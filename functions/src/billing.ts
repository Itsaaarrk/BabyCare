// Plan and limit rules, enforced on the server. The app has the same rules in
// src/lib/billing/entitlement.ts so the screens can explain them; a parity test
// (src/lib/billing/parity.test.ts) fails if the two ever disagree. This file has no imports so
// that test can load it.

export const PLANS = ['free', 'plus_monthly', 'plus_yearly', 'lifetime'] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['none', 'active', 'grace_period', 'paused', 'cancelled', 'expired'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** What clients may read at rooms/{roomId}/entitlement. Written only by Cloud Functions. */
export interface RoomEntitlement {
  plan: Plan;
  status: SubscriptionStatus;
  /** Subscriptions only; lifetime never expires. */
  expiresAt?: number | null;
  updatedAt: number;
}

export const FREE_MAX_BABIES = 1;
export const PLUS_MAX_BABIES = 5;
/** Rooms a person may own. "Premium family-room features" aren't defined yet, so Plus matches Free. */
export const FREE_MAX_OWNED_ROOMS = 1;
export const PLUS_MAX_OWNED_ROOMS = 1;

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
 * True when the room currently has BabyCare Plus. Decided from the dates as well as the status, so
 * a stale record can't grant access forever. A lifetime purchase has no expiry; a cancelled
 * subscription stays active until it runs out; paused or expired ones don't count.
 */
export function isPlusActive(entitlement: RoomEntitlement | null, now: number): boolean {
  if (!entitlement || entitlement.plan === 'free') return false;
  if (entitlement.plan === 'lifetime') return entitlement.status === 'active';
  const live =
    entitlement.status === 'active' ||
    entitlement.status === 'grace_period' ||
    entitlement.status === 'cancelled';
  return live && typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now;
}

export const maxBabiesFor = (entitlement: RoomEntitlement | null, now: number) =>
  isPlusActive(entitlement, now) ? PLUS_MAX_BABIES : FREE_MAX_BABIES;

export const maxOwnedRoomsFor = (entitlement: RoomEntitlement | null, now: number) =>
  isPlusActive(entitlement, now) ? PLUS_MAX_OWNED_ROOMS : FREE_MAX_OWNED_ROOMS;

export const GENDERS = ['girl', 'boy', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export interface BabyInput {
  name: string;
  nickname?: string;
  birthDate: string;
  birthTime?: string;
  gender?: Gender;
  notes?: string;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealPastDate(value: string, now: number): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return false;
  }
  // One day of slack for time zones: a baby born "today" in Manila is still tomorrow in UTC.
  return probe.getTime() <= now + 24 * 60 * 60 * 1000;
}

/**
 * Validates a baby profile coming from a client. The Admin SDK ignores the database rules, so the
 * checks the rules make for direct writes (name length, date format, ...) are repeated here.
 */
export function parseBabyInput(raw: unknown, now: number): BabyInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number): string | null => {
    if (v === undefined || v === null) return '';
    return typeof v === 'string' && v.trim().length <= max ? v.trim() : null;
  };

  const name = text(r.name, 60);
  const nickname = text(r.nickname, 40);
  const notes = text(r.notes, 1000);
  const birthTime = text(r.birthTime, 5);
  if (!name || nickname === null || notes === null || birthTime === null) return null;
  if (typeof r.birthDate !== 'string' || !isRealPastDate(r.birthDate, now)) return null;
  if (birthTime !== '' && !TIME.test(birthTime)) return null;
  if (r.gender !== undefined && r.gender !== null && !(GENDERS as readonly unknown[]).includes(r.gender)) return null;

  return {
    name,
    birthDate: r.birthDate,
    ...(nickname ? { nickname } : {}),
    ...(birthTime ? { birthTime } : {}),
    ...(typeof r.gender === 'string' ? { gender: r.gender as Gender } : {}),
    ...(notes ? { notes } : {}),
  };
}
