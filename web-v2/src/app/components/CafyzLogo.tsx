import { CAFYZ_LOGO_SRC } from '../../config/brand';

export type CafyzLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'login' | 'loginMobile' | 'sidebar';

interface CafyzLogoProps {
  /** @deprecated Both variants use `logo.png`; size presets differ only. */
  variant?: 'full' | 'mark';
  size?: CafyzLogoSize;
  /**
   * `auto` follows the light/dark theme. `onDark` is for surfaces that stay dark in both
   * themes (the login hero panel), so the logo keeps its dark-mode glow there.
   */
  tone?: 'auto' | 'onDark';
  /** Layout classes for the logo box (flex-shrink, margins, animation). */
  className?: string;
  style?: React.CSSProperties;
}

/** Box size per preset — mobile widths are 90% of `sm:` and up. The logo art is square. */
const LOGO_SIZE: Record<CafyzLogoSize, string> = {
  xs: 'w-[3.6rem] max-h-[3.6rem] sm:w-16 sm:max-h-16',
  sm: 'w-[5.4rem] max-h-[5.4rem] sm:w-24 sm:max-h-24',
  md: 'w-[6.3rem] max-h-[6.3rem] sm:w-28 sm:max-h-28',
  lg: 'w-[8.1rem] max-h-[8.1rem] sm:w-36 sm:max-h-36',
  xl: 'w-[9.9rem] max-h-[9.9rem] sm:w-44 sm:max-h-44',
  hero: 'w-[min(100%,18rem)] sm:w-[min(100%,20rem)]',
  login: 'w-[min(100%,19.8rem)] sm:w-[min(100%,25rem)]',
  /** Expanded app sidebar on large screens */
  sidebar: 'w-[min(100%,12rem)] max-h-20 lg:w-[min(100%,13rem)] lg:max-h-[5.5rem]',
  /** Fills the 30% mobile login logo band (the image itself is sized in CSS) */
  loginMobile: 'login-screen-logo-img w-auto h-auto max-w-full',
};

/**
 * The logo is silver and blue metal on a transparent canvas. A slowly morphing amoeba glow
 * (`.cafyz-logo-glow`, theme-modes.css) sits behind it so the silver reads in both themes.
 */
export function CafyzLogo({
  size = 'md',
  tone = 'auto',
  className = '',
  style,
}: CafyzLogoProps) {
  // The mobile login band sizes the <img> from CSS; every other preset sizes the box.
  const imageSized = size === 'loginMobile';
  return (
    <span
      className={`cafyz-logo${tone === 'onDark' ? ' cafyz-logo--on-dark' : ''} relative flex items-center justify-center select-none ${imageSized ? '' : `aspect-square ${LOGO_SIZE[size]}`} ${className}`}
      style={style}
    >
      <span aria-hidden="true" className="cafyz-logo-glow" />
      <img
        src={CAFYZ_LOGO_SRC}
        alt="Cafyz — Restaurant Management Solutions"
        className={`relative object-contain ${imageSized ? LOGO_SIZE[size] : 'w-full h-full'}`}
        draggable={false}
      />
    </span>
  );
}
