import {
  addDays,
  dayKey,
  formatDayLabel,
  fromLocalParts,
  isValidTimeZone,
  resolveTimeZone,
  startOfDay,
  timePart,
} from './zone';

const NY = 'America/New_York';
const MANILA = 'Asia/Manila';

describe('startOfDay', () => {
  it('finds local midnight in a fixed-offset zone', () => {
    // 2026-10-04 23:30 Manila (UTC+8) is 15:30 UTC.
    const ms = Date.UTC(2026, 9, 4, 15, 30);
    expect(startOfDay(ms, MANILA)).toBe(Date.UTC(2026, 9, 3, 16, 0));
    // Just after Manila midnight on the 5th is still the 5th.
    expect(startOfDay(Date.UTC(2026, 9, 4, 16, 1), MANILA)).toBe(Date.UTC(2026, 9, 4, 16, 0));
  });

  it('uses the zone, not UTC, to decide the day', () => {
    const ms = Date.UTC(2026, 9, 5, 2, 0); // Oct 4, 22:00 in New York
    expect(dayKey(ms, NY)).toBe('2026-10-04');
    expect(dayKey(ms, 'UTC')).toBe('2026-10-05');
  });

  it('handles the 23-hour spring-forward day and the 25-hour fall-back day', () => {
    const springDay = startOfDay(Date.UTC(2026, 2, 8, 18, 0), NY); // Mar 8 2026
    const springNext = addDays(springDay, 1, NY);
    expect((springNext - springDay) / 3_600_000).toBe(23);

    const fallDay = startOfDay(Date.UTC(2026, 10, 1, 18, 0), NY); // Nov 1 2026
    const fallNext = addDays(fallDay, 1, NY);
    expect((fallNext - fallDay) / 3_600_000).toBe(25);
  });
});

describe('addDays', () => {
  it('moves by calendar days in both directions', () => {
    const start = startOfDay(Date.UTC(2026, 9, 4, 12, 0), MANILA);
    expect(dayKey(addDays(start, 1, MANILA), MANILA)).toBe('2026-10-05');
    expect(dayKey(addDays(start, -7, MANILA), MANILA)).toBe('2026-09-27');
  });
});

describe('fromLocalParts / timePart', () => {
  it('round-trips a wall-clock time through the zone', () => {
    const ms = fromLocalParts('2026-10-04', '22:30', MANILA);
    expect(ms).toBe(Date.UTC(2026, 9, 4, 14, 30));
    expect(timePart(ms as number, MANILA)).toBe('22:30');
  });

  it('rejects malformed input', () => {
    expect(fromLocalParts('2026-10-04', '9:30', MANILA)).toBeNull();
    expect(fromLocalParts('nope', '09:30', MANILA)).toBeNull();
  });
});

describe('zone settings', () => {
  it('validates IANA names and resolves "device"', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(resolveTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(isValidTimeZone(resolveTimeZone('device'))).toBe(true);
  });
});

describe('formatDayLabel', () => {
  const now = Date.UTC(2026, 9, 4, 4, 0); // Oct 4, noon in Manila
  it('says Today and Yesterday, then falls back to a date', () => {
    expect(formatDayLabel(now - 3_600_000, MANILA, now, 'en-US')).toBe('Today');
    expect(formatDayLabel(now - 24 * 3_600_000, MANILA, now, 'en-US')).toBe('Yesterday');
    expect(formatDayLabel(now - 72 * 3_600_000, MANILA, now, 'en-US')).toBe('Thu, Oct 1');
  });
});
