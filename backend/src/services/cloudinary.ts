import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function ensureCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

const MENU_FOLDER = process.env.CLOUDINARY_MENU_FOLDER ?? 'cafyz/menu';

export interface CloudinaryUploadResult {
  url: string;
  public_id: string;
}

export async function uploadMenuItemImage(
  buffer: Buffer,
  restaurantId: string,
): Promise<CloudinaryUploadResult> {
  ensureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${MENU_FOLDER}/${restaurantId}`,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
        ],
      },
      (err, result) => {
        if (err || !result?.secure_url || !result.public_id) {
          reject(err ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/** Best-effort cleanup when replacing or removing a menu item image. */
export async function deleteMenuItemImage(publicIdOrUrl: string | null | undefined): Promise<void> {
  if (!publicIdOrUrl || !isCloudinaryConfigured()) return;
  ensureCloudinary();

  let publicId = publicIdOrUrl;
  if (publicId.startsWith('http')) {
    const marker = '/upload/';
    const idx = publicId.indexOf(marker);
    if (idx === -1) return;
    publicId = publicId.slice(idx + marker.length).replace(/^v\d+\//, '');
    publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, '');
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // Non-fatal — item save should still succeed
  }
}

/** Thumbnail transform for POS / menu grid (client can also CSS-scale full URL). */
export function menuImageThumb(url: string, size = 400): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_fill,g_auto,w_${size},h_${size},q_auto:good,f_auto/`);
}
