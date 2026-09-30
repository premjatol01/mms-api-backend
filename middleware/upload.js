const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Allowed image MIME types
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Creates a multer instance that saves to `public/uploads/<folder>/`
 * @param {string} folder - subfolder inside public/uploads (e.g. 'restaurants')
 */
const createUploader = (folder) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, `../public/uploads/${folder}`);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WebP images are allowed'), false);
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });
};

// Pre-built uploader for restaurant images (logo, cover)
const restaurantUploader = createUploader('restaurants');

module.exports = { restaurantUploader, createUploader };
