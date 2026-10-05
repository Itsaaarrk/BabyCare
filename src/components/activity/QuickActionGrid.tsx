import { Pressable, View } from 'react-native';

import { ActivityIcon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useEnabledTypes } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { ACTIVITY_META } from '@/lib/activity/meta';
import type { ActivityType } from '@/types/activity';

interface Props {
  onSelect: (type: ActivityType) => void;
  /** Types with a running timer, shown with an indicator. */
  running?: readonly ActivityType[];
}

/** Large one-tap buttons, in the user's chosen order, hiding activities they turned off. */
export function QuickActionGrid({ onSelect, running = [] }: Props) {
  const { colors } = useTheme();
  const types = useEnabledTypes();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {types.map((type) => {
        const meta = ACTIVITY_META[type];
        const active = running.includes(type);
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={active ? `${meta.label}, in progress` : `Log ${meta.label.toLowerCase()}`}
            onPress={() => onSelect(type)}
            style={({ pressed }) => ({
              width: '47%',
              minHeight: 96,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: radius.lg,
              backgroundColor: active ? colors.surfaceMuted : colors.surface,
              borderWidth: active ? 2.5 : 1.5,
              borderColor: active ? colors.accent : colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <ActivityIcon type={type} size={32} />
            <Text variant="heading" style={{ fontSize: 17 }}>
              {meta.action}
            </Text>
            {/* A text cue as well as the border, so state isn't conveyed by colour alone. */}
            {active ? <Text variant="caption" muted>In progress</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
