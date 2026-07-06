// ============================================
// WALY Mobile — Design Tokens
// Copy from walyapp/src/theme (shared tokens)
// ============================================

export const colors = {
  // ── Primary Brand: Royal Purple ───────────
  primary: {
    50:  '#F0EBFF',
    100: '#DDD3FF',
    200: '#BBA8FF',
    300: '#997CFF',
    400: '#7750F8',
    500: '#5C3BCC',
    600: '#4A2EA8',
    700: '#372285',
    800: '#251661',
    900: '#130A3E',
    DEFAULT: '#5C3BCC',
  },

  // ── Accent: Amber Gold ─────────────────────
  accent: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F4A825',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    DEFAULT: '#F4A825',
  },

  dark: {
    bg:      '#1C1340',
    surface: '#261A54',
    border:  '#352470',
    muted:   '#7060A8',
  },

  light: {
    bg:      '#F4F2FF',
    surface: '#FFFFFF',
    border:  '#E4E0F5',
    muted:   '#9B94C4',
  },

  success: { DEFAULT: '#22C55E', light: '#DCFCE7', dark: '#15803D' },
  warning: { DEFAULT: '#F59E0B', light: '#FEF3C7', dark: '#B45309' },
  error:   { DEFAULT: '#EF4444', light: '#FEE2E2', dark: '#B91C1C' },
  info:    { DEFAULT: '#3B82F6', light: '#DBEAFE', dark: '#1D4ED8' },

  text: {
    primary:   '#111827',
    secondary: '#374151',
    muted:     '#6B7280',
    disabled:  '#9CA3AF',
    inverse:   '#FFFFFF',
  },

  stamp: {
    filled:  '#5C3BCC',
    empty:   '#E4E0F5',
    special: '#F4A825',
  },

  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const;

export const spacing = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10,
  3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 7: 28,
  8: 32, 9: 36, 10: 40, 12: 48, 14: 56, 16: 64,
  20: 80, 24: 96, 32: 128,
} as const;

export const radii = {
  none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, full: 9999,
} as const;

export const shadows = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm:   { shadowColor: '#1C1340', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,  elevation: 2 },
  md:   { shadowColor: '#1C1340', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,  elevation: 4 },
  lg:   { shadowColor: '#1C1340', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
  xl:   { shadowColor: '#5C3BCC', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
} as const;

export const layout = {
  screenPaddingH:  20,
  screenPaddingV:  16,
  headerHeight:    56,
  tabBarHeight:    72,
  buttonHeightLg:  52,
  buttonHeightMd:  44,
  buttonHeightSm:  36,
  inputHeight:     48,
  stampCardWidth:  340,
  stampCardHeight: 200,
  stampSize:       48,
  stampSizeSmall:  36,
  avatarSm:  32,
  avatarMd:  40,
  avatarLg:  56,
  avatarXl:  80,
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  layout,
} as const;

export default theme;
