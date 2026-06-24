import { menuApi } from './api';
import { prepareMenuImageFile } from '../utils/menuImage';

/** Upload menu item photo via API (Cloudinary when configured, data URL fallback on server). */
export async function uploadMenuItemImage(file: File): Promise<string> {
  const prepared = await prepareMenuImageFile(file);
  const { url } = await menuApi.uploadImage(prepared);
  if (!url?.trim()) throw new Error('Upload succeeded but no image URL was returned.');
  return url.trim();
}
