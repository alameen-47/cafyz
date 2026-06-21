export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

export function validateMenuImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose a JPEG, PNG, WebP, or GIF image.';
  if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.';
  return null;
}
