import {
  endAt,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';

import { getFirebaseDatabase } from '@/lib/firebase';
import { ACTIVITY_TYPES, type Activity, type ActivityRecord } from '@/types/activity';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Drops anything that doesn't look like an activity rather than crashing a list on bad data. */
function parse(roomId: string, babyId: string, snapshot: DataSnapshot): Record<string, Activity> {
  const result: Record<string, Activity> = {};
  snapshot.forEach((child) => {
    const value: unknown = child.val();
    if (
      child.key &&
      isObject(value) &&
      typeof value.startedAt === 'number' &&
      (ACTIVITY_TYPES as readonly unknown[]).includes(value.type)
    ) {
      result[child.key] = {
        ...(value as unknown as ActivityRecord),
        createdByName: typeof value.createdByName === 'string' ? value.createdByName : 'Family member',
        id: child.key,
        roomId,
        babyId,
      };
    }
  });
  return result;
}

const activitiesRef = (roomId: string, babyId: string) =>
  ref(getFirebaseDatabase(), `rooms/${roomId}/babies/${babyId}/activities`);

/** Live feed of activities that started on or after `since`. */
export function subscribeToActivities(
  roomId: string,
  babyId: string,
  since: number,
  onData: (items: Record<string, Activity>) => void,
  onError: () => void,
): Unsubscribe {
  return onValue(
    query(activitiesRef(roomId, babyId), orderByChild('startedAt'), startAt(since)),
    (snapshot) => onData(parse(roomId, babyId, snapshot)),
    onError,
  );
}

/** One-off read of a date range, for analytics and summaries beyond the live window. */
export async function fetchActivityRange(
  roomId: string,
  babyId: string,
  start: number,
  end: number,
): Promise<Activity[]> {
  const snapshot = await get(
    query(activitiesRef(roomId, babyId), orderByChild('startedAt'), startAt(start), endAt(end - 1)),
  );
  return Object.values(parse(roomId, babyId, snapshot));
}
