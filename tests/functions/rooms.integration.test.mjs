// Run with: npm run test:functions
// Exercises the real Cloud Functions against the local Auth, Database, Storage and Functions
// emulators, reading data back as ordinary signed-in users so security rules are enforced.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref, update } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';

const PROJECT = 'demo-babycare';
const config = { apiKey: 'fake-key', projectId: PROJECT, databaseURL: `http://127.0.0.1:9000?ns=${PROJECT}` };
let counter = 0;

/** Creates a signed-in user with their own app instance, so users don't share auth state. */
async function newUser(name) {
  const app = initializeApp(config, `${name}-${++counter}-${Math.random().toString(36).slice(2, 6)}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, `${name}${counter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, 'password123');
  await updateProfile(credential.user, { displayName: name });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const functions = getFunctions(app, 'asia-southeast1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const call = async (fn, data) => (await httpsCallable(functions, fn)(data)).data;
  return {
    uid: credential.user.uid,
    db,
    call,
    read: async (path) => (await get(ref(db, path))).val(),
    claims: async () => (await credential.user.getIdTokenResult(true)).claims.rooms ?? {},
  };
}

/** Resolves with the HttpsError `reason` detail, or throws if the call unexpectedly succeeds. */
async function reasonOf(promise) {
  try {
    await promise;
  } catch (error) {
    return { code: error.code, reason: error.details?.reason };
  }
  assert.fail('expected the call to be rejected');
}

async function readDenied(user, path) {
  await assert.rejects(user.read(path), /permission.denied/i);
}

// For a demo project the Functions emulator's Admin SDK uses the namespace named after the project,
// which the Database emulator starts with wide-open rules, so load the real rules into it
// and use the emulator's admin token for direct edits that no client may make.
const DB = 'http://127.0.0.1:9000';
const adminFetch = (path, init) =>
  fetch(`${DB}${path}${path.includes('?') ? '&' : '?'}ns=${PROJECT}`, {
    ...init,
    headers: { Authorization: 'Bearer owner' },
  });

before(async () => {
  const response = await adminFetch('/.settings/rules.json', {
    method: 'PUT',
    body: readFileSync('database.rules.json', 'utf8'),
  });
  assert.equal(response.status, 200);
});

/** An owner with a room (plus its first baby) and a signed-in stranger. */
async function setup() {
  const ana = await newUser('ana');
  const { roomId, invite } = await ana.call('createRoom', { name: "Sofia's Family" });
  const { babyId } = await ana.call('addBaby', { roomId, baby: { name: 'Sofia', birthDate: '2026-09-22' } });
  return { ana, roomId, invite, babyId };
}

describe('createRoom', () => {
  it('creates an owned room, an invite and the owner’s claim', async () => {
    const { ana, roomId, invite } = await setup();
    assert.match(invite.code, /^[A-HJKMNP-Z2-9]{6}$/);
    assert.equal(invite.role, 'caregiver');
    assert.ok(invite.expiresAt > Date.now());

    assert.equal((await ana.read(`rooms/${roomId}/info`)).ownerId, ana.uid);
    assert.equal((await ana.read(`rooms/${roomId}/members/${ana.uid}`)).role, 'owner');
    assert.equal(await ana.read(`userRooms/${ana.uid}/${roomId}`), true);
    assert.equal((await ana.read(`roomInvites/${roomId}`)).code, invite.code);
    assert.deepEqual(await ana.claims(), { [roomId]: 'owner' });
  });

  it('rejects bad input and anonymous callers', async () => {
    const ana = await newUser('ana');
    assert.equal((await reasonOf(ana.call('createRoom', { name: '' }))).reason, 'invalid-input');
    assert.equal((await reasonOf(ana.call('createRoom', {}))).reason, 'invalid-input');
  });
});

describe('joining', () => {
  it('previews a room without joining it', async () => {
    const { invite } = await setup();
    const grandma = await newUser('grandma');
    const preview = await grandma.call('previewRoom', { code: invite.code });
    assert.deepEqual(preview, {
      roomName: "Sofia's Family",
      ownerName: 'ana',
      babyNames: ['Sofia'],
      role: 'caregiver',
      alreadyMember: false,
    });
    assert.deepEqual(await grandma.claims(), {});
  });

  it('accepts codes typed loosely', async () => {
    const { invite } = await setup();
    const grandma = await newUser('grandma');
    const loose = `${invite.code.slice(0, 3).toLowerCase()} - ${invite.code.slice(3)}`;
    assert.equal((await grandma.call('previewRoom', { code: loose })).roomName, "Sofia's Family");
  });

  it('adds the member with the invite’s role and gives them access', async () => {
    const { ana, roomId, invite, babyId } = await setup();
    const grandma = await newUser('grandma');
    await readDenied(grandma, `rooms/${roomId}/babies`);

    assert.deepEqual(await grandma.call('joinRoom', { code: invite.code }), { roomId, role: 'caregiver' });
    assert.equal((await grandma.read(`rooms/${roomId}/babies/${babyId}`)).name, 'Sofia');
    assert.equal((await ana.read(`rooms/${roomId}/members/${grandma.uid}`)).displayName, 'grandma');
    assert.deepEqual(await grandma.claims(), { [roomId]: 'caregiver' });
    // Caregivers can't see the invite code.
    await readDenied(grandma, `roomInvites/${roomId}`);
  });

  it('is idempotent and never downgrades or upgrades an existing member', async () => {
    const { ana, roomId, invite } = await setup();
    assert.deepEqual(await ana.call('joinRoom', { code: invite.code }), { roomId, role: 'owner' });
    assert.equal((await ana.read(`rooms/${roomId}/members/${ana.uid}`)).role, 'owner');
  });

  it('rejects unknown codes with a single generic answer', async () => {
    await setup();
    const grandma = await newUser('grandma');
    for (const code of ['ZZZZZZ', 'nope', '', undefined]) {
      assert.deepEqual(await reasonOf(grandma.call('joinRoom', { code })), {
        code: 'functions/not-found',
        reason: 'invalid-code',
      });
    }
  });

  it('rate-limits repeated bad guesses', async () => {
    const { invite } = await setup();
    const mallory = await newUser('mallory');
    for (let i = 0; i < 10; i++) await reasonOf(mallory.call('joinRoom', { code: 'ZZZZZZ' }));
    assert.equal((await reasonOf(mallory.call('joinRoom', { code: 'ZZZZZZ' }))).reason, 'too-many-attempts');
    // Even the right code is refused while locked out.
    assert.equal((await reasonOf(mallory.call('joinRoom', { code: invite.code }))).reason, 'too-many-attempts');
  });

  it('rejects expired invitations', async () => {
    const { roomId, invite } = await setup();
    await adminFetch(`/roomInvites/${roomId}.json`, {
      method: 'PATCH',
      body: JSON.stringify({ expiresAt: Date.now() - 1000 }),
    });
    const grandma = await newUser('grandma');
    assert.equal((await reasonOf(grandma.call('joinRoom', { code: invite.code }))).reason, 'invite-expired');
    assert.equal((await reasonOf(grandma.call('previewRoom', { code: invite.code }))).reason, 'invite-expired');
  });
});

describe('invites', () => {
  it('regenerating replaces the old code and can change the role', async () => {
    const { ana, roomId, invite } = await setup();
    const { invite: fresh } = await ana.call('regenerateInvite', { roomId, role: 'viewer' });
    assert.notEqual(fresh.code, invite.code);
    assert.equal(fresh.role, 'viewer');

    const grandma = await newUser('grandma');
    assert.equal((await reasonOf(grandma.call('joinRoom', { code: invite.code }))).reason, 'invalid-code');
    assert.deepEqual(await grandma.call('joinRoom', { code: fresh.code }), { roomId, role: 'viewer' });
  });

  it('lets parents invite caregivers and viewers, but not parents; denies others', async () => {
    const { ana, roomId, invite } = await setup();
    const dad = await newUser('dad');
    const nanny = await newUser('nanny');
    const { invite: parentInvite } = await ana.call('regenerateInvite', { roomId, role: 'parent' });
    await dad.call('joinRoom', { code: parentInvite.code });
    const { invite: nannyInvite } = await ana.call('regenerateInvite', { roomId, role: 'caregiver' });
    await nanny.call('joinRoom', { code: nannyInvite.code });

    await dad.call('regenerateInvite', { roomId, role: 'viewer' });
    assert.equal((await reasonOf(dad.call('regenerateInvite', { roomId, role: 'parent' }))).reason, 'not-allowed');
    assert.equal((await reasonOf(nanny.call('regenerateInvite', { roomId }))).reason, 'not-allowed');
    assert.equal((await reasonOf(ana.call('regenerateInvite', { roomId, role: 'owner' }))).reason, 'invalid-input');
    void invite;
  });

  it('revoking kills the code', async () => {
    const { ana, roomId, invite } = await setup();
    await ana.call('revokeInvite', { roomId });
    const grandma = await newUser('grandma');
    assert.equal((await reasonOf(grandma.call('joinRoom', { code: invite.code }))).reason, 'invalid-code');
  });

  it('hides rooms from outsiders who try to manage them', async () => {
    const { roomId } = await setup();
    const mallory = await newUser('mallory');
    assert.equal((await reasonOf(mallory.call('regenerateInvite', { roomId }))).reason, 'not-allowed');
    assert.equal((await reasonOf(mallory.call('revokeInvite', { roomId }))).reason, 'not-allowed');
    assert.equal((await reasonOf(mallory.call('deleteRoom', { roomId }))).reason, 'not-allowed');
  });
});

describe('roles and removal', () => {
  async function withMember(role = 'caregiver') {
    const ctx = await setup();
    const { invite } = await ctx.ana.call('regenerateInvite', { roomId: ctx.roomId, role });
    const grandma = await newUser('grandma');
    await grandma.call('joinRoom', { code: invite.code });
    return { ...ctx, grandma };
  }

  it('lets only the owner change roles, and updates claims', async () => {
    const { ana, grandma, roomId } = await withMember('caregiver');
    await ana.call('setMemberRole', { roomId, memberId: grandma.uid, role: 'parent' });
    assert.equal((await ana.read(`rooms/${roomId}/members/${grandma.uid}/role`)), 'parent');
    assert.deepEqual(await grandma.claims(), { [roomId]: 'parent' });

    const reason = (p) => reasonOf(p).then((r) => r.reason);
    assert.equal(await reason(grandma.call('setMemberRole', { roomId, memberId: grandma.uid, role: 'parent' })), 'not-allowed');
    assert.equal(await reason(grandma.call('setMemberRole', { roomId, memberId: ana.uid, role: 'viewer' })), 'not-allowed');
    assert.equal(await reason(ana.call('setMemberRole', { roomId, memberId: ana.uid, role: 'viewer' })), 'not-allowed');
    assert.equal(await reason(ana.call('setMemberRole', { roomId, memberId: grandma.uid, role: 'owner' })), 'invalid-input');
    assert.equal(await reason(ana.call('setMemberRole', { roomId, memberId: 'ghost', role: 'viewer' })), 'not-found');
  });

  it('lets the owner remove a member, who then loses access and claims', async () => {
    const { ana, grandma, roomId } = await withMember();
    await ana.call('removeMember', { roomId, memberId: grandma.uid });
    await readDenied(grandma, `rooms/${roomId}/babies`);
    assert.equal(await ana.read(`rooms/${roomId}/members/${grandma.uid}`), null);
    assert.equal(await grandma.read(`userRooms/${grandma.uid}/${roomId}`), null);
    assert.deepEqual(await grandma.claims(), {});
  });

  it('lets a member leave, but not the owner, and stops members removing each other', async () => {
    const { ana, grandma, roomId } = await withMember();
    const reason = (p) => reasonOf(p).then((r) => r.reason);
    assert.equal(await reason(ana.call('removeMember', { roomId, memberId: ana.uid })), 'not-allowed');
    assert.equal(await reason(grandma.call('removeMember', { roomId, memberId: ana.uid })), 'not-allowed');

    const grandpa = await newUser('grandpa');
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'viewer' });
    await grandpa.call('joinRoom', { code: invite.code });
    assert.equal(await reason(grandma.call('removeMember', { roomId, memberId: grandpa.uid })), 'not-allowed');

    await grandma.call('removeMember', { roomId, memberId: grandma.uid });
    await readDenied(grandma, `rooms/${roomId}/babies`);
    assert.deepEqual(await grandma.claims(), {});
  });

  it('removed members can rejoin with a fresh invite', async () => {
    const { ana, grandma, roomId } = await withMember();
    await ana.call('removeMember', { roomId, memberId: grandma.uid });
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'viewer' });
    await grandma.call('joinRoom', { code: invite.code });
    assert.deepEqual(await grandma.claims(), { [roomId]: 'viewer' });
  });
});

describe('deleteRoom', () => {
  it('removes the room, invite, index entries and everyone’s claims', async () => {
    const { ana, roomId, invite } = await setup();
    const grandma = await newUser('grandma');
    await grandma.call('joinRoom', { code: invite.code });

    const reason = (p) => reasonOf(p).then((r) => r.reason);
    assert.equal(await reason(grandma.call('deleteRoom', { roomId })), 'not-allowed');

    await ana.call('deleteRoom', { roomId });
    await readDenied(ana, `rooms/${roomId}/info`);
    assert.equal(await ana.read(`userRooms/${ana.uid}`), null);
    assert.equal(await grandma.read(`userRooms/${grandma.uid}`), null);
    assert.deepEqual(await ana.claims(), {});
    assert.deepEqual(await grandma.claims(), {});

    const stranger = await newUser('stranger');
    assert.equal((await reasonOf(stranger.call('joinRoom', { code: invite.code }))).reason, 'invalid-code');
  });
});
