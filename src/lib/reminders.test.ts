import { planReminders } from './reminders';
import { DEFAULT_SETTINGS, normalizeSettings, type NotificationSettings } from './settings';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 4, 12, 0);

const settings = (over: Partial<NotificationSettings> = {}): NotificationSettings => ({
  ...DEFAULT_SETTINGS.notifications,
  enabled: true,
  ...over,
});

describe('planReminders', () => {
  it('schedules nothing when notifications are off', () => {
    expect(
      planReminders({
        settings: settings({ enabled: false, feedingReminder: { enabled: true, hours: 3 } }),
        now: NOW,
        lastFeedAt: NOW - HOUR,
        babyName: 'Sofia',
      }),
    ).toEqual([]);
  });

  it('plans one feeding reminder N hours after the last feed', () => {
    const plan = planReminders({
      settings: settings({ feedingReminder: { enabled: true, hours: 3 } }),
      now: NOW,
      lastFeedAt: NOW - HOUR,
      babyName: 'Sofia',
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'once', id: 'feeding-reminder', at: NOW + 2 * HOUR });
    expect(plan[0]?.body).toContain('Sofia');
  });

  it('never schedules a reminder in the past, so enabling it can’t cause a burst', () => {
    expect(
      planReminders({
        settings: settings({ feedingReminder: { enabled: true, hours: 3 } }),
        now: NOW,
        lastFeedAt: NOW - 5 * HOUR,
        babyName: 'Sofia',
      }),
    ).toEqual([]);
  });

  it('skips the feeding reminder when no feed is known or it is switched off', () => {
    const on = settings({ feedingReminder: { enabled: true, hours: 3 } });
    expect(planReminders({ settings: on, now: NOW, lastFeedAt: undefined, babyName: 'S' })).toEqual([]);
    expect(
      planReminders({ settings: settings(), now: NOW, lastFeedAt: NOW - HOUR, babyName: 'S' }),
    ).toEqual([]);
  });

  it('plans enabled daily reminders only', () => {
    const plan = planReminders({
      settings: settings({
        daily: [
          { id: 'a', label: 'Vitamins', hour: 8, minute: 30, enabled: true },
          { id: 'b', label: 'Off', hour: 9, minute: 0, enabled: false },
        ],
      }),
      now: NOW,
      lastFeedAt: undefined,
      babyName: 'S',
    });
    expect(plan).toEqual([
      { kind: 'daily', id: 'daily-a', title: 'Vitamins', body: expect.any(String), hour: 8, minute: 30 },
    ]);
  });

  it('caps the number of daily reminders', () => {
    const daily = Array.from({ length: 15 }, (_, i) => ({
      id: `r${i}`,
      label: 'x',
      hour: 8,
      minute: i,
      enabled: true,
    }));
    expect(planReminders({ settings: settings({ daily }), now: NOW, lastFeedAt: undefined, babyName: 'S' })).toHaveLength(10);
  });
});

describe('normalizeSettings', () => {
  it('fills in defaults for missing or garbage input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and repairs invalid ones', () => {
    const result = normalizeSettings({
      shakeToLog: true,
      timeZone: 'Asia/Manila',
      quickActionOrder: ['sleep', 'bogus', 'sleep', 'feeding'],
      enabledActivities: { outdoor: false, feeding: 'nope' },
      notifications: {
        enabled: true,
        feedingReminder: { enabled: true, hours: 999 },
        daily: [{ id: 'a', hour: 8, minute: 5 }, { id: 'b', hour: 99, minute: 0 }, 'junk'],
      },
    });
    expect(result.shakeToLog).toBe(true);
    expect(result.timeZone).toBe('Asia/Manila');
    // De-duplicated, unknown dropped, missing types appended in default order.
    expect(result.quickActionOrder).toEqual(['sleep', 'feeding', 'diaper', 'bath', 'outdoor', 'note']);
    expect(result.enabledActivities.outdoor).toBe(false);
    expect(result.enabledActivities.feeding).toBe(true);
    expect(result.notifications.feedingReminder).toEqual({ enabled: true, hours: 3 });
    expect(result.notifications.daily).toEqual([{ id: 'a', label: 'Reminder', hour: 8, minute: 5, enabled: true }]);
  });

  it('defaults shake-to-log off and the notes card hidden', () => {
    expect(DEFAULT_SETTINGS.shakeToLog).toBe(false);
    expect(DEFAULT_SETTINGS.dashboardCardVisible.note).toBe(false);
  });
});
