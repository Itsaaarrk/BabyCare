// The server enforces plan limits; the app only explains them. If these two copies of the rules
// ever drift apart, the app would promise things the server refuses (or the reverse).
import * as server from '../../../functions/src/billing';
import { babyFormSchema } from '@/features/babies/schemas';

import { FREE_LIMITS, PLUS_LIMITS } from './config';
import { isPlusActive, limitsFor, PLANS, SUBSCRIPTION_STATUSES, type RoomEntitlement } from './entitlement';

const NOW = Date.UTC(2026, 9, 5, 12, 0);
const DAY = 86_400_000;

describe('server and app agree on plans', () => {
  it('uses the same plan and status names', () => {
    expect([...server.PLANS]).toEqual([...PLANS]);
    expect([...server.SUBSCRIPTION_STATUSES]).toEqual([...SUBSCRIPTION_STATUSES]);
  });

  it('uses the same limits', () => {
    expect(server.FREE_MAX_BABIES).toBe(FREE_LIMITS.maxBabies);
    expect(server.PLUS_MAX_BABIES).toBe(PLUS_LIMITS.maxBabies);
    expect(server.FREE_MAX_OWNED_ROOMS).toBe(FREE_LIMITS.maxOwnedRooms);
    expect(server.PLUS_MAX_OWNED_ROOMS).toBe(PLUS_LIMITS.maxOwnedRooms);
  });

  it('decides "is Plus" identically for every plan, status and date', () => {
    const expiries: (number | null | undefined)[] = [undefined, null, NOW - DAY, NOW - 1, NOW, NOW + 1, NOW + 30 * DAY];
    let checked = 0;
    for (const plan of PLANS) {
      for (const status of SUBSCRIPTION_STATUSES) {
        for (const expiresAt of expiries) {
          const entitlement: RoomEntitlement = { plan, status, expiresAt, updatedAt: NOW };
          expect({ entitlement, plus: server.isPlusActive(entitlement, NOW) }).toEqual({
            entitlement,
            plus: isPlusActive(entitlement, NOW),
          });
          expect(server.maxBabiesFor(entitlement, NOW)).toBe(limitsFor(entitlement, NOW).maxBabies);
          expect(server.maxOwnedRoomsFor(entitlement, NOW)).toBe(limitsFor(entitlement, NOW).maxOwnedRooms);
          checked++;
        }
      }
    }
    expect(checked).toBe(PLANS.length * SUBSCRIPTION_STATUSES.length * expiries.length);
    expect(server.isPlusActive(null, NOW)).toBe(false);
  });
});

describe('server and app accept the same baby details', () => {
  const cases: Record<string, unknown>[] = [
    { name: 'Sofia', birthDate: '2026-09-22' },
    { name: '  Sofia  ', nickname: ' Sof ', birthDate: '2026-09-22', birthTime: '08:30', gender: 'girl', notes: 'hello' },
    { name: '', birthDate: '2026-09-22' },
    { name: 'x'.repeat(60), birthDate: '2026-09-22' },
    { name: 'x'.repeat(61), birthDate: '2026-09-22' },
    { name: 'Sofia', nickname: 'n'.repeat(41), birthDate: '2026-09-22' },
    { name: 'Sofia', notes: 'n'.repeat(1001), birthDate: '2026-09-22' },
    { name: 'Sofia', birthDate: '2026-02-30' },
    { name: 'Sofia', birthDate: '2999-01-01' },
    { name: 'Sofia', birthDate: 'last week' },
    { name: 'Sofia', birthDate: '2026-09-22', birthTime: '24:00' },
    { name: 'Sofia', birthDate: '2026-09-22', birthTime: '23:59' },
    { name: 'Sofia', birthDate: '2026-09-22', gender: 'robot' },
    { name: 'Sofia', birthDate: '2026-09-22', gender: 'other' },
  ];

  it('agrees on which are valid', () => {
    for (const input of cases) {
      const form = { nickname: '', birthTime: '', notes: '', ...input };
      const appOk = babyFormSchema.safeParse(form).success;
      const serverOk = server.parseBabyInput(input, Date.now()) !== null;
      expect({ input, ok: serverOk }).toEqual({ input, ok: appOk });
    }
  });
});
