import { useEffect, useMemo, useState } from 'react';

import { useActivities } from '@/hooks/useActivities';
import { useBabies } from '@/hooks/useBabies';
import { useTimeZone } from '@/hooks/useSettings';
import { applyOps } from '@/lib/activity/ops';
import { inRange } from '@/lib/activity/summary';
import type { DateRange } from '@/lib/date/range';
import { addDays, startOfDay } from '@/lib/date/zone';
import { fetchActivityRange } from '@/services/activities/activitySync';
import { useActivityStore } from '@/stores/activityStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Activity } from '@/types/activity';

const FETCH_TIMEOUT_MS = 8000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });

/**
 * Activities that started in `range`. Ranges inside the live window (the last week by default)
 * come straight from it, so they work offline and update instantly. Older ranges are fetched
 * once, with this device's unsynced changes overlaid.
 */
export function useRangeActivities(range: DateRange | null) {
  const { current } = useBabies();
  const { activities: live } = useActivities();
  const zone = useTimeZone();
  const days = useActivityStore((s) => s.days);
  const ops = useSyncStore((s) => s.ops);

  const windowStart = addDays(startOfDay(Date.now(), zone), -(days - 1), zone);
  const needsFetch = !!range && !!current && range.start < windowStart;

  const [fetched, setFetched] = useState<{ key: string; items: Activity[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const rangeKey = range && current ? `${current.roomId}/${current.id}/${range.start}/${range.end}` : null;
  const start = range?.start;
  const end = range?.end;
  const roomId = current?.roomId;
  const babyId = current?.id;

  useEffect(() => {
    if (!needsFetch || start === undefined || end === undefined || !roomId || !babyId || !rangeKey) {
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    withTimeout(fetchActivityRange(roomId, babyId, start, end), FETCH_TIMEOUT_MS)
      .then((items) => !cancelled && setFetched({ key: rangeKey, items }))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [needsFetch, start, end, roomId, babyId, rangeKey]);

  const activities = useMemo<Activity[]>(() => {
    if (!range || !current) return [];
    if (!needsFetch) return inRange(live, range.start, range.end);
    // Offline or still loading: show whatever part of the range the live window already has.
    if (!fetched || fetched.key !== rangeKey) return inRange(live, range.start, range.end);
    const byId = Object.fromEntries(fetched.items.map((a) => [a.id, a]));
    const merged = applyOps(byId, ops, current.roomId, current.id);
    return inRange(Object.values(merged), range.start, range.end);
  }, [range, current, needsFetch, live, fetched, rangeKey, ops]);

  return { activities, loading: needsFetch && loading, partial: needsFetch && failed };
}
