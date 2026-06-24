export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function validateMenuImageFile(file: File): string | null {
  // Android WebView sometimes returns an empty MIME type for gallery files — fall back to extension.
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  const ok  = file.type ? ALLOWED_TYPES.has(file.type) : ALLOWED_EXTS.has(ext);
  if (!ok) return 'Please choose a JPEG, PNG, WebP, or GIF image.';
  if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.';
  return null;
}
