const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');
const Combo = require('../models/Combo');

// =======================
// Categories
// =======================

exports.getCategories = async (req, res) => {
  try {
    const categories = await MenuCategory.find({ restaurantId: req.user.restaurantId }).sort({ displayOrder: 1, createdAt: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching categories' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    const newCategory = await MenuCategory.create({
      restaurantId: req.user.restaurantId,
      name,
      description,
      status: status || 'active'
    });

    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error creating category' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await MenuCategory.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.user.restaurantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating category' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await MenuCategory.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    
    // Also remove category reference from associated items
    await MenuItem.updateMany({ categoryId: req.params.id }, { $unset: { categoryId: 1 } });
    
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error deleting category' });
  }
};

// =======================
// Menu Items
// =======================

exports.getItems = async (req, res) => {
  try {
    const items = await MenuItem.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching menu items' });
  }
};

exports.createItem = async (req, res) => {
  try {
    const { name, categoryId, price, description, status, isPopular } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const newItem = await MenuItem.create({
      restaurantId: req.user.restaurantId,
      name,
      categoryId: categoryId || undefined,
      price,
      description,
      status: status || 'available',
      isPopular: !!isPopular
    });

    // Update item count on category
    if (categoryId) {
      await MenuCategory.findByIdAndUpdate(categoryId, { $inc: { itemCount: 1 } });
    }

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error creating menu item' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const oldItem = await MenuItem.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!oldItem) return res.status(404).json({ success: false, message: 'Menu item not found' });

    const newItem = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.user.restaurantId },
      req.body,
      { new: true, runValidators: true }
    );

    // If category changed, update counts
    const oldCatId = oldItem.categoryId?.toString();
    const newCatId = req.body.categoryId?.toString();

    if (oldCatId !== newCatId) {
      if (oldCatId) await MenuCategory.findByIdAndUpdate(oldCatId, { $inc: { itemCount: -1 } });
      if (newCatId) await MenuCategory.findByIdAndUpdate(newCatId, { $inc: { itemCount: 1 } });
    }

    res.json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating menu item' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });

    // Decrement category item count
    if (item.categoryId) {
      await MenuCategory.findByIdAndUpdate(item.categoryId, { $inc: { itemCount: -1 } });
    }

    // Remove item from any combos
    await Combo.updateMany(
      { restaurantId: req.user.restaurantId, itemIds: item._id },
      { $pull: { itemIds: item._id } }
    );

    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error deleting menu item' });
  }
};

// =======================
// Combos
// =======================

exports.getCombos = async (req, res) => {
  try {
    const combos = await Combo.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: -1 });
    res.json({ success: true, data: combos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching combos' });
  }
};

exports.createCombo = async (req, res) => {
  try {
    const { name, description, itemIds, price, status } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const newCombo = await Combo.create({
      restaurantId: req.user.restaurantId,
      name,
      description,
      itemIds: itemIds || [],
      price,
      status: status || 'available'
    });

    res.status(201).json({ success: true, data: newCombo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error creating combo' });
  }
};

exports.updateCombo = async (req, res) => {
  try {
    const combo = await Combo.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.user.restaurantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, data: combo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating combo' });
  }
};

exports.deleteCombo = async (req, res) => {
  try {
    const combo = await Combo.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error deleting combo' });
  }
};
