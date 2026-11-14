const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isCloudinaryConfigured, getCloudinaryStorage } = require('../config/cloudinary');

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_MIME = [
  ...ALLOWED_MIME,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB for images
const MAX_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB for documents

/**
 * Universal helper to resolve uploaded file URL:
 * - If Cloudinary is used, file.path is the secure HTTPS URL (https://res.cloudinary.com/...)
 * - Otherwise falls back to local static URL (/uploads/{folder}/{filename})
 */
const getFileUrl = (file, folder = 'general') => {
  if (!file) return null;
  if (file.path && (file.path.startsWith('http://') || file.path.startsWith('https://'))) {
    return file.path;
  }
  return `/uploads/${folder}/${file.filename}`;
};

const createUploader = (folder, options = {}) => {
  const { allowDocs = false } = options;
  const allowedMimeTypes = allowDocs ? ALLOWED_DOC_MIME : ALLOWED_MIME;
  const maxSize = allowDocs ? MAX_DOC_SIZE_BYTES : MAX_SIZE_BYTES;

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

  let storage;
  if (isCloudinaryConfigured()) {
    storage = getCloudinaryStorage(folder);
  } else {
    // Local disk fallback
    storage = multer.diskStorage({
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
  }

  const uploader = multer({ storage, fileFilter, limits: { fileSize: maxSize } });

  // Wrap methods so req.file always has `req.file.fileUrl`
  return {
    single: (fieldName) => (req, res, next) => {
      uploader.single(fieldName)(req, res, (err) => {
        if (err) return next(err);
        if (req.file) {
          req.file.fileUrl = getFileUrl(req.file, folder);
        }
        next();
      });
    },
    array: (fieldName, maxCount) => (req, res, next) => {
      uploader.array(fieldName, maxCount)(req, res, (err) => {
        if (err) return next(err);
        if (Array.isArray(req.files)) {
          req.files.forEach((f) => {
            f.fileUrl = getFileUrl(f, folder);
          });
        }
        next();
      });
    },
    fields: (fieldsConfig) => (req, res, next) => {
      uploader.fields(fieldsConfig)(req, res, (err) => {
        if (err) return next(err);
        if (req.files) {
          Object.keys(req.files).forEach((key) => {
            req.files[key].forEach((f) => {
              f.fileUrl = getFileUrl(f, folder);
            });
          });
        }
        next();
      });
    }
  };
};

const restaurantUploader = createUploader('restaurants');
const proofUploader = createUploader('subscription-proofs');
const paymentQrUploader = createUploader('payment-qr');

module.exports = {
  restaurantUploader,
  proofUploader,
  paymentQrUploader,
  createUploader,
  getFileUrl
};
