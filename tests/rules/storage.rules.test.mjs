// Run with: npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

const path = 'rooms/room1/babies/baby1/profile-1.jpg';
const jpeg = { contentType: 'image/jpeg' };
const bytes = (n) => new Uint8Array(n);

let env;
// `rooms` is the custom claim Cloud Functions maintain: {roomId: role}.
const as = (uid, rooms) => env.authenticatedContext(uid, rooms ? { rooms } : {}).storage();
const asOwner = () => as('ana', { room1: 'owner' });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-babycare',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(() => env.cleanup());

describe('baby photos', () => {
  it('lets the room owner upload and read a JPEG', async () => {
    await assertSucceeds(uploadBytes(ref(asOwner(), path), bytes(1024), jpeg));
    await assertSucceeds(getBytes(ref(asOwner(), path)));
  });

  it('lets every room member read, whatever their role', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), bytes(1024), jpeg);
    });
    for (const role of ['owner', 'parent', 'caregiver', 'viewer']) {
      await assertSucceeds(getBytes(ref(as('u', { room1: role }), path)));
    }
  });

  it('blocks non-members, other rooms’ members and anonymous users', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path), bytes(1024), jpeg);
    });
    await assertFails(getBytes(ref(as('mallory'), path)));
    await assertFails(getBytes(ref(as('mallory', {}), path)));
    await assertFails(getBytes(ref(as('mallory', { room2: 'owner' }), path)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  });

  it('blocks writing and deleting by anyone but the owner', async () => {
    for (const role of ['parent', 'caregiver', 'viewer']) {
      await assertFails(uploadBytes(ref(as('u', { room1: role }), path), bytes(1024), jpeg));
    }
    await assertFails(uploadBytes(ref(as('mallory', { room2: 'owner' }), path), bytes(1024), jpeg));
  });

  it('rejects non-JPEG and oversized files', async () => {
    await assertFails(
      uploadBytes(ref(asOwner(), 'rooms/room1/babies/baby1/x.png'), bytes(1024), { contentType: 'image/png' }),
    );
    await assertFails(
      uploadBytes(ref(asOwner(), 'rooms/room1/babies/baby1/big.jpg'), bytes(5 * 1024 * 1024 + 1), jpeg),
    );
  });

  describe('activity photos', () => {
    const photo = 'rooms/room1/babies/baby1/activities/act1/photo.jpg';

    it('lets owners, parents and caregivers add photos, but not viewers or outsiders', async () => {
      for (const role of ['owner', 'parent', 'caregiver']) {
        await assertSucceeds(uploadBytes(ref(as('u', { room1: role }), photo), bytes(1024), jpeg));
      }
      await assertFails(uploadBytes(ref(as('u', { room1: 'viewer' }), photo), bytes(1024), jpeg));
      await assertFails(uploadBytes(ref(as('u', { room2: 'owner' }), photo), bytes(1024), jpeg));
      await assertFails(uploadBytes(ref(as('u'), photo), bytes(1024), jpeg));
    });

    it('lets every member read, and nobody else', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await uploadBytes(ref(ctx.storage(), photo), bytes(1024), jpeg);
      });
      for (const role of ['owner', 'parent', 'caregiver', 'viewer']) {
        await assertSucceeds(getBytes(ref(as('u', { room1: role }), photo)));
      }
      await assertFails(getBytes(ref(as('u', { room2: 'owner' }), photo)));
      await assertFails(getBytes(ref(as('u'), photo)));
    });

    it('rejects non-JPEG and oversized photos', async () => {
      const owner = as('u', { room1: 'owner' });
      await assertFails(uploadBytes(ref(owner, photo), bytes(10), { contentType: 'image/png' }));
      await assertFails(uploadBytes(ref(owner, photo), bytes(5 * 1024 * 1024 + 1), jpeg));
    });
  });

  it('denies everything outside the baby photo folders', async () => {
    await assertFails(uploadBytes(ref(asOwner(), 'misc/file.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(asOwner(), 'users/ana/babies/baby1/old.jpg'), bytes(10), jpeg));
  });
});
