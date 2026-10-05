import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';

import { signOut } from './authService';
import { signInWithGoogle } from './googleSignIn';

export type SignInMethod = 'password' | 'google' | 'unknown';

/** How the signed-in person signs in, which decides how they confirm a deletion. */
export function currentSignInMethod(): SignInMethod {
  const providers = getFirebaseAuth().currentUser?.providerData.map((p) => p.providerId) ?? [];
  if (providers.includes('password')) return 'password';
  if (providers.includes('google.com')) return 'google';
  return 'unknown';
}

/** Confirms it's really them by asking for the password again. Throws if it's wrong. */
export async function confirmWithPassword(password: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email) throw new Error('Not signed in with an email address.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  // The server wants a sign-in from the last few minutes; make sure the token says so.
  await user.getIdToken(true);
}

/** Confirms it's really them by signing in with Google again. False if they backed out. */
export async function confirmWithGoogle(): Promise<boolean> {
  if ((await signInWithGoogle()) === 'cancelled') return false;
  await getFirebaseAuth().currentUser?.getIdToken(true);
  return true;
}

/**
 * Deletes the account on the server, then signs out on this phone. The server refuses unless the
 * person signed in very recently, and refuses room owners (they must delete their room first).
 */
export async function deleteMyAccount(): Promise<void> {
  await httpsCallable(getFirebaseFunctions(), 'deleteAccount', { timeout: 25_000 })({});
  try {
    await signOut();
  } catch {
    // The account is already gone; local sign-out failing changes nothing.
  }
}
