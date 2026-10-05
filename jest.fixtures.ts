import type { Activity } from '@/types/activity';

/** Freezes only the clock (not timers), so "today" is stable and RNTL still works. */
export function freezeClock(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
      'hrtime',
    ],
  });
}

let seq = 0;
export function makeActivity(partial: Partial<Activity> & Pick<Activity, 'type'>): Activity {
  const startedAt = partial.startedAt ?? Date.now() - 3_600_000;
  return {
    id: `act${++seq}`,
    roomId: 'room1',
    babyId: 'baby1',
    startedAt,
    createdBy: 'ana',
    createdByName: 'Ana',
    createdAt: startedAt,
    updatedAt: startedAt,
    ...partial,
  };
}
