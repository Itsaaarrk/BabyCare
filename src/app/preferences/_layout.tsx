import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

export default function PreferencesLayout() {
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
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="quick-actions" options={{ title: 'Quick logging' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="time-zone" options={{ title: 'Time zone' }} />
    </Stack>
  );
}
