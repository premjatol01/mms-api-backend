const MasterCategory = require('../models/MasterCategory');
const MasterItem = require('../models/MasterItem');

// -- Categories --

// @desc    Get all master categories
// @route   GET /api/master-menu/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await MasterCategory.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a master category
// @route   POST /api/master-menu/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const category = await MasterCategory.create({ name, description });
    res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a master category
// @route   PUT /api/master-menu/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const category = await MasterCategory.findByIdAndUpdate(
      req.params.id,
      { name, description, status },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.status(200).json({ success: true, data: category, message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a master category
// @route   DELETE /api/master-menu/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const category = await MasterCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    
    // Also delete associated items
    await MasterItem.deleteMany({ categoryId: req.params.id });

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// -- Items --

// @desc    Get all master items
// @route   GET /api/master-menu/items
exports.getItems = async (req, res) => {
  try {
    const items = await MasterItem.find().populate('categoryId', 'name').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a master item
// @route   POST /api/master-menu/items
exports.createItem = async (req, res) => {
  try {
    const { categoryId, name } = req.body;
    let image = req.body.image; // fallback to body if passing URL
    
    if (req.file) {
      // Store the relative path to be served statically
      image = `/uploads/master-menu/${req.file.filename}`;
    }

    if (!categoryId || !name) return res.status(400).json({ success: false, message: 'Category and Name are required' });

    const item = await MasterItem.create({ categoryId, name, image });
    const populatedItem = await MasterItem.findById(item._id).populate('categoryId', 'name');

    res.status(201).json({ success: true, data: populatedItem, message: 'Item created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a master item
// @route   PUT /api/master-menu/items/:id
exports.updateItem = async (req, res) => {
  try {
    const { categoryId, name, status } = req.body;
    let image = req.body.image;

    if (req.file) {
      image = `/uploads/master-menu/${req.file.filename}`;
    }

    const item = await MasterItem.findByIdAndUpdate(
      req.params.id,
      { categoryId, name, image, status },
      { new: true, runValidators: true }
    ).populate('categoryId', 'name');

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.status(200).json({ success: true, data: item, message: 'Item updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a master item
// @route   DELETE /api/master-menu/items/:id
exports.deleteItem = async (req, res) => {
  try {
    const item = await MasterItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
