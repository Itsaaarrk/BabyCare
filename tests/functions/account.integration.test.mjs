// Run with: npm run test:functions
// Deleting an account, against real functions, rules and the Auth emulator.
import { signInWithEmailAndPassword } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { adminExists, denied, loadRules, newUser, reasonOf } from './helpers.mjs';

before(loadRules);

const baby = { name: 'Sofia', birthDate: '2026-09-22' };

/** An owner with a room and a baby, plus a parent who has joined. */
async function family() {
  const ana = await newUser('ana');
  const { roomId } = await ana.call('createRoom', { name: "Sofia's Family" });
  const { babyId } = await ana.call('addBaby', { roomId, baby });
  const dad = await newUser('dad');
  const { invite } = await ana.call('regenerateInvite', { roomId, role: 'parent' });
  await dad.call('joinRoom', { code: invite.code });
  return { ana, dad, roomId, babyId };
}

/** What a member keeps in the database for themselves. */
async function saveProfile(user) {
  await set(ref(user.db, `users/${user.uid}`), { displayName: 'Dad', createdAt: Date.now() });
  await set(ref(user.db, `userSettings/${user.uid}`), { updatedAt: Date.now(), shakeToLog: true });
}

const exists = async (user, path) => (await get(ref(user.db, path))).exists();

describe('deleteAccount', () => {
  it('removes the person, their settings and their sign-in, and leaves their rooms', async () => {
    const { ana, dad, roomId } = await family();
    await saveProfile(dad);
    assert.equal(await exists(dad, `users/${dad.uid}`), true);

    assert.deepEqual(await dad.call('deleteAccount', {}), { ok: true });

    // Their own data is gone ...
    assert.equal(await adminExists(`users/${dad.uid}`), false);
    assert.equal(await adminExists(`userSettings/${dad.uid}`), false);
    // ... they are no longer a member ...
    assert.equal(await ana.read(`rooms/${roomId}/members/${dad.uid}`), null);
    // ... and they can't sign in any more.
    await assert.rejects(signInWithEmailAndPassword(dad.auth, dad.email, 'password123'), /user-not-found|invalid-credential/);
  });

  it('keeps the family’s records, including what the person logged', async () => {
    const { ana, dad, roomId, babyId } = await family();
    const now = Date.now();
    await set(ref(dad.db, `rooms/${roomId}/babies/${babyId}/activities/a1`), {
      type: 'diaper',
      startedAt: now - 60_000,
      details: { diaperType: 'pee' },
      createdBy: dad.uid,
      createdByName: 'Dad',
      createdAt: now,
      updatedAt: now,
    });

    await dad.call('deleteAccount', {});

    assert.equal((await ana.read(`rooms/${roomId}/babies/${babyId}/name`)), 'Sofia');
    const entry = await ana.read(`rooms/${roomId}/babies/${babyId}/activities/a1`);
    assert.equal(entry.type, 'diaper');
    assert.equal(entry.createdByName, 'Dad');
    const members = await ana.read(`rooms/${roomId}/members`);
    assert.deepEqual(Object.keys(members), [ana.uid]);
  });

  it('cuts off access to the room straight away, even while their token is still valid', async () => {
    const { ana, dad, roomId } = await family();
    assert.ok(await exists(dad, `rooms/${roomId}/info`));
    await dad.call('deleteAccount', {});
    // Their token lives on for a while after the account is deleted; membership is what stops them.
    await denied(get(ref(dad.db, `rooms/${roomId}/info`)));
    // Everyone else is unaffected.
    assert.equal((await ana.read(`rooms/${roomId}/info`)).ownerId, ana.uid);
  });

  it('refuses a room owner and changes nothing', async () => {
    const { ana, roomId, babyId } = await family();
    assert.equal((await reasonOf(ana.call('deleteAccount', {}))).reason, 'owns-room');
    assert.equal((await ana.read(`rooms/${roomId}/babies/${babyId}/name`)), 'Sofia');
    assert.equal((await ana.read(`rooms/${roomId}/members/${ana.uid}`)).role, 'owner');
    // They can still use the app: the account is intact.
    assert.ok((await signInWithEmailAndPassword(ana.auth, ana.email, 'password123')).user.uid);
  });

  it('lets a former owner delete their account once the room is deleted', async () => {
    const { ana, dad, roomId } = await family();
    await ana.call('deleteRoom', { roomId });
    assert.deepEqual(await ana.call('deleteAccount', {}), { ok: true });
    await assert.rejects(signInWithEmailAndPassword(ana.auth, ana.email, 'password123'), /user-not-found|invalid-credential/);
    // The parent's account is untouched and simply has no room any more.
    assert.equal(await adminExists(`userRooms/${dad.uid}/${roomId}`), false);
  });

  it('works for someone who belongs to no room at all', async () => {
    const loner = await newUser('loner');
    assert.deepEqual(await loner.call('deleteAccount', {}), { ok: true });
  });

  it('cannot be used to delete someone else’s account', async () => {
    const { ana, dad } = await family();
    // The only input is the caller's own identity; passing another uid has no effect.
    await dad.call('deleteAccount', { uid: ana.uid, userId: ana.uid });
    assert.ok((await signInWithEmailAndPassword(ana.auth, ana.email, 'password123')).user.uid);
  });

  it('has no effect on other people’s data nodes', async () => {
    const { ana, dad } = await family();
    await saveProfile(ana);
    await dad.call('deleteAccount', {});
    assert.equal(await exists(ana, `users/${ana.uid}`), true);
    assert.equal(await exists(ana, `userSettings/${ana.uid}`), true);
    // And clients still cannot read other people's profiles.
    await denied(get(ref(ana.db, `users/${dad.uid}`)));
  });
});
