import { addDays, dayKey, startOfDay } from '@/lib/date/zone';
import { isTimedType, type Activity, type ActivityType } from '@/types/activity';

export interface Summary {
  feeding: { count: number; totalSeconds: number; averageSeconds: number; averageIntervalSeconds: number | null };
  diaper: { total: number; pee: number; poop: number; both: number; dry: number };
  sleep: { count: number; totalSeconds: number; averageSeconds: number };
  bath: { count: number; totalSeconds: number };
  outdoor: { count: number; totalSeconds: number };
  notes: { count: number };
  /** Number of activities each person logged, most active first. */
  caregivers: { uid: string; name: string; count: number }[];
  total: number;
}

/** Seconds an activity covers; a running timer counts up to `now`. */
export function activitySeconds(activity: Activity, now: number): number {
  if (activity.durationSeconds !== undefined) return activity.durationSeconds;
  if (isTimedType(activity.type) && activity.endedAt === undefined) {
    return Math.max(0, Math.floor((now - activity.startedAt) / 1000));
  }
  return 0;
}

const average = (total: number, count: number) => (count === 0 ? 0 : Math.round(total / count));

export function summarize(activities: readonly Activity[], now: number): Summary {
  const of = (type: ActivityType) => activities.filter((a) => a.type === type);
  const seconds = (list: readonly Activity[]) => list.reduce((sum, a) => sum + activitySeconds(a, now), 0);

  const feeds = of('feeding');
  const sleeps = of('sleep');
  const baths = of('bath');
  const outdoors = of('outdoor');
  const diapers = of('diaper');

  const feedStarts = feeds.map((f) => f.startedAt).sort((a, b) => a - b);
  let intervalTotal = 0;
  for (let i = 1; i < feedStarts.length; i++) intervalTotal += (feedStarts[i] as number) - (feedStarts[i - 1] as number);
  const averageIntervalSeconds =
    feedStarts.length > 1 ? Math.round(intervalTotal / 1000 / (feedStarts.length - 1)) : null;

  const diaperCount = (type: string) => diapers.filter((d) => d.details?.diaperType === type).length;

  const byPerson = new Map<string, { uid: string; name: string; count: number }>();
  for (const a of activities) {
    const entry = byPerson.get(a.createdBy) ?? { uid: a.createdBy, name: a.createdByName, count: 0 };
    entry.count += 1;
    byPerson.set(a.createdBy, entry);
  }

  return {
    feeding: {
      count: feeds.length,
      totalSeconds: seconds(feeds),
      averageSeconds: average(seconds(feeds), feeds.length),
      averageIntervalSeconds,
    },
    diaper: {
      total: diapers.length,
      pee: diaperCount('pee'),
      poop: diaperCount('poop'),
      both: diaperCount('both'),
      dry: diaperCount('dry'),
    },
    sleep: { count: sleeps.length, totalSeconds: seconds(sleeps), averageSeconds: average(seconds(sleeps), sleeps.length) },
    bath: { count: baths.length, totalSeconds: seconds(baths) },
    outdoor: { count: outdoors.length, totalSeconds: seconds(outdoors) },
    notes: { count: of('note').length },
    caregivers: [...byPerson.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    total: activities.length,
  };
}

export interface DayBucket {
  /** `YYYY-MM-DD` in the user's zone. */
  key: string;
  start: number;
  value: number;
}

/**
 * One bucket per calendar day in [rangeStart, rangeEnd), so days with nothing logged still
 * appear as zero. An activity belongs to the day it started on, even if it ran past midnight.
 */
export function dailySeries(
  activities: readonly Activity[],
  type: ActivityType,
  metric: 'count' | 'seconds',
  rangeStart: number,
  rangeEnd: number,
  zone: string,
  now: number,
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const order: DayBucket[] = [];
  for (let day = startOfDay(rangeStart, zone); day < rangeEnd; day = addDays(day, 1, zone)) {
    const bucket = { key: dayKey(day, zone), start: day, value: 0 };
    buckets.set(bucket.key, bucket);
    order.push(bucket);
  }
  for (const a of activities) {
    if (a.type !== type) continue;
    const bucket = buckets.get(dayKey(a.startedAt, zone));
    if (bucket) bucket.value += metric === 'count' ? 1 : activitySeconds(a, now);
  }
  return order;
}

/** Filters to activities that started in [start, end). */
export const inRange = (activities: readonly Activity[], start: number, end: number) =>
  activities.filter((a) => a.startedAt >= start && a.startedAt < end);

export const latestOfType = (activities: readonly Activity[], type: ActivityType): Activity | undefined =>
  activities.reduce<Activity | undefined>(
    (latest, a) => (a.type === type && (!latest || a.startedAt > latest.startedAt) ? a : latest),
    undefined,
  );

/** Running timers, newest first. */
export const runningTimers = (activities: readonly Activity[]) =>
  activities.filter((a) => isTimedType(a.type) && a.endedAt === undefined).sort((a, b) => b.startedAt - a.startedAt);
