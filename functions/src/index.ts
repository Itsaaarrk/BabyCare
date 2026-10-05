import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import {
  INVITE_TTL_MS,
  JOIN_ATTEMPT_WINDOW_MS,
  MAX_FAILED_JOIN_ATTEMPTS,
  MAX_MEMBERS_PER_ROOM,
  MAX_ROOMS_PER_USER,
  canInviteAs,
  generateJoinCode,
  isAssignableRole,
  isRole,
  normalizeJoinCode,
  type AssignableRole,
  type Role,
} from './logic.js';

// Same region as the Realtime Database, so each database round trip inside a function stays local.
// Keep in step with EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION (src/lib/env.ts).
const REGION = 'asia-southeast1';
setGlobalOptions({ region: REGION });

// The Admin SDK can only guess the URL of a database in the US. For one in another region the guess
// is wrong and every database call hangs until the function times out, so spell the URL out when
// deployed. The emulators supply their own.
const projectId = process.env.GCLOUD_PROJECT;
const databaseURL =
  process.env.FUNCTIONS_EMULATOR === 'true' || !projectId
    ? undefined
    : `https://${projectId}-default-rtdb.${REGION}.firebasedatabase.app`;
initializeApp(databaseURL ? { databaseURL } : undefined);

// Looked up on first use, not at import time. The Firebase CLI loads this file to discover the
// functions before any project config exists, and getDatabase() throws without a database URL.
const db = { ref: (path?: string) => getDatabase().ref(path) };

// Everything that changes who belongs to a room goes through here, so the Realtime Database
// and Storage rules can stay closed to client-side membership writes.

type Reason =
  | 'invalid-code'
  | 'invite-expired'
  | 'too-many-attempts'
  | 'room-full'
  | 'not-allowed'
  | 'invalid-input'
  | 'room-limit'
  | 'not-found';

const fail = (
  code: ConstructorParameters<typeof HttpsError>[0],
  reason: Reason,
  message: string,
): never => {
  throw new HttpsError(code, message, { reason });
};

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) return fail('unauthenticated', 'not-allowed', 'Sign in first.');
  return uid;
}

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    return fail('invalid-argument', 'invalid-input', `Invalid ${field}.`);
  }
  return value.trim();
}

const requireId = (value: unknown, field: string) => {
  // Realtime Database keys can't contain . $ # [ ] / so this also blocks path injection.
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    return fail('invalid-argument', 'invalid-input', `Invalid ${field}.`);
  }
  return value;
};

async function getRole(roomId: string, uid: string): Promise<Role | null> {
  const snap = await db.ref(`rooms/${roomId}/members/${uid}/role`).get();
  const role: unknown = snap.val();
  return isRole(role) ? role : null;
}

async function requireRole(roomId: string, uid: string, allowed: readonly Role[]): Promise<Role> {
  const role = await getRole(roomId, uid);
  // Same answer for "no such room" and "not your room" so rooms can't be probed.
  if (!role || !allowed.includes(role)) return fail('permission-denied', 'not-allowed', 'Not allowed.');
  return role;
}

/**
 * Rebuilds a user's `rooms` custom claim ({roomId: role}) from the database, which stays the
 * source of truth. Storage rules read this claim, because they cannot read the database.
 * The client must refresh its ID token to see the change.
 */
async function syncClaims(uid: string): Promise<void> {
  const auth = getAuth();
  const indexSnap = await db.ref(`userRooms/${uid}`).get();
  const roomIds = Object.keys((indexSnap.val() as Record<string, unknown> | null) ?? {});
  const rooms: Record<string, Role> = {};
  await Promise.all(
    roomIds.map(async (roomId) => {
      const role = await getRole(roomId, uid);
      if (role) rooms[roomId] = role;
    }),
  );
  try {
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...user.customClaims, rooms });
  } catch (error) {
    // The user may have been deleted; nothing left to sync.
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
}

async function displayNameOf(uid: string): Promise<string> {
  try {
    return (await getAuth().getUser(uid)).displayName?.trim().slice(0, 60) || 'Family member';
  } catch {
    return 'Family member';
  }
}

interface Invite {
  code: string;
  role: AssignableRole;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
}

/** Replaces the room's invite with a fresh code. */
async function issueInvite(roomId: string, role: AssignableRole, createdBy: string): Promise<Invite> {
  let code = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateJoinCode();
    const result = await db
      .ref(`roomJoinCodes/${candidate}`)
      .transaction((current) => (current === null ? { roomId } : undefined));
    if (result.committed) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new HttpsError('internal', 'Could not generate a code.');

  const previous = (await db.ref(`roomInvites/${roomId}/code`).get()).val() as string | null;
  const now = Date.now();
  const invite: Invite = { code, role, createdBy, createdAt: now, expiresAt: now + INVITE_TTL_MS };
  await db.ref(`roomInvites/${roomId}`).set(invite);
  if (previous) await db.ref(`roomJoinCodes/${previous}`).remove();
  return invite;
}

async function assertJoinAllowed(uid: string): Promise<void> {
  const snap = await db.ref(`joinAttempts/${uid}`).get();
  const record = snap.val() as { count: number; windowStart: number } | null;
  if (
    record &&
    Date.now() - record.windowStart < JOIN_ATTEMPT_WINDOW_MS &&
    record.count >= MAX_FAILED_JOIN_ATTEMPTS
  ) {
    fail('resource-exhausted', 'too-many-attempts', 'Too many attempts. Try again later.');
  }
}

async function recordFailedJoin(uid: string): Promise<void> {
  await db.ref(`joinAttempts/${uid}`).transaction((current: { count: number; windowStart: number } | null) => {
    const now = Date.now();
    if (!current || now - current.windowStart >= JOIN_ATTEMPT_WINDOW_MS) return { count: 1, windowStart: now };
    return { count: current.count + 1, windowStart: current.windowStart };
  });
}

/** Resolves a code to its room, counting failures toward the caller's rate limit. */
async function resolveInvite(uid: string, rawCode: unknown): Promise<{ roomId: string; invite: Invite }> {
  await assertJoinAllowed(uid);
  const code = normalizeJoinCode(rawCode);
  const roomId = code ? ((await db.ref(`roomJoinCodes/${code}/roomId`).get()).val() as string | null) : null;
  const invite = roomId ? ((await db.ref(`roomInvites/${roomId}`).get()).val() as Invite | null) : null;

  if (!code || !roomId || !invite || invite.code !== code) {
    await recordFailedJoin(uid);
    return fail('not-found', 'invalid-code', 'That code isn’t valid.');
  }
  if (invite.expiresAt < Date.now()) {
    return fail('failed-precondition', 'invite-expired', 'That invitation has expired.');
  }
  return { roomId, invite };
}

export const createRoom = onCall(async (request) => {
  const uid = requireUid(request);
  const name = requireString(request.data?.name, 'room name', 80);

  const existing = Object.keys(((await db.ref(`userRooms/${uid}`).get()).val() as object | null) ?? {});
  if (existing.length >= MAX_ROOMS_PER_USER) fail('resource-exhausted', 'room-limit', 'Room limit reached.');

  const roomId = db.ref('rooms').push().key as string;
  const ownerName = await displayNameOf(uid);
  const now = Date.now();
  await db.ref().update({
    [`rooms/${roomId}/info`]: { name, ownerId: uid, ownerName, createdAt: now },
    [`rooms/${roomId}/members/${uid}`]: { role: 'owner', displayName: ownerName, joinedAt: now },
    [`userRooms/${uid}/${roomId}`]: true,
  });
  const invite = await issueInvite(roomId, 'caregiver', uid);
  await syncClaims(uid);
  return { roomId, invite };
});

export const regenerateInvite = onCall(async (request) => {
  const uid = requireUid(request);
  const roomId = requireId(request.data?.roomId, 'room');
  const role: unknown = request.data?.role ?? 'caregiver';
  if (!isAssignableRole(role)) return fail('invalid-argument', 'invalid-input', 'Invalid role.');

  const inviterRole = await requireRole(roomId, uid, ['owner', 'parent']);
  if (!canInviteAs(inviterRole, role)) return fail('permission-denied', 'not-allowed', 'Not allowed.');
  return { invite: await issueInvite(roomId, role, uid) };
});

export const revokeInvite = onCall(async (request) => {
  const uid = requireUid(request);
  const roomId = requireId(request.data?.roomId, 'room');
  await requireRole(roomId, uid, ['owner', 'parent']);
  const code = (await db.ref(`roomInvites/${roomId}/code`).get()).val() as string | null;
  await db.ref().update({
    [`roomInvites/${roomId}`]: null,
    ...(code ? { [`roomJoinCodes/${code}`]: null } : {}),
  });
  return { ok: true };
});

/** Lets someone see what they're about to join, without joining. */
export const previewRoom = onCall(async (request) => {
  const uid = requireUid(request);
  const { roomId, invite } = await resolveInvite(uid, request.data?.code);
  const [infoSnap, babiesSnap, myRole] = await Promise.all([
    db.ref(`rooms/${roomId}/info`).get(),
    db.ref(`rooms/${roomId}/babies`).get(),
    getRole(roomId, uid),
  ]);
  const info = infoSnap.val() as { name?: string; ownerName?: string } | null;
  const babies = Object.values((babiesSnap.val() as Record<string, { name?: string }> | null) ?? {});
  return {
    roomName: info?.name ?? 'Family room',
    ownerName: info?.ownerName ?? '',
    babyNames: babies.map((b) => b.name).filter((n): n is string => typeof n === 'string'),
    role: invite.role,
    alreadyMember: myRole !== null,
  };
});

export const joinRoom = onCall(async (request) => {
  const uid = requireUid(request);
  const { roomId, invite } = await resolveInvite(uid, request.data?.code);

  const existingRole = await getRole(roomId, uid);
  if (existingRole) return { roomId, role: existingRole };

  const members = (await db.ref(`rooms/${roomId}/members`).get()).val() as object | null;
  if (Object.keys(members ?? {}).length >= MAX_MEMBERS_PER_ROOM) {
    fail('resource-exhausted', 'room-full', 'This room is full.');
  }

  const displayName = await displayNameOf(uid);
  await db.ref().update({
    [`rooms/${roomId}/members/${uid}`]: { role: invite.role, displayName, joinedAt: Date.now() },
    [`userRooms/${uid}/${roomId}`]: true,
  });
  await syncClaims(uid);
  return { roomId, role: invite.role };
});

export const setMemberRole = onCall(async (request) => {
  const uid = requireUid(request);
  const roomId = requireId(request.data?.roomId, 'room');
  const memberId = requireId(request.data?.memberId, 'member');
  const role: unknown = request.data?.role;
  if (!isAssignableRole(role)) return fail('invalid-argument', 'invalid-input', 'Invalid role.');

  await requireRole(roomId, uid, ['owner']);
  const targetRole = await getRole(roomId, memberId);
  if (!targetRole) return fail('not-found', 'not-found', 'Member not found.');
  // There is exactly one owner and ownership can't be transferred or demoted here.
  if (targetRole === 'owner') return fail('failed-precondition', 'not-allowed', 'The owner’s role can’t be changed.');

  await db.ref(`rooms/${roomId}/members/${memberId}/role`).set(role);
  await syncClaims(memberId);
  return { ok: true };
});

/** The owner removes someone, or a non-owner member removes themselves (leaving). */
export const removeMember = onCall(async (request) => {
  const uid = requireUid(request);
  const roomId = requireId(request.data?.roomId, 'room');
  const memberId = requireId(request.data?.memberId, 'member');

  const callerRole = await requireRole(roomId, uid, ['owner', 'parent', 'caregiver', 'viewer']);
  const leaving = memberId === uid;
  if (leaving ? callerRole === 'owner' : callerRole !== 'owner') {
    return fail('permission-denied', 'not-allowed', 'Not allowed.');
  }
  const targetRole = await getRole(roomId, memberId);
  if (!targetRole) return fail('not-found', 'not-found', 'Member not found.');
  if (targetRole === 'owner') return fail('failed-precondition', 'not-allowed', 'The owner can’t be removed.');

  await db.ref().update({
    [`rooms/${roomId}/members/${memberId}`]: null,
    [`userRooms/${memberId}/${roomId}`]: null,
  });
  await syncClaims(memberId);
  return { ok: true };
});

export const deleteRoom = onCall(async (request) => {
  const uid = requireUid(request);
  const roomId = requireId(request.data?.roomId, 'room');
  await requireRole(roomId, uid, ['owner']);

  const memberIds = Object.keys(
    ((await db.ref(`rooms/${roomId}/members`).get()).val() as object | null) ?? {},
  );
  const code = (await db.ref(`roomInvites/${roomId}/code`).get()).val() as string | null;

  const removals: Record<string, null> = {
    [`rooms/${roomId}`]: null,
    [`roomInvites/${roomId}`]: null,
  };
  if (code) removals[`roomJoinCodes/${code}`] = null;
  for (const memberId of memberIds) removals[`userRooms/${memberId}/${roomId}`] = null;
  await db.ref().update(removals);

  await Promise.all(memberIds.map(syncClaims));
  try {
    await getStorage().bucket().deleteFiles({ prefix: `rooms/${roomId}/` });
  } catch {
    // Orphaned files are unreachable without a claim for this room; don't fail the delete.
  }
  return { ok: true };
});
