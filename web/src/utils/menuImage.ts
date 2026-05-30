/** Cloudinary thumbnail transform for menu/POS grids. */
export function menuImageThumb(url: string | null | undefined, size = 400): string | undefined {
  if (!url?.trim()) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_fill,g_auto,w_${size},h_${size},q_auto:good,f_auto/`);
}

export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

export function validateMenuImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose a JPEG, PNG, WebP, or GIF image.';
  if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.';
  return null;
}
