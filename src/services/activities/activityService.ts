import { push, ref } from 'firebase/database';

import {
  finishPatch,
  toActivityPatch,
  toActivityRecord,
  type ActivityFormValues,
  type Actor,
} from '@/features/activities/schemas';
import type { ActivityOp } from '@/lib/activity/ops';
import { getFirebaseDatabase } from '@/lib/firebase';
import type { Activity } from '@/types/activity';

import { enqueue } from './writeQueue';

/** Which baby an action is for, and who is doing it. */
export interface ActivityContext {
  roomId: string;
  babyId: string;
  actor: Actor;
}

const newOpId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const base = (ctx: ActivityContext, id: string) => ({
  opId: newOpId(),
  roomId: ctx.roomId,
  babyId: ctx.babyId,
  id,
  queuedAt: Date.now(),
});

/** Client-generated ids mean a retried or replayed create can never duplicate an activity. */
function newActivityId(ctx: ActivityContext): string {
  const key = push(ref(getFirebaseDatabase(), `rooms/${ctx.roomId}/babies/${ctx.babyId}/activities`)).key;
  if (!key) throw new Error('Could not allocate an id');
  return key;
}

function queue(op: ActivityOp) {
  enqueue(op);
}

/** Logs a new activity (or starts a timer, if `endedAt` is null for a timed type). */
export function createActivity(
  ctx: ActivityContext,
  values: ActivityFormValues,
  photoUri?: string | null,
): string {
  const record = toActivityRecord(values, ctx.actor);
  const id = newActivityId(ctx);
  queue({ ...base(ctx, id), kind: 'set', record });
  if (photoUri) queue({ ...base(ctx, id), kind: 'photo', localUri: photoUri, attempts: 0 });
  return id;
}

export function updateActivity(
  ctx: ActivityContext,
  activity: Activity,
  values: ActivityFormValues,
  photoUri?: string | null,
): void {
  queue({ ...base(ctx, activity.id), kind: 'update', patch: toActivityPatch(values, ctx.actor) });
  if (photoUri) queue({ ...base(ctx, activity.id), kind: 'photo', localUri: photoUri, attempts: 0 });
}

/** Ends a running timer now. */
export function finishActivity(ctx: ActivityContext, activity: Activity): void {
  queue({ ...base(ctx, activity.id), kind: 'update', patch: finishPatch(activity.startedAt, ctx.actor) });
}

export function deleteActivity(ctx: ActivityContext, activity: Activity): void {
  queue({ ...base(ctx, activity.id), kind: 'delete', photoPath: activity.photoPath });
}
