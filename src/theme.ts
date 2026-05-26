// Cafyz — Design tokens
// Fonts: requires react-native-font-files or manual linking of:
//   Playfair Display (serif headings)
//   Inter (body/UI)
//   JetBrains Mono (monospace IDs/timers)

export const Colors = {
  bg0: '#030d1a',       // deep navy background
  bg1: '#0a1628',       // card surface
  bg2: '#07111f',       // input surface
  bg3: '#0f1d38',       // empty / inert
  bgSidebar: '#040c17',

  gold: '#60a5fa',
  goldSoft: '#93c5fd',
  goldLine: 'rgba(96, 165, 250, 0.16)',
  goldLine2: 'rgba(96, 165, 250, 0.30)',
  goldGlow: 'rgba(96, 165, 250, 0.45)',
  goldBg: 'rgba(96, 165, 250, 0.08)',
  goldBg2: 'rgba(96, 165, 250, 0.12)',

  text0: '#eef4ff',     // primary text — blue-tinted white
  text1: '#b0c8e8',
  text2: '#6b8aab',
  text3: '#384e6b',

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
    bg: 'rgba(59, 130, 246, 0.16)',
    text: '#3b82f6',
  },
  open: {
    bg: 'rgba(240, 165, 0, 0.16)',
    text: '#F0A500',
  },
} as const;
