import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ActivityOp } from '@/lib/activity/ops';

interface SyncState {
  /** Changes waiting to reach the server, oldest first. Survives app restarts. */
  ops: ActivityOp[];
  /** Changes the server rejected. Kept so the user can retry or discard them. */
  failed: ActivityOp[];
  /** The signed-in user the queue belongs to, so one user's changes never run as another. */
  ownerUid: string | null;

  enqueue: (op: ActivityOp) => void;
  complete: (opId: string) => void;
  /** Moves an op (and any later ops on the same activity, which depended on it) to `failed`. */
  fail: (op: ActivityOp) => void;
  /** Puts a photo op at the back of the queue with one more attempt counted. */
  requeuePhoto: (opId: string) => void;
  retryFailed: () => void;
  discardFailed: () => void;
  claim: (uid: string) => void;
  clear: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      ops: [],
      failed: [],
      ownerUid: null,

      enqueue: (op) => set((s) => ({ ops: [...s.ops, op] })),
      complete: (opId) => set((s) => ({ ops: s.ops.filter((o) => o.opId !== opId) })),
      fail: (op) =>
        set((s) => {
          const dependent = (o: ActivityOp) => o.opId === op.opId || (o.id === op.id && o.queuedAt >= op.queuedAt);
          return { ops: s.ops.filter((o) => !dependent(o)), failed: [...s.failed, ...s.ops.filter(dependent)] };
        }),
      requeuePhoto: (opId) =>
        set((s) => {
          const op = s.ops.find((o) => o.opId === opId);
          if (!op || op.kind !== 'photo') return s;
          return {
            ops: [...s.ops.filter((o) => o.opId !== opId), { ...op, attempts: op.attempts + 1 }],
          };
        }),
      retryFailed: () => set((s) => ({ ops: [...s.ops, ...s.failed], failed: [] })),
      discardFailed: () => set({ failed: [] }),
      claim: (uid) =>
        set((s) => (s.ownerUid === uid ? s : { ops: [], failed: [], ownerUid: uid })),
      clear: () => set({ ops: [], failed: [], ownerUid: null }),
    }),
    { name: 'babycare-sync', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
