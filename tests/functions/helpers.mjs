// Shared setup for emulator integration tests.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, ref } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const PROJECT = 'demo-babycare';
const DB = 'http://127.0.0.1:9000';
const config = { apiKey: 'fake-key', projectId: PROJECT, databaseURL: `${DB}?ns=${PROJECT}` };
let counter = 0;

/** Creates a signed-in user with their own app instance, so users don't share auth state. */
export async function newUser(name) {
  const app = initializeApp(config, `${name}-${++counter}-${Math.random().toString(36).slice(2, 6)}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, `${name}${counter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, 'password123');
  await updateProfile(credential.user, { displayName: name });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const functions = getFunctions(app, 'asia-southeast1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return {
    app,
    auth,
    uid: credential.user.uid,
    email: credential.user.email,
    db,
    call: async (fn, data) => (await httpsCallable(functions, fn)(data)).data,
    read: async (path) => (await get(ref(db, path))).val(),
  };
}

/** For a demo project the Functions emulator's Admin SDK uses the namespace named after the
 *  project, which starts wide open, so load the real rules into it. */
export async function loadRules() {
  const response = await fetch(`${DB}/.settings/rules.json?ns=${PROJECT}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: readFileSync('database.rules.json', 'utf8'),
  });
  assert.equal(response.status, 200);
}

/** Sets or clears a room's plan the way the server would: with admin access, bypassing the rules. */
export async function setEntitlement(roomId, entitlement) {
  const response = await fetch(`${DB}/rooms/${roomId}/entitlement.json?ns=${PROJECT}`, {
    method: entitlement ? 'PUT' : 'DELETE',
    headers: { Authorization: 'Bearer owner' },
    body: entitlement ? JSON.stringify({ updatedAt: Date.now(), ...entitlement }) : undefined,
  });
  assert.equal(response.status, 200);
}

export async function reasonOf(promise) {
  try {
    await promise;
  } catch (error) {
    return { code: error.code, reason: error.details?.reason };
  }
  assert.fail('expected the call to be rejected');
}

export async function denied(promise) {
  await assert.rejects(promise, /permission.denied/i);
}
