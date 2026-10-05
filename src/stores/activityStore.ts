import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Activity } from '@/types/activity';

export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 90;
/** Keep the offline copy small: it only needs to cover what the timeline opens with. */
const CACHE_LIMIT = 300;

interface ActivityState {
  /** `roomId/babyId` of the baby whose activities are loaded. */
  key: string | null;
  /** Server copy of the loaded window, keyed by activity id. */
  items: Record<string, Activity>;
  /** How many days back the live window reaches. */
  days: number;
  /** True once the server (not just the offline cache) has answered for the current key. */
  synced: boolean;

  /** Last known server data for one baby, restored when offline or while loading. */
  cacheKey: string | null;
  cacheItems: Record<string, Activity>;

  open: (key: string | null) => void;
  setSnapshot: (key: string, items: Record<string, Activity>) => void;
  loadOlder: () => void;
  reset: () => void;
}

const newest = (items: Record<string, Activity>): Record<string, Activity> =>
  Object.fromEntries(
    Object.entries(items)
      .sort(([, a], [, b]) => b.startedAt - a.startedAt)
      .slice(0, CACHE_LIMIT),
  );

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      key: null,
      items: {},
      days: DEFAULT_DAYS,
      synced: false,
      cacheKey: null,
      cacheItems: {},

      open: (key) => {
        if (get().key === key) return;
        const { cacheKey, cacheItems } = get();
        set({
          key,
          days: DEFAULT_DAYS,
          synced: false,
          items: key !== null && cacheKey === key ? cacheItems : {},
        });
      },
      setSnapshot: (key, items) => {
        if (get().key !== key) return;
        set({ items, synced: true, cacheKey: key, cacheItems: newest(items) });
      },
      loadOlder: () => set((s) => ({ days: Math.min(MAX_DAYS, s.days + DEFAULT_DAYS) })),
      reset: () => set({ key: null, items: {}, days: DEFAULT_DAYS, synced: false, cacheKey: null, cacheItems: {} }),
    }),
    {
      name: 'babycare-activities',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ cacheKey: s.cacheKey, cacheItems: s.cacheItems }),
    },
  ),
);
