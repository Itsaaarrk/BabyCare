import {
  activityFormSchema,
  emptyFormValues,
  finishPatch,
  toActivityPatch,
  toActivityRecord,
  toFormValues,
  type ActivityFormValues,
} from '@/features/activities/schemas';
import type { Activity } from '@/types/activity';

import { durationSeconds, formatAgo, formatDuration, formatDurationLong, formatTimer } from './duration';
import { activityDetailLine, activityTitle } from './meta';
import { applyOps, applyPatch, type ActivityOp } from './ops';
import { dailySeries, inRange, latestOfType, runningTimers, summarize } from './summary';

const ana = { uid: 'ana', name: 'Ana' };
const NOW = Date.UTC(2026, 9, 4, 12, 0);
const MIN = 60_000;
const ZONE = 'UTC';

let seq = 0;
function activity(partial: Partial<Activity> & Pick<Activity, 'type'>): Activity {
  const startedAt = partial.startedAt ?? NOW - 60 * MIN;
  return {
    id: `a${++seq}`,
    roomId: 'r',
    babyId: 'b',
    startedAt,
    createdBy: 'ana',
    createdByName: 'Ana',
    createdAt: startedAt,
    updatedAt: startedAt,
    ...partial,
  };
}

describe('duration formatting', () => {
  it('computes whole seconds and never goes negative', () => {
    expect(durationSeconds(0, 18 * MIN)).toBe(1080);
    expect(durationSeconds(1000, 500)).toBe(0);
  });

  it('formats compact, spoken and timer forms', () => {
    expect(formatDuration(95 * 60)).toBe('1h 35m');
    expect(formatDuration(18 * 60)).toBe('18m');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDurationLong(95 * 60)).toBe('1 hour 35 minutes');
    expect(formatDurationLong(60)).toBe('1 minute');
    expect(formatTimer(5052)).toBe('01:24:12');
    expect(formatTimer(7)).toBe('00:00:07');
  });

  it('describes how long ago something happened', () => {
    expect(formatAgo(NOW - 10_000, NOW)).toBe('just now');
    expect(formatAgo(NOW - 42 * MIN, NOW)).toBe('42 min ago');
    expect(formatAgo(NOW - 75 * MIN, NOW)).toBe('1h 15m ago');
    expect(formatAgo(NOW - 72 * 60 * MIN, NOW)).toBe('3 days ago');
  });
});

describe('activityFormSchema', () => {
  const feeding = (over: Partial<ActivityFormValues> = {}): ActivityFormValues => ({
    ...emptyFormValues('feeding', NOW - 30 * MIN),
    ...over,
  });

  it('accepts a minimal feeding and a finished one', () => {
    expect(activityFormSchema.safeParse(feeding()).success).toBe(true);
    expect(activityFormSchema.safeParse(feeding({ endedAt: Date.now() - MIN })).success).toBe(true);
  });

  it('rejects an end before the start, future times and absurd durations', () => {
    const start = Date.now() - 60 * MIN;
    expect(activityFormSchema.safeParse(feeding({ startedAt: start, endedAt: start - 1 })).success).toBe(false);
    expect(activityFormSchema.safeParse(feeding({ startedAt: Date.now() + 3600_000 })).success).toBe(false);
    expect(
      activityFormSchema.safeParse(feeding({ startedAt: Date.now() - 72 * 3600_000, endedAt: Date.now() - MIN }))
        .success,
    ).toBe(false);
  });

  it('requires the type-specific choice', () => {
    expect(activityFormSchema.safeParse({ ...emptyFormValues('diaper', NOW - MIN) }).success).toBe(false);
    expect(activityFormSchema.safeParse({ ...emptyFormValues('diaper', NOW - MIN), diaperType: 'pee' }).success).toBe(true);
    expect(activityFormSchema.safeParse({ ...emptyFormValues('note', NOW - MIN) }).success).toBe(false);
    expect(activityFormSchema.safeParse({ ...emptyFormValues('note', NOW - MIN), title: 'Sleepy' }).success).toBe(true);
    expect(activityFormSchema.safeParse({ ...emptyFormValues('feeding', NOW - MIN), feedingType: undefined }).success).toBe(false);
  });

  it('gives instant activities no end time', () => {
    const v = { ...emptyFormValues('diaper', NOW - MIN), diaperType: 'pee' as const, endedAt: NOW };
    expect(activityFormSchema.safeParse(v).success).toBe(false);
  });

  it('validates the feeding amount', () => {
    expect(activityFormSchema.safeParse(feeding({ amount: '120' })).success).toBe(true);
    expect(activityFormSchema.safeParse(feeding({ amount: 'abc' })).success).toBe(false);
    expect(activityFormSchema.safeParse(feeding({ amount: '-5' })).success).toBe(false);
    expect(activityFormSchema.safeParse(feeding({ amount: '99999' })).success).toBe(false);
  });
});

describe('record building', () => {
  it('builds a finished feeding with a duration and only relevant details', () => {
    const values = {
      ...emptyFormValues('feeding', NOW - 18 * MIN),
      endedAt: NOW,
      side: 'left' as const,
      amount: '',
      title: 'ignored',
      notes: ' calm ',
    };
    const record = toActivityRecord(values, ana, NOW);
    expect(record).toEqual({
      type: 'feeding',
      startedAt: NOW - 18 * MIN,
      endedAt: NOW,
      durationSeconds: 1080,
      details: { feedingType: 'breast', side: 'left' },
      notes: 'calm',
      createdBy: 'ana',
      createdByName: 'Ana',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('drops the side for non-breast feeds and keeps the amount', () => {
    const record = toActivityRecord(
      { ...emptyFormValues('feeding', NOW - MIN), feedingType: 'bottle', side: 'left', amount: '120' },
      ana,
      NOW,
    );
    expect(record.details).toEqual({ feedingType: 'bottle', amount: 120, amountUnit: 'ml' });
  });

  it('omits undefined fields so the database never sees them', () => {
    const record = toActivityRecord({ ...emptyFormValues('sleep', NOW - MIN) }, ana, NOW);
    expect(record).not.toHaveProperty('endedAt');
    expect(record).not.toHaveProperty('details');
    expect(record).not.toHaveProperty('notes');
    expect(JSON.stringify(record)).not.toContain('undefined');
  });

  it('round-trips through the edit form and builds a patch that can clear fields', () => {
    const record = toActivityRecord(
      { ...emptyFormValues('feeding', NOW - 30 * MIN), endedAt: NOW - 10 * MIN, notes: 'x' },
      ana,
      NOW,
    );
    const values = toFormValues(record);
    expect(values.endedAt).toBe(NOW - 10 * MIN);
    const patch = toActivityPatch({ ...values, notes: '', endedAt: null }, ana, NOW + 1);
    expect(patch).toMatchObject({ notes: null, endedAt: null, durationSeconds: null, updatedBy: 'ana' });
    expect(applyPatch(record, patch)).not.toHaveProperty('notes');
  });

  it('builds a patch that finishes a timer', () => {
    expect(finishPatch(NOW - 90 * MIN, ana, NOW)).toEqual({
      endedAt: NOW,
      durationSeconds: 5400,
      updatedAt: NOW,
      updatedBy: 'ana',
    });
  });
});

describe('describing activities', () => {
  it('titles and details read naturally', () => {
    expect(activityTitle({ type: 'bath', details: { bathType: 'night' } })).toBe('Night bath');
    expect(activityTitle({ type: 'diaper', details: { diaperType: 'both' } })).toBe('Diaper · Pee + Poop');
    expect(activityTitle({ type: 'note', details: { title: 'Sleepy' } })).toBe('Sleepy');
    expect(activityDetailLine({ type: 'feeding', details: { feedingType: 'breast', side: 'left' } })).toBe(
      'Breastfeeding · left',
    );
    expect(
      activityDetailLine({ type: 'feeding', details: { feedingType: 'bottle', amount: 120, amountUnit: 'ml' } }),
    ).toBe('Bottle · 120 ml');
  });
});

describe('applyOps', () => {
  const base = activity({ type: 'sleep', id: 's1' });
  const server = { s1: base };
  const op = (o: Partial<ActivityOp> & Pick<ActivityOp, 'kind'>): ActivityOp =>
    ({ opId: 'o', roomId: 'r', babyId: 'b', id: 's1', queuedAt: 1, ...o }) as ActivityOp;

  it('shows a queued create immediately and marks it pending', () => {
    const record = toActivityRecord({ ...emptyFormValues('sleep', NOW - MIN) }, ana, NOW);
    const result = applyOps({}, [op({ kind: 'set', id: 'new', record })], 'r', 'b');
    expect(result.new).toMatchObject({ id: 'new', type: 'sleep', pending: true });
  });

  it('applies updates (finishing a timer) and deletes', () => {
    const finished = applyOps(server, [op({ kind: 'update', patch: finishPatch(base.startedAt, ana, NOW) })], 'r', 'b');
    expect(finished.s1?.endedAt).toBe(NOW);
    expect(finished.s1?.pending).toBe(true);
    expect(applyOps(server, [op({ kind: 'delete' })], 'r', 'b')).toEqual({});
  });

  it('ignores operations for other babies and updates to unknown activities', () => {
    expect(applyOps(server, [op({ kind: 'delete', babyId: 'other' })], 'r', 'b')).toEqual(server);
    expect(applyOps({}, [op({ kind: 'update', patch: { notes: 'x' } })], 'r', 'b')).toEqual({});
  });

  it('applies operations in order and never mutates its input', () => {
    const snapshot = JSON.stringify(server);
    const result = applyOps(
      server,
      [op({ kind: 'update', patch: { notes: 'a' } }), op({ kind: 'update', patch: { notes: 'b' } })],
      'r',
      'b',
    );
    expect(result.s1?.notes).toBe('b');
    expect(JSON.stringify(server)).toBe(snapshot);
  });
});

describe('summarize', () => {
  const day = [
    activity({ type: 'feeding', startedAt: NOW - 300 * MIN, durationSeconds: 900 }),
    activity({ type: 'feeding', startedAt: NOW - 180 * MIN, durationSeconds: 1200 }),
    activity({ type: 'feeding', startedAt: NOW - 60 * MIN, durationSeconds: 600, createdBy: 'dad', createdByName: 'Dad' }),
    activity({ type: 'diaper', details: { diaperType: 'pee' } }),
    activity({ type: 'diaper', details: { diaperType: 'poop' } }),
    activity({ type: 'diaper', details: { diaperType: 'both' }, createdBy: 'dad', createdByName: 'Dad' }),
    activity({ type: 'diaper', details: { diaperType: 'dry' } }),
    activity({ type: 'sleep', startedAt: NOW - 240 * MIN, durationSeconds: 7200 }),
    activity({ type: 'sleep', startedAt: NOW - 100 * MIN, durationSeconds: 3600 }),
    activity({ type: 'bath', durationSeconds: 720 }),
    activity({ type: 'outdoor', durationSeconds: 1080 }),
    activity({ type: 'note', details: { title: 'x' } }),
  ];

  it('totals each activity type', () => {
    const s = summarize(day, NOW);
    expect(s.feeding).toEqual({ count: 3, totalSeconds: 2700, averageSeconds: 900, averageIntervalSeconds: 7200 });
    expect(s.diaper).toEqual({ total: 4, pee: 1, poop: 1, both: 1, dry: 1 });
    expect(s.sleep).toEqual({ count: 2, totalSeconds: 10800, averageSeconds: 5400 });
    expect(s.bath).toEqual({ count: 1, totalSeconds: 720 });
    expect(s.outdoor).toEqual({ count: 1, totalSeconds: 1080 });
    expect(s.notes.count).toBe(1);
    expect(s.total).toBe(day.length);
  });

  it('counts logs per caregiver, busiest first', () => {
    expect(summarize(day, NOW).caregivers).toEqual([
      { uid: 'ana', name: 'Ana', count: 10 },
      { uid: 'dad', name: 'Dad', count: 2 },
    ]);
  });

  it('counts a running timer up to now and has no interval with one feed', () => {
    const running = activity({ type: 'sleep', startedAt: NOW - 30 * MIN });
    expect(summarize([running], NOW).sleep.totalSeconds).toBe(1800);
    expect(summarize([activity({ type: 'feeding' })], NOW).feeding.averageIntervalSeconds).toBeNull();
  });

  it('handles an empty list', () => {
    const s = summarize([], NOW);
    expect(s.feeding).toEqual({ count: 0, totalSeconds: 0, averageSeconds: 0, averageIntervalSeconds: null });
    expect(s.caregivers).toEqual([]);
  });
});

describe('series and helpers', () => {
  const dayMs = 86_400_000;
  const start = Date.UTC(2026, 9, 1);
  const list = [
    activity({ type: 'feeding', startedAt: start + 3600_000, durationSeconds: 600 }),
    activity({ type: 'feeding', startedAt: start + 2 * dayMs + 3600_000, durationSeconds: 1200 }),
    activity({ type: 'feeding', startedAt: start + 2 * dayMs + 7200_000, durationSeconds: 300 }),
    activity({ type: 'sleep', startedAt: start + 3600_000, durationSeconds: 99 }),
  ];

  it('buckets by day including empty days', () => {
    const counts = dailySeries(list, 'feeding', 'count', start, start + 4 * dayMs, ZONE, NOW);
    expect(counts.map((b) => b.value)).toEqual([1, 0, 2, 0]);
    expect(counts.map((b) => b.key)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(dailySeries(list, 'feeding', 'seconds', start, start + 4 * dayMs, ZONE, NOW).map((b) => b.value)).toEqual([
      600, 0, 1500, 0,
    ]);
  });

  it('filters ranges, finds the latest and lists running timers', () => {
    expect(inRange(list, start, start + dayMs)).toHaveLength(2);
    expect(latestOfType(list, 'feeding')?.startedAt).toBe(start + 2 * dayMs + 7200_000);
    expect(latestOfType(list, 'bath')).toBeUndefined();
    const timers = runningTimers([
      activity({ type: 'sleep', startedAt: NOW - 5 * MIN }),
      activity({ type: 'diaper' }),
      activity({ type: 'feeding', startedAt: NOW - MIN }),
      activity({ type: 'bath', durationSeconds: 5, endedAt: NOW }),
    ]);
    expect(timers.map((t) => t.type)).toEqual(['feeding', 'sleep']);
  });
});
