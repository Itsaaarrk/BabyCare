import type { RoomRole } from '@/types/baby';

/**
 * What each role may do. This only shapes the UI; Realtime Database rules, Storage rules and
 * Cloud Functions are the authority and enforce the same matrix on the server.
 */
export type Permission =
  | 'viewBaby'
  | 'editBaby'
  | 'viewTimeline'
  | 'viewAnalytics'
  | 'addActivity'
  | 'editAnyActivity'
  | 'deleteOwnActivity'
  | 'deleteAnyActivity'
  | 'uploadPhoto'
  | 'invite'
  | 'manageMembers'
  | 'deleteRoom';

const ALL: readonly Permission[] = [
  'viewBaby',
  'editBaby',
  'viewTimeline',
  'viewAnalytics',
  'addActivity',
  'editAnyActivity',
  'deleteOwnActivity',
  'deleteAnyActivity',
  'uploadPhoto',
  'invite',
  'manageMembers',
  'deleteRoom',
];

const MATRIX: Record<RoomRole, ReadonlySet<Permission>> = {
  owner: new Set(ALL),
  parent: new Set<Permission>([
    'viewBaby',
    'viewTimeline',
    'viewAnalytics',
    'addActivity',
    'editAnyActivity',
    'deleteOwnActivity',
    'uploadPhoto',
    'invite',
  ]),
  caregiver: new Set<Permission>([
    'viewBaby',
    'viewTimeline',
    'viewAnalytics',
    'addActivity',
    'uploadPhoto',
  ]),
  viewer: new Set<Permission>(['viewBaby', 'viewTimeline', 'viewAnalytics']),
};

export function can(role: RoomRole | undefined, permission: Permission): boolean {
  return role !== undefined && MATRIX[role].has(permission);
}

export type AssignableRole = Exclude<RoomRole, 'owner'>;
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = ['parent', 'caregiver', 'viewer'];

/** Roles this member may put on an invitation: owners any, parents only caregiver/viewer. */
export function invitableRoles(role: RoomRole | undefined): AssignableRole[] {
  if (role === 'owner') return [...ASSIGNABLE_ROLES];
  if (role === 'parent') return ['caregiver', 'viewer'];
  return [];
}

export const ROLE_LABELS: Record<RoomRole, string> = {
  owner: 'Owner',
  parent: 'Parent',
  caregiver: 'Caregiver',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  parent: 'Logs and edits activities, can invite caregivers',
  caregiver: 'Logs activities and adds photos',
  viewer: 'Can only look',
};
