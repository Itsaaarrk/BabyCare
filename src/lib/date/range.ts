import { addDays, fromLocalParts, startOfDay } from './zone';

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface DateRange {
  /** Inclusive, UTC milliseconds at the start of the first day. */
  start: number;
  /** Exclusive, UTC milliseconds at the start of the day after the last. */
  end: number;
}

export const MAX_CUSTOM_DAYS = 120;

/**
 * The window for an analytics preset, in whole calendar days of the user's zone.
 * "Last 7 days" includes today, so it covers today and the six days before it.
 * For `custom`, pass `YYYY-MM-DD` dates (inclusive); invalid, reversed or oversized ranges
 * return null.
 */
export function rangeFor(
  preset: RangePreset,
  now: number,
  zone: string,
  custom?: { from: string; to: string },
): DateRange | null {
  const today = startOfDay(now, zone);
  const tomorrow = addDays(today, 1, zone);
  switch (preset) {
    case 'today':
      return { start: today, end: tomorrow };
    case 'yesterday':
      return { start: addDays(today, -1, zone), end: today };
    case '7d':
      return { start: addDays(today, -6, zone), end: tomorrow };
    case '30d':
      return { start: addDays(today, -29, zone), end: tomorrow };
    case 'custom': {
      if (!custom) return null;
      const from = fromLocalParts(custom.from, '00:00', zone);
      const to = fromLocalParts(custom.to, '00:00', zone);
      if (from === null || to === null || to < from) return null;
      const end = addDays(to, 1, zone);
      const days = Math.round((end - from) / 86_400_000);
      return days > MAX_CUSTOM_DAYS ? null : { start: from, end };
    }
  }
}

export const dayCount = (range: DateRange) => Math.round((range.end - range.start) / 86_400_000);
