import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { PlannedReminder } from '@/lib/reminders';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'reminders';

let module_: NotificationsModule | null | undefined;

// Android Expo Go no longer supports expo-notifications, and the package reports that with an error
// the moment it is imported, so it must not be imported there at all. A development build has it.
const inAndroidExpoGo =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Loaded on first use, not at import time. Null where reminders are unavailable. */
function notifications(): NotificationsModule | null {
  if (module_ === undefined) {
    try {
      module_ = inAndroidExpoGo ? null : (require('expo-notifications') as NotificationsModule);
    } catch {
      module_ = null;
    }
  }
  return module_;
}

export const notificationsAvailable = () => notifications() !== null;

let configured = false;

/** Shows reminders as banners even while the app is open. Safe to call repeatedly. */
export function configureNotifications(): void {
  const Notifications = notifications();
  if (configured || !Notifications) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Reads the permission, asking the user only when `ask` is true. */
export async function notificationPermission(ask: boolean): Promise<PermissionState> {
  const Notifications = notifications();
  if (!Notifications) return 'unavailable';
  let current = await Notifications.getPermissionsAsync();
  if (current.status === 'undetermined' && ask && current.canAskAgain) {
    current = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
  }
  return current.granted ? 'granted' : current.status === 'undetermined' ? 'undetermined' : 'denied';
}

async function ensureChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Makes the scheduled reminders match `plan` exactly: everything this app scheduled before is
 * cancelled first, so stale reminders (e.g. for a feed that has since been logged) never fire.
 * Does nothing, and never prompts, if the user hasn't granted permission.
 */
export async function applyReminderPlan(plan: readonly PlannedReminder[]): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0) return;
  if ((await notificationPermission(false)) !== 'granted') return;
  await ensureChannel(Notifications);

  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body },
      trigger:
        reminder.kind === 'once'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(reminder.at),
              channelId: CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: reminder.hour,
              minute: reminder.minute,
              channelId: CHANNEL_ID,
            },
    });
  }
}

export const cancelAllReminders = async (): Promise<void> => {
  await notifications()?.cancelAllScheduledNotificationsAsync();
};
