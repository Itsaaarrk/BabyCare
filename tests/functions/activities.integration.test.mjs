// Run with: npm run test:functions
// Activities end to end: real users, real functions, real security rules, live listeners.
import {
  endAt,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  remove,
  set,
  startAt,
  update,
} from 'firebase/database';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { denied, loadRules, newUser } from './helpers.mjs';

before(loadRules);

const MIN = 60_000;
// JSON round-trip drops `undefined` fields, which the SDK refuses to write.
const activity = (user, over = {}) =>
  JSON.parse(
    JSON.stringify({
  type: 'feeding',
  startedAt: Date.now() - 30 * MIN,
  details: { feedingType: 'breast', side: 'left' },
  createdBy: user.uid,
  createdByName: 'x',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...over,
    }),
  );

/** A room owned by ana with a baby, plus members of each role. */
async function family() {
  const ana = await newUser('ana');
  const { roomId } = await ana.call('createRoom', { name: "Sofia's Family" });
  const { babyId } = await ana.call('addBaby', { roomId, baby: { name: 'Sofia', birthDate: '2026-09-22' } });

  const members = {};
  for (const role of ['parent', 'caregiver', 'viewer']) {
    const user = await newUser(role);
    const { invite } = await ana.call('regenerateInvite', { roomId, role });
    await user.call('joinRoom', { code: invite.code });
    members[role] = user;
  }
  const at = (id) => `rooms/${roomId}/babies/${babyId}/activities/${id}`;
  return { ana, ...members, roomId, babyId, at };
}

describe('logging activities', () => {
  it('lets owners, parents and caregivers log, but not viewers', async () => {
    const f = await family();
    for (const [name, user] of [['a', f.ana], ['p', f.parent], ['c', f.caregiver]]) {
      await set(ref(user.db, f.at(name)), activity(user));
    }
    await denied(set(ref(f.viewer.db, f.at('v')), activity(f.viewer)));
    assert.equal(Object.keys(await f.viewer.read(f.at(''))).length, 3);
  });

  it('shows a new activity to other family members live', async () => {
    const f = await family();
    const seen = new Promise((resolve) => {
      const off = onValue(ref(f.viewer.db, f.at('live1')), (snapshot) => {
        if (snapshot.exists()) {
          off();
          resolve(snapshot.val());
        }
      });
    });
    await set(ref(f.parent.db, f.at('live1')), activity(f.parent, { type: 'diaper', details: { diaperType: 'both' } }));
    const value = await Promise.race([seen, new Promise((_, rej) => setTimeout(() => rej(new Error('not synced')), 5000))]);
    assert.equal(value.details.diaperType, 'both');
  });

  it('runs a shared timer: anyone who can log may finish it, and the duration is kept', async () => {
    const f = await family();
    await set(ref(f.parent.db, f.at('sleep1')), activity(f.parent, { type: 'sleep', details: undefined }));
    const endedAt = Date.now();
    await update(ref(f.caregiver.db, f.at('sleep1')), {
      endedAt,
      durationSeconds: 1800,
      updatedAt: endedAt,
      updatedBy: f.caregiver.uid,
    });
    const stored = await f.ana.read(f.at('sleep1'));
    assert.equal(stored.durationSeconds, 1800);
    assert.equal(stored.updatedBy, f.caregiver.uid);
    assert.equal(stored.createdBy, f.parent.uid);
    // A viewer cannot end timers.
    await set(ref(f.parent.db, f.at('sleep2')), activity(f.parent, { type: 'sleep', details: undefined }));
    await denied(update(ref(f.viewer.db, f.at('sleep2')), { endedAt, durationSeconds: 1, updatedAt: endedAt, updatedBy: f.viewer.uid }));
  });

  it('enforces who may edit and delete', async () => {
    const f = await family();
    await set(ref(f.caregiver.db, f.at('byCaregiver')), activity(f.caregiver, { type: 'diaper', details: { diaperType: 'pee' } }));
    await set(ref(f.ana.db, f.at('byAna')), activity(f.ana, { type: 'diaper', details: { diaperType: 'pee' } }));

    // Parents edit anyone's; caregivers only their own.
    await update(ref(f.parent.db, f.at('byAna')), { notes: 'edited by parent', updatedAt: Date.now(), updatedBy: f.parent.uid });
    await update(ref(f.caregiver.db, f.at('byCaregiver')), { notes: 'mine', updatedAt: Date.now(), updatedBy: f.caregiver.uid });
    await denied(update(ref(f.caregiver.db, f.at('byAna')), { notes: 'nope', updatedAt: Date.now(), updatedBy: f.caregiver.uid }));

    // Caregivers and viewers cannot delete; parents only their own; owners anything.
    await denied(remove(ref(f.caregiver.db, f.at('byCaregiver'))));
    await denied(remove(ref(f.viewer.db, f.at('byAna'))));
    await denied(remove(ref(f.parent.db, f.at('byAna'))));
    await remove(ref(f.ana.db, f.at('byCaregiver')));
    assert.equal(await f.ana.read(f.at('byCaregiver')), null);
  });

  it('answers range queries by start time', async () => {
    const f = await family();
    const day = 86_400_000;
    const base = Date.now() - 10 * day;
    for (let i = 0; i < 6; i++) {
      await set(ref(f.ana.db, f.at(`r${i}`)), activity(f.ana, { startedAt: base + i * day }));
    }
    const result = await get(
      query(ref(f.viewer.db, f.at('')), orderByChild('startedAt'), startAt(base + 2 * day), endAt(base + 4 * day)),
    );
    assert.deepEqual(Object.keys(result.val()).sort(), ['r2', 'r3', 'r4']);
  });

  it('cuts off access for a removed member straight away', async () => {
    const f = await family();
    await set(ref(f.ana.db, f.at('a1')), activity(f.ana));
    assert.ok(await f.caregiver.read(f.at('a1')));

    await f.ana.call('removeMember', { roomId: f.roomId, memberId: f.caregiver.uid });
    await denied(get(ref(f.caregiver.db, f.at('a1'))));
    await denied(set(ref(f.caregiver.db, f.at('a2')), activity(f.caregiver)));
  });

  it('never shows one family another family’s activities', async () => {
    const f = await family();
    await set(ref(f.ana.db, f.at('private')), activity(f.ana));
    const stranger = await newUser('stranger');
    await denied(get(ref(stranger.db, f.at('private'))));
    await denied(set(ref(stranger.db, f.at('x')), activity(stranger)));
  });

  it('is deleted along with the baby or the room', async () => {
    const f = await family();
    await set(ref(f.ana.db, f.at('a1')), activity(f.ana));
    await f.ana.call('deleteRoom', { roomId: f.roomId });
    await denied(get(ref(f.ana.db, f.at('a1'))));
    assert.equal(await f.ana.read(`userRooms/${f.ana.uid}`), null);
  });
});
