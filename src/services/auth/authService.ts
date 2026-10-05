import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';

import { forgetGoogleAccount } from './googleSignIn';

export { signInWithGoogle } from './googleSignIn';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
});

export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (user) => callback(user ? toAuthUser(user) : null));
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<void> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim() });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/**
 * Forces a fresh ID token. Room access for Storage lives in a custom claim that only reaches
 * the client through the token, so call this after the user's memberships change.
 */
export async function refreshClaims(): Promise<void> {
  await getFirebaseAuth().currentUser?.getIdToken(true);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  await forgetGoogleAccount();
}
