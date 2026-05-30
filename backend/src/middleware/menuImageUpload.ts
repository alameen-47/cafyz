import multer from 'multer';

const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export const menuImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'));
      return;
    }
    cb(null, true);
  },
});
