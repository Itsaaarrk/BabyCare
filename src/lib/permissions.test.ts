import { can, invitableRoles, type Permission } from './permissions';

describe('can', () => {
  it('gives the owner everything', () => {
    for (const p of ['editBaby', 'manageMembers', 'deleteRoom', 'deleteAnyActivity'] as Permission[]) {
      expect(can('owner', p)).toBe(true);
    }
  });

  it('lets parents log and edit activities and invite, but not manage the room', () => {
    expect(can('parent', 'addActivity')).toBe(true);
    expect(can('parent', 'editAnyActivity')).toBe(true);
    expect(can('parent', 'deleteOwnActivity')).toBe(true);
    expect(can('parent', 'invite')).toBe(true);
    expect(can('parent', 'editBaby')).toBe(false);
    expect(can('parent', 'manageMembers')).toBe(false);
    expect(can('parent', 'deleteRoom')).toBe(false);
    expect(can('parent', 'deleteAnyActivity')).toBe(false);
  });

  it('keeps caregivers to logging, photos and viewing', () => {
    expect(can('caregiver', 'addActivity')).toBe(true);
    expect(can('caregiver', 'uploadPhoto')).toBe(true);
    expect(can('caregiver', 'viewAnalytics')).toBe(true);
    expect(can('caregiver', 'editAnyActivity')).toBe(false);
    expect(can('caregiver', 'invite')).toBe(false);
    expect(can('caregiver', 'editBaby')).toBe(false);
  });

  it('makes viewers strictly read-only', () => {
    expect(can('viewer', 'viewBaby')).toBe(true);
    expect(can('viewer', 'viewTimeline')).toBe(true);
    expect(can('viewer', 'viewAnalytics')).toBe(true);
    for (const p of ['addActivity', 'uploadPhoto', 'invite', 'editBaby', 'deleteOwnActivity'] as Permission[]) {
      expect(can('viewer', p)).toBe(false);
    }
  });

  it('denies everything when the role is unknown', () => {
    expect(can(undefined, 'viewBaby')).toBe(false);
  });
});

describe('invitableRoles', () => {
  it('limits what each role can hand out, and never offers owner', () => {
    expect(invitableRoles('owner')).toEqual(['parent', 'caregiver', 'viewer']);
    expect(invitableRoles('parent')).toEqual(['caregiver', 'viewer']);
    expect(invitableRoles('caregiver')).toEqual([]);
    expect(invitableRoles('viewer')).toEqual([]);
    expect(invitableRoles(undefined)).toEqual([]);
  });
});
