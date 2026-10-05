/**
 * Everything about plans that a business owner may want to change lives here: product ids, the
 * fallback prices, the limits, and which Plus features are really available. Screens read from
 * this file; they don't hard-code prices, limits or plan names.
 */

/**
 * Google Play structure: one subscription with two base plans, plus one one-time product. A single
 * subscription lets Play handle upgrades and downgrades between monthly and yearly itself.
 */
export const BILLING_PRODUCTS = {
  plusSubscription: 'babycare_plus',
  basePlans: { monthly: 'monthly', yearly: 'yearly' },
  lifetime: 'babycare_lifetime',
} as const;

export type PlanChoice = 'monthly' | 'yearly' | 'lifetime';

export const PLAN_NAME = 'BabyCare Plus';

/** Where Google Play lets people see and cancel their subscriptions. */
export const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/**
 * Shown only until Google Play returns the real, localized price. Prices are in micros of the
 * currency (1,000,000 = one peso), the same unit Play uses, so the maths is identical.
 */
export const FALLBACK_PRICES: Record<PlanChoice, { amountMicros: number; currency: string }> = {
  monthly: { amountMicros: 129_000_000, currency: 'PHP' },
  yearly: { amountMicros: 999_000_000, currency: 'PHP' },
  lifetime: { amountMicros: 1_999_000_000, currency: 'PHP' },
};

/** Limits per plan. The server enforces the baby and room limits; storage is not yet measured. */
export const FREE_LIMITS = {
  maxBabies: 1,
  maxOwnedRooms: 1,
  maxPhotoStorageBytes: 500 * 1024 * 1024,
} as const;

export const PLUS_LIMITS = {
  maxBabies: 5,
  maxOwnedRooms: 1,
  maxPhotoStorageBytes: 5 * 1024 * 1024 * 1024,
} as const;

export type Limits = { [K in keyof typeof FREE_LIMITS]: number };

export type PremiumFeature =
  | 'multiple_babies'
  | 'premium_storage'
  | 'ad_free'
  | 'advanced_analytics'
  | 'pdf_reports'
  | 'data_export';

/**
 * `launched` is true only for features that work today. The paywall lists launched features only,
 * so it never promises something the app can't do yet. Flip a flag when the feature ships.
 */
export const PREMIUM_FEATURES: Record<PremiumFeature, { label: string; launched: boolean }> = {
  multiple_babies: { label: 'Up to 5 babies in your family room', launched: true },
  premium_storage: { label: 'More photo storage', launched: false },
  ad_free: { label: 'No ads', launched: false },
  advanced_analytics: { label: 'Longer analytics ranges', launched: false },
  pdf_reports: { label: 'PDF reports', launched: false },
  data_export: { label: 'Data export', launched: false },
};

/** Every Plus plan unlocks the same features; Monthly, Yearly and Lifetime don't differ. */
export const PLUS_FEATURES: readonly PremiumFeature[] = Object.keys(PREMIUM_FEATURES) as PremiumFeature[];

/**
 * Upgrade screens appear while developing, and in release builds only when explicitly turned on.
 * Real purchases arrive with Google Play billing; until then nothing here takes payment.
 */
export const billingEnabled = __DEV__ || process.env.EXPO_PUBLIC_BILLING_ENABLED === 'true';
