import { onValue, ref, type Unsubscribe } from 'firebase/database';

import { getFirebaseDatabase } from '@/lib/firebase';
import { can } from '@/lib/permissions';
import type { BabyRecord, RoomInfo, RoomInvite, RoomMember, RoomRole } from '@/types/baby';

const ROLES: readonly string[] = ['owner', 'parent', 'caregiver', 'viewer'];

/** Receives live data for every room the user belongs to. */
export interface RoomSink {
  setRoomIds(ids: string[]): void;
  setInfo(roomId: string, info: RoomInfo | null): void;
  setRole(roomId: string, role: RoomRole | null): void;
  setBabies(roomId: string, babies: Record<string, BabyRecord>): void;
  setMembers(roomId: string, members: RoomMember[]): void;
  /** `null` when there is no active invitation, or the user can't see it. */
  setInvite(roomId: string, invite: RoomInvite | null): void;
  /** The room can't be read (removed, or the user was removed from it). */
  roomUnavailable(roomId: string): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isRole = (v: unknown): v is RoomRole => typeof v === 'string' && ROLES.includes(v);

function parseInfo(value: unknown): RoomInfo | null {
  if (!isObject(value)) return null;
  const { name, ownerId, ownerName, createdAt } = value;
  if (typeof name !== 'string' || typeof ownerId !== 'string') return null;
  return {
    name,
    ownerId,
    ownerName: typeof ownerName === 'string' ? ownerName : '',
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
  };
}

function parseBabies(value: unknown): Record<string, BabyRecord> {
  const result: Record<string, BabyRecord> = {};
  if (!isObject(value)) return result;
  for (const [id, raw] of Object.entries(value)) {
    if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.birthDate !== 'string') continue;
    result[id] = raw as unknown as BabyRecord;
  }
  return result;
}

function parseMembers(value: unknown): RoomMember[] {
  if (!isObject(value)) return [];
  const members: RoomMember[] = [];
  for (const [uid, raw] of Object.entries(value)) {
    if (!isObject(raw) || !isRole(raw.role)) continue;
    members.push({
      uid,
      role: raw.role,
      displayName: typeof raw.displayName === 'string' ? raw.displayName : 'Family member',
      joinedAt: typeof raw.joinedAt === 'number' ? raw.joinedAt : 0,
    });
  }
  return members;
}

function parseInvite(value: unknown): RoomInvite | null {
  if (!isObject(value) || typeof value.code !== 'string' || !isRole(value.role) || value.role === 'owner') {
    return null;
  }
  return {
    code: value.code,
    role: value.role,
    createdBy: typeof value.createdBy === 'string' ? value.createdBy : '',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
    expiresAt: typeof value.expiresAt === 'number' ? value.expiresAt : 0,
  };
}

/**
 * Listens to the user's room index, then to each room's info, members, own role and babies
 * (plus the invitation, for roles allowed to see it). Listeners are scoped narrowly on purpose
 * so later activity data is never pulled in here.
 */
export function subscribeToUserRooms(uid: string, sink: RoomSink): Unsubscribe {
  const db = getFirebaseDatabase();
  const roomListeners = new Map<string, Unsubscribe[]>();
  const inviteListeners = new Map<string, Unsubscribe>();

  const stopInvite = (roomId: string) => {
    inviteListeners.get(roomId)?.();
    inviteListeners.delete(roomId);
  };

  const detach = (roomId: string) => {
    roomListeners.get(roomId)?.forEach((off) => off());
    roomListeners.delete(roomId);
    stopInvite(roomId);
  };

  /** Only owners and parents may read the invitation; others would get a permission error. */
  const syncInviteListener = (roomId: string, role: RoomRole | null) => {
    const wanted = can(role ?? undefined, 'invite');
    if (!wanted) {
      stopInvite(roomId);
      sink.setInvite(roomId, null);
    } else if (!inviteListeners.has(roomId)) {
      inviteListeners.set(
        roomId,
        onValue(
          ref(db, `roomInvites/${roomId}`),
          (s) => sink.setInvite(roomId, parseInvite(s.val())),
          () => sink.setInvite(roomId, null),
        ),
      );
    }
  };

  const attach = (roomId: string) => {
    const fail = () => {
      detach(roomId);
      sink.roomUnavailable(roomId);
    };
    roomListeners.set(roomId, [
      onValue(ref(db, `rooms/${roomId}/info`), (s) => sink.setInfo(roomId, parseInfo(s.val())), fail),
      onValue(
        ref(db, `rooms/${roomId}/members/${uid}/role`),
        (s) => {
          const role = isRole(s.val()) ? (s.val() as RoomRole) : null;
          sink.setRole(roomId, role);
          syncInviteListener(roomId, role);
        },
        fail,
      ),
      onValue(ref(db, `rooms/${roomId}/members`), (s) => sink.setMembers(roomId, parseMembers(s.val())), fail),
      onValue(ref(db, `rooms/${roomId}/babies`), (s) => sink.setBabies(roomId, parseBabies(s.val())), fail),
    ]);
  };

  const offIndex = onValue(
    ref(db, `userRooms/${uid}`),
    (snapshot) => {
      const ids = isObject(snapshot.val()) ? Object.keys(snapshot.val() as object) : [];
      for (const id of [...roomListeners.keys()]) if (!ids.includes(id)) detach(id);
      for (const id of ids) if (!roomListeners.has(id)) attach(id);
      sink.setRoomIds(ids);
    },
    () => sink.setRoomIds([]),
  );

  return () => {
    offIndex();
    [...roomListeners.keys()].forEach(detach);
  };
}
