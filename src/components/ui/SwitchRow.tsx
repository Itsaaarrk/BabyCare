import { Switch, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** A labelled on/off row. The whole row is described to screen readers as one switch. */
export function SwitchRow({ label, description, value, onValueChange, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {description ? (
          <Text variant="caption" muted>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
      />
    </View>
  );
}
