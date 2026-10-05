import { useMemo } from 'react';

import { useNow } from '@/hooks/useNow';
import type { PremiumFeature } from '@/lib/billing/config';
import { effectivePlan, hasFeature, limitsFor } from '@/lib/billing/entitlement';
import { useBabyStore } from '@/stores/babyStore';

/**
 * A room's plan, as the app should treat it right now. Re-checked every minute, so a subscription
 * that runs out while the app is open stops counting without a restart.
 *
 * This is for explaining and for showing the right screens. The server enforces the limits, so
 * nothing here can be used to get around them.
 */
export function useRoomPlan(roomId: string | undefined) {
  const room = useBabyStore((s) => (roomId ? s.rooms[roomId] : undefined));
  const now = useNow(60_000);

  return useMemo(() => {
    const entitlement = room?.entitlement ?? null;
    const plan = effectivePlan(entitlement, now);
    const limits = limitsFor(entitlement, now);
    const babyCount = Object.keys(room?.babies ?? {}).length;
    return {
      ...plan,
      limits,
      babyCount,
      /** Whether another baby may be added to this room. */
      canAddBaby: babyCount < limits.maxBabies,
      hasFeature: (feature: PremiumFeature) => hasFeature(entitlement, feature, now),
    };
  }, [room, now]);
}
