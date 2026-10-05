import { ref, remove, set, update } from 'firebase/database';

import type { ActivityOp } from '@/lib/activity/ops';
import { logHandled } from '@/lib/errors';
import { getFirebaseDatabase } from '@/lib/firebase';
import { deletePhoto, uploadActivityPhoto } from '@/services/storage/photoService';
import { useSyncStore } from '@/stores/syncStore';

const MAX_PHOTO_ATTEMPTS = 4;

const activityRef = (op: ActivityOp) =>
  ref(getFirebaseDatabase(), `rooms/${op.roomId}/babies/${op.babyId}/activities/${op.id}`);

async function run(op: ActivityOp): Promise<void> {
  switch (op.kind) {
    case 'set':
      await set(activityRef(op), op.record);
      return;
    case 'update':
      // `null` values delete the field, which is how cleared inputs and finished timers work.
      await update(activityRef(op), op.patch);
      return;
    case 'delete':
      await remove(activityRef(op));
      if (op.photoPath) await deletePhoto(op.photoPath);
      return;
    case 'photo': {
      const photoPath = await uploadActivityPhoto(op.roomId, op.babyId, op.id, op.localUri);
      await update(activityRef(op), { photoPath, updatedAt: Date.now() });
      return;
    }
  }
}

let flushing = false;

/**
 * Sends queued changes to the server in order. While offline the Firebase SDK holds each write
 * and resolves it once the server acknowledges, so this simply waits; if the app is killed
 * first, the persisted queue replays on the next start. Replays are harmless because every
 * operation is idempotent.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const op = useSyncStore.getState().ops[0];
      if (!op) return;
      try {
        await run(op);
        useSyncStore.getState().complete(op.opId);
      } catch (error) {
        logHandled(`queued ${op.kind} for activity ${op.id} failed`, error);
        const retryablePhoto =
          op.kind === 'photo' && op.attempts + 1 < MAX_PHOTO_ATTEMPTS && !isRejected(error);
        if (retryablePhoto) useSyncStore.getState().requeuePhoto(op.opId);
        else useSyncStore.getState().fail(op);
      }
    }
  } finally {
    flushing = false;
  }
}

/** True when the server refused the change outright, so retrying can't help. */
function isRejected(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return /permission|unauthorized|invalid|too-large/i.test(code) || (error as Error)?.name === 'PhotoTooLargeError';
}

export function enqueue(op: ActivityOp): void {
  useSyncStore.getState().enqueue(op);
  void flushQueue();
}
