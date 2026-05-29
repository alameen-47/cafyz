// ─── Cloudinary unsigned image upload ─────────────────────────────────────────
// Uploads an image straight from the browser to Cloudinary using an unsigned
// upload preset, so no API secret ever reaches the client. Configure with:
//   VITE_CLOUDINARY_CLOUD_NAME      e.g. "cafyz"
//   VITE_CLOUDINARY_UPLOAD_PRESET   an unsigned preset created in the dashboard
//   VITE_CLOUDINARY_FOLDER          optional folder, e.g. "restaurant-logos"
//
// Cloudinary delivery URLs are served with `Access-Control-Allow-Origin: *`,
// so the returned URL also works with the canvas-based receipt logo renderer.

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
const FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER as string | undefined;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/** Uploads an image File to Cloudinary and resolves to its secure HTTPS URL. */
export async function uploadImage(file: File): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Image upload is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    );
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, SVG, or WebP).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is too large — please use a file under 5 MB.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET!);
  if (FOLDER) form.append('folder', FOLDER);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('Could not reach Cloudinary. Check your internet connection.');
  }

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch {
      /* ignore parse error */
    }
    throw new Error(`Upload failed: ${detail}`);
  }

  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error('Upload succeeded but no URL was returned.');
  return data.secure_url;
}
