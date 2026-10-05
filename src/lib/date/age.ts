const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface Age {
  days: number;
  weeks: number;
  /** Completed calendar months. */
  months: number;
  years: number;
}

/** Parses `YYYY-MM-DD`, returning null for malformed or non-existent dates (e.g. Feb 30). */
export function parseDateString(value: string): CalendarDate | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Formats a Date's local calendar day as `YYYY-MM-DD`. */
export function toDateString(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Formats a Date's local time as `HH:mm`. */
export function toTimeString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Whole calendar days from `from` to `to`; DST-safe because it works in UTC. */
function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Age of someone born on `birthDate` as of `today` (local calendar day).
 * Returns null if the date is invalid or in the future.
 */
export function calculateAge(birthDate: string, today: Date = new Date()): Age | null {
  const birth = parseDateString(birthDate);
  if (!birth) return null;
  const now: CalendarDate = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  const days = daysBetween(birth, now);
  if (days < 0) return null;

  let months = (now.year - birth.year) * 12 + (now.month - birth.month);
  if (now.day < birth.day) months -= 1;
  months = Math.max(0, months);

  return { days, weeks: Math.floor(days / 7), months, years: Math.floor(months / 12) };
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * Human-readable age that switches unit as the baby grows:
 * days (under 2 weeks), weeks (under 9 weeks), months (under 2 years), then years.
 */
export function formatAge(birthDate: string, today: Date = new Date()): string {
  const age = calculateAge(birthDate, today);
  if (!age) return '';
  if (age.days === 0) return 'Born today';
  if (age.days < 14) return `${plural(age.days, 'day')} old`;
  if (age.days < 63) return `${plural(age.weeks, 'week')} old`;
  if (age.months < 24) return `${plural(age.months, 'month')} old`;
  return `${plural(age.years, 'year')} old`;
}
