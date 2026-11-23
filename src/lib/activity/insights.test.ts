import { buildInsights } from '@/lib/activity/insights';
import { frequentNoteTitles } from '@/lib/activity/quickNotes';
import { defaultBathType } from '@/types/activity';
import type { Activity, ActivityRecord } from '@/types/activity';

const NOW = Date.UTC(2026, 10, 23, 12);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let n = 0;

function act(partial: Partial<ActivityRecord> & Pick<ActivityRecord, 'type' | 'startedAt'>): Activity {
  n += 1;
  return {
    id: `a${n}`,
    roomId: 'r',
    babyId: 'b',
    createdBy: 'u1',
    createdByName: 'Sam',
    createdAt: partial.startedAt,
    updatedAt: partial.startedAt,
    ...partial,
  };
}

/** `days` days of logs ending before NOW, starting `offsetDays` back. */
function week(offsetDays: number, perDay: { feeds: number; sleepMin: number; bottleAmount?: boolean }) {
  const out: Activity[] = [];
  for (let d = 0; d < 7; d++) {
    const dayStart = NOW - (offsetDays + d + 1) * DAY;
    for (let f = 0; f < perDay.feeds; f++) {
      const start = dayStart + f * 3 * HOUR;
      out.push(
        act({
          type: 'feeding',
          startedAt: start,
          endedAt: start + 10 * 60_000,
          durationSeconds: 600,
          details: f % 2 ? { feedingType: 'breast', side: 'right' } : { feedingType: 'bottle', ...(perDay.bottleAmount && { amount: 90, amountUnit: 'ml' }) },
        }),
      );
    }
    out.push(
      act({ type: 'sleep', startedAt: dayStart + HOUR, endedAt: dayStart + HOUR + perDay.sleepMin * 60_000, durationSeconds: perDay.sleepMin * 60 }),
    );
    out.push(act({ type: 'diaper', startedAt: dayStart + 2 * HOUR, details: { diaperType: 'pee' } }));
  }
  return out;
}

describe('buildInsights', () => {
  it('asks for more data when the week is sparse', () => {
    const insights = buildInsights([act({ type: 'diaper', startedAt: NOW - HOUR, details: { diaperType: 'pee' } })], NOW);
    expect(insights.map((i) => i.id)).toEqual(['not-enough']);
  });

  it('compares with the week before and flags missing bottle amounts', () => {
    const insights = buildInsights([...week(0, { feeds: 8, sleepMin: 600 }), ...week(7, { feeds: 6, sleepMin: 600 })], NOW);
    const byId = Object.fromEntries(insights.map((i) => [i.id, i.text]));
    expect(byId['sleep-total']).toContain('about the same as the week before');
    expect(byId['feeding']).toContain('About 8 feeds a day');
    expect(byId['feeding']).toContain('33% more than');
    expect(byId['sides']).toContain('right side');
    expect(byId['nudge-amount']).toMatch(/^28 of 28 bottle feeds/);
  });

  it('skips the amount nudge when amounts are logged and has no week-over-week without history', () => {
    const insights = buildInsights(week(0, { feeds: 4, sleepMin: 300, bottleAmount: true }), NOW);
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain('nudge-amount');
    expect(insights.find((i) => i.id === 'sleep-total')?.text).not.toContain('week before');
  });

  it('points out a timer left running', () => {
    const insights = buildInsights([...week(0, { feeds: 2, sleepMin: 60 }), act({ type: 'sleep', startedAt: NOW - 20 * HOUR })], NOW);
    expect(insights.some((i) => i.id.startsWith('nudge-running-'))).toBe(true);
  });

  it('never gives advice words', () => {
    const text = buildInsights([...week(0, { feeds: 8, sleepMin: 600 }), ...week(7, { feeds: 6, sleepMin: 900 })], NOW)
      .map((i) => i.text)
      .join(' ');
    expect(text).not.toMatch(/\b(should|normal|healthy|doctor|too (much|little))\b/i);
  });
});

describe('frequentNoteTitles', () => {
  const note = (title: string, hoursAgo: number) =>
    act({ type: 'note', startedAt: NOW - hoursAgo * HOUR, details: { title } });

  it('returns the most-used titles, merging case and spaces', () => {
    const list = [
      note('burp', 10), note('Burp ', 5), note('Burp', 1),
      note('Vitamin D', 30), note('vitamin d', 20), note('Vitamin D', 2),
      note('Hiccups', 3), note('Hiccups', 4),
    ];
    expect(frequentNoteTitles(list, { since: NOW - 7 * DAY })).toEqual(['Burp', 'Vitamin D']);
  });

  it('ignores old notes and respects the limit', () => {
    const list = [note('A', 1), note('A', 2), note('A', 3), note('B', 200), note('B', 201), note('B', 202)];
    expect(frequentNoteTitles(list, { since: NOW - 7 * DAY })).toEqual(['A']);
    expect(frequentNoteTitles(list, { since: 0, limit: 1 })).toHaveLength(1);
  });
});

describe('defaultBathType', () => {
  it('follows the time of day', () => {
    const at = (h: number) => new Date(2026, 10, 23, h).getTime();
    expect(defaultBathType(at(8))).toBe('morning');
    expect(defaultBathType(at(14))).toBe('afternoon');
    expect(defaultBathType(at(20))).toBe('night');
  });
});
