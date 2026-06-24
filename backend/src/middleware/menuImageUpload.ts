import multer from 'multer';

const ALLOWED = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/heic-sequence',
  'application/octet-stream', // some mobile pickers omit MIME
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);

export const menuImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = '.' + (file.originalname.split('.').pop() ?? '').toLowerCase();
    const ok = ALLOWED.has(file.mimetype) || ALLOWED_EXT.has(ext);
    if (!ok) {
      cb(new Error('Only JPEG, PNG, WebP, GIF, or HEIC images are allowed.'));
      return;
    }
    cb(null, true);
  },
});
