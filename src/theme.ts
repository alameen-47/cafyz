// Cafyz — Design tokens
// Fonts: requires react-native-font-files or manual linking of:
//   Playfair Display (serif headings)
//   Inter (body/UI)
//   JetBrains Mono (monospace IDs/timers)

export const Colors = {
  bg0: '#0A0A0F',       // deep space background
  bg1: '#12121A',       // card surface
  bg2: '#0D0D14',       // input surface
  bg3: '#1A1A26',       // empty / inert
  bgSidebar: '#0B0B11',

  gold: '#C9A84C',
  goldSoft: '#E8D5A3',
  goldLine: 'rgba(201, 168, 76, 0.15)',
  goldLine2: 'rgba(201, 168, 76, 0.28)',
  goldGlow: 'rgba(201, 168, 76, 0.45)',
  goldBg: 'rgba(201, 168, 76, 0.08)',
  goldBg2: 'rgba(201, 168, 76, 0.12)',

  text0: '#F5F5F0',     // primary text
  text1: '#B8B8C2',
  text2: '#8A8A9A',
  text3: '#5A5A6A',

  success: '#2ECC8A',
  warning: '#F0A500',
  danger: '#E84545',

  line: 'rgba(255, 255, 255, 0.06)',
  line2: 'rgba(255, 255, 255, 0.1)',
} as const;

export const Typography = {
  serif: 'PlayfairDisplay-SemiBold',      // Playfair Display 600
  serifItalic: 'PlayfairDisplay-Italic',
  sans: 'Inter-Regular',
  sansMedium: 'Inter-Medium',
  sansBold: 'Inter-Bold',
  mono: 'JetBrainsMono-Regular',
  monoMedium: 'JetBrainsMono-Medium',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  pill: 999,
  full: 9999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Badge variant config
export const BadgeVariants = {
  paid: {
    bg: 'rgba(46, 204, 138, 0.16)',
    text: '#2ECC8A',
  },
  pending: {
    bg: 'rgba(240, 165, 0, 0.16)',
    text: '#F0A500',
  },
  cancel: {
    bg: 'rgba(232, 69, 69, 0.18)',
    text: '#E84545',
  },
  new: {
    bg: 'rgba(201, 168, 76, 0.16)',
    text: '#C9A84C',
  },
  open: {
    bg: 'rgba(240, 165, 0, 0.16)',
    text: '#F0A500',
  },
} as const;
