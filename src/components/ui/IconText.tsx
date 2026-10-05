import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props {
  icon: IconName;
  children: ReactNode;
  variant?: ComponentProps<typeof Text>['variant'];
  muted?: boolean;
  /** Icon size; defaults to a size that sits well beside the text. */
  size?: number;
}

/** A label with its icon in front, e.g. a section heading. The text is what screen readers read. */
export function IconText({ icon, children, variant, muted, size = 22 }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={size} />
      <Text variant={variant} muted={muted} style={{ flexShrink: 1 }}>
        {children}
      </Text>
    </View>
  );
}
