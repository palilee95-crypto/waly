// ============================================
// RISEV Mobile — Design Tokens
// Copy from risevapp/src/theme (shared tokens)
// ============================================

export const colors = {
  // ── Primary Brand: Vibrant Yellow-Gold ───────────
  primary: {
    50:  '#FFFBEA',
    100: '#FFF1C5',
    200: '#FFE38F',
    300: '#FFD352',
    400: '#FFC700', // Core Brand Yellow
    500: '#E6B300',
    600: '#B38B00',
    700: '#806400',
    800: '#4D3C00',
    900: '#1A1400',
    DEFAULT: '#FFC700',
  },

  // ── Accent: Dark Slate/Black (Secondary action) ────
  accent: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    DEFAULT: '#1E293B', // Dark accent for buttons/headers
  },

  dark: {
    bg:      '#000000',
    surface: '#111827',
    border:  '#374151',
    muted:   '#4B5563',
  },

  light: {
    bg:      '#FAFAFA', // Very light off-white background
    surface: '#FFFFFF', // Pure white cards
    border:  '#E5E7EB',
    muted:   '#D1D5DB',
  },

  success: { DEFAULT: '#22C55E', light: '#DCFCE7', dark: '#15803D' },
  warning: { DEFAULT: '#F59E0B', light: '#FEF3C7', dark: '#B45309' },
  error:   { DEFAULT: '#EF4444', light: '#FEE2E2', dark: '#B91C1C' },
  info:    { DEFAULT: '#3B82F6', light: '#DBEAFE', dark: '#1D4ED8' },

  text: {
    primary:   '#000000', // Deep black for headings
    secondary: '#4B5563', // Dark grey for body text
    muted:     '#6B7280', // Medium grey for less important text
    disabled:  '#9CA3AF',
    inverse:   '#FFFFFF', // White text on dark/colored backgrounds
  },

  stamp: {
    filled:  '#FFC700',
    empty:   '#F3F4F6',
    special: '#000000',
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
