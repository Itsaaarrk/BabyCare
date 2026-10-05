import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

import { Text } from './Text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const background =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : 'transparent';
  const foreground = variant === 'secondary' ? colors.accent : colors.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? colors.accent : background,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text variant="heading" style={{ color: foreground, fontSize: 17 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
