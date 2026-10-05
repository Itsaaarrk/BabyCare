import { useEffect, useMemo } from 'react';

import { subscribeToUserRooms } from '@/services/babies/babySync';
import { useAuthStore } from '@/stores/authStore';
import { useBabyStore } from '@/stores/babyStore';
import type { Baby, RoomRole } from '@/types/baby';

export interface BabyEntry extends Baby {
  roomName: string;
  /** The current user's role in this baby's room. */
  role: RoomRole | undefined;
}

/** Keeps the baby store in sync with Firebase while a user is signed in. Mount once. */
export function useBabySync(): void {
  const uid = useAuthStore((s) => s.user?.uid);

  useEffect(() => {
    if (!uid) return;
    const { setRoomIds, patchRoom, removeRoom, resetSynced, claimCache } = useBabyStore.getState();
    claimCache(uid);
    const off = subscribeToUserRooms(uid, {
      setRoomIds,
      setInfo: (roomId, info) => patchRoom(roomId, { info: info ?? undefined }),
      setRole: (roomId, role) => patchRoom(roomId, { role: role ?? undefined }),
      setBabies: (roomId, babies) => patchRoom(roomId, { babies }),
      setMembers: (roomId, members) => patchRoom(roomId, { members }),
      setInvite: (roomId, invite) => patchRoom(roomId, { invite }),
      roomUnavailable: removeRoom,
    });
    return () => {
      off();
      resetSynced();
    };
  }, [uid]);
}

export function useBabies() {
  const rooms = useBabyStore((s) => s.rooms);
  const roomIndexLoaded = useBabyStore((s) => s.roomIndexLoaded);
  const selected = useBabyStore((s) => s.selected);
  const select = useBabyStore((s) => s.select);

  const babies = useMemo<BabyEntry[]>(() => {
    const entries: BabyEntry[] = [];
    for (const [roomId, room] of Object.entries(rooms)) {
      if (!room.babies) continue;
      for (const [id, record] of Object.entries(room.babies)) {
        entries.push({ ...record, id, roomId, roomName: room.info?.name ?? '', role: room.role });
      }
    }
    return entries.sort((a, b) => a.createdAt - b.createdAt);
  }, [rooms]);

  // Cached rooms count as loaded, so the app opens offline instead of spinning forever.
  const hasCache = Object.keys(rooms).length > 0;
  const loading = hasCache
    ? Object.values(rooms).some((room) => room.babies === undefined)
    : !roomIndexLoaded;

  const current =
    babies.find((b) => b.id === selected?.babyId && b.roomId === selected.roomId) ?? babies[0];

  return { babies, loading, current, select };
}
