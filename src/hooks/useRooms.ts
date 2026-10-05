import { useMemo } from 'react';

import { useBabyStore, type RoomState } from '@/stores/babyStore';
import type { RoomInfo } from '@/types/baby';

export interface RoomEntry extends RoomState {
  id: string;
  info: RoomInfo;
}

/** Rooms the user belongs to, oldest first, plus the one the Family tab should show. */
export function useRooms() {
  const rooms = useBabyStore((s) => s.rooms);
  const selected = useBabyStore((s) => s.selected);
  const select = useBabyStore((s) => s.select);
  const loaded = useBabyStore((s) => s.roomIndexLoaded);

  const list = useMemo<RoomEntry[]>(
    () =>
      Object.entries(rooms)
        .filter((entry): entry is [string, RoomState & { info: RoomInfo }] => entry[1].info !== undefined)
        .map(([id, room]) => ({ ...room, id }))
        .sort((a, b) => a.info.createdAt - b.info.createdAt),
    [rooms],
  );

  // Follow the selected baby's room so Home and Family agree; fall back to the first room.
  const current = list.find((room) => room.id === selected?.roomId) ?? list[0];

  const showRoom = (roomId: string) => {
    const firstBaby = Object.keys(rooms[roomId]?.babies ?? {})[0];
    if (firstBaby) select({ roomId, babyId: firstBaby });
  };

  return { rooms: list, current, loading: !loaded, showRoom };
}
