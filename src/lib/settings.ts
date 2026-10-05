import type { TimeZoneSetting } from '@/lib/date/zone';
import { ACTIVITY_TYPES, type ActivityType } from '@/types/activity';

export interface DailyReminder {
  id: string;
  label: string;
  /** 0-23, in the user's time zone. */
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface NotificationSettings {
  /** Master switch; nothing is scheduled when off. */
  enabled: boolean;
  feedingReminder: { enabled: boolean; hours: number };
  daily: DailyReminder[];
}

/** Per-user preferences. Synced across the user's devices; see services/settings. */
export interface UserSettings {
  timeZone: TimeZoneSetting;
  shakeToLog: boolean;
  /** Which activity types the user tracks. Hidden types vanish from every screen. */
  enabledActivities: Record<ActivityType, boolean>;
  /** Order of the home quick-action buttons. */
  quickActionOrder: ActivityType[];
  /** Order of the summary cards on home. */
  dashboardCardOrder: ActivityType[];
  dashboardCardVisible: Record<ActivityType, boolean>;
  notifications: NotificationSettings;
}

const allTrue = (): Record<ActivityType, boolean> =>
  Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, true])) as Record<ActivityType, boolean>;

export const DEFAULT_SETTINGS: UserSettings = {
  timeZone: 'device',
  // Off by default: accidental shakes in a pocket or a stroller are a real risk.
  shakeToLog: false,
  enabledActivities: allTrue(),
  quickActionOrder: [...ACTIVITY_TYPES],
  dashboardCardOrder: ['feeding', 'diaper', 'sleep', 'bath', 'outdoor', 'note'],
  dashboardCardVisible: { ...allTrue(), note: false },
  notifications: { enabled: false, feedingReminder: { enabled: false, hours: 3 }, daily: [] },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isType = (v: unknown): v is ActivityType => (ACTIVITY_TYPES as readonly unknown[]).includes(v);
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function normalizeOrder(raw: unknown, fallback: readonly ActivityType[]): ActivityType[] {
  const seen = new Set<ActivityType>();
  if (Array.isArray(raw)) for (const item of raw) if (isType(item)) seen.add(item);
  // Types added later (or lost to bad data) still show up, at the end.
  for (const type of fallback) seen.add(type);
  return [...seen];
}

function normalizeFlags(raw: unknown, fallback: Record<ActivityType, boolean>): Record<ActivityType, boolean> {
  const result = { ...fallback };
  if (isObject(raw)) for (const type of ACTIVITY_TYPES) if (typeof raw[type] === 'boolean') result[type] = raw[type];
  return result;
}

function normalizeDaily(raw: unknown): DailyReminder[] {
  if (!Array.isArray(raw)) return [];
  const result: DailyReminder[] = [];
  for (const item of raw.slice(0, 10)) {
    if (!isObject(item) || typeof item.id !== 'string' || !inRange(item.hour, 0, 23) || !inRange(item.minute, 0, 59)) {
      continue;
    }
    result.push({
      id: item.id.slice(0, 40),
      label: typeof item.label === 'string' ? item.label.slice(0, 60) : 'Reminder',
      hour: Math.floor(item.hour),
      minute: Math.floor(item.minute),
      enabled: item.enabled !== false,
    });
  }
  return result;
}

/** Turns whatever is stored (possibly old, partial or hand-edited) into valid settings. */
export function normalizeSettings(raw: unknown): UserSettings {
  const d = DEFAULT_SETTINGS;
  if (!isObject(raw)) return normalizeSettings({});
  const n = isObject(raw.notifications) ? raw.notifications : {};
  const feeding = isObject(n.feedingReminder) ? n.feedingReminder : {};
  return {
    timeZone: typeof raw.timeZone === 'string' && raw.timeZone.length <= 64 ? raw.timeZone : d.timeZone,
    shakeToLog: raw.shakeToLog === true,
    enabledActivities: normalizeFlags(raw.enabledActivities, d.enabledActivities),
    quickActionOrder: normalizeOrder(raw.quickActionOrder, d.quickActionOrder),
    dashboardCardOrder: normalizeOrder(raw.dashboardCardOrder, d.dashboardCardOrder),
    dashboardCardVisible: normalizeFlags(raw.dashboardCardVisible, d.dashboardCardVisible),
    notifications: {
      enabled: n.enabled === true,
      feedingReminder: {
        enabled: feeding.enabled === true,
        hours: inRange(feeding.hours, 0.5, 24) ? feeding.hours : d.notifications.feedingReminder.hours,
      },
      daily: normalizeDaily(n.daily),
    },
  };
}

/** Types that are enabled, in the given order. */
export const visibleTypes = (order: readonly ActivityType[], enabled: Record<ActivityType, boolean>) =>
  order.filter((type) => enabled[type]);
