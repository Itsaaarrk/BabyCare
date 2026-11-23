import { formatDuration } from '@/lib/activity/duration';
import { activitySeconds } from '@/lib/activity/summary';
import { ACTIVITY_META } from '@/lib/activity/meta';
import { isTimedType, type Activity } from '@/types/activity';

/**
 * Plain-language observations about the last week, computed on the device from logged data.
 * They describe patterns and gaps in the logging only: no thresholds of what is "normal" and no
 * advice, so nothing here should read as medical guidance.
 */
export interface Insight {
  id: string;
  /** `trend`: how this week compares. `pattern`: an observation. `nudge`: a logging tip. */
  kind: 'trend' | 'pattern' | 'nudge';
  text: string;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Changes smaller than this, week over week, are described as steady. */
const STEADY_RATIO = 0.1;
/** Fewer days with any log than this and a week isn't compared. */
const MIN_ACTIVE_DAYS = 4;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const perDay = (n: number) => (n / 7).toFixed(n / 7 >= 10 ? 0 : 1).replace(/\.0$/, '');

function activeDays(list: readonly Activity[]): number {
  return new Set(list.map((a) => Math.floor(a.startedAt / DAY_MS))).size;
}

function change(current: number, previous: number): { word: string; ratio: number } | null {
  if (previous <= 0) return null;
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < STEADY_RATIO) return { word: 'about the same as', ratio };
  return { word: ratio > 0 ? `${pct(ratio)} more than` : `${pct(-ratio)} less than`, ratio };
}

/** Finished entries of a timed type, oldest first. */
const finished = (list: readonly Activity[], type: Activity['type']) =>
  list.filter((a) => a.type === type && a.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt);

export function buildInsights(activities: readonly Activity[], now: number): Insight[] {
  const out: Insight[] = [];
  const week = activities.filter((a) => a.startedAt >= now - WEEK_MS && a.startedAt < now);
  const prev = activities.filter((a) => a.startedAt >= now - 2 * WEEK_MS && a.startedAt < now - WEEK_MS);
  const compare = activeDays(prev) >= MIN_ACTIVE_DAYS;
  if (activeDays(week) < MIN_ACTIVE_DAYS) {
    return [
      {
        id: 'not-enough',
        kind: 'nudge',
        text: 'Keep logging for a few more days and insights about the week will show up here.',
      },
    ];
  }

  // Sleep: daily total and the longest stretch.
  const sleeps = finished(week, 'sleep');
  if (sleeps.length > 0) {
    const total = sleeps.reduce((s, a) => s + activitySeconds(a, now), 0);
    const prevTotal = finished(prev, 'sleep').reduce((s, a) => s + activitySeconds(a, now), 0);
    const c = compare ? change(total, prevTotal) : null;
    out.push({
      id: 'sleep-total',
      kind: c ? 'trend' : 'pattern',
      text:
        `Logged sleep averaged ${formatDuration(Math.round(total / 7))} a day this week` +
        (c ? `, ${c.word} the week before.` : '.'),
    });
    const longest = sleeps.reduce((best, a) => (activitySeconds(a, now) > activitySeconds(best, now) ? a : best));
    out.push({
      id: 'sleep-longest',
      kind: 'pattern',
      text: `The longest sleep this week was ${formatDuration(activitySeconds(longest, now))}.`,
    });
  }

  // Feeding: how many a day and the usual gap.
  const feeds = week.filter((a) => a.type === 'feeding').sort((a, b) => a.startedAt - b.startedAt);
  if (feeds.length > 1) {
    const prevFeeds = prev.filter((a) => a.type === 'feeding').length;
    const c = compare ? change(feeds.length, prevFeeds) : null;
    const gaps: number[] = [];
    for (let i = 1; i < feeds.length; i++) gaps.push((feeds[i]!.startedAt - feeds[i - 1]!.startedAt) / 1000);
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)]!;
    out.push({
      id: 'feeding',
      kind: c ? 'trend' : 'pattern',
      text:
        `About ${perDay(feeds.length)} feeds a day this week` +
        (c ? ` (${c.word} the week before)` : '') +
        `, usually ${formatDuration(Math.round(medianGap))} apart.`,
    });
  }

  // Breastfeeding sides.
  const breast = feeds.filter((a) => a.details?.feedingType === 'breast');
  const left = breast.filter((a) => a.details?.side === 'left').length;
  const right = breast.filter((a) => a.details?.side === 'right').length;
  if (left + right >= 10) {
    const share = Math.max(left, right) / (left + right);
    if (share >= 0.6) {
      out.push({
        id: 'sides',
        kind: 'pattern',
        text: `The ${left > right ? 'left' : 'right'} side was logged for ${pct(share)} of one-side breastfeeds this week.`,
      });
    }
  }

  // Diapers.
  const diapers = week.filter((a) => a.type === 'diaper').length;
  if (diapers > 0) {
    const c = compare ? change(diapers, prev.filter((a) => a.type === 'diaper').length) : null;
    out.push({
      id: 'diapers',
      kind: c ? 'trend' : 'pattern',
      text: `About ${perDay(diapers)} diaper changes a day` + (c ? `, ${c.word} the week before.` : '.'),
    });
  }

  // Logging nudges: gaps that make the charts less useful.
  const bottles = feeds.filter((a) => a.details?.feedingType === 'bottle' || a.details?.feedingType === 'formula');
  const noAmount = bottles.filter((a) => a.details?.amount === undefined).length;
  if (bottles.length >= 3 && noAmount / bottles.length >= 0.5) {
    out.push({
      id: 'nudge-amount',
      kind: 'nudge',
      text: `${noAmount} of ${bottles.length} bottle feeds have no amount, so intake can’t be charted. Add the amount when you log a bottle.`,
    });
  }
  const noSide = breast.filter((a) => !a.details?.side).length;
  if (breast.length >= 5 && noSide / breast.length >= 0.2) {
    out.push({
      id: 'nudge-side',
      kind: 'nudge',
      text: `${noSide} of ${breast.length} breastfeeds have no side recorded.`,
    });
  }
  const quick = week.filter(
    (a) => isTimedType(a.type) && a.endedAt !== undefined && a.endedAt - a.startedAt < 60_000,
  ).length;
  if (quick >= 5) {
    out.push({
      id: 'nudge-short',
      kind: 'nudge',
      text: `${quick} timers were stopped within a minute. If you’re logging after the fact, “Log one that already happened” keeps the real length.`,
    });
  }
  for (const a of activities) {
    if (isTimedType(a.type) && a.endedAt === undefined && now - a.startedAt > 12 * 3_600_000) {
      out.push({
        id: `nudge-running-${a.id}`,
        kind: 'nudge',
        text: `A ${ACTIVITY_META[a.type].label.toLowerCase()} timer has been running for ${formatDuration(
          Math.round((now - a.startedAt) / 1000),
        )}. Finish it if it’s over.`,
      });
    }
  }

  return out;
}
