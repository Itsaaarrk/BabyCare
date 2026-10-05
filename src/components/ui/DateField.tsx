import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { parseDateString, toDateString, toTimeString } from '@/lib/date/age';

import { Text } from './Text';
import { TextField } from './TextField';

interface Props {
  label: string;
  mode: 'date' | 'time';
  /** `YYYY-MM-DD` for dates, `HH:mm` for times, or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  /** When provided, the field is optional and can be cleared. */
  allowClear?: boolean;
  maximumDate?: Date;
  error?: string;
}

function toDate(mode: Props['mode'], value: string): Date {
  if (mode === 'date') {
    const parsed = parseDateString(value);
    return parsed ? new Date(parsed.year, parsed.month - 1, parsed.day) : new Date();
  }
  const now = new Date();
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match) now.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return now;
}

const serialize = (mode: Props['mode'], date: Date) =>
  mode === 'date' ? toDateString(date) : toTimeString(date);

function display(mode: Props['mode'], date: Date): string {
  return mode === 'date'
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function DateField({ label, mode, value, onChange, allowClear, maximumDate, error }: Props) {
  const { colors } = useTheme();

  // Native pickers don't exist on web; fall back to typing the raw value.
  if (Platform.OS === 'web') {
    return (
      <TextField
        label={`${label} (${mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'})`}
        value={value}
        onChangeText={onChange}
        error={error}
      />
    );
  }

  const isSet = value !== '';
  const current = toDate(mode, value);

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: current,
      mode,
      maximumDate,
      onValueChange: (_event, date) => onChange(serialize(mode, date)),
    });

  const clear = allowClear && isSet && (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clear ${label}`}
      onPress={() => onChange('')}
      hitSlop={8}
      style={styles.clear}
    >
      <Text muted>Clear</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrapper}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        {Platform.OS === 'ios' && isSet ? (
          <DateTimePicker
            value={current}
            mode={mode}
            display="compact"
            maximumDate={maximumDate}
            accentColor={colors.accent}
            onValueChange={(_event, date) => onChange(serialize(mode, date))}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSet ? `${label}: ${display(mode, current)}` : `Add ${label}`}
            onPress={
              Platform.OS === 'android' ? openAndroid : () => onChange(serialize(mode, new Date()))
            }
            style={styles.valueButton}
          >
            <Text style={isSet ? undefined : { color: colors.textMuted }}>
              {isSet ? display(mode, current) : 'Not set — tap to add'}
            </Text>
          </Pressable>
        )}
        {clear}
      </View>
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueButton: { flex: 1, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  clear: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingLeft: 12 },
});
