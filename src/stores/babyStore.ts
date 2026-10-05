import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RoomEntitlement } from '@/lib/billing/entitlement';
import type { BabyRecord, RoomInfo, RoomInvite, RoomMember, RoomRole } from '@/types/baby';

export interface RoomState {
  info?: RoomInfo;
  role?: RoomRole;
  members?: RoomMember[];
  /** Only populated for owners and parents. */
  invite?: RoomInvite | null;
  /** `undefined` until the first snapshot arrives, so loading is distinguishable from empty. */
  babies?: Record<string, BabyRecord>;
  /** The room's plan. `null` means none recorded, which is the Free plan. */
  entitlement?: RoomEntitlement | null;
}

export interface SelectedBaby {
  roomId: string;
  babyId: string;
}

interface BabyState {
  rooms: Record<string, RoomState>;
  roomIndexLoaded: boolean;
  selected: SelectedBaby | null;
  /** Whose data the persisted room cache holds, so one user never sees another's. */
  cacheUid: string | null;

  setRoomIds: (ids: string[]) => void;
  patchRoom: (roomId: string, patch: Partial<RoomState>) => void;
  removeRoom: (roomId: string) => void;
  select: (selected: SelectedBaby | null) => void;
  /** Drops cached rooms if they belong to a different user than `uid`. */
  claimCache: (uid: string) => void;
  /** Clears synced data (not the remembered selection) on sign-out. */
  resetSynced: () => void;
}

export const useBabyStore = create<BabyState>()(
  persist(
    (set) => ({
      rooms: {},
      roomIndexLoaded: false,
      selected: null,
      cacheUid: null,

      setRoomIds: (ids) =>
        set((state) => {
          const rooms: Record<string, RoomState> = {};
          for (const id of ids) rooms[id] = state.rooms[id] ?? {};
          return { rooms, roomIndexLoaded: true };
        }),
      patchRoom: (roomId, patch) =>
        set((state) => ({ rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], ...patch } } })),
      removeRoom: (roomId) =>
        set((state) => {
          const { [roomId]: _removed, ...rooms } = state.rooms;
          return { rooms };
        }),
      select: (selected) => set({ selected }),
      claimCache: (uid) =>
        set((state) => (state.cacheUid === uid ? state : { rooms: {}, roomIndexLoaded: false, selected: null, cacheUid: uid })),
      resetSynced: () => set({ rooms: {}, roomIndexLoaded: false }),
    }),
    {
      name: 'babycare-babies',
      storage: createJSONStorage(() => AsyncStorage),
      // Rooms and babies are cached so the app opens offline. Invitation codes stay out of storage.
      partialize: (state) => ({
        selected: state.selected,
        cacheUid: state.cacheUid,
        rooms: Object.fromEntries(
          Object.entries(state.rooms).map(([id, room]) => [id, { ...room, invite: undefined }]),
        ),
      }),
    },
  ),
);
