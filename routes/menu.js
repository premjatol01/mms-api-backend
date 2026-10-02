const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getCombos,
  createCombo,
  updateCombo,
  deleteCombo
} = require('../controllers/menu');

const { createUploader } = require('../middleware/upload');
const menuUploader = createUploader('menu');

// All menu routes require the user to be a restaurant admin
router.use(protect, roleGuard('restaurant_admin'));

// Upload Image
router.post('/upload-image', menuUploader.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/uploads/menu/${req.file.filename}`;
  res.json({ success: true, data: { url } });
});

// Categories
router.route('/categories')
  .get(getCategories)
  .post(createCategory);

router.route('/categories/:id')
  .put(updateCategory)
  .delete(deleteCategory);

// Items
router.route('/items')
  .get(getItems)
  .post(createItem);

router.route('/items/:id')
  .put(updateItem)
  .delete(deleteItem);

// Combos
router.route('/combos')
  .get(getCombos)
  .post(createCombo);

router.route('/combos/:id')
  .put(updateCombo)
  .delete(deleteCombo);

module.exports = router;
