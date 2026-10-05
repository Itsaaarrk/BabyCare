import { View } from 'react-native';

import { DateField } from '@/components/ui/DateField';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { useTimeZone } from '@/hooks/useSettings';
import { dayKey, fromLocalParts, timePart } from '@/lib/date/zone';

interface Props {
  label: string;
  /** UTC milliseconds. */
  value: number;
  onChange: (ms: number) => void;
  error?: string;
}

/** A date and a time field that together edit one instant, read in the user's time zone. */
export function DateTimeField({ label, value, onChange, error }: Props) {
  const { colors } = useTheme();
  const zone = useTimeZone();

  const update = (date: string, time: string) => {
    const ms = fromLocalParts(date, time, zone);
    if (ms !== null) onChange(ms);
  };

  return (
    <View style={{ gap: 6 }} accessibilityLabel={label}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <DateField
        label="Date"
        mode="date"
        value={dayKey(value, zone)}
        onChange={(date) => update(date, timePart(value, zone))}
      />
      <DateField
        label="Time"
        mode="time"
        value={timePart(value, zone)}
        onChange={(time) => update(dayKey(value, zone), time)}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
