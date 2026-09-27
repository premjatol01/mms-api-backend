const express = require('express');
const router = express.Router();
const qrTemplateController = require('../controllers/qrTemplate');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'qrcodes');
fs.mkdirSync(uploadDir, { recursive: true });

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'qr-template-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, webp, etc.)'));
    }
  }
});

// Multer error-handling wrapper
const uploadMiddleware = (req, res, next) => {
  upload.single('templateImage')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.get('/', qrTemplateController.getTemplates);
router.get('/:id', qrTemplateController.getTemplate);
router.post('/', uploadMiddleware, qrTemplateController.uploadTemplate);
router.put('/:id', qrTemplateController.updateTemplate);
router.delete('/:id', qrTemplateController.deleteTemplate);

module.exports = router;
