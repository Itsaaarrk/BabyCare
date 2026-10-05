import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { ROLE_LABELS, type AssignableRole } from '@/lib/permissions';

interface Props {
  roles: readonly AssignableRole[];
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  disabled?: boolean;
}

/** A small single-choice selector for picking a member or invitation role. */
export function RoleChips({ roles, value, onChange, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
      {roles.map((role) => {
        const selected = role === value;
        return (
          <Pressable
            key={role}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={ROLE_LABELS[role]}
            disabled={disabled}
            onPress={() => onChange(role)}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: 16,
              justifyContent: 'center',
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.surfaceMuted : 'transparent',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: selected ? '700' : '400' }}>{ROLE_LABELS[role]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
