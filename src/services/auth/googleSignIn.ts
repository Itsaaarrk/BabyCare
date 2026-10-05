import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { googleWebClientId } from '@/lib/env';
import { GoogleSignInUnavailableError } from '@/lib/errors';
import { getFirebaseAuth } from '@/lib/firebase';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let module_: GoogleModule | null | undefined;
let configured = false;

/**
 * Loaded on first use, not at import time: the library is native code, so Expo Go doesn't have it
 * and importing it there would fail. Null wherever Google sign-in can't work.
 */
function google(): GoogleModule | null {
  if (module_ === undefined) {
    try {
      const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
      module_ = !googleWebClientId || inExpoGo ? null : (require('@react-native-google-signin/google-signin') as GoogleModule);
    } catch {
      module_ = null;
    }
  }
  return module_;
}

export type GoogleSignInResult = 'signed-in' | 'cancelled';

/**
 * Asks Google for an ID token and signs into Firebase with it. This both signs in and signs up:
 * Firebase creates the account the first time, with the name and email from the Google account.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const lib = google();
  if (!lib) throw new GoogleSignInUnavailableError();
  const { GoogleSignin, statusCodes, isErrorWithCode } = lib;

  if (!configured) {
    GoogleSignin.configure({ webClientId: googleWebClientId });
    configured = true;
  }

  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return 'cancelled';
    idToken = response.data.idToken;
  } catch (error) {
    if (
      isErrorWithCode(error) &&
      (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)
    ) {
      return 'cancelled';
    }
    if (__DEV__) console.warn('Google sign-in failed', error);
    throw error;
  }
  if (!idToken) throw new Error('Google did not return an ID token.');

  await signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken));
  return 'signed-in';
}

/** Forgets the Google account on this device so the next sign-in offers the account chooser. */
export async function forgetGoogleAccount(): Promise<void> {
  try {
    await google()?.GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or not configured; nothing to forget.
  }
}
