import { Tabs } from 'expo-router';
import { Text as RNText } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

// Emoji icons keep Phase 1 dependency-free; swap for an icon set in the Customization phase.
const icon = (glyph: string) =>
  function TabIcon() {
    return <RNText style={{ fontSize: 22 }}>{glyph}</RNText>;
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline', tabBarIcon: icon('🕒') }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: icon('👨‍👩‍👧') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
