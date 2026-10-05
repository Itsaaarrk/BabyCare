import { router, usePathname } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useActivities } from '@/hooks/useActivities';
import { useBabies } from '@/hooks/useBabies';
import { latestOfType } from '@/lib/activity/summary';
import { planReminders } from '@/lib/reminders';
import { ShakeDetector } from '@/lib/shake';
import {
  applyReminderPlan,
  cancelAllReminders,
  configureNotifications,
} from '@/services/notifications/notificationService';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Opens Quick Log when the phone is shaken, if the user turned that on in settings.
 * The visible buttons remain the primary way to log; this is a convenience.
 */
export function useShakeToLog(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const enabled = useSettingsStore((s) => s.settings.shakeToLog);
  const { current } = useBabies();
  const pathname = usePathname();
  // The listener outlives renders, so read the route through a ref.
  const onLogScreen = useRef(false);
  onLogScreen.current = pathname.startsWith('/activity');
  const hasBaby = !!current;

  useEffect(() => {
    if (!enabled || !uid || !hasBaby) return;
    const detector = new ShakeDetector();
    Accelerometer.setUpdateInterval(60);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (onLogScreen.current) return;
      if (detector.feed({ x, y, z, t: Date.now() })) router.push('/activity/quick');
    });
    // Don't listen while backgrounded; a phone in a pocket would otherwise keep it busy.
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') detector.reset();
    });
    return () => {
      subscription.remove();
      appState.remove();
    };
  }, [enabled, uid, hasBaby]);
}

/** Keeps scheduled reminders matching settings and the latest feed. Mount once. */
export function useReminders(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const notifications = useSettingsStore((s) => s.settings.notifications);
  const { current } = useBabies();
  const { activities } = useActivities();
  const lastFeedAt = latestOfType(activities, 'feeding')?.startedAt;
  const babyName = current?.name ?? 'your baby';

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (!uid) {
      void cancelAllReminders().catch(() => undefined);
      return;
    }
    const apply = () => {
      const plan = planReminders({ settings: notifications, now: Date.now(), lastFeedAt, babyName });
      void applyReminderPlan(plan).catch(() => undefined);
    };
    // A short pause so a burst of changes (typing a time, a few quick logs) schedules once.
    const timer = setTimeout(apply, 1000);
    // Re-plan on return to the app so a feed logged elsewhere moves the reminder.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && apply());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [uid, notifications, lastFeedAt, babyName]);
}
