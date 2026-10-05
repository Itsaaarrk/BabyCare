import { ref, remove, update } from 'firebase/database';

import { babyFormSchema, type BabyFormValues } from '@/features/babies/schemas';
import { getFirebaseDatabase } from '@/lib/firebase';
import type { AuthUser } from '@/services/auth/authService';
import { addBabyToRoom, createRoom } from '@/services/rooms/roomService';
import { deletePhoto } from '@/services/storage/photoService';
import type { Baby } from '@/types/baby';

/** Realtime Database rejects `undefined`, so optional empties are omitted. */
function optionalFields(values: BabyFormValues) {
  return {
    nickname: values.nickname || undefined,
    birthTime: values.birthTime || undefined,
    gender: values.gender,
    notes: values.notes || undefined,
  };
}

/**
 * Creates a family room owned by the user (a Cloud Function, since membership is
 * server-managed) and then its first baby. If the second step fails the room is left empty;
 * the next attempt reuses it because the user already owns a room.
 */
export async function createBabyWithRoom(
  _user: AuthUser,
  input: BabyFormValues,
): Promise<{ roomId: string; babyId: string }> {
  const values = babyFormSchema.parse(input);
  const { roomId } = await createRoom(`${values.name}'s Family`);
  return { roomId, babyId: await addBaby(roomId, values) };
}

/**
 * Adds another baby to a room the user owns. The server creates it, because the database rules
 * can't count babies: it refuses with reason `baby-limit` once the room's plan is full.
 */
export async function addBaby(roomId: string, input: BabyFormValues): Promise<string> {
  return addBabyToRoom(roomId, babyFormSchema.parse(input));
}

export async function updateBaby(
  roomId: string,
  babyId: string,
  input: BabyFormValues,
): Promise<void> {
  const values = babyFormSchema.parse(input);
  const optional = optionalFields(values);
  await update(ref(getFirebaseDatabase(), `rooms/${roomId}/babies/${babyId}`), {
    name: values.name,
    birthDate: values.birthDate,
    // `null` deletes the field so cleared inputs actually clear.
    nickname: optional.nickname ?? null,
    birthTime: optional.birthTime ?? null,
    gender: optional.gender ?? null,
    notes: optional.notes ?? null,
    updatedAt: Date.now(),
  });
}

export async function setBabyPhotoPath(
  roomId: string,
  babyId: string,
  photoPath: string,
  previousPath?: string,
): Promise<void> {
  await update(ref(getFirebaseDatabase(), `rooms/${roomId}/babies/${babyId}`), {
    photoPath,
    updatedAt: Date.now(),
  });
  if (previousPath && previousPath !== photoPath) await deletePhoto(previousPath);
}

export async function deleteBaby(baby: Baby): Promise<void> {
  await remove(ref(getFirebaseDatabase(), `rooms/${baby.roomId}/babies/${baby.id}`));
  if (baby.photoPath) await deletePhoto(baby.photoPath);
}
