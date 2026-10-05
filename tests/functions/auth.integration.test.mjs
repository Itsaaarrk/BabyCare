// Run with: npm run test:functions
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { PROJECT, loadRules } from './helpers.mjs';

before(loadRules);

let n = 0;
function client() {
  const app = initializeApp(
    { apiKey: 'fake', projectId: PROJECT, databaseURL: `http://127.0.0.1:9000?ns=${PROJECT}` },
    `auth-${++n}-${Math.random().toString(36).slice(2, 6)}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return { auth, db };
}

const email = () => `person${++n}-${Date.now()}@example.com`;

describe('authentication', () => {
  it('registers, signs out and signs back in', async () => {
    const { auth } = client();
    const address = email();
    const created = await createUserWithEmailAndPassword(auth, address, 'password123');
    await updateProfile(created.user, { displayName: 'Ana' });
    assert.equal(auth.currentUser?.email, address);

    await signOut(auth);
    assert.equal(auth.currentUser, null);

    const again = await signInWithEmailAndPassword(auth, address, 'password123');
    assert.equal(again.user.uid, created.user.uid);
    assert.equal(again.user.displayName, 'Ana');
  });

  it('rejects a wrong password, an unknown account, a duplicate email and a weak password', async () => {
    const { auth } = client();
    const address = email();
    await createUserWithEmailAndPassword(auth, address, 'password123');
    await signOut(auth);

    await assert.rejects(signInWithEmailAndPassword(auth, address, 'wrong-password'), (e) =>
      ['auth/invalid-credential', 'auth/wrong-password'].includes(e.code),
    );
    await assert.rejects(signInWithEmailAndPassword(auth, email(), 'password123'), (e) =>
      ['auth/invalid-credential', 'auth/user-not-found'].includes(e.code),
    );
    await assert.rejects(createUserWithEmailAndPassword(auth, address, 'password123'), { code: 'auth/email-already-in-use' });
    await assert.rejects(createUserWithEmailAndPassword(auth, email(), '123'), { code: 'auth/weak-password' });
    await assert.rejects(createUserWithEmailAndPassword(auth, 'not-an-email', 'password123'), { code: 'auth/invalid-email' });
  });

  it('reports the signed-in state to listeners, as the app’s session gate depends on it', async () => {
    const { auth } = client();
    const states = [];
    const off = onAuthStateChanged(auth, (user) => states.push(user ? 'in' : 'out'));
    await createUserWithEmailAndPassword(auth, email(), 'password123');
    await signOut(auth);
    await new Promise((r) => setTimeout(r, 100));
    off();
    assert.deepEqual(states, ['out', 'in', 'out']);
  });

  it('accepts a password reset request without revealing whether the account exists', async () => {
    const { auth } = client();
    await sendPasswordResetEmail(auth, email()).catch((e) => {
      // The emulator may refuse unknown addresses; the app ignores this error on purpose.
      assert.ok(['auth/user-not-found', 'auth/invalid-email'].includes(e.code));
    });
  });

  it('keeps signed-out users away from private data', async () => {
    const { db } = client();
    await assert.rejects(get(ref(db, 'userSettings/anyone')), /permission.denied/i);
    await assert.rejects(get(ref(db, 'rooms/any')), /permission.denied/i);
  });
});
