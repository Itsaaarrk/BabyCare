import { Pressable, View } from 'react-native';

import { BabyAvatar } from '@/components/baby/BabyAvatar';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import type { BabyEntry } from '@/hooks/useBabies';
import { useTheme } from '@/hooks/useTheme';
import { formatAge } from '@/lib/date/age';

interface Props {
  baby: BabyEntry;
  selected?: boolean;
  onPress: () => void;
  actionLabel?: string;
}

export function BabyRow({ baby, selected, onPress, actionLabel }: Props) {
  const { colors } = useTheme();
  const age = formatAge(baby.birthDate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${baby.name}, ${age}${actionLabel ? `. ${actionLabel}` : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET + 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <BabyAvatar size={56} photoPath={baby.photoPath} label={`${baby.name}'s photo`} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{baby.name}</Text>
        {baby.nickname ? <Text muted>“{baby.nickname}”</Text> : null}
        <Text muted>{age}</Text>
      </View>
      {actionLabel ? <Text style={{ color: colors.accent, fontWeight: '600' }}>{actionLabel}</Text> : null}
    </Pressable>
  );
}
