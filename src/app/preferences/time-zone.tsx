import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { deviceTimeZone, formatClock, isValidTimeZone, resolveTimeZone } from '@/lib/date/zone';

export default function TimeZoneScreen() {
  const { colors } = useTheme();
  const { settings, update } = useSettings();
  const [input, setInput] = useState(settings.timeZone === 'device' ? '' : settings.timeZone);
  const [error, setError] = useState<string | null>(null);

  const zone = resolveTimeZone(settings.timeZone);

  const save = () => {
    const value = input.trim();
    if (!isValidTimeZone(value)) {
      setError('That isn’t a time zone name. Try something like Asia/Manila or America/New_York.');
      return;
    }
    setError(null);
    update({ timeZone: value });
  };

  return (
    <Screen topInset={false}>
      <Card>
        <Text variant="heading">Times are shown in</Text>
        <Text>
          {settings.timeZone === 'device' ? `Your phone’s time zone (${zone})` : zone}
        </Text>
        <Text muted>Now: {formatClock(Date.now(), zone)}</Text>
      </Card>

      <Text muted>
        Days start and end at midnight in this zone, which decides what counts as “today”. Following
        your phone means it adjusts by itself when you travel.
      </Text>

      <Button
        label={`Follow my phone (${deviceTimeZone()})`}
        variant={settings.timeZone === 'device' ? 'secondary' : 'primary'}
        disabled={settings.timeZone === 'device'}
        onPress={() => {
          setInput('');
          setError(null);
          update({ timeZone: 'device' });
        }}
      />

      <TextField
        label="Or use a specific zone"
        value={input}
        onChangeText={setInput}
        placeholder="Asia/Manila"
        autoCapitalize="none"
        autoCorrect={false}
        error={error ?? undefined}
      />
      <Button label="Use this zone" variant="secondary" onPress={save} disabled={input.trim() === ''} />
      {error ? null : <Text variant="caption" style={{ color: colors.textMuted }}>Use the IANA name, e.g. Europe/London.</Text>}
    </Screen>
  );
}
