import { z } from 'zod';

import { MAX_DURATION_SECONDS, durationSeconds } from '@/lib/activity/duration';
import {
  ACTIVITY_TYPES,
  AMOUNT_UNITS,
  BATH_TYPES,
  BREAST_SIDES,
  DIAPER_TYPES,
  FEEDING_TYPES,
  isTimedType,
  type ActivityDetails,
  type ActivityRecord,
  type ActivityType,
} from '@/types/activity';

/** Allows for a little clock drift between devices when rejecting future times. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const activityFormSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    startedAt: z.number().int().positive('Choose a start time'),
    /** `null` means still running (timed types) or not applicable. */
    endedAt: z.number().int().positive().nullable(),
    notes: z.string().trim().max(1000, 'Notes are too long'),
    feedingType: z.enum(FEEDING_TYPES).optional(),
    side: z.enum(BREAST_SIDES).optional(),
    amount: z.string().trim(),
    amountUnit: z.enum(AMOUNT_UNITS),
    diaperType: z.enum(DIAPER_TYPES).optional(),
    bathType: z.enum(BATH_TYPES).optional(),
    title: z.string().trim().max(80, 'Title is too long'),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const now = Date.now();

    if (v.startedAt > now + FUTURE_TOLERANCE_MS) issue('startedAt', 'Start time can’t be in the future');

    if (v.endedAt !== null) {
      if (!isTimedType(v.type)) issue('endedAt', 'This activity has no end time');
      else if (v.endedAt < v.startedAt) issue('endedAt', 'End time must be after the start');
      else if (v.endedAt > now + FUTURE_TOLERANCE_MS) issue('endedAt', 'End time can’t be in the future');
      else if (durationSeconds(v.startedAt, v.endedAt) > MAX_DURATION_SECONDS) {
        issue('endedAt', 'That’s longer than 48 hours. Check the times.');
      }
    }

    if (v.type === 'feeding' && !v.feedingType) issue('feedingType', 'Choose a feeding type');
    if (v.type === 'diaper' && !v.diaperType) issue('diaperType', 'Choose a diaper type');
    if (v.type === 'bath' && !v.bathType) issue('bathType', 'Choose a bath type');
    if (v.type === 'note' && v.title === '') issue('title', 'Add a title');

    if (v.type === 'feeding' && v.amount !== '') {
      const amount = Number(v.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) issue('amount', 'Enter a valid amount');
    }
  });

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export function emptyFormValues(type: ActivityType, startedAt = Date.now()): ActivityFormValues {
  return {
    type,
    startedAt,
    endedAt: null,
    notes: '',
    amount: '',
    amountUnit: 'ml',
    title: '',
    // One-tap defaults for the most common choices.
    feedingType: type === 'feeding' ? 'breast' : undefined,
    bathType: type === 'bath' ? 'night' : undefined,
    diaperType: undefined,
    side: undefined,
  };
}

/** Only the fields that belong to the activity's type are kept. */
export function detailsFor(v: ActivityFormValues): ActivityDetails | undefined {
  switch (v.type) {
    case 'feeding': {
      const details: ActivityDetails = { feedingType: v.feedingType };
      if (v.feedingType === 'breast' && v.side) details.side = v.side;
      if (v.amount !== '') {
        details.amount = Number(v.amount);
        details.amountUnit = v.amountUnit;
      }
      return details;
    }
    case 'diaper':
      return { diaperType: v.diaperType };
    case 'bath':
      return { bathType: v.bathType };
    case 'note':
      return { title: v.title };
    default:
      return undefined;
  }
}

export interface Actor {
  uid: string;
  name: string;
}

/** Builds the record to store for a new activity. */
export function toActivityRecord(input: ActivityFormValues, actor: Actor, now = Date.now()): ActivityRecord {
  const v = activityFormSchema.parse(input);
  const details = detailsFor(v);
  return {
    type: v.type,
    startedAt: v.startedAt,
    ...(v.endedAt !== null && {
      endedAt: v.endedAt,
      durationSeconds: durationSeconds(v.startedAt, v.endedAt),
    }),
    ...(details && { details }),
    ...(v.notes !== '' && { notes: v.notes }),
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: now,
    updatedAt: now,
  };
}

/** Builds a partial update; `null` removes a field. The type and creator never change. */
export function toActivityPatch(
  input: ActivityFormValues,
  actor: Actor,
  now = Date.now(),
): Record<string, unknown> {
  const v = activityFormSchema.parse(input);
  return {
    startedAt: v.startedAt,
    endedAt: v.endedAt ?? null,
    durationSeconds: v.endedAt !== null ? durationSeconds(v.startedAt, v.endedAt) : null,
    details: detailsFor(v) ?? null,
    notes: v.notes !== '' ? v.notes : null,
    updatedAt: now,
    updatedBy: actor.uid,
  };
}

/** Patch that ends a running timer. */
export function finishPatch(startedAt: number, actor: Actor, now = Date.now()): Record<string, unknown> {
  const endedAt = Math.max(now, startedAt);
  return {
    endedAt,
    durationSeconds: durationSeconds(startedAt, endedAt),
    updatedAt: now,
    updatedBy: actor.uid,
  };
}

/** Form values for editing an existing activity. */
export function toFormValues(activity: ActivityRecord): ActivityFormValues {
  const d = activity.details;
  return {
    type: activity.type,
    startedAt: activity.startedAt,
    endedAt: activity.endedAt ?? null,
    notes: activity.notes ?? '',
    feedingType: d?.feedingType,
    side: d?.side,
    amount: d?.amount !== undefined ? String(d.amount) : '',
    amountUnit: d?.amountUnit ?? 'ml',
    diaperType: d?.diaperType,
    bathType: d?.bathType,
    title: d?.title ?? '',
  };
}
