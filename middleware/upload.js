const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_MIME = [
  ...ALLOWED_MIME,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const createUploader = (folder, options = {}) => {
  const { allowDocs = false } = options;
  const allowedMimeTypes = allowDocs ? ALLOWED_DOC_MIME : ALLOWED_MIME;
  const maxSize = allowDocs ? MAX_DOC_SIZE_BYTES : MAX_SIZE_BYTES;

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
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const msg = allowDocs 
        ? 'Only images, PDF, and Word documents are allowed'
        : 'Only JPG, JPEG, PNG, and WebP images are allowed';
      cb(new Error(msg), false);
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: maxSize } });
};

const restaurantUploader = createUploader('restaurants');

module.exports = { restaurantUploader, createUploader };
