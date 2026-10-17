const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');
const Combo = require('../models/Combo');
const Offer = require('../models/Offer');

// =======================
// Categories
// =======================

exports.getCategories = async (req, res) => {
  try {
    const categories = await MenuCategory.find({ restaurantId: req.user.restaurantId })
      .sort({ isTopCategory: -1, displayOrder: 1, createdAt: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching categories' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, status, image, isTopCategory, displayOrder } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    if (isTopCategory) {
      const topCount = await MenuCategory.countDocuments({
        restaurantId: req.user.restaurantId,
        isTopCategory: true
      });
      if (topCount >= 5) {
        return res.status(400).json({
          success: false,
          message: 'You can only select up to 5 top categories. Please deselect one first.'
        });
      }
    }

    const newCategory = await MenuCategory.create({
      restaurantId: req.user.restaurantId,
      name,
      description,
      image: image || undefined,
      status: status || 'active',
      isTopCategory: !!isTopCategory,
      displayOrder: displayOrder || 0
    });

    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error creating category' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    if (req.body.isTopCategory === true) {
      const topCount = await MenuCategory.countDocuments({
        restaurantId: req.user.restaurantId,
        isTopCategory: true,
        _id: { $ne: req.params.id }
      });
      if (topCount >= 5) {
        return res.status(400).json({
          success: false,
          message: 'You can only select up to 5 top categories. Please deselect one first.'
        });
      }
    }

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

exports.setTopCategories = async (req, res) => {
  try {
    const { categoryIds } = req.body;
    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ success: false, message: 'categoryIds array is required' });
    }
    if (categoryIds.length > 5) {
      return res.status(400).json({ success: false, message: 'Maximum 5 top categories allowed' });
    }

    // Reset all categories for this restaurant
    await MenuCategory.updateMany(
      { restaurantId: req.user.restaurantId },
      { $set: { isTopCategory: false } }
    );

    // Set isTopCategory = true for the chosen categories and preserve their selection order
    for (let i = 0; i < categoryIds.length; i++) {
      await MenuCategory.updateOne(
        { restaurantId: req.user.restaurantId, _id: categoryIds[i] },
        { $set: { isTopCategory: true, displayOrder: i + 1 } }
      );
    }

    const updatedCategories = await MenuCategory.find({
      restaurantId: req.user.restaurantId
    }).sort({ isTopCategory: -1, displayOrder: 1, createdAt: 1 });

    res.json({ success: true, data: updatedCategories });
  } catch (error) {
    console.error('Error setting top categories:', error);
    res.status(500).json({ success: false, message: 'Server error setting top categories' });
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
    const {
      name,
      categoryId,
      price,
      mrp,
      description,
      status,
      isPopular,
      isBestseller,
      image,
      foodType,
      dietaryFlags
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const newItem = await MenuItem.create({
      restaurantId: req.user.restaurantId,
      name,
      categoryId: categoryId || undefined,
      price: Number(price) || 0,
      mrp: mrp ? Number(mrp) : undefined,
      description,
      status: status || 'available',
      isPopular: !!isPopular,
      isBestseller: !!isBestseller,
      image: image || undefined,
      foodType: foodType || undefined,
      dietaryFlags: dietaryFlags || []
    });

    // Update item count on category
    if (categoryId) {
      await MenuCategory.findByIdAndUpdate(categoryId, { $inc: { itemCount: 1 } });
    }

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating menu item' });
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
    const { name, description, itemIds, price, mrp, status, image, isPopular, badge } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const newCombo = await Combo.create({
      restaurantId: req.user.restaurantId,
      name,
      description,
      itemIds: itemIds || [],
      price: Number(price) || 0,
      mrp: mrp ? Number(mrp) : undefined,
      image: image || undefined,
      badge: badge || undefined,
      status: status || 'available',
      isPopular: !!isPopular
    });

    res.status(201).json({ success: true, data: newCombo });
  } catch (error) {
    console.error('Error creating combo:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error creating combo' });
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

// =======================
// Public Menu (Customer Order Portal)
// =======================
exports.getPublicMenu = async (req, res) => {
  try {
    const { subdomain } = req.params;
    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain is required' });
    }

    const cleanSubdomain = decodeURIComponent(subdomain).trim().toLowerCase();
    const mongoose = require('mongoose');
    const Restaurant = require('../models/Restaurant');

    let restaurant = await Restaurant.findOne({
      'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
    }).select('_id name status');

    if (!restaurant && mongoose.isValidObjectId(cleanSubdomain)) {
      restaurant = await Restaurant.findById(cleanSubdomain).select('_id name status');
    }

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (restaurant.status && restaurant.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Restaurant is currently inactive' });
    }

    // 1. Fetch only ACTIVE categories
    const categories = await MenuCategory.find({
      restaurantId: restaurant._id,
      status: 'active'
    }).sort({ isTopCategory: -1, displayOrder: 1, createdAt: 1 });

    const activeCatIds = categories.map((c) => c._id);

    // 2. Fetch only AVAILABLE items that belong to active categories (or items without category)
    const items = await MenuItem.find({
      restaurantId: restaurant._id,
      status: 'available',
      $or: [
        { categoryId: { $in: activeCatIds } },
        { categoryId: null },
        { categoryId: { $exists: false } }
      ]
    }).sort({ createdAt: -1 });

    // 3. Fetch only AVAILABLE combos
    const combos = await Combo.find({
      restaurantId: restaurant._id,
      status: 'available'
    }).populate('itemIds', 'name price image foodType').sort({ createdAt: -1 });

    // 4. Fetch ACTIVE date-valid offers
    const now = new Date();
    const rawOffers = await Offer.find({
      restaurantId: restaurant._id,
      status: 'active'
    }).sort({ createdAt: -1 });

    const offers = rawOffers.filter((o) => {
      if (o.validity?.endDate) {
        const end = new Date(o.validity.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      if (o.validity?.startDate) {
        const start = new Date(o.validity.startDate);
        start.setHours(0, 0, 0, 0);
        if (start > now) return false;
      }
      return true;
    });

    return res.status(200).json({
      success: true,
      data: {
        categories,
        items,
        combos,
        offers
      }
    });
  } catch (error) {
    console.error('Error fetching public menu:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
