import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function ActivityLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="start" options={{ title: 'Log activity' }} />
      <Stack.Screen name="form" options={{ title: 'Activity' }} />
      <Stack.Screen name="detail" options={{ title: 'Activity details' }} />
      <Stack.Screen name="quick" options={{ title: 'Quick log', presentation: 'modal' }} />
    </Stack>
  );
}
