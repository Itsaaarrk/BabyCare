import { router } from 'expo-router';

import { QuickActionGrid } from '@/components/activity/QuickActionGrid';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';

/** Opened by shake-to-log: the same big buttons as home, in a sheet. */
export default function QuickLogScreen() {
  const { current } = useBabies();
  return (
    <Screen topInset={false}>
      <Text variant="title">Quick log</Text>
      <Text muted>{current ? `For ${current.name}` : 'Add a baby first'}</Text>
      {current ? (
        <QuickActionGrid
          onSelect={(type) => router.replace({ pathname: '/activity/start', params: { type } })}
        />
      ) : null}
    </Screen>
  );
}
