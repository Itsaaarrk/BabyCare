// Rules for deleting an account. No imports, so the app's tests can load this file too.

/**
 * Deleting an account can't be undone, so the person must have signed in just now. A phone that
 * was left unlocked, or a stolen session, can't wipe an account that way.
 */
export const RECENT_SIGN_IN_MS = 5 * 60 * 1000;

/**
 * `authTimeSeconds` is the `auth_time` claim of the caller's ID token: when they last actually
 * signed in (not when the token was last refreshed), in seconds since 1970.
 */
export function isRecentSignIn(authTimeSeconds: unknown, nowMs: number): boolean {
  if (typeof authTimeSeconds !== 'number' || !Number.isFinite(authTimeSeconds)) return false;
  const ageMs = nowMs - authTimeSeconds * 1000;
  // A little clock skew into the future is fine; a token claiming to be far in the future is not.
  return ageMs >= -60_000 && ageMs <= RECENT_SIGN_IN_MS;
}
