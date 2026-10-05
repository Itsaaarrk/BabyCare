import { rangeFor, dayCount } from '@/lib/date/range';
import type { Activity } from '@/types/activity';

import { groupByDay } from './group';

const MANILA = 'Asia/Manila';
// Oct 4 2026, 12:00 in Manila.
const NOW = Date.UTC(2026, 9, 4, 4, 0);
const startOf = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 8 * 3_600_000;

describe('rangeFor', () => {
  it('builds whole-day windows in the user’s zone', () => {
    expect(rangeFor('today', NOW, MANILA)).toEqual({ start: startOf(2026, 10, 4), end: startOf(2026, 10, 5) });
    expect(rangeFor('yesterday', NOW, MANILA)).toEqual({ start: startOf(2026, 10, 3), end: startOf(2026, 10, 4) });
  });

  it('counts "last 7 days" and "last 30 days" including today', () => {
    const week = rangeFor('7d', NOW, MANILA)!;
    expect(dayCount(week)).toBe(7);
    expect(week.start).toBe(startOf(2026, 9, 28));
    expect(week.end).toBe(startOf(2026, 10, 5));
    expect(dayCount(rangeFor('30d', NOW, MANILA)!)).toBe(30);
  });

  it('is based on the zone, not UTC: just after Manila midnight is already the next day', () => {
    const justAfterMidnight = Date.UTC(2026, 9, 4, 16, 5); // Oct 5, 00:05 in Manila
    expect(rangeFor('today', justAfterMidnight, MANILA)!.start).toBe(startOf(2026, 10, 5));
  });

  it('includes both ends of a custom range', () => {
    const range = rangeFor('custom', NOW, MANILA, { from: '2026-10-01', to: '2026-10-03' })!;
    expect(range).toEqual({ start: startOf(2026, 10, 1), end: startOf(2026, 10, 4) });
    expect(dayCount(range)).toBe(3);
    expect(dayCount(rangeFor('custom', NOW, MANILA, { from: '2026-10-03', to: '2026-10-03' })!)).toBe(1);
  });

  it('rejects reversed, malformed, missing and oversized custom ranges', () => {
    expect(rangeFor('custom', NOW, MANILA, { from: '2026-10-05', to: '2026-10-01' })).toBeNull();
    expect(rangeFor('custom', NOW, MANILA, { from: 'x', to: '2026-10-01' })).toBeNull();
    expect(rangeFor('custom', NOW, MANILA)).toBeNull();
    expect(rangeFor('custom', NOW, MANILA, { from: '2020-01-01', to: '2026-10-01' })).toBeNull();
  });
});

describe('groupByDay', () => {
  const at = (ms: number, type: Activity['type'] = 'diaper'): Activity => ({
    id: String(ms),
    roomId: 'r',
    babyId: 'b',
    type,
    startedAt: ms,
    createdBy: 'u',
    createdByName: 'U',
    createdAt: ms,
    updatedAt: ms,
  });
  const list = [
    at(NOW - 1 * 3_600_000, 'feeding'),
    at(NOW - 2 * 3_600_000),
    at(NOW - 20 * 3_600_000),
    at(NOW - 50 * 3_600_000),
  ];

  it('creates a section per local day, newest first, with friendly titles', () => {
    const sections = groupByDay(list, MANILA, NOW, undefined, 'en-US');
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Yesterday', 'Fri, Oct 2']);
    expect(sections.map((s) => s.data.length)).toEqual([2, 1, 1]);
  });

  it('filters by type and drops days that become empty', () => {
    const sections = groupByDay(list, MANILA, NOW, ['feeding'], 'en-US');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.data[0]?.type).toBe('feeding');
    expect(groupByDay([], MANILA, NOW)).toEqual([]);
  });
});
