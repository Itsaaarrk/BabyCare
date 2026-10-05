import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { ACCENT_COLORS, MIN_TOUCH_TARGET, type AccentName, type ThemeMode } from '@/constants/theme';
import { useSettings, useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { signOut } from '@/services/auth/authService';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { mode, accent, setMode, setAccent } = useThemeStore();
  const { settings, update } = useSettings();
  const zone = useTimeZone();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(toUserMessage(e));
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">Settings</Text>

      <Card>
        <Text variant="heading">Babies</Text>
        <Text muted>Edit profiles, add another baby, or change a photo.</Text>
        <Button label="Manage babies" variant="secondary" onPress={() => router.push('/baby')} />
      </Card>

      <Card>
        <Text variant="heading">Family room</Text>
        <Text muted>Members, invitations, join code and QR code.</Text>
        <Button label="Open Family" variant="secondary" onPress={() => router.push('/family')} />
      </Card>

      <Card>
        <Text variant="heading">Appearance</Text>
        <ChoiceChips<ThemeMode>
          label="Theme"
          options={MODES}
          value={mode}
          onChange={(v) => v && setMode(v)}
        />

        <Text variant="caption" muted style={{ marginTop: 8 }}>
          Accent color
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(Object.keys(ACCENT_COLORS) as AccentName[]).map((name) => {
            const selected = name === accent;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${name} accent`}
                onPress={() => setAccent(name)}
                style={{
                  width: MIN_TOUCH_TARGET,
                  height: MIN_TOUCH_TARGET,
                  borderRadius: MIN_TOUCH_TARGET / 2,
                  backgroundColor: ACCENT_COLORS[name],
                  borderWidth: selected ? 4 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
        </View>
        <Button
          label="Customize dashboard"
          variant="secondary"
          onPress={() => router.push('/preferences/dashboard')}
        />
      </Card>

      <Card>
        <Text variant="heading">Quick logging</Text>
        <SwitchRow
          label="Shake to log"
          description="Opens Quick Log when you shake the phone."
          value={settings.shakeToLog}
          onValueChange={(shakeToLog) => update({ shakeToLog })}
        />
        <Button
          label="Quick-action buttons"
          variant="secondary"
          onPress={() => router.push('/preferences/quick-actions')}
        />
      </Card>

      <Card>
        <Text variant="heading">Notifications</Text>
        <Text muted>
          {settings.notifications.enabled ? 'Reminders are on.' : 'Reminders are off.'}
        </Text>
        <Button
          label="Reminder preferences"
          variant="secondary"
          onPress={() => router.push('/preferences/notifications')}
        />
      </Card>

      <Card>
        <Text variant="heading">Time zone</Text>
        <Text muted>
          {settings.timeZone === 'device' ? `Following your phone (${zone})` : zone}
        </Text>
        <Button label="Change time zone" variant="secondary" onPress={() => router.push('/preferences/time-zone')} />
      </Card>

      <Card>
        <Text variant="heading">Account</Text>
        {user?.displayName ? <Text>{user.displayName}</Text> : null}
        <Text muted>{user?.email}</Text>
      </Card>

      <Text variant="caption" muted>
        BabyCare helps you keep track of daily care. It isn’t a medical device and doesn’t give medical
        advice. Talk to your pediatrician about any health concerns.
      </Text>

      {error ? <Text accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label="Sign out" variant="secondary" onPress={onSignOut} loading={signingOut} />
    </Screen>
  );
}
