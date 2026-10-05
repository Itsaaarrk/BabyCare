import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { BabyEditor } from '@/components/baby/BabyEditor';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';
import { useTheme } from '@/hooks/useTheme';

export default function EditBabyScreen() {
  const { roomId, babyId } = useLocalSearchParams<{ roomId: string; babyId: string }>();
  const { colors } = useTheme();
  const { babies, loading } = useBabies();
  const baby = babies.find((b) => b.id === babyId && b.roomId === roomId);

  if (!baby) {
    return (
      <Screen topInset={false}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Card>
            <Text variant="heading">Baby not found</Text>
            <Text muted>This profile may have been removed.</Text>
          </Card>
        )}
      </Screen>
    );
  }

  if (baby.role !== 'owner') {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">View only</Text>
          <Text muted>Only the room owner can edit {baby.name}’s profile.</Text>
        </Card>
      </Screen>
    );
  }

  // Keyed so switching babies never reuses stale form state.
  return <BabyEditor key={`${baby.roomId}/${baby.id}`} baby={baby} />;
}
