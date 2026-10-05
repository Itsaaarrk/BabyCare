import { calculateAge, formatAge, parseDateString, toDateString, toTimeString } from './age';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 15, 30);

describe('parseDateString', () => {
  it('accepts real dates', () => {
    expect(parseDateString('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseDateString('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('rejects malformed and non-existent dates', () => {
    expect(parseDateString('2026-02-30')).toBeNull();
    expect(parseDateString('2025-02-29')).toBeNull();
    expect(parseDateString('2026-13-01')).toBeNull();
    expect(parseDateString('2026-1-1')).toBeNull();
    expect(parseDateString('')).toBeNull();
  });
});

describe('toDateString / toTimeString', () => {
  it('formats local date and time with zero padding', () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toTimeString(new Date(2026, 0, 5, 7, 4))).toBe('07:04');
  });
});

describe('calculateAge', () => {
  it('counts days, weeks and months', () => {
    expect(calculateAge('2026-09-22', at(2026, 10, 4))).toEqual({
      days: 12,
      weeks: 1,
      months: 0,
      years: 0,
    });
  });

  it('is 0 days on the birth date', () => {
    expect(calculateAge('2026-10-04', at(2026, 10, 4))?.days).toBe(0);
  });

  it('only counts a month once the day of month is reached', () => {
    expect(calculateAge('2026-01-15', at(2026, 2, 14))?.months).toBe(0);
    expect(calculateAge('2026-01-15', at(2026, 2, 15))?.months).toBe(1);
  });

  it('handles month-end birthdays', () => {
    expect(calculateAge('2026-01-31', at(2026, 2, 28))?.months).toBe(0);
    expect(calculateAge('2026-01-31', at(2026, 3, 31))?.months).toBe(2);
  });

  it('counts years across leap days', () => {
    const age = calculateAge('2024-02-29', at(2026, 3, 1));
    expect(age?.years).toBe(2);
    expect(age?.days).toBe(731);
  });

  it('is not thrown off by daylight-saving changes', () => {
    expect(calculateAge('2026-03-01', at(2026, 4, 1))?.days).toBe(31);
    expect(calculateAge('2026-10-01', at(2026, 11, 1))?.days).toBe(31);
  });

  it('returns null for future or invalid dates', () => {
    expect(calculateAge('2026-10-05', at(2026, 10, 4))).toBeNull();
    expect(calculateAge('nope', at(2026, 10, 4))).toBeNull();
  });
});

describe('formatAge', () => {
  const born = '2026-01-10';
  it.each([
    ['2026-01-10', 'Born today'],
    ['2026-01-11', '1 day old'],
    ['2026-01-22', '12 days old'],
    ['2026-01-24', '2 weeks old'],
    ['2026-03-10', '8 weeks old'],
    ['2026-03-14', '2 months old'],
    ['2026-12-10', '11 months old'],
    ['2027-01-10', '12 months old'],
    ['2027-12-10', '23 months old'],
    ['2028-01-10', '2 years old'],
  ])('on %s says "%s"', (today, expected) => {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    expect(formatAge(born, at(y, m, d))).toBe(expected);
  });

  it('is empty for an invalid date', () => {
    expect(formatAge('bad', at(2026, 1, 1))).toBe('');
  });
});
