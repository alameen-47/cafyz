import { menuImageThumb } from '../utils/menuImage';
import './MenuItemImage.css';

interface MenuItemImageProps {
  imageUrl?: string | null;
  name: string;
  variant?: 'menu-card' | 'pos-plate' | 'mobile';
  className?: string;
}

export function MenuItemImage({
  imageUrl,
  name,
  variant = 'menu-card',
  className = '',
}: MenuItemImageProps) {
  const thumb = menuImageThumb(imageUrl ?? undefined, variant === 'pos-plate' ? 320 : 400);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt={name}
        className={`menu-item-image menu-item-image--${variant} ${className}`.trim()}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={`menu-item-image-fallback menu-item-image--${variant} ${className}`.trim()}
      aria-hidden
    >
      ○
    </span>
  );
}
