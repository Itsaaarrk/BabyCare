import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface Item {
  key: string;
  label: string;
  emoji?: string;
}

interface Props {
  items: readonly Item[];
  /** Called with the item's index and the direction to move it. */
  onMove: (index: number, direction: -1 | 1) => void;
}

/**
 * Reorder with up and down buttons. Dragging is nicer to look at but can't be done with a screen
 * reader or one hand while holding a baby, so buttons are the primary control.
 */
export function ReorderList({ items, onMove }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={{
            minHeight: MIN_TOUCH_TARGET + 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ flex: 1 }}>
            {item.emoji ? `${item.emoji}  ` : ''}
            {item.label}
          </Text>
          <Mover
            label={`Move ${item.label} up`}
            glyph="▲"
            disabled={index === 0}
            onPress={() => onMove(index, -1)}
          />
          <Mover
            label={`Move ${item.label} down`}
            glyph="▼"
            disabled={index === items.length - 1}
            onPress={() => onMove(index, 1)}
          />
        </View>
      ))}
    </View>
  );
}

function Mover({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET + 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text>{glyph}</Text>
    </Pressable>
  );
}

/** Returns a copy of `list` with the item at `index` moved one step; unchanged at the ends. */
export function moveItem<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}
