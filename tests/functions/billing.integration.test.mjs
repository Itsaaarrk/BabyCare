// Run with: npm run test:functions
// The free baby limit, plan changes, and the billing nodes, against real functions and rules.
import { get, ref, set, update } from 'firebase/database';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { denied, loadRules, newUser, reasonOf, setEntitlement } from './helpers.mjs';

before(loadRules);

const DAY = 86_400_000;
const baby = (name) => ({ name, birthDate: '2026-09-22' });

/** An owner with a room and no babies yet. */
async function owner() {
  const ana = await newUser('ana');
  const { roomId } = await ana.call('createRoom', { name: "Sofia's Family" });
  return { ana, roomId };
}

const addBaby = (user, roomId, name) => user.call('addBaby', { roomId, baby: baby(name) });
const babyCount = async (user, roomId) => Object.keys((await user.read(`rooms/${roomId}/babies`)) ?? {}).length;

describe('addBaby on the Free plan', () => {
  it('adds the first baby and refuses the second', async () => {
    const { ana, roomId } = await owner();
    const { babyId } = await addBaby(ana, roomId, 'Sofia');
    const saved = await ana.read(`rooms/${roomId}/babies/${babyId}`);
    assert.equal(saved.name, 'Sofia');
    assert.equal(saved.createdBy, ana.uid);

    assert.equal((await reasonOf(addBaby(ana, roomId, 'Liam'))).reason, 'baby-limit');
    assert.equal(await babyCount(ana, roomId), 1);
  });

  it('stores only what was asked for and trims text', async () => {
    const { ana, roomId } = await owner();
    const { babyId } = await ana.call('addBaby', {
      roomId,
      baby: { name: '  Sofia ', nickname: ' Sof ', birthDate: '2026-09-22', birthTime: '08:30', gender: 'girl', notes: '' },
    });
    const saved = await ana.read(`rooms/${roomId}/babies/${babyId}`);
    assert.equal(saved.name, 'Sofia');
    assert.equal(saved.nickname, 'Sof');
    assert.equal(saved.birthTime, '08:30');
    assert.equal(saved.gender, 'girl');
    assert.equal('notes' in saved, false);
  });

  it('rejects invalid details', async () => {
    const { ana, roomId } = await owner();
    const bad = [
      { name: '', birthDate: '2026-09-22' },
      { name: 'x'.repeat(61), birthDate: '2026-09-22' },
      { name: 'Sofia', birthDate: '2026-02-30' },
      { name: 'Sofia', birthDate: '2999-01-01' },
      { name: 'Sofia', birthDate: 'yesterday' },
      { name: 'Sofia', birthDate: '2026-09-22', birthTime: '25:00' },
      { name: 'Sofia', birthDate: '2026-09-22', gender: 'robot' },
      { name: 'Sofia', birthDate: '2026-09-22', notes: 'n'.repeat(1001) },
    ];
    for (const value of bad) {
      assert.equal((await reasonOf(ana.call('addBaby', { roomId, baby: value }))).reason, 'invalid-input');
    }
    assert.equal((await reasonOf(ana.call('addBaby', { roomId, baby: undefined }))).reason, 'invalid-input');
    assert.equal((await reasonOf(ana.call('addBaby', { roomId: '../x', baby: baby('Sofia') }))).reason, 'invalid-input');
    assert.equal(await babyCount(ana, roomId), 0);
  });

  it('is for owners only, and for signed-in callers', async () => {
    const { ana, roomId } = await owner();
    const dad = await newUser('dad');
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'parent' });
    await dad.call('joinRoom', { code: invite.code });
    assert.equal((await reasonOf(addBaby(dad, roomId, 'Sofia'))).reason, 'not-allowed');

    const stranger = await newUser('stranger');
    assert.equal((await reasonOf(addBaby(stranger, roomId, 'Sofia'))).reason, 'not-allowed');
    assert.equal(await babyCount(ana, roomId), 0);
  });

  it('cannot be bypassed by writing a baby straight to the database', async () => {
    const { ana, roomId } = await owner();
    await addBaby(ana, roomId, 'Sofia');
    const now = Date.now();
    await denied(set(ref(ana.db, `rooms/${roomId}/babies/sneaky`), { ...baby('Liam'), createdBy: ana.uid, createdAt: now, updatedAt: now }));
    await denied(update(ref(ana.db, `rooms/${roomId}/babies`), { sneaky2: { ...baby('Liam'), createdBy: ana.uid, createdAt: now, updatedAt: now } }));
    assert.equal(await babyCount(ana, roomId), 1);
  });

  it('still lets the owner edit and delete an existing baby', async () => {
    const { ana, roomId } = await owner();
    const { babyId } = await addBaby(ana, roomId, 'Sofia');
    await update(ref(ana.db, `rooms/${roomId}/babies/${babyId}`), { name: 'Sofia M.', updatedAt: Date.now() });
    assert.equal((await ana.read(`rooms/${roomId}/babies/${babyId}/name`)), 'Sofia M.');
    await set(ref(ana.db, `rooms/${roomId}/babies/${babyId}`), null);
    assert.equal(await babyCount(ana, roomId), 0);
    // Deleting frees the slot.
    await addBaby(ana, roomId, 'Liam');
    assert.equal(await babyCount(ana, roomId), 1);
  });
});

describe('addBaby on BabyCare Plus', () => {
  const plus = (over = {}) => ({ plan: 'plus_yearly', status: 'active', expiresAt: Date.now() + 30 * DAY, ...over });

  it('allows up to five babies, then refuses', async () => {
    const { ana, roomId } = await owner();
    await setEntitlement(roomId, plus());
    for (let i = 1; i <= 5; i++) await addBaby(ana, roomId, `Baby ${i}`);
    assert.equal((await reasonOf(addBaby(ana, roomId, 'Baby 6'))).reason, 'baby-limit');
    assert.equal(await babyCount(ana, roomId), 5);
  });

  it('treats monthly, yearly and lifetime the same', async () => {
    for (const entitlement of [
      plus({ plan: 'plus_monthly' }),
      plus({ plan: 'plus_yearly' }),
      { plan: 'lifetime', status: 'active', expiresAt: null },
      plus({ status: 'cancelled' }),
      plus({ status: 'grace_period' }),
    ]) {
      const { ana, roomId } = await owner();
      await setEntitlement(roomId, entitlement);
      await addBaby(ana, roomId, 'First');
      await addBaby(ana, roomId, 'Second');
      assert.equal(await babyCount(ana, roomId), 2, JSON.stringify(entitlement));
    }
  });

  it('falls back to Free when the plan has expired, keeping every baby', async () => {
    const { ana, roomId } = await owner();
    await setEntitlement(roomId, plus());
    await addBaby(ana, roomId, 'First');
    await addBaby(ana, roomId, 'Second');

    // Stored status still says active, but the date has passed: dates win.
    await setEntitlement(roomId, plus({ expiresAt: Date.now() - 1000 }));
    assert.equal((await reasonOf(addBaby(ana, roomId, 'Third'))).reason, 'baby-limit');
    for (const status of ['expired', 'paused', 'none']) {
      await setEntitlement(roomId, plus({ status }));
      assert.equal((await reasonOf(addBaby(ana, roomId, 'Third'))).reason, 'baby-limit', status);
    }
    assert.equal(await babyCount(ana, roomId), 2);
  });

  it('does not let a malformed or lifetime-without-active entitlement unlock anything', async () => {
    const { ana, roomId } = await owner();
    await addBaby(ana, roomId, 'First');
    for (const entitlement of [
      { plan: 'lifetime', status: 'expired' },
      { plan: 'free', status: 'active', expiresAt: Date.now() + DAY },
      { plan: 'platinum', status: 'active', expiresAt: Date.now() + DAY },
      { plan: 'plus_yearly', status: 'active' },
    ]) {
      await setEntitlement(roomId, entitlement);
      assert.equal((await reasonOf(addBaby(ana, roomId, 'Second'))).reason, 'baby-limit', JSON.stringify(entitlement));
    }
  });
});

describe('a room that already has several babies', () => {
  it('keeps them all and simply cannot add more', async () => {
    const { ana, roomId } = await owner();
    await setEntitlement(roomId, { plan: 'lifetime', status: 'active', expiresAt: null });
    await addBaby(ana, roomId, 'First');
    await addBaby(ana, roomId, 'Second');
    await setEntitlement(roomId, null);
    assert.equal(await babyCount(ana, roomId), 2);
    assert.equal((await reasonOf(addBaby(ana, roomId, 'Third'))).reason, 'baby-limit');
    assert.equal(await babyCount(ana, roomId), 2);
  });
});

describe('createRoom owned-room limit', () => {
  it('allows one owned room and refuses a second', async () => {
    const { ana } = await owner();
    assert.equal((await reasonOf(ana.call('createRoom', { name: 'Another' }))).reason, 'owned-room-limit');
  });

  it('allows a new room after the old one is deleted', async () => {
    const { ana, roomId } = await owner();
    await ana.call('deleteRoom', { roomId });
    const second = await ana.call('createRoom', { name: 'Again' });
    assert.ok(second.roomId);
  });

  it('does not count rooms the person only joined', async () => {
    const { ana, roomId } = await owner();
    const grandma = await newUser('grandma');
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'caregiver' });
    await grandma.call('joinRoom', { code: invite.code });
    const own = await grandma.call('createRoom', { name: "Grandma's" });
    assert.ok(own.roomId);
  });
});

describe('the plan and billing nodes', () => {
  it('lets members read the plan but not write it', async () => {
    const { ana, roomId } = await owner();
    const grandma = await newUser('grandma');
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'viewer' });
    await grandma.call('joinRoom', { code: invite.code });
    await setEntitlement(roomId, { plan: 'plus_monthly', status: 'active', expiresAt: Date.now() + DAY });

    for (const member of [ana, grandma]) {
      const plan = await member.read(`rooms/${roomId}/entitlement`);
      assert.equal(plan.plan, 'plus_monthly');
      assert.equal(plan.status, 'active');
      await denied(set(ref(member.db, `rooms/${roomId}/entitlement`), { plan: 'lifetime', status: 'active', updatedAt: 1 }));
      await denied(set(ref(member.db, `rooms/${roomId}/entitlement/plan`), 'lifetime'));
      await denied(update(ref(member.db, `rooms/${roomId}`), { entitlement: { plan: 'lifetime', status: 'active', updatedAt: 1 } }));
    }
    assert.equal((await ana.read(`rooms/${roomId}/entitlement/plan`)), 'plus_monthly');
  });

  it('hides the plan from people who are not in the room', async () => {
    const { roomId } = await owner();
    await setEntitlement(roomId, { plan: 'lifetime', status: 'active' });
    const stranger = await newUser('stranger');
    await denied(get(ref(stranger.db, `rooms/${roomId}/entitlement`)));
  });

  it('keeps purchase data away from clients, and billing details to the billing owner', async () => {
    const { ana, roomId } = await owner();
    const grandma = await newUser('grandma');
    const { invite } = await ana.call('regenerateInvite', { roomId, role: 'parent' });
    await grandma.call('joinRoom', { code: invite.code });

    // What the server would store once purchases exist (written here with admin access).
    const put = (path, value) =>
      fetch(`http://127.0.0.1:9000/${path}.json?ns=demo-babycare`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer owner' },
        body: JSON.stringify(value),
      });
    await put(`roomBilling/${roomId}`, { billingOwnerId: ana.uid, productId: 'babycare_plus', plan: 'plus_yearly' });
    await put(`billingPrivate/${roomId}`, { purchaseToken: 'secret-token' });
    await put('purchaseTokens/abc', { roomId });

    assert.equal((await ana.read(`roomBilling/${roomId}/plan`)), 'plus_yearly');
    await denied(get(ref(grandma.db, `roomBilling/${roomId}`)));
    for (const user of [ana, grandma]) {
      await denied(get(ref(user.db, `billingPrivate/${roomId}`)));
      await denied(get(ref(user.db, 'purchaseTokens/abc')));
      await denied(set(ref(user.db, `roomBilling/${roomId}`), { billingOwnerId: user.uid, plan: 'lifetime' }));
      await denied(set(ref(user.db, `billingPrivate/${roomId}`), { purchaseToken: 'x' }));
      await denied(set(ref(user.db, 'purchaseTokens/mine'), { roomId }));
    }
  });
});
