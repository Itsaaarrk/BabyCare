import { randomBytes } from 'node:crypto';

export const ROLES = ['owner', 'parent', 'caregiver', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be handed out by an invite or a role change; there is exactly one owner. */
export const ASSIGNABLE_ROLES = ['parent', 'caregiver', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_MEMBERS_PER_ROOM = 20;
export const MAX_ROOMS_PER_USER = 10;
export const MAX_FAILED_JOIN_ATTEMPTS = 10;
export const JOIN_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

// No 0/O, 1/I/L: codes get read aloud and typed by tired people.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function generateJoinCode(random: (size: number) => Uint8Array = randomBytes): string {
  // Reject bytes past the largest multiple of the alphabet size to avoid modulo bias.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH * 2)) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

/** Uppercases and strips spacing/dashes; returns null if the result isn't a valid code. */
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return CODE_PATTERN.test(code) ? code : null;
}

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

export const isAssignableRole = (value: unknown): value is AssignableRole =>
  typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value);

/** Owners can invite anyone; parents can only invite caregivers and viewers. */
export function canInviteAs(inviterRole: Role | null, inviteRole: AssignableRole): boolean {
  if (inviterRole === 'owner') return true;
  if (inviterRole === 'parent') return inviteRole === 'caregiver' || inviteRole === 'viewer';
  return false;
}
