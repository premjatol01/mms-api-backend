const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/master-menu');
    // create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getItems,
  createItem,
  updateItem,
  deleteItem
} = require('../controllers/masterMenu');

// Middleware for authentication could be added here if needed
// const { protect, authorize } = require('../middleware/auth');
// router.use(protect);
// router.use(authorize('super_admin'));

router.route('/categories')
  .get(getCategories)
  .post(createCategory);

router.route('/categories/:id')
  .put(updateCategory)
  .delete(deleteCategory);

router.route('/items')
  .get(getItems)
  .post(upload.single('image'), createItem);

router.route('/items/:id')
  .put(upload.single('image'), updateItem)
  .delete(deleteItem);

module.exports = router;
