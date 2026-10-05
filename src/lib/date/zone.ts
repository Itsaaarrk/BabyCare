/**
 * Time zone helpers. Timestamps are UTC milliseconds everywhere; "which day is this?" depends
 * on the user's time zone, which is either the device's current zone ('device', so travel and
 * zone changes are followed automatically) or a chosen IANA zone such as "Asia/Manila".
 */
export type TimeZoneSetting = 'device' | (string & {});

const DAY_MS = 86_400_000;

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function resolveTimeZone(setting: TimeZoneSetting): string {
  return setting === 'device' ? deviceTimeZone() : setting;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(ms: number, zone: string): Parts {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, formatter);
  }
  const result: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result as unknown as Parts;
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function offsetAt(ms: number, zone: string): number {
  const p = partsIn(ms, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** The UTC instant at which the zone's wall clock reads the given date and time. */
function zonedToUtc(year: number, month: number, day: number, zone: string, hour = 0, minute = 0): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle on the right offset even when the guess lands across a DST change.
  let utc = wall - offsetAt(wall, zone);
  utc = wall - offsetAt(utc, zone);
  return utc;
}

/** Midnight at the start of the day containing `ms`, in the given zone. */
export function startOfDay(ms: number, zone: string): number {
  const p = partsIn(ms, zone);
  return zonedToUtc(p.year, p.month, p.day, zone);
}

/** Start of the day `days` calendar days after the day starting at `dayStart` (DST-safe). */
export function addDays(dayStart: number, days: number, zone: string): number {
  const p = partsIn(dayStart + DAY_MS / 2, zone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedToUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), zone);
}

/** `YYYY-MM-DD` of the day containing `ms` in the zone. */
export function dayKey(ms: number, zone: string): string {
  const p = partsIn(ms, zone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Combines a `YYYY-MM-DD` date and `HH:mm` time, read in the zone, into a UTC instant. */
export function fromLocalParts(date: string, time: string, zone: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  return zonedToUtc(Number(d[1]), Number(d[2]), Number(d[3]), zone, Number(t[1]), Number(t[2]));
}

/** `HH:mm` of the instant in the zone. */
export function timePart(ms: number, zone: string): string {
  const p = partsIn(ms, zone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function formatClock(ms: number, zone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}

export function formatDayLabel(ms: number, zone: string, now: number, locale?: string): string {
  const today = startOfDay(now, zone);
  const day = startOfDay(ms, zone);
  if (day === today) return 'Today';
  if (day === addDays(today, -1, zone)) return 'Yesterday';
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}
