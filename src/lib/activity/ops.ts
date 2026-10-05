import type { Activity, ActivityRecord } from '@/types/activity';

/**
 * A change made on this device that may not have reached the server yet. Every operation is
 * idempotent (activity ids are generated on the client), so replaying one after a crash or a
 * dropped connection can never create a duplicate.
 */
interface BaseOp {
  opId: string;
  roomId: string;
  babyId: string;
  /** Activity id. */
  id: string;
  queuedAt: number;
}

export type ActivityOp =
  | (BaseOp & { kind: 'set'; record: ActivityRecord })
  | (BaseOp & { kind: 'update'; patch: Record<string, unknown> })
  | (BaseOp & { kind: 'delete'; photoPath?: string })
  | (BaseOp & { kind: 'photo'; localUri: string; attempts: number });

export function applyPatch(record: ActivityRecord, patch: Record<string, unknown>): ActivityRecord {
  const next: Record<string, unknown> = { ...record };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as unknown as ActivityRecord;
}

/**
 * Overlays queued local changes on what the server last told us, so the UI reflects a change
 * the moment it is made, online or not. Changes still waiting are marked `pending`.
 */
export function applyOps(
  server: Record<string, Activity>,
  ops: readonly ActivityOp[],
  roomId: string,
  babyId: string,
): Record<string, Activity> {
  const result: Record<string, Activity> = { ...server };
  for (const op of ops) {
    if (op.roomId !== roomId || op.babyId !== babyId) continue;
    switch (op.kind) {
      case 'set':
        result[op.id] = { ...op.record, id: op.id, roomId, babyId, pending: true };
        break;
      case 'update': {
        const current = result[op.id];
        if (current) {
          const { id, roomId: r, babyId: b } = current;
          result[op.id] = { ...applyPatch(current, op.patch), id, roomId: r, babyId: b, pending: true };
        }
        break;
      }
      case 'delete':
        delete result[op.id];
        break;
      case 'photo': {
        const current = result[op.id];
        if (current) result[op.id] = { ...current, pending: true };
        break;
      }
    }
  }
  return result;
}
