import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { buildPalette, type Palette } from '@/constants/theme';
import { useThemeStore } from '@/stores/themeStore';

export function useTheme(): { colors: Palette; isDark: boolean } {
  const system = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const colors = useMemo(() => buildPalette(scheme, accent), [scheme, accent]);
  return { colors, isDark: scheme === 'dark' };
}
