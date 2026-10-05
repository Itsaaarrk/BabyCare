import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { BabyRow } from '@/components/baby/BabyRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';
import { useTheme } from '@/hooks/useTheme';

export default function ManageBabiesScreen() {
  const { colors } = useTheme();
  const { babies, loading, current, select } = useBabies();

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

      <Button label="Add a baby" onPress={() => router.push('/baby/new')} />
    </Screen>
  );
}
