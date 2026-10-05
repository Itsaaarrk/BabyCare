import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { BabyRow } from '@/components/baby/BabyRow';
import { LockedFeature } from '@/components/billing/LockedFeature';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';
import { useRoomPlan } from '@/hooks/useEntitlement';
import { useRooms } from '@/hooks/useRooms';
import { useTheme } from '@/hooks/useTheme';
import { PLAN_NAME, PLUS_LIMITS } from '@/lib/billing/config';

export default function ManageBabiesScreen() {
  const { colors } = useTheme();
  const { babies, loading, current, select } = useBabies();
  // The limit applies to the room this person owns; new babies are only ever added there.
  const ownedRoom = useRooms().rooms.find((room) => room.role === 'owner');
  const plan = useRoomPlan(ownedRoom?.id);
  const atLimit = !!ownedRoom && !plan.canAddBaby;

  return (
    <Screen topInset={false}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}

      {!loading && babies.length === 0 ? (
        <Card>
          <Text variant="heading">No babies yet</Text>
          <Text muted>Add your baby to start tracking their day.</Text>
        </Card>
      ) : null}

      {babies.map((baby) => (
        <BabyRow
          key={`${baby.roomId}/${baby.id}`}
          baby={baby}
          selected={current?.id === baby.id && current.roomId === baby.roomId}
          actionLabel={baby.role === 'owner' ? 'Edit' : undefined}
          onPress={() => {
            select({ roomId: baby.roomId, babyId: baby.id });
            if (baby.role === 'owner') {
              router.push({ pathname: '/baby/edit', params: { roomId: baby.roomId, babyId: baby.id } });
            }
          }}
        />
      ))}

      {atLimit ? (
        <LockedFeature
          title="More babies"
          description={`Your plan includes ${plan.limits.maxBabies} ${plan.limits.maxBabies === 1 ? 'baby' : 'babies'}. ${PLAN_NAME} lets a family room track up to ${PLUS_LIMITS.maxBabies}.`}
        />
      ) : (
        <Button label="Add a baby" onPress={() => router.push('/baby/new')} />
      )}
    </Screen>
  );
}
