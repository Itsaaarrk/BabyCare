export const ACTIVITY_TYPES = ['feeding', 'diaper', 'sleep', 'bath', 'outdoor', 'note'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const FEEDING_TYPES = ['breast', 'bottle', 'formula', 'other'] as const;
export type FeedingType = (typeof FEEDING_TYPES)[number];

export const BREAST_SIDES = ['left', 'right', 'both'] as const;
export type BreastSide = (typeof BREAST_SIDES)[number];

export const DIAPER_TYPES = ['pee', 'poop', 'both', 'dry'] as const;
export type DiaperType = (typeof DIAPER_TYPES)[number];

/** Every bath type that can be stored. `other` (shown as plain "Bath") is kept only for older entries. */
export const BATH_TYPES = ['morning', 'afternoon', 'night', 'other'] as const;
export type BathType = (typeof BATH_TYPES)[number];

/** Bath types offered when logging. */
export const BATH_CHOICES: readonly BathType[] = ['morning', 'afternoon', 'night'];

/** A sensible bath type for the time of day (device clock): before noon, before 5 pm, then night. */
export function defaultBathType(now = Date.now()): BathType {
  const hour = new Date(now).getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'night';
}

export const AMOUNT_UNITS = ['ml', 'oz'] as const;
export type AmountUnit = (typeof AMOUNT_UNITS)[number];

/** Type-specific fields, stored under `details`. */
export interface ActivityDetails {
  feedingType?: FeedingType;
  side?: BreastSide;
  amount?: number;
  amountUnit?: AmountUnit;
  diaperType?: DiaperType;
  bathType?: BathType;
  /** Notes only. */
  title?: string;
}

/**
 * An activity as stored at /rooms/{roomId}/babies/{babyId}/activities/{id}. Timestamps are UTC
 * milliseconds. An activity with a duration-based type and no `endedAt` is a running timer.
 */
export interface ActivityRecord {
  type: ActivityType;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  details?: ActivityDetails;
  notes?: string;
  /** Storage path, not a URL. */
  photoPath?: string;
  createdBy: string;
  /** Name snapshot, so the timeline still reads well after a member leaves. */
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface Activity extends ActivityRecord {
  id: string;
  roomId: string;
  babyId: string;
  /** True while a local change hasn't been confirmed by the server yet. */
  pending?: boolean;
}

/** Types that have a start and an end, and so can run as a timer. */
export const TIMED_TYPES: readonly ActivityType[] = ['feeding', 'sleep', 'bath', 'outdoor'];
export const isTimedType = (type: ActivityType) => TIMED_TYPES.includes(type);

export const isRunning = (activity: Pick<ActivityRecord, 'type' | 'endedAt'>) =>
  isTimedType(activity.type) && activity.endedAt === undefined;
