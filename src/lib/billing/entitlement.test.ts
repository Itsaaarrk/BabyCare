import { FREE_LIMITS, PLUS_LIMITS } from './config';
import {
  effectivePlan,
  hasFeature,
  isPlusActive,
  limitsFor,
  parseEntitlement,
  type RoomEntitlement,
} from './entitlement';

const NOW = Date.UTC(2026, 9, 5, 12, 0);
const DAY = 86_400_000;

const sub = (over: Partial<RoomEntitlement> = {}): RoomEntitlement => ({
  plan: 'plus_yearly',
  status: 'active',
  expiresAt: NOW + 30 * DAY,
  updatedAt: NOW,
  ...over,
});
const lifetime = (over: Partial<RoomEntitlement> = {}): RoomEntitlement => ({
  plan: 'lifetime',
  status: 'active',
  expiresAt: null,
  updatedAt: NOW,
  ...over,
});

describe('isPlusActive', () => {
  it('is false with no entitlement or the free plan', () => {
    expect(isPlusActive(null, NOW)).toBe(false);
    expect(isPlusActive(undefined, NOW)).toBe(false);
    expect(isPlusActive({ plan: 'free', status: 'active', expiresAt: NOW + DAY, updatedAt: 0 }, NOW)).toBe(false);
  });

  it('treats monthly and yearly the same', () => {
    expect(isPlusActive(sub({ plan: 'plus_monthly' }), NOW)).toBe(true);
    expect(isPlusActive(sub({ plan: 'plus_yearly' }), NOW)).toBe(true);
  });

  it('keeps a subscription active through grace period and after cancelling, until it runs out', () => {
    expect(isPlusActive(sub({ status: 'grace_period' }), NOW)).toBe(true);
    expect(isPlusActive(sub({ status: 'cancelled' }), NOW)).toBe(true);
    expect(isPlusActive(sub({ status: 'cancelled', expiresAt: NOW - 1 }), NOW)).toBe(false);
  });

  it('ends a subscription at its date even if the stored status still says active', () => {
    expect(isPlusActive(sub({ expiresAt: NOW - 1 }), NOW)).toBe(false);
    expect(isPlusActive(sub({ expiresAt: NOW }), NOW)).toBe(false);
    expect(isPlusActive(sub({ expiresAt: NOW + 1 }), NOW)).toBe(true);
  });

  it('does not count paused, expired or missing-status subscriptions', () => {
    for (const status of ['paused', 'expired', 'none'] as const) {
      expect(isPlusActive(sub({ status }), NOW)).toBe(false);
    }
  });

  it('never grants a subscription that has no expiry date', () => {
    expect(isPlusActive(sub({ expiresAt: null }), NOW)).toBe(false);
    expect(isPlusActive(sub({ expiresAt: undefined }), NOW)).toBe(false);
  });

  it('keeps lifetime active with no expiry, however far in the future', () => {
    expect(isPlusActive(lifetime(), NOW)).toBe(true);
    expect(isPlusActive(lifetime(), NOW + 100 * 365 * DAY)).toBe(true);
  });

  it('ends lifetime only when it is revoked, such as after a refund', () => {
    expect(isPlusActive(lifetime({ status: 'expired' }), NOW)).toBe(false);
    expect(isPlusActive(lifetime({ status: 'none' }), NOW)).toBe(false);
  });
});

describe('effectivePlan', () => {
  it('reports Free for no entitlement and for a lapsed one', () => {
    const free = { isPlus: false, plan: 'free', status: 'none', endsAtPeriodEnd: false, expiresAt: null };
    expect(effectivePlan(null, NOW)).toEqual(free);
    expect(effectivePlan(sub({ expiresAt: NOW - DAY }), NOW)).toEqual(free);
  });

  it('describes an active subscription and a cancelled one that has not ended', () => {
    expect(effectivePlan(sub(), NOW)).toMatchObject({ isPlus: true, plan: 'plus_yearly', endsAtPeriodEnd: false });
    expect(effectivePlan(sub({ status: 'cancelled' }), NOW)).toMatchObject({
      isPlus: true,
      endsAtPeriodEnd: true,
      expiresAt: NOW + 30 * DAY,
    });
  });

  it('shows lifetime with no end date', () => {
    expect(effectivePlan(lifetime(), NOW)).toMatchObject({ isPlus: true, plan: 'lifetime', expiresAt: null });
  });
});

describe('limits and features', () => {
  it('gives Plus the same limits whichever plan paid for it', () => {
    expect(limitsFor(null, NOW)).toBe(FREE_LIMITS);
    for (const e of [sub({ plan: 'plus_monthly' }), sub({ plan: 'plus_yearly' }), lifetime()]) {
      expect(limitsFor(e, NOW)).toBe(PLUS_LIMITS);
    }
    expect(limitsFor(sub({ expiresAt: NOW - 1 }), NOW)).toBe(FREE_LIMITS);
  });

  it('keeps lifetime storage at the Plus allowance, not unlimited', () => {
    expect(limitsFor(lifetime(), NOW).maxPhotoStorageBytes).toBe(PLUS_LIMITS.maxPhotoStorageBytes);
    expect(Number.isFinite(limitsFor(lifetime(), NOW).maxPhotoStorageBytes)).toBe(true);
  });

  it('answers feature questions the same for every Plus plan', () => {
    for (const e of [sub({ plan: 'plus_monthly' }), sub({ plan: 'plus_yearly' }), lifetime()]) {
      expect(hasFeature(e, 'multiple_babies', NOW)).toBe(true);
    }
    expect(hasFeature(null, 'multiple_babies', NOW)).toBe(false);
    expect(hasFeature(sub({ status: 'expired' }), 'multiple_babies', NOW)).toBe(false);
  });
});

describe('parseEntitlement', () => {
  it('reads a stored record', () => {
    expect(parseEntitlement({ plan: 'plus_monthly', status: 'active', expiresAt: 5, updatedAt: 3 })).toEqual({
      plan: 'plus_monthly',
      status: 'active',
      expiresAt: 5,
      updatedAt: 3,
    });
  });

  it('treats anything unrecognised as no entitlement', () => {
    for (const bad of [null, undefined, 'plus', 5, [], {}, { plan: 'platinum', status: 'active' }, { plan: 'lifetime', status: 'forever' }]) {
      expect(parseEntitlement(bad)).toBeNull();
    }
  });
});
