import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { ActivityType } from '@/types/activity';

type SymbolName = Exclude<ComponentProps<typeof SymbolView>['name'], string>;

/**
 * One name per icon the app uses. Android and web draw Material Symbols, iOS draws the matching
 * SF Symbol. The names are checked against both libraries' lists at compile time.
 */
const SYMBOLS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  timeline: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  analytics: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  family: { ios: 'person.3.fill', android: 'family_restroom', web: 'family_restroom' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  feeding: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  diaper: { ios: 'figure.and.child.holdinghands', android: 'baby_changing_station', web: 'baby_changing_station' },
  sleep: { ios: 'moon.zzz.fill', android: 'bedtime', web: 'bedtime' },
  bath: { ios: 'bathtub.fill', android: 'bathtub', web: 'bathtub' },
  outdoor: { ios: 'sun.max.fill', android: 'sunny', web: 'sunny' },
  note: { ios: 'note.text', android: 'edit_note', web: 'edit_note' },
  photo: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  baby: { ios: 'face.smiling', android: 'child_care', web: 'child_care' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof SYMBOLS;

interface Props {
  name: IconName;
  size?: number;
  /** Defaults to the normal text colour. */
  color?: ColorValue;
}

/**
 * A decorative icon: it is hidden from screen readers, so wherever it carries meaning the
 * surrounding label or accessibilityLabel must say it in words.
 */
export function Icon({ name, size = 24, color }: Props) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={SYMBOLS[name]}
      size={size}
      tintColor={color ?? colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** The icon for an activity type (feeding, diaper, sleep, ...). */
export const ActivityIcon = ({ type, ...rest }: Omit<Props, 'name'> & { type: ActivityType }) => (
  <Icon name={type} {...rest} />
);
