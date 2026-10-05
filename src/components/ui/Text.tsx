import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Variant = 'title' | 'heading' | 'body' | 'caption';

const sizes: Record<Variant, { fontSize: number; fontWeight: '400' | '600' | '700' }> = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
};

interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[sizes[variant], { color: muted ? colors.textMuted : colors.text }, style]}
    />
  );
}
