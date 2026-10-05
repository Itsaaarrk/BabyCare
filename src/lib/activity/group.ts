import { dayKey, formatDayLabel } from '@/lib/date/zone';
import type { Activity, ActivityType } from '@/types/activity';

export interface DaySection {
  /** `YYYY-MM-DD` in the user's zone. */
  key: string;
  title: string;
  data: Activity[];
}

/**
 * Groups activities (newest first) into one section per calendar day, labelled "Today",
 * "Yesterday" or a date. Optionally keeps only the given types.
 */
export function groupByDay(
  activities: readonly Activity[],
  zone: string,
  now: number,
  types?: readonly ActivityType[],
  locale?: string,
): DaySection[] {
  const sections: DaySection[] = [];
  for (const activity of activities) {
    if (types && !types.includes(activity.type)) continue;
    const key = dayKey(activity.startedAt, zone);
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.data.push(activity);
    else sections.push({ key, title: formatDayLabel(activity.startedAt, zone, now, locale), data: [activity] });
  }
  return sections;
}
