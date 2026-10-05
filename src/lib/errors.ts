import type { FirebaseError } from 'firebase/app';

/** Duck-typed so this file needs no runtime import of the Firebase SDK (keeps screens and tests light). */
const isFirebaseError = (error: unknown): error is FirebaseError =>
  error instanceof Error && error.name === 'FirebaseError' && typeof (error as { code?: unknown }).code === 'string';

const GENERIC = 'Something went wrong. Please try again.';

const REASON_MESSAGES: Record<string, string> = {
  'invalid-code': "That code isn't valid. Check it and try again.",
  'invite-expired': 'That invitation has expired. Ask for a new code.',
  'too-many-attempts': 'Too many attempts. Please wait a while and try again.',
  'room-full': 'This family room is full.',
  'room-limit': "You've reached the limit of family rooms.",
  'owned-room-limit': 'You already have a family room.',
  'baby-limit': 'This family room has reached its limit for babies.',
  'recent-login-required': 'Please sign in again to confirm.',
  'owns-room': 'You own a family room. Delete the room first, then you can delete your account.',
  'not-allowed': "You don't have permission to do that.",
  'not-found': "We couldn't find that. It may have been removed.",
};

/** Cloud Functions attach a machine-readable `reason` we can turn into friendly text. */
function reasonOf(error: FirebaseError): string | undefined {
  const details = (error as { details?: unknown }).details;
  if (typeof details === 'object' && details !== null && 'reason' in details) {
    const reason = (details as { reason: unknown }).reason;
    return typeof reason === 'string' ? REASON_MESSAGES[reason] : undefined;
  }
  return undefined;
}

/** Google sign-in can't run here: Expo Go has no native module for it, or the client ID is unset. */
export class GoogleSignInUnavailableError extends Error {
  constructor() {
    super('Google sign-in is unavailable in this build.');
    this.name = 'GoogleSignInUnavailableError';
  }
}

/** Development builds only (not release builds, not tests): show what actually went wrong. */
const showErrorDetails = __DEV__ && process.env.NODE_ENV !== 'test';

/** The raw error as one readable line: its code where it has one, then its message. */
function describe(error: unknown): string {
  if (isFirebaseError(error)) {
    const reason = (error as { details?: { reason?: unknown } }).details?.reason;
    const url = (error.customData as { url?: unknown } | undefined)?.url;
    return (
      `${error.code}${typeof reason === 'string' ? ` (${reason})` : ''}: ${error.message}` +
      (typeof url === 'string' ? ` — ${url}` : '')
    );
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return `${typeof code === 'string' ? `${code}: ` : `${error.name}: `}${error.message}`;
  }
  return String(error);
}

/** For failures the UI recovers from quietly: while developing, say what failed and why. */
export function logHandled(context: string, error: unknown): void {
  if (showErrorDetails) console.warn(`[BabyCare] ${context}: ${describe(error)}`);
}

/** Development-only trace line, for following a flow that fails without throwing. */
export function logTrace(message: string): void {
  if (showErrorDetails) console.log(`[BabyCare] ${message}`);
}

/** A line to append to an on-screen message while developing; empty in release builds. */
export const errorDetails = (error: unknown): string =>
  showErrorDetails ? `\n\nDetails: ${describe(error)}` : '';

/**
 * Maps raw Firebase/internal errors to a sentence people can act on. While developing, the real
 * error is added underneath and logged to the Metro terminal, so a failure is never a mystery.
 */
export function toUserMessage(error: unknown): string {
  const message = friendlyMessage(error);
  if (!showErrorDetails) return message;
  const details = describe(error);
  console.warn(`[BabyCare] handled error: ${details}`);
  return `${message}\n\nDetails: ${details}`;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof GoogleSignInUnavailableError) {
    return 'Google sign-in needs a development build. It doesn’t work in Expo Go.';
  }
  if (isFirebaseError(error)) {
    const fromReason = reasonOf(error);
    if (fromReason) return fromReason;
    switch (error.code) {
      case 'functions/unavailable':
      case 'functions/deadline-exceeded':
        return 'No connection. Check your internet and try again.';
      case 'auth/invalid-email':
        return "That email address doesn't look right.";
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 8 characters).';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'An account with this email already exists. Sign in with your password instead.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in isn’t turned on for this app yet.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'PERMISSION_DENIED':
      case 'permission-denied':
        return "You don't have permission to do that.";
      default:
        return GENERIC;
    }
  }
  return GENERIC;
}
