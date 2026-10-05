import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  title: string;
  /** The price as Google Play (or the fallback) formats it, e.g. "₱999 / year". */
  price: string;
  /** Whether it renews. Always shown, never hidden in fine print. */
  billing: string;
  /** Optional extra line, such as the yearly saving. */
  detail?: string;
  /** A badge such as "Best value". */
  badge?: { label: string; icon: IconName };
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function PlanCard({ title, price, billing, detail, badge, selected, onPress, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={[title, price, billing, detail, badge?.label].filter(Boolean).join(', ')}
      disabled={disabled}
      onPress={onPress}
      style={{
        gap: 4,
        padding: 16,
        borderRadius: radius.lg,
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.surfaceMuted : colors.surface,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {badge ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={badge.icon} size={16} color={colors.accent} />
          <Text variant="caption" style={{ color: colors.accent, fontWeight: '700' }}>
            {badge.label}
          </Text>
        </View>
      ) : null}
      <Text variant="heading">{title}</Text>
      <Text variant="title" style={{ fontSize: 24 }}>
        {price}
      </Text>
      <Text muted>{billing}</Text>
      {detail ? <Text>{detail}</Text> : null}
      {/* A text cue as well as the border, so the choice isn't conveyed by colour alone. */}
      {selected ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="check" size={16} color={colors.accent} />
          <Text variant="caption" style={{ fontWeight: '600' }}>
            Selected
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
