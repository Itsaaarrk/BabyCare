import {
  FREE_LIMITS,
  PLUS_FEATURES,
  PLUS_LIMITS,
  type Limits,
  type PremiumFeature,
} from './config';

// The same rules run on the server (functions/src/billing.ts), which is what actually enforces
// them. src/lib/billing/parity.test.ts fails if the two ever disagree.

export const PLANS = ['free', 'plus_monthly', 'plus_yearly', 'lifetime'] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['none', 'active', 'grace_period', 'paused', 'cancelled', 'expired'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** The room's plan as stored at rooms/{roomId}/entitlement. Written only by Cloud Functions. */
export interface RoomEntitlement {
  plan: Plan;
  status: SubscriptionStatus;
  /** Subscriptions only; lifetime never expires. */
  expiresAt?: number | null;
  updatedAt: number;
}

const isPlan = (v: unknown): v is Plan => typeof v === 'string' && (PLANS as readonly string[]).includes(v);
const isStatus = (v: unknown): v is SubscriptionStatus =>
  typeof v === 'string' && (SUBSCRIPTION_STATUSES as readonly string[]).includes(v);

/** Reads whatever is stored; anything unrecognised counts as no entitlement (Free). */
export function parseEntitlement(value: unknown): RoomEntitlement | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isPlan(raw.plan) || !isStatus(raw.status)) return null;
  return {
    plan: raw.plan,
    status: raw.status,
    expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : null,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

/**
 * True when the room currently has BabyCare Plus. Decided from the dates as well as the status, so a
 * stale or cached record can never grant access forever: a lifetime purchase has no expiry, a
 * cancelled subscription stays active until it runs out, paused and expired ones don't count.
 */
export function isPlusActive(entitlement: RoomEntitlement | null | undefined, now: number): boolean {
  if (!entitlement || entitlement.plan === 'free') return false;
  if (entitlement.plan === 'lifetime') return entitlement.status === 'active';
  const live =
    entitlement.status === 'active' ||
    entitlement.status === 'grace_period' ||
    entitlement.status === 'cancelled';
  return live && typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now;
}

export interface EffectivePlan {
  /** Whether the room has Plus right now. */
  isPlus: boolean;
  /** `free` whenever Plus isn't active, even if an old record says otherwise. */
  plan: Plan;
  status: SubscriptionStatus;
  /** True for a subscription that won't renew but still runs until `expiresAt`. */
  endsAtPeriodEnd: boolean;
  expiresAt: number | null;
}

export function effectivePlan(entitlement: RoomEntitlement | null | undefined, now: number): EffectivePlan {
  if (!entitlement || !isPlusActive(entitlement, now)) {
    return { isPlus: false, plan: 'free', status: 'none', endsAtPeriodEnd: false, expiresAt: null };
  }
  return {
    isPlus: true,
    plan: entitlement.plan,
    status: entitlement.status,
    endsAtPeriodEnd: entitlement.status === 'cancelled',
    expiresAt: entitlement.plan === 'lifetime' ? null : (entitlement.expiresAt ?? null),
  };
}

export const limitsFor = (entitlement: RoomEntitlement | null | undefined, now: number): Limits =>
  isPlusActive(entitlement, now) ? PLUS_LIMITS : FREE_LIMITS;

/** The one place that answers "may this room use this feature?". Don't compare plan names elsewhere. */
export function hasFeature(
  entitlement: RoomEntitlement | null | undefined,
  feature: PremiumFeature,
  now: number,
): boolean {
  return isPlusActive(entitlement, now) && PLUS_FEATURES.includes(feature);
}

/** "Monthly", "Yearly" or "Lifetime" for display. */
export const PLAN_LABEL: Record<Exclude<Plan, 'free'>, string> = {
  plus_monthly: 'Monthly',
  plus_yearly: 'Yearly',
  lifetime: 'Lifetime',
};
