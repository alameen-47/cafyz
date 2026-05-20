// Cafyz — Design tokens
// Fonts: requires react-native-font-files or manual linking of:
//   Playfair Display (serif headings)
//   Inter (body/UI)
//   JetBrains Mono (monospace IDs/timers)

export const Colors = {
  bg0: '#07060F',       // deep space background
  bg1: '#0E0B1C',       // card surface
  bg2: '#0A0816',       // input surface
  bg3: '#17122A',       // empty / inert
  bgSidebar: '#060410',

  gold: '#8B5CF6',
  goldSoft: '#C4B5FD',
  goldLine: 'rgba(139, 92, 246, 0.15)',
  goldLine2: 'rgba(139, 92, 246, 0.28)',
  goldGlow: 'rgba(139, 92, 246, 0.45)',
  goldBg: 'rgba(139, 92, 246, 0.08)',
  goldBg2: 'rgba(139, 92, 246, 0.12)',

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
    bg: 'rgba(139, 92, 246, 0.16)',
    text: '#8B5CF6',
  },
  open: {
    bg: 'rgba(240, 165, 0, 0.16)',
    text: '#F0A500',
  },
} as const;
