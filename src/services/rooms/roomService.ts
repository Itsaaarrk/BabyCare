import { httpsCallable } from 'firebase/functions';

import type { BabyFormValues } from '@/features/babies/schemas';
import { getFirebaseFunctions } from '@/lib/firebase';
import { refreshClaims } from '@/services/auth/authService';
import type { AssignableRole } from '@/lib/permissions';
import type { RoomInvite, RoomRole } from '@/types/baby';

// Membership changes only happen in Cloud Functions; these are thin typed wrappers.
// After anything that changes the caller's own roles we refresh the ID token so the
// `rooms` claim (which Storage rules read) is current.

// The client waits 70 seconds by default, which looks like a frozen button. A healthy call, cold
// start included, finishes in a few seconds, so give up sooner and let the person try again.
const CALL_TIMEOUT_MS = 25_000;

async function call<Result>(name: string, data?: Record<string, unknown>): Promise<Result> {
  const result = await httpsCallable<Record<string, unknown> | undefined, Result>(
    getFirebaseFunctions(),
    name,
    { timeout: CALL_TIMEOUT_MS },
  )(data);
  return result.data;
}

export interface RoomPreview {
  roomName: string;
  ownerName: string;
  babyNames: string[];
  /** The role the invitation grants. */
  role: AssignableRole;
  alreadyMember: boolean;
}

export async function createRoom(name: string): Promise<{ roomId: string; invite: RoomInvite }> {
  const result = await call<{ roomId: string; invite: RoomInvite }>('createRoom', { name });
  await refreshClaims();
  return result;
}

/** Adds a baby through the server, which applies the room's plan limit. */
export async function addBabyToRoom(roomId: string, baby: BabyFormValues): Promise<string> {
  const result = await call<{ babyId: string }>('addBaby', { roomId, baby: toServerBaby(baby) });
  return result.babyId;
}

/** Empty optional fields are left out; the server stores only what was filled in. */
function toServerBaby(values: BabyFormValues) {
  return {
    name: values.name,
    birthDate: values.birthDate,
    nickname: values.nickname || undefined,
    birthTime: values.birthTime || undefined,
    gender: values.gender,
    notes: values.notes || undefined,
  };
}

export const previewRoom = (code: string) => call<RoomPreview>('previewRoom', { code });

export async function joinRoom(code: string): Promise<{ roomId: string; role: RoomRole }> {
  const result = await call<{ roomId: string; role: RoomRole }>('joinRoom', { code });
  await refreshClaims();
  return result;
}

export async function regenerateInvite(roomId: string, role: AssignableRole): Promise<RoomInvite> {
  return (await call<{ invite: RoomInvite }>('regenerateInvite', { roomId, role })).invite;
}

export const revokeInvite = (roomId: string) => call<{ ok: true }>('revokeInvite', { roomId });

export const setMemberRole = (roomId: string, memberId: string, role: AssignableRole) =>
  call<{ ok: true }>('setMemberRole', { roomId, memberId, role });

/** Removes another member (owner) or the caller themselves (leaving). */
export async function removeMember(roomId: string, memberId: string, isSelf: boolean): Promise<void> {
  await call<{ ok: true }>('removeMember', { roomId, memberId });
  if (isSelf) await refreshClaims();
}

export async function deleteRoom(roomId: string): Promise<void> {
  await call<{ ok: true }>('deleteRoom', { roomId });
  await refreshClaims();
}
