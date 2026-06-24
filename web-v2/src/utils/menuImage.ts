export const MENU_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/*',
]);
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);

export const MENU_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function validateMenuImageFile(file: File): string | null {
  // Android/iOS gallery files often have empty MIME — fall back to extension.
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  const ok  = (file.type && file.type !== 'application/octet-stream')
    ? (ALLOWED_TYPES.has(file.type) || file.type.startsWith('image/'))
    : ALLOWED_EXTS.has(ext);
  if (!ok) return 'Please choose a JPEG, PNG, WebP, GIF, or HEIC image.';
  if (file.size > MENU_IMAGE_MAX_BYTES) return 'Image must be 8 MB or smaller.';
  return null;
}

/** Resize/compress to JPEG for faster upload and broader server support (best-effort). */
export async function prepareMenuImageFile(file: File): Promise<File> {
  const validation = validateMenuImageFile(file);
  if (validation) throw new Error(validation);

  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  const isHeic = file.type.includes('heic') || file.type.includes('heif') || ext === '.heic' || ext === '.heif';
  if (isHeic) return file; // let Cloudinary / server handle HEIC natively

  if (file.size < 400_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const max = 1200;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'menu-item';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
