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

export const iconSizes = {
  micro:   12, // Subtext metadata, tiny badges, stock markers
  sm:      14, // Secondary status pills, inline timestamps
  md:      18, // Form input decorators, default list icons, navigation links
  lg:      22, // App bar actions, primary segmented tabs
  xl:      28, // Apple squircle feature badges, primary action triggers
  display: 40, // Empty states, modal celebratory heroes
} as const;

export interface VoucherSpineTheme {
  spineBg: string;
  spineText: string;
  spineTextColor: string;
  subText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export function getVoucherSpineTheme(rewardType?: string, title?: string, brandColor?: string): VoucherSpineTheme {
  const normType = (rewardType || '').toLowerCase();
  const normTitle = (title || '').toLowerCase();

  let defaultTheme: VoucherSpineTheme;

  if (normType === 'bogo' || normTitle.includes('buy 1 free 1') || normTitle.includes('bogo')) {
    defaultTheme = {
      spineBg: '#E11D48', // Crimson Ruby
      spineText: 'BUY 1 FREE 1',
      spineTextColor: '#FFFFFF',
      subText: 'SPECIAL PASS',
      badgeBg: '#FFE4E6',
      badgeBorder: '#FECDD3',
      badgeText: '#BE123C',
    };
  } else if (normType === 'happy_hour' || normTitle.includes('happy hour')) {
    defaultTheme = {
      spineBg: '#7C3AED', // Royal Purple
      spineText: 'HAPPY HOUR',
      spineTextColor: '#FFFFFF',
      subText: 'OFF-PEAK PASS',
      badgeBg: '#F3E8FF',
      badgeBorder: '#E9D5FF',
      badgeText: '#6D28D9',
    };
  } else if (normType === 'flash_sale' || normTitle.includes('flash sale') || normTitle.includes('kilat')) {
    defaultTheme = {
      spineBg: '#D97706', // Electric Amber
      spineText: 'FLASH SALE',
      spineTextColor: '#FFFFFF',
      subText: 'LIMITED PASS',
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      badgeText: '#B45309',
    };
  } else if (normType === 'welcome_gift' || normTitle.includes('welcome') || normTitle.includes('pertama')) {
    defaultTheme = {
      spineBg: '#0D9488', // Fresh Teal
      spineText: 'WELCOME GIFT',
      spineTextColor: '#FFFFFF',
      subText: 'NEW GUEST PASS',
      badgeBg: '#CCFBF1',
      badgeBorder: '#99F6E4',
      badgeText: '#0F766E',
    };
  } else if (normType === 'bring_friend' || normTitle.includes('friend') || normTitle.includes('kawan')) {
    defaultTheme = {
      spineBg: '#0284C7', // Electric Blue
      spineText: 'BRING A FRIEND',
      spineTextColor: '#FFFFFF',
      subText: 'DUO PASS',
      badgeBg: '#E0F2FE',
      badgeBorder: '#BAE6FD',
      badgeText: '#0369A1',
    };
  } else if (normType === 'win_back' || normTitle.includes('miss you') || normTitle.includes('sepi')) {
    defaultTheme = {
      spineBg: '#BE185D', // Velvet Rose
      spineText: 'WE MISS YOU',
      spineTextColor: '#FFFFFF',
      subText: 'SPECIAL PASS',
      badgeBg: '#FCE7F3',
      badgeBorder: '#FBCFE8',
      badgeText: '#9D174D',
    };
  } else if (normType === 'spend_save' || normTitle.includes('spend & save') || normTitle.includes('hemat')) {
    defaultTheme = {
      spineBg: '#15803D', // Forest Green
      spineText: 'SPEND & SAVE',
      spineTextColor: '#FFFFFF',
      subText: 'SAVER PASS',
      badgeBg: '#DCFCE7',
      badgeBorder: '#BBF7D0',
      badgeText: '#15803D',
    };
  } else if (normType === 'festive' || normTitle.includes('merdeka') || normTitle.includes('raya') || normTitle.includes('payday')) {
    defaultTheme = {
      spineBg: '#B45309', // Luxury Gold
      spineText: 'FESTIVE PASS',
      spineTextColor: '#FFFFFF',
      subText: 'CELEBRATION PASS',
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      badgeText: '#92400E',
    };
  } else if (normType === 'discount') {
    defaultTheme = {
      spineBg: '#EA580C', // Sunset Orange
      spineText: 'DISCOUNT',
      spineTextColor: '#FFFFFF',
      subText: 'SPECIAL PASS',
      badgeBg: '#FFEDD5',
      badgeBorder: '#FED7AA',
      badgeText: '#C2410C',
    };
  } else {
    // Default: Free Item
    defaultTheme = {
      spineBg: '#059669', // Emerald Green
      spineText: 'FREE ITEM',
      spineTextColor: '#FFFFFF',
      subText: 'REWARD PASS',
      badgeBg: '#D1FAE5',
      badgeBorder: '#A7F3D0',
      badgeText: '#047857',
    };
  }

  if (brandColor) {
    const hex = brandColor.replace('#', '');
    let isLight = false;
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      isLight = yiq >= 160;
    }
    return {
      ...defaultTheme,
      spineBg: brandColor,
      spineTextColor: isLight ? '#0F172A' : '#FFFFFF',
    };
  }

  return defaultTheme;
}

export const PRO_CAMPAIGN_RECIPES = [
  {
    id: 'bogo',
    name: 'Buy 1 Free 1',
    desc: 'Buy 1 item, get 1 free on selected menu',
    icon: 'cafe-outline',
    color: '#E11D48',
    baseType: 'free_item',
    tag: '1+1 FREE',
  },
  {
    id: 'happy_hour',
    name: 'Happy Hour',
    desc: 'Fill quiet hours between 2 PM – 5 PM',
    icon: 'time-outline',
    color: '#7C3AED',
    baseType: 'discount',
    tag: 'HAPPY HOUR',
  },
  {
    id: 'flash_sale',
    name: 'Flash Sale',
    desc: 'Limited-time deal for 24h or 48h only',
    icon: 'flash-outline',
    color: '#D97706',
    baseType: 'discount',
    tag: 'LIMITED TIME',
  },
  {
    id: 'welcome_gift',
    name: 'Welcome Gift',
    desc: 'Special perk for first-time visitors',
    icon: 'hand-left-outline',
    color: '#0D9488',
    baseType: 'free_item',
    tag: 'NEW GUEST',
  },
  {
    id: 'bring_friend',
    name: 'Bring A Friend',
    desc: 'Special perks when customers visit in pairs',
    icon: 'people-outline',
    color: '#0284C7',
    baseType: 'discount',
    tag: 'WITH FRIEND',
  },
  {
    id: 'win_back',
    name: 'We Miss You',
    desc: 'Invite regulars back with a special gift',
    icon: 'heart-outline',
    color: '#BE185D',
    baseType: 'discount',
    tag: 'COME BACK',
  },
  {
    id: 'spend_save',
    name: 'Spend & Save',
    desc: 'Spend RM50, get RM10 off your bill',
    icon: 'wallet-outline',
    color: '#15803D',
    baseType: 'discount',
    tag: 'SPEND & SAVE',
  },
  {
    id: 'festive',
    name: 'Holiday & Payday Special',
    desc: 'Boost sales on payday & festive seasons',
    icon: 'sparkles-outline',
    color: '#B45309',
    baseType: 'discount',
    tag: 'SPECIAL EVENT',
  },
] as const;

export type ProCampaignRecipe = typeof PRO_CAMPAIGN_RECIPES[number];

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  layout,
  iconSizes,
  getVoucherSpineTheme,
  PRO_CAMPAIGN_RECIPES,
} as const;

export default theme;

