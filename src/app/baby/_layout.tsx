import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function BabyLayout() {
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
      <Stack.Screen name="index" options={{ title: 'My babies' }} />
      <Stack.Screen name="new" options={{ title: 'Add a baby' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit baby' }} />
    </Stack>
  );
}
