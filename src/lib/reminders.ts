import type { DailyReminder, NotificationSettings } from '@/lib/settings';

export type PlannedReminder =
  | { kind: 'once'; id: string; title: string; body: string; at: number }
  | { kind: 'daily'; id: string; title: string; body: string; hour: number; minute: number };

export const FEEDING_REMINDER_ID = 'feeding-reminder';
const MAX_DAILY = 10;

interface PlanInput {
  settings: NotificationSettings;
  now: number;
  /** Start of the most recent feeding for the selected baby, if known. */
  lastFeedAt: number | undefined;
  babyName: string;
}

/**
 * Decides which reminders should exist right now. It is a pure function of its inputs, so the
 * scheduling layer can simply replace everything with the result whenever an input changes.
 *
 * Deliberately sparse: at most one feeding reminder is ever pending, and it is never scheduled
 * for a time that has already passed, so turning it on can't produce a burst of alerts.
 */
export function planReminders({ settings, now, lastFeedAt, babyName }: PlanInput): PlannedReminder[] {
  if (!settings.enabled) return [];
  const plan: PlannedReminder[] = [];

  if (settings.feedingReminder.enabled && lastFeedAt !== undefined) {
    const at = lastFeedAt + settings.feedingReminder.hours * 3_600_000;
    if (at > now) {
      plan.push({
        kind: 'once',
        id: FEEDING_REMINDER_ID,
        title: 'Feeding reminder',
        body: `It’s been ${formatHours(settings.feedingReminder.hours)} since ${babyName}’s last feed.`,
        at,
      });
    }
  }

  for (const reminder of settings.daily.slice(0, MAX_DAILY)) {
    if (!reminder.enabled) continue;
    plan.push(dailyPlan(reminder));
  }
  return plan;
}

const dailyPlan = (r: DailyReminder): PlannedReminder => ({
  kind: 'daily',
  id: `daily-${r.id}`,
  title: r.label || 'Reminder',
  body: 'Tap to open BabyCare.',
  hour: r.hour,
  minute: r.minute,
});

export function formatHours(hours: number): string {
  if (hours === 1) return '1 hour';
  if (Number.isInteger(hours)) return `${hours} hours`;
  return `${hours} hours`;
}
