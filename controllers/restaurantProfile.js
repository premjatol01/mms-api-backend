const path = require('path');
const fs = require('fs');
const Restaurant = require('../models/Restaurant');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default 7-day business hours structure returned for restaurants with none set */
const DEFAULT_BUSINESS_HOURS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
].map((day) => ({ day, isOpen: false, slots: [{ open: '10:00', close: '23:00' }] }));

/**
 * Delete a file from disk given its URL path (e.g. `/uploads/restaurants/abc.jpg`)
 * Silently ignores errors — missing file should never crash an API.
 */
const deleteFile = (urlPath) => {
  if (!urlPath) return;
  const abs = path.join(__dirname, '../public', urlPath);
  fs.unlink(abs, () => {}); // fire-and-forget
};

/**
 * Build the full public URL for an uploaded file path.
 * Returns null if no path is provided.
 */
const buildUrl = (req, filePath) => {
  if (!filePath) return null;
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}${filePath}`;
};

/**
 * Shape the raw Mongoose restaurant document into the profile response
 * the frontend expects.
 *
 * Key mapping: `detailedAddress` → `address`
 * The basic `address` field (set by super-admin during creation) is merged
 * as fallback so the restaurant always has something to show.
 */
const formatProfile = (restaurant, req) => {
  const r = restaurant.toObject();

  // Merge basic address as fallback into detailedAddress fields
  const address = {
    line1: r.detailedAddress?.line1 || '',
    line2: r.detailedAddress?.line2 || '',
    area: r.detailedAddress?.area || '',
    city: r.detailedAddress?.city || r.address?.city || '',
    state: r.detailedAddress?.state || r.address?.state || '',
    country: r.detailedAddress?.country || r.address?.country || 'India',
    pincode: r.detailedAddress?.pincode || r.address?.pincode || '',
    landmark: r.detailedAddress?.landmark || '',
  };

  // Ensure businessHours always has all 7 days
  const businessHours = r.businessHours?.length === 7
    ? r.businessHours
    : DEFAULT_BUSINESS_HOURS;

  return {
    _id: r._id,
    name: r.name,
    status: r.status,

    // Basic info
    tagline: r.tagline || '',
    shortDescription: r.shortDescription || '',
    fullDescription: r.fullDescription || '',
    restaurantType: r.restaurantType || '',
    cuisineTypes: r.cuisineTypes || [],
    establishmentYear: r.establishmentYear || '',

    // Branding
    logo: r.logo ? buildUrl(req, r.logo) : null,
    coverImage: r.coverImage ? buildUrl(req, r.coverImage) : null,

    // Contact
    contact: r.contact || {},

    // Address (unified from detailedAddress)
    address,

    // Business hours
    businessHours,

    // Social links
    socialLinks: r.socialLinks || {},

    // Other sections
    googleReviewLink: r.googleReviewLink || '',
    website: r.website || {},
    settings: r.settings || { isActive: false, acceptOrders: false, showOnPublicWebsite: false },

    // Read-only subscription info (for the Subscription tab)
    subscription: r.subscription || {},

    // Master Menu Selection
    masterMenuSelection: {
      categoryIds: r.masterMenuSelection?.categoryIds || [],
      itemIds: r.masterMenuSelection?.itemIds || [],
    },

    // Admin info (read-only, shown in header)
    admin: r.admin || {},

    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * @desc    Get the logged-in restaurant admin's profile
 * @route   GET /api/restaurant/profile
 * @access  Private (restaurant_admin)
 */
const getProfile = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }
    res.status(200).json({ success: true, data: formatProfile(restaurant, req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update restaurant profile (partial — any section)
 * @route   PUT /api/restaurant/profile
 * @access  Private (restaurant_admin)
 *
 * Accepts a JSON body with any subset of profile fields.
 * When the frontend sends `{ address: {...} }` we save to `detailedAddress`.
 * Nested objects are merged via dot-notation $set so other sub-fields aren't wiped.
 */
const updateProfile = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const body = { ...req.body };

    // Remap `address` → `detailedAddress` (frontend sends `address`)
    if (body.address) {
      body.detailedAddress = body.address;
      delete body.address;
    }

    // Fields the restaurant admin is NOT allowed to modify directly
    const PROTECTED = ['_id', 'admin', 'subscription', 'createdAt', 'updatedAt'];
    PROTECTED.forEach((f) => delete body[f]);

    // Build a flat $set object so nested objects are merged, not replaced.
    // E.g. { contact: { primaryPhone: '...' } } becomes { 'contact.primaryPhone': '...' }
    const $set = {};

    const flatten = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        // Arrays and primitives: set directly (don't flatten arrays)
        if (Array.isArray(value) || value === null || typeof value !== 'object') {
          $set[fullKey] = value;
        } else {
          flatten(value, fullKey);
        }
      });
    };

    flatten(body);

    const updated = await Restaurant.findByIdAndUpdate(
      req.user.restaurantId,
      { $set },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: formatProfile(updated, req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Upload / replace restaurant logo
 * @route   POST /api/restaurant/profile/logo
 * @access  Private (restaurant_admin)
 */
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Delete old logo from disk
    deleteFile(restaurant.logo);

    const logoPath = `/uploads/restaurants/${req.file.filename}`;
    restaurant.logo = logoPath;
    await restaurant.save();

    res.status(200).json({
      success: true,
      data: { logo: buildUrl(req, logoPath) },
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Remove restaurant logo
 * @route   DELETE /api/restaurant/profile/logo
 * @access  Private (restaurant_admin)
 */
const removeLogo = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    deleteFile(restaurant.logo);
    restaurant.logo = null;
    await restaurant.save();

    res.status(200).json({ success: true, message: 'Logo removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Upload / replace restaurant cover image
 * @route   POST /api/restaurant/profile/cover
 * @access  Private (restaurant_admin)
 */
const uploadCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Delete old cover from disk
    deleteFile(restaurant.coverImage);

    const coverPath = `/uploads/restaurants/${req.file.filename}`;
    restaurant.coverImage = coverPath;
    await restaurant.save();

    res.status(200).json({
      success: true,
      data: { coverImage: buildUrl(req, coverPath) },
      message: 'Cover image uploaded successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Remove restaurant cover image
 * @route   DELETE /api/restaurant/profile/cover
 * @access  Private (restaurant_admin)
 */
const removeCover = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    deleteFile(restaurant.coverImage);
    restaurant.coverImage = null;
    await restaurant.save();

    res.status(200).json({ success: true, message: 'Cover image removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const MasterCategory = require('../models/MasterCategory');
const MasterItem = require('../models/MasterItem');
const MenuCategory = require('../models/MenuCategory');
const MenuItem = require('../models/MenuItem');

const syncMasterMenuSelection = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { categoryIds = [], itemIds = [] } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    
    restaurant.masterMenuSelection = { categoryIds, itemIds };
    await restaurant.save();

    const masterCategories = await MasterCategory.find({ _id: { $in: categoryIds } });
    const masterItems = await MasterItem.find({ _id: { $in: itemIds } });

    const syncedCategoryIds = new Map();

    for (const mCat of masterCategories) {
      let localCat = await MenuCategory.findOne({ restaurantId, masterCategoryId: mCat._id });
      if (!localCat) {
        localCat = await MenuCategory.create({
          restaurantId,
          masterCategoryId: mCat._id,
          name: mCat.name,
          description: mCat.description,
          image: mCat.image
        });
      }
      syncedCategoryIds.set(mCat._id.toString(), localCat._id);
    }

    for (const mItem of masterItems) {
      const localCatId = syncedCategoryIds.get(mItem.categoryId?.toString());
      if (!localCatId) continue;

      let localItem = await MenuItem.findOne({ restaurantId, masterItemId: mItem._id });
      if (!localItem) {
        localItem = await MenuItem.create({
          restaurantId,
          categoryId: localCatId,
          masterItemId: mItem._id,
          name: mItem.name,
          description: '', 
          price: 0, 
          image: mItem.image,
          status: 'available'
        });
      }
    }

    res.status(200).json({ success: true, message: 'Menu selection synced successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo,
  removeLogo,
  uploadCover,
  removeCover,
  syncMasterMenuSelection,
};
