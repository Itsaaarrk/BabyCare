import { isRecentSignIn, RECENT_SIGN_IN_MS } from '../../functions/src/account';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const seconds = (ms: number) => ms / 1000;

describe('isRecentSignIn', () => {
  it('accepts a sign-in from the last few minutes', () => {
    expect(isRecentSignIn(seconds(NOW), NOW)).toBe(true);
    expect(isRecentSignIn(seconds(NOW - 60_000), NOW)).toBe(true);
    expect(isRecentSignIn(seconds(NOW - RECENT_SIGN_IN_MS), NOW)).toBe(true);
  });

  it('rejects an older one, even by a second', () => {
    expect(isRecentSignIn(seconds(NOW - RECENT_SIGN_IN_MS - 1000), NOW)).toBe(false);
    expect(isRecentSignIn(seconds(NOW - 24 * 3_600_000), NOW)).toBe(false);
  });

  it('tolerates a little clock skew but not a token from the future', () => {
    expect(isRecentSignIn(seconds(NOW + 30_000), NOW)).toBe(true);
    expect(isRecentSignIn(seconds(NOW + 10 * 60_000), NOW)).toBe(false);
  });

  it('rejects a missing or malformed claim', () => {
    for (const bad of [undefined, null, '', 'now', NaN, Infinity, {}, []]) {
      expect(isRecentSignIn(bad, NOW)).toBe(false);
    }
  });
});
