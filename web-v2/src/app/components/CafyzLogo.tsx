import { CAFYZ_LOGO_SRC } from '../../config/brand';

export type CafyzLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'login' | 'loginMobile' | 'sidebar';

interface CafyzLogoProps {
  /** @deprecated Both variants use `logo.png`; size presets differ only. */
  variant?: 'full' | 'mark';
  size?: CafyzLogoSize;
  className?: string;
  style?: React.CSSProperties;
}

/** `logo.png` — mobile widths are 90% of `sm:` and up. */
const LOGO_SIZE: Record<CafyzLogoSize, string> = {
  xs: 'w-[3.6rem] max-h-[3.6rem] sm:w-16 sm:max-h-16',
  sm: 'w-[5.4rem] max-h-[5.4rem] sm:w-24 sm:max-h-24',
  md: 'w-[6.3rem] max-h-[6.3rem] sm:w-28 sm:max-h-28',
  lg: 'w-[8.1rem] max-h-[8.1rem] sm:w-36 sm:max-h-36',
  xl: 'w-[9.9rem] max-h-[9.9rem] sm:w-44 sm:max-h-44',
  hero: 'w-[min(100%,18rem)] sm:w-[min(100%,20rem)]',
  login: 'w-[min(100%,19.8rem)] sm:w-[min(100%,25rem)]',
  /** Expanded app sidebar on large screens */
  sidebar: 'w-[min(100%,11rem)] max-h-[3.5rem] lg:w-[min(100%,13rem)] lg:max-h-16',
  /** Small screens: fits within the 30% viewport logo band */
  loginMobile: 'w-[min(30vw,30dvh)] max-w-[min(30vw,30dvh)] max-h-[min(24dvh,30vw)] h-auto',
};

export function CafyzLogo({
  size = 'md',
  className = '',
  style,
}: CafyzLogoProps) {
  return (
    <img
      src={CAFYZ_LOGO_SRC}
      alt="Cafyz — Restaurant Management Solutions"
      className={`object-contain select-none h-auto ${LOGO_SIZE[size]} ${className}`}
      style={style}
      draggable={false}
    />
  );
}
