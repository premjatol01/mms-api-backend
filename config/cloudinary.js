const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'wpki4zhy',
  api_key: process.env.CLOUDINARY_API_KEY || '226772317422256',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Returns true if Cloudinary credentials are fully provided and active.
 */
const isCloudinaryConfigured = () => {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  return Boolean(
    name &&
    key &&
    secret &&
    !secret.includes('PASTE_') &&
    !secret.includes('<your_api_secret>')
  );
};

/**
 * Returns a Multer Cloudinary storage engine configured for a specific folder.
 */
function getCloudinaryStorage(folder) {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const cleanName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
      return {
        folder: `tablly/${folder}`,
        public_id: `${cleanName}-${uniqueSuffix}`,
        resource_type: 'auto',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      };
    }
  });
}

/**
 * Direct upload helper: Upload a local file path or Buffer directly to Cloudinary.
 * Used for generated QR code buffers, automated seeding, etc.
 */
async function uploadToCloudinary(fileInput, options = {}) {
  if (!isCloudinaryConfigured()) return null;

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `tablly/${options.folder || 'general'}`,
      public_id: options.public_id,
      resource_type: options.resource_type || 'auto',
      ...options
    };

    if (Buffer.isBuffer(fileInput)) {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url);
      });
      stream.end(fileInput);
    } else {
      cloudinary.uploader.upload(fileInput, uploadOptions)
        .then(result => resolve(result.secure_url))
        .catch(reject);
    }
  });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  getCloudinaryStorage,
  uploadToCloudinary
};
