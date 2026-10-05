export type ThemeMode = 'system' | 'light' | 'dark';

export const ACCENT_COLORS = {
  peach: '#F2845C',
  rose: '#E26D8F',
  sage: '#5FA37F',
  sky: '#4F9BD9',
  lavender: '#8E7CC3',
} as const;

export type AccentName = keyof typeof ACCENT_COLORS;

export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
  success: string;
}

const base = {
  light: {
    background: '#FFF8F3',
    surface: '#FFFFFF',
    surfaceMuted: '#FBEFE6',
    border: '#EBDACB',
    text: '#3A2E2A',
    textMuted: '#7A6A62',
    danger: '#C0392B',
    success: '#2E7D5B',
  },
  // Dark mode stays warm and low-glare for late-night use.
  dark: {
    background: '#1C1614',
    surface: '#2A211E',
    surfaceMuted: '#352A26',
    border: '#4A3B35',
    text: '#F5EAE2',
    textMuted: '#B8A59B',
    danger: '#FF8A7A',
    success: '#6FCF9F',
  },
} as const;

export function buildPalette(scheme: 'light' | 'dark', accent: AccentName): Palette {
  return { ...base[scheme], accent: ACCENT_COLORS[accent], onAccent: '#FFFFFF' };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { md: 12, lg: 20, pill: 999 } as const;
export const MIN_TOUCH_TARGET = 48;
