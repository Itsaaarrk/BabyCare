import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SetupRequired } from '@/components/SetupRequired';
import { useAppSync } from '@/hooks/useActivities';
import { useBabySync } from '@/hooks/useBabies';
import { useReminders, useShakeToLog } from '@/hooks/useDeviceFeatures';
import { useTheme } from '@/hooks/useTheme';
import { isFirebaseConfigured } from '@/lib/env';
import { subscribeToAuth } from '@/services/auth/authService';
import { startSettingsSync } from '@/services/settings/settingsSync';
import { useAuthStore } from '@/stores/authStore';

void SplashScreen.preventAutoHideAsync();

function useSettingsSync() {
  const uid = useAuthStore((s) => s.user?.uid);
  useEffect(() => (uid ? startSettingsSync(uid) : undefined), [uid]);
}

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const setUser = useAuthStore((s) => s.setUser);
  useBabySync();
  useAppSync();
  useSettingsSync();
  useReminders();
  useShakeToLog();

  useEffect(() => {
    if (!isFirebaseConfigured) {
      void SplashScreen.hideAsync();
      return;
    }
    return subscribeToAuth(setUser);
  }, [setUser]);

  useEffect(() => {
    if (initialized) void SplashScreen.hideAsync();
  }, [initialized]);

  let content;
  if (!isFirebaseConfigured) {
    content = <SetupRequired />;
  } else if (!initialized) {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  } else {
    content = (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="baby" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="preferences" />
          <Stack.Screen
            name="summary"
            options={{
              headerShown: true,
              title: 'Daily summary',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{
              headerShown: true,
              title: 'BabyCare Plus',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="join"
            options={{
              headerShown: true,
              title: 'Join family room',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {content}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
