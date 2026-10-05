// Run with: npm run test:rules   (starts the Firebase emulators via firebase-tools; needs Java)
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, remove, set, update } from 'firebase/database';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

const ROOM = 'room1';
const BABY = 'baby1';
const now = Date.now();

const babyRecord = (uid, overrides = {}) => ({
  name: 'Sofia',
  birthDate: '2026-09-22',
  createdBy: uid,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

let env;
const as = (uid) => env.authenticatedContext(uid).database();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-babycare',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearDatabase());

/** Seeds what Cloud Functions would write: ana owns the room; others have the given roles. */
async function seedRoom(others = { grandma: 'viewer' }) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    const members = { ana: { role: 'owner', displayName: 'Ana', joinedAt: now } };
    for (const [uid, role] of Object.entries(others)) {
      members[uid] = { role, displayName: uid, joinedAt: now };
    }
    await set(ref(db, `rooms/${ROOM}`), {
      info: { name: "Sofia's Family", ownerId: 'ana', ownerName: 'Ana', createdAt: now },
      members,
      babies: { [BABY]: babyRecord('ana') },
    });
    await set(ref(db, `userRooms/ana/${ROOM}`), true);
    await set(ref(db, `roomInvites/${ROOM}`), { code: 'K7M4P2', role: 'caregiver', expiresAt: now + 1e6 });
    await set(ref(db, 'roomJoinCodes/K7M4P2'), { roomId: ROOM });
  });
}

describe('server-managed data is closed to clients', () => {
  it('rejects creating, replacing or deleting rooms', async () => {
    const room = {
      info: { name: 'Mine', ownerId: 'mallory', ownerName: 'M', createdAt: now },
      members: { mallory: { role: 'owner', displayName: 'M', joinedAt: now } },
    };
    await assertFails(set(ref(as('mallory'), `rooms/${ROOM}`), room));
    await seedRoom();
    await assertFails(set(ref(as('mallory'), `rooms/${ROOM}`), room));
    await assertFails(set(ref(as('ana'), `rooms/${ROOM}`), room));
    await assertFails(remove(ref(as('ana'), `rooms/${ROOM}`)));
  });

  it('rejects every client write to members', async () => {
    await seedRoom({ grandma: 'viewer', dad: 'parent' });
    const member = { role: 'owner', displayName: 'M', joinedAt: now };
    await assertFails(set(ref(as('mallory'), `rooms/${ROOM}/members/mallory`), member));
    await assertFails(set(ref(as('grandma'), `rooms/${ROOM}/members/grandma/role`), 'owner'));
    await assertFails(set(ref(as('dad'), `rooms/${ROOM}/members/dad/role`), 'owner'));
    await assertFails(set(ref(as('ana'), `rooms/${ROOM}/members/grandma/role`), 'parent'));
    await assertFails(remove(ref(as('ana'), `rooms/${ROOM}/members/grandma`)));
    await assertFails(remove(ref(as('grandma'), `rooms/${ROOM}/members/grandma`)));
  });

  it('rejects client writes to the room index, invites and join codes', async () => {
    await seedRoom();
    await assertFails(set(ref(as('mallory'), `userRooms/mallory/${ROOM}`), true));
    await assertFails(set(ref(as('ana'), `userRooms/ana/other`), true));
    await assertFails(set(ref(as('ana'), `roomInvites/${ROOM}/role`), 'owner'));
    await assertFails(set(ref(as('mallory'), 'roomJoinCodes/ZZZZZZ'), { roomId: ROOM }));
    await assertFails(get(ref(as('mallory'), 'roomJoinCodes/K7M4P2')));
    await assertFails(get(ref(as('ana'), 'roomJoinCodes/K7M4P2')));
    await assertFails(set(ref(as('mallory'), 'joinAttempts/mallory'), { count: 0, windowStart: now }));
  });
});

describe('reading', () => {
  it('lets members read the room, members and babies', async () => {
    await seedRoom();
    for (const uid of ['ana', 'grandma']) {
      await assertSucceeds(get(ref(as(uid), `rooms/${ROOM}/babies`)));
      await assertSucceeds(get(ref(as(uid), `rooms/${ROOM}/info`)));
      await assertSucceeds(get(ref(as(uid), `rooms/${ROOM}/members`)));
    }
  });

  it('blocks non-members and anonymous users', async () => {
    await seedRoom();
    await assertFails(get(ref(as('mallory'), `rooms/${ROOM}`)));
    await assertFails(get(ref(as('mallory'), `rooms/${ROOM}/babies`)));
    await assertFails(get(ref(as('mallory'), `rooms/${ROOM}/members`)));
    await assertFails(get(ref(env.unauthenticatedContext().database(), `rooms/${ROOM}/info`)));
  });

  it('does not allow listing every room', async () => {
    await seedRoom();
    await assertFails(get(ref(as('ana'), 'rooms')));
  });

  it('keeps each user’s room index private', async () => {
    await seedRoom();
    await assertSucceeds(get(ref(as('ana'), 'userRooms/ana')));
    await assertFails(get(ref(as('mallory'), 'userRooms/ana')));
  });

  it('shows invite codes only to owners and parents', async () => {
    await seedRoom({ dad: 'parent', nanny: 'caregiver', grandma: 'viewer' });
    await assertSucceeds(get(ref(as('ana'), `roomInvites/${ROOM}`)));
    await assertSucceeds(get(ref(as('dad'), `roomInvites/${ROOM}`)));
    await assertFails(get(ref(as('nanny'), `roomInvites/${ROOM}`)));
    await assertFails(get(ref(as('grandma'), `roomInvites/${ROOM}`)));
    await assertFails(get(ref(as('mallory'), `roomInvites/${ROOM}`)));
  });
});

describe('room name', () => {
  it('lets only the owner rename the room', async () => {
    await seedRoom({ dad: 'parent' });
    await assertSucceeds(set(ref(as('ana'), `rooms/${ROOM}/info/name`), 'The Garcias'));
    await assertFails(set(ref(as('dad'), `rooms/${ROOM}/info/name`), 'Mine now'));
    await assertFails(set(ref(as('ana'), `rooms/${ROOM}/info/ownerId`), 'mallory'));
  });
});

describe('activities', () => {
  const dir = `rooms/${ROOM}/babies/${BABY}/activities`;
  const at = (id) => `${dir}/${id}`;
  const activity = (uid, over = {}) => ({
    type: 'feeding',
    startedAt: now - 60_000,
    details: { feedingType: 'breast', side: 'left' },
    createdBy: uid,
    createdByName: uid,
    createdAt: now,
    updatedAt: now,
    ...over,
  });
  const diaper = (uid, over = {}) =>
    activity(uid, { type: 'diaper', details: { diaperType: 'pee' }, ...over });
  const sleepTimer = (uid) => activity(uid, { type: 'sleep', details: undefined });

  async function seedActivities(members, activities) {
    await seedRoom(members);
    await env.withSecurityRulesDisabled(async (ctx) => {
      // JSON round-trip drops `undefined` fields, which the SDK refuses to write.
      for (const [id, value] of Object.entries(activities)) {
        await set(ref(ctx.database(), at(id)), JSON.parse(JSON.stringify(value)));
      }
    });
  }

  it('lets owners, parents and caregivers create activities as themselves', async () => {
    await seedRoom({ dad: 'parent', nanny: 'caregiver' });
    for (const uid of ['ana', 'dad', 'nanny']) {
      await assertSucceeds(set(ref(as(uid), at(`new-${uid}`)), activity(uid)));
    }
  });

  it('blocks viewers and outsiders from creating', async () => {
    await seedRoom({ grandma: 'viewer' });
    await assertFails(set(ref(as('grandma'), at('x')), activity('grandma')));
    await assertFails(set(ref(as('mallory'), at('x')), activity('mallory')));
    await assertFails(set(ref(env.unauthenticatedContext().database(), at('x')), activity('ana')));
  });

  it('refuses to attribute an activity to someone else', async () => {
    await seedRoom({ nanny: 'caregiver' });
    await assertFails(set(ref(as('nanny'), at('x')), activity('ana')));
  });

  it('lets every member read activities and nobody else', async () => {
    await seedActivities({ grandma: 'viewer' }, { a1: activity('ana') });
    await assertSucceeds(get(ref(as('ana'), at('a1'))));
    await assertSucceeds(get(ref(as('grandma'), dir)));
    await assertFails(get(ref(as('mallory'), dir)));
  });

  it('lets a parent edit anyone’s activity, but a caregiver only their own', async () => {
    await seedActivities(
      { dad: 'parent', nanny: 'caregiver' },
      { byAna: diaper('ana'), byNanny: diaper('nanny') },
    );
    await assertSucceeds(update(ref(as('dad'), at('byAna')), { notes: 'edited', updatedAt: now + 1 }));
    await assertSucceeds(update(ref(as('nanny'), at('byNanny')), { notes: 'mine', updatedAt: now + 1 }));
    await assertFails(update(ref(as('nanny'), at('byAna')), { notes: 'not mine', updatedAt: now + 1 }));
  });

  it('lets a caregiver finish a timer someone else started, but not edit a finished one', async () => {
    await seedActivities(
      { nanny: 'caregiver' },
      { running: sleepTimer('ana'), done: activity('ana', { type: 'sleep', details: undefined, endedAt: now - 1000, durationSeconds: 59 }) },
    );
    const finish = { endedAt: now, durationSeconds: 60, updatedAt: now, updatedBy: 'nanny' };
    await assertSucceeds(update(ref(as('nanny'), at('running')), finish));
    await assertFails(update(ref(as('nanny'), at('done')), { notes: 'x', updatedAt: now, updatedBy: 'nanny' }));
  });

  it('blocks viewers from editing', async () => {
    await seedActivities({ grandma: 'viewer' }, { a1: diaper('ana') });
    await assertFails(update(ref(as('grandma'), at('a1')), { notes: 'x', updatedAt: now }));
  });

  it('lets the owner delete anything, a parent only their own, nobody else', async () => {
    await seedActivities(
      { dad: 'parent', nanny: 'caregiver', grandma: 'viewer' },
      { byAna: diaper('ana'), byDad: diaper('dad'), byNanny: diaper('nanny') },
    );
    await assertFails(remove(ref(as('nanny'), at('byNanny'))));
    await assertFails(remove(ref(as('grandma'), at('byAna'))));
    await assertFails(remove(ref(as('dad'), at('byAna'))));
    await assertSucceeds(remove(ref(as('dad'), at('byDad'))));
    await assertSucceeds(remove(ref(as('ana'), at('byNanny'))));
  });

  it('rejects malformed activities', async () => {
    await seedRoom();
    const db = as('ana');
    const bad = [
      ['unknown type', activity('ana', { type: 'dance' })],
      ['feeding without a feeding type', activity('ana', { details: { side: 'left' } })],
      ['diaper without a diaper type', diaper('ana', { details: {} })],
      ['note without a title', activity('ana', { type: 'note', details: {} })],
      ['future start', activity('ana', { startedAt: Date.now() + 3_600_000 })],
      ['end before start', activity('ana', { endedAt: now - 120_000 })],
      ['end on an instant activity', diaper('ana', { endedAt: now })],
      ['negative duration', activity('ana', { endedAt: now, durationSeconds: -1 })],
      ['huge amount', activity('ana', { details: { feedingType: 'bottle', amount: 99999 } })],
      ['bad enum', activity('ana', { details: { feedingType: 'breast', side: 'up' } })],
      ['long notes', activity('ana', { notes: 'x'.repeat(1001) })],
      ['unknown field', activity('ana', { admin: true })],
      ['unknown detail', activity('ana', { details: { feedingType: 'breast', sneaky: 1 } })],
    ];
    for (const [name, value] of bad) {
      await assertFails(set(ref(db, at('bad')), value), name);
    }
  });

  it('keeps type, creator and creation time fixed', async () => {
    await seedActivities({ dad: 'parent' }, { a1: diaper('ana') });
    const db = as('dad');
    await assertFails(update(ref(db, at('a1')), { type: 'sleep' }));
    await assertFails(update(ref(db, at('a1')), { createdBy: 'dad' }));
    await assertFails(update(ref(db, at('a1')), { createdAt: 1 }));
    await assertFails(update(ref(db, at('a1')), { updatedBy: 'ana' }));
  });

  it('only accepts a photo path inside the activity’s own folder', async () => {
    await seedRoom();
    const db = as('ana');
    await set(ref(db, at('p1')), activity('ana'));
    await assertSucceeds(update(ref(db, at('p1')), { photoPath: `${dir}/p1/photo-1.jpg` }));
    await assertFails(update(ref(db, at('p1')), { photoPath: `${dir}/other/photo-1.jpg` }));
    await assertFails(update(ref(db, at('p1')), { photoPath: 'https://evil.example/x.jpg' }));
  });

  it('is deleted along with its baby, by the owner only', async () => {
    await seedActivities({ dad: 'parent' }, { a1: diaper('ana') });
    await assertFails(remove(ref(as('dad'), `rooms/${ROOM}/babies/${BABY}`)));
    await assertSucceeds(remove(ref(as('ana'), `rooms/${ROOM}/babies/${BABY}`)));
    assert.equal((await get(ref(as('ana'), dir))).val(), null);
  });
});

describe('user settings', () => {
  const settings = {
    updatedAt: now,
    timeZone: 'Asia/Manila',
    shakeToLog: false,
    themeMode: 'dark',
    themeAccent: 'sage',
    enabledActivities: { feeding: true, outdoor: false },
    quickActionOrder: ['sleep', 'feeding', 'diaper'],
    notifications: {
      enabled: true,
      feedingReminder: { enabled: true, hours: 3 },
      daily: [{ id: 'vit', label: 'Vitamins', hour: 8, minute: 30, enabled: true }],
    },
  };

  it('lets users read and write only their own settings', async () => {
    await assertSucceeds(set(ref(as('ana'), 'userSettings/ana'), settings));
    await assertSucceeds(get(ref(as('ana'), 'userSettings/ana')));
    await assertFails(get(ref(as('mallory'), 'userSettings/ana')));
    await assertFails(set(ref(as('mallory'), 'userSettings/ana'), settings));
    await assertFails(get(ref(env.unauthenticatedContext().database(), 'userSettings/ana')));
  });

  it('rejects malformed settings', async () => {
    const db = as('ana');
    const bad = [
      { ...settings, shakeToLog: 'yes' },
      { ...settings, themeMode: 'neon' },
      { ...settings, timeZone: 'x'.repeat(65) },
      { ...settings, enabledActivities: { dancing: true } },
      { ...settings, quickActionOrder: ['sleep', 'dancing'] },
      { ...settings, notifications: { ...settings.notifications, feedingReminder: { enabled: true, hours: 99 } } },
      { ...settings, notifications: { ...settings.notifications, daily: [{ id: 'a', hour: 25, minute: 0 }] } },
      { ...settings, surprise: true },
      { shakeToLog: true },
    ];
    for (const value of bad) await assertFails(set(ref(db, 'userSettings/ana'), value));
  });
});

describe('baby profiles', () => {
  const path = `rooms/${ROOM}/babies/${BABY}`;

  it('lets the owner edit and add babies', async () => {
    await seedRoom();
    await assertSucceeds(update(ref(as('ana'), path), { name: 'Sofia M.', updatedAt: now + 1 }));
    await assertSucceeds(set(ref(as('ana'), `rooms/${ROOM}/babies/baby2`), babyRecord('ana', { name: 'Liam' })));
  });

  for (const role of ['parent', 'caregiver', 'viewer']) {
    it(`blocks a ${role} from editing, adding or deleting babies`, async () => {
      await seedRoom({ grandma: role });
      const db = as('grandma');
      await assertFails(update(ref(db, path), { name: 'Hacked' }));
      await assertFails(set(ref(db, `rooms/${ROOM}/babies/baby2`), babyRecord('grandma')));
      await assertFails(set(ref(db, path), null));
    });
  }

  it('blocks outsiders', async () => {
    await seedRoom();
    await assertFails(update(ref(as('mallory'), path), { name: 'Hacked' }));
  });

  it('rejects invalid data', async () => {
    await seedRoom();
    const db = as('ana');
    await assertFails(update(ref(db, path), { birthDate: '22/09/2026' }));
    await assertFails(update(ref(db, path), { name: '' }));
    await assertFails(update(ref(db, path), { name: 'x'.repeat(61) }));
    await assertFails(update(ref(db, path), { gender: 'robot' }));
    await assertFails(update(ref(db, path), { birthTime: '25:00' }));
    await assertFails(update(ref(db, path), { surprise: 'field' }));
    await assertFails(update(ref(db, path), { createdBy: 'mallory' }));
    await assertFails(update(ref(db, path), { photoPath: 'https://evil.example/x.jpg' }));
  });

  it('only accepts a photo path inside this baby’s own folder', async () => {
    await seedRoom();
    const db = as('ana');
    await assertSucceeds(update(ref(db, path), { photoPath: `rooms/${ROOM}/babies/${BABY}/profile-1.jpg` }));
    await assertFails(update(ref(db, path), { photoPath: `rooms/other/babies/${BABY}/profile-1.jpg` }));
    await assertFails(update(ref(db, path), { photoPath: `rooms/${ROOM}/babies/other/profile-1.jpg` }));
    await assertFails(update(ref(db, path), { photoPath: `rooms/${ROOM}/babies/${BABY}/../x.jpg` }));
  });
});
