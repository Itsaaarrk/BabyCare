import { useMemo } from 'react';

import { resolveTimeZone } from '@/lib/date/zone';
import { visibleTypes } from '@/lib/settings';
import { useSettingsStore } from '@/stores/settingsStore';

export function useSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  return { settings, update };
}

/** The IANA zone to display times in. "device" follows the phone, including after travel. */
export function useTimeZone(): string {
  const setting = useSettingsStore((s) => s.settings.timeZone);
  return resolveTimeZone(setting);
}

/** Activity types the user tracks, in quick-action order. */
export function useEnabledTypes() {
  const order = useSettingsStore((s) => s.settings.quickActionOrder);
  const enabled = useSettingsStore((s) => s.settings.enabledActivities);
  return useMemo(() => visibleTypes(order, enabled), [order, enabled]);
}
