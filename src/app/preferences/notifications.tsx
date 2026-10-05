import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { DateField } from '@/components/ui/DateField';
import { Screen } from '@/components/ui/Screen';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { DailyReminder } from '@/lib/settings';
import { notificationPermission, type PermissionState } from '@/services/notifications/notificationService';

const HOURS = [1, 2, 3, 4, 6].map((h) => ({ value: String(h), label: `${h} ${h === 1 ? 'hour' : 'hours'}` }));
const MAX_DAILY = 10;

const pad = (n: number) => String(n).padStart(2, '0');

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const n = settings.notifications;
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    void notificationPermission(false).then(setPermission);
  }, []);

  const setNotifications = (patch: Partial<typeof n>) => update({ notifications: { ...n, ...patch } });

  const toggleMaster = async (enabled: boolean) => {
    if (enabled) {
      const state = await notificationPermission(true);
      setPermission(state);
      if (state !== 'granted') return;
    }
    setNotifications({ enabled });
  };

  const updateDaily = (id: string, patch: Partial<DailyReminder>) =>
    setNotifications({ daily: n.daily.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addDaily = () =>
    setNotifications({
      daily: [
        ...n.daily,
        { id: `r${Date.now().toString(36)}`, label: 'Reminder', hour: 9, minute: 0, enabled: true },
      ],
    });

  return (
    <Screen topInset={false}>
      <Card>
        <SwitchRow
          label="Reminders"
          description="Off by default. You’ll only get the reminders you set up here."
          value={n.enabled}
          disabled={permission === 'unavailable'}
          onValueChange={(v) => void toggleMaster(v)}
        />
        {permission === 'unavailable' ? (
          <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            Reminders aren’t available in Expo Go on Android. Use a development build to try them.
          </Text>
        ) : null}
        {permission === 'denied' ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
              Notifications are blocked for BabyCare in your phone’s settings.
            </Text>
            <Button label="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
      </Card>

      <Card>
        <SwitchRow
          label="Feeding reminder"
          description="One reminder, a set time after the last feed. It moves when a new feed is logged."
          value={n.feedingReminder.enabled}
          disabled={!n.enabled}
          onValueChange={(enabled) => setNotifications({ feedingReminder: { ...n.feedingReminder, enabled } })}
        />
        {n.feedingReminder.enabled && n.enabled ? (
          <ChoiceChips
            label="Remind me after"
            options={HOURS}
            value={String(n.feedingReminder.hours)}
            onChange={(v) => v && setNotifications({ feedingReminder: { ...n.feedingReminder, hours: Number(v) } })}
          />
        ) : null}
        <Text variant="caption" muted>
          The reminder is refreshed whenever the app syncs, so it follows feeds logged by anyone in the
          family while this phone is connected.
        </Text>
      </Card>

      <Card>
        <Text variant="heading">Daily reminders</Text>
        <Text muted>For things like vitamins or a bedtime routine. They follow your phone’s clock.</Text>
        {n.daily.map((reminder) => (
          <View key={reminder.id} style={{ gap: 8, paddingTop: 8 }}>
            <TextField
              label="Label"
              value={reminder.label}
              maxLength={60}
              onChangeText={(label) => updateDaily(reminder.id, { label })}
            />
            <DateField
              label="Time"
              mode="time"
              value={`${pad(reminder.hour)}:${pad(reminder.minute)}`}
              onChange={(value) => {
                const [h, m] = value.split(':').map(Number);
                if (h !== undefined && m !== undefined) updateDaily(reminder.id, { hour: h, minute: m });
              }}
            />
            <SwitchRow
              label="On"
              value={reminder.enabled}
              disabled={!n.enabled}
              onValueChange={(enabled) => updateDaily(reminder.id, { enabled })}
            />
            <Button
              label="Delete this reminder"
              variant="secondary"
              onPress={() => setNotifications({ daily: n.daily.filter((r) => r.id !== reminder.id) })}
            />
          </View>
        ))}
        <Button
          label="Add a daily reminder"
          variant="secondary"
          disabled={n.daily.length >= MAX_DAILY}
          onPress={addDaily}
        />
      </Card>
    </Screen>
  );
}
