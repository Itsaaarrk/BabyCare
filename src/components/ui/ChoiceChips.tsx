import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  /** Tapping the selected option again clears it. */
  clearable?: boolean;
  error?: string;
  disabled?: boolean;
}

/** Single-choice selector with large touch targets, for forms and settings. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  clearable,
  error,
  disabled,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="caption" muted>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => onChange(selected && clearable ? undefined : option.value)}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <Text style={{ fontWeight: selected ? '700' : '400' }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
