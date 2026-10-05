export type Gender = 'girl' | 'boy' | 'other';

export type RoomRole = 'owner' | 'parent' | 'caregiver' | 'viewer';

/** A baby profile as stored at /rooms/{roomId}/babies/{babyId}. */
export interface BabyRecord {
  name: string;
  nickname?: string;
  /** Calendar date, `YYYY-MM-DD`. Deliberately timezone-free. */
  birthDate: string;
  /** Optional local birth time, `HH:mm`. */
  birthTime?: string;
  gender?: Gender;
  notes?: string;
  /** Storage path of the profile photo, not a URL. */
  photoPath?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Baby extends BabyRecord {
  id: string;
  roomId: string;
}

/** A room member as stored at /rooms/{roomId}/members/{uid}. */
export interface RoomMember {
  uid: string;
  role: RoomRole;
  displayName: string;
  joinedAt: number;
}

/** The room's current invitation, readable by owners and parents. */
export interface RoomInvite {
  code: string;
  role: Exclude<RoomRole, 'owner'>;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
}

/** Room metadata as stored at /rooms/{roomId}/info. */
export interface RoomInfo {
  name: string;
  ownerId: string;
  ownerName: string;
  createdAt: number;
}
