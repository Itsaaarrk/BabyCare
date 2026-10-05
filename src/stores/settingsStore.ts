import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_SETTINGS, normalizeSettings, type UserSettings } from '@/lib/settings';

interface SettingsState {
  settings: UserSettings;
  /** Bumped on every local edit, so the sync layer can tell edits from remote updates. */
  revision: number;
  update: (patch: Partial<UserSettings>) => void;
  /** Applies settings that arrived from another device without counting as a local edit. */
  applyRemote: (raw: unknown) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      revision: 0,
      update: (patch) =>
        set((s) => ({ settings: normalizeSettings({ ...s.settings, ...patch }), revision: s.revision + 1 })),
      applyRemote: (raw) => set({ settings: normalizeSettings(raw) }),
      reset: () => set({ settings: DEFAULT_SETTINGS, revision: 0 }),
    }),
    {
      name: 'babycare-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: normalizeSettings((persisted as Partial<SettingsState> | undefined)?.settings),
      }),
    },
  ),
);
