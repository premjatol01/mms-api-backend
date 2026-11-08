const Restaurant = require('../models/Restaurant');
const Package = require('../models/Package');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');

// @desc    Get all restaurants (with filters and pagination)
// @route   GET /api/restaurants
exports.getRestaurants = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      subscriptionStatus, 
      package: subPackage, 
      city, 
      dateFrom, 
      dateTo,
      page = 1,
      limit = 10 
    } = req.query;

    const query = {};

    // Filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'admin.name': { $regex: search, $options: 'i' } },
        { 'admin.email': { $regex: search, $options: 'i' } },
        { 'admin.phone': { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (subscriptionStatus) query['subscription.status'] = subscriptionStatus;
    if (subPackage) query['subscription.packageName'] = { $regex: new RegExp(`^${subPackage}$`, 'i') };
    if (city) query['address.city'] = { $regex: new RegExp(`^${city}$`, 'i') };
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await Restaurant.countDocuments(query);
    const restaurants = await Restaurant.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: restaurants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to clean mobile number: strictly 10 digits without country code (+91 / 91)
function sanitizeMobile(val) {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

// @desc    Create new restaurant
// @route   POST /api/restaurants
exports.createRestaurant = async (req, res) => {
  try {
    const data = { ...req.body };
    
    // Parse nested objects that might be stringified if using form-data
    if (typeof data.admin === 'string') data.admin = JSON.parse(data.admin);
    if (typeof data.address === 'string') data.address = JSON.parse(data.address);
    if (typeof data.subscription === 'string') data.subscription = JSON.parse(data.subscription);
    if (typeof data.contact === 'string') data.contact = JSON.parse(data.contact);

    // 1. Sanitize & Normalize Contact Information (strictly 10-digit phone, no country code)
    const cleanRestaurantPhone = sanitizeMobile(data.phone || data.contact?.primaryPhone);
    const cleanRestaurantEmail = (data.email || data.contact?.email || '').trim().toLowerCase();
    
    data.phone = cleanRestaurantPhone;
    data.email = cleanRestaurantEmail;

    // Handle website
    const rawWebsite = data.website || data.websiteUrl || '';
    if (typeof rawWebsite === 'string') {
      const cleanWeb = rawWebsite.trim();
      data.websiteUrl = cleanWeb;
      const subCandidate = cleanWeb
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split('.')[0]
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      data.website = {
        subdomain: subCandidate || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'restaurant'),
        status: 'published',
        url: cleanWeb
      };
    } else if (typeof data.website === 'object' && data.website !== null) {
      data.websiteUrl = data.website.url || data.websiteUrl || '';
    }

    if (data.description && !data.shortDescription) {
      data.shortDescription = data.description;
    } else if (data.shortDescription && !data.description) {
      data.description = data.shortDescription;
    }

    // Keep contact subdocument in sync
    if (!data.contact) data.contact = {};
    data.contact.primaryPhone = cleanRestaurantPhone;
    data.contact.email = cleanRestaurantEmail;

    // 2. Sanitize & Validate Restaurant Admin Information
    if (!data.admin || !data.admin.email) {
      return res.status(400).json({ success: false, message: 'Admin email is required' });
    }
    data.admin.name = (data.admin.name || '').trim();
    data.admin.email = data.admin.email.trim().toLowerCase();
    data.admin.phone = sanitizeMobile(data.admin.phone);

    if (!data.admin.name) {
      return res.status(400).json({ success: false, message: 'Admin name is required' });
    }

    if (!data.admin.phone || data.admin.phone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit admin mobile number without country code' });
    }

    // 3. Subscription package resolution
    if (data.subscription && (data.subscription.package || data.subscription.packageName)) {
      const pName = data.subscription.packageName || data.subscription.package;
      const pkgDoc = await Package.findOne({ name: new RegExp('^' + pName + '\$', 'i') });
      if (pkgDoc) {
        data.subscription.packageId = pkgDoc._id;
        data.subscription.packageName = pkgDoc.name;
      }
    }
    
    // 4. Validate Admin Email Uniqueness & Generate Temp Password
    let tempHashedPassword;
    const existingUser = await User.findOne({ email: data.admin.email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Admin email already exists' });
    }

    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const salt = await bcrypt.genSalt(10);
    tempHashedPassword = await bcrypt.hash(tempPassword, salt);

    if (req.file) {
      data.logo = `/uploads/restaurants/${req.file.filename}`;
    }

    // 5. Create the Restaurant
    const restaurant = await Restaurant.create(data);

    // 6. Create the corresponding User for Login (Starts inactive until invite accepted)
    await User.create({
      name: data.admin.name,
      email: data.admin.email,
      password: tempHashedPassword,
      phone: data.admin.phone,
      mobile: data.admin.phone,
      role: 'restaurant_admin',
      restaurantId: restaurant._id,
      status: 'inactive'
    });

    // 7. Create Subscription Record in Central Ledger if package assigned
    if (data.subscription && data.subscription.packageId) {
      const Subscription = require('../models/Subscription');
      const pkg = await Package.findById(data.subscription.packageId);
      const days = Number(data.subscription.durationDays || data.subscription.duration || 30);
      const start = data.subscription.startDate ? new Date(data.subscription.startDate) : new Date();
      const end = data.subscription.endDate ? new Date(data.subscription.endDate) : new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
      
      await Subscription.create({
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        adminName: restaurant.admin?.name || '',
        adminEmail: restaurant.admin?.email || '',
        packageId: data.subscription.packageId,
        packageName: data.subscription.packageName || pkg?.name || 'Basic',
        duration: days,
        durationDisplay: data.subscription.durationDisplay || `${days} Days`,
        startDate: start,
        endDate: end,
        price: data.subscription.price || pkg?.price || 0,
        status: data.subscription.status || 'active',
        features: pkg?.features || []
      });
    }

    res.status(201).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
exports.updateRestaurant = async (req, res) => {
  try {
    const data = { ...req.body };
    
    if (typeof data.admin === 'string') data.admin = JSON.parse(data.admin);
    if (typeof data.address === 'string') data.address = JSON.parse(data.address);
    if (typeof data.subscription === 'string') data.subscription = JSON.parse(data.subscription);
    if (typeof data.contact === 'string') data.contact = JSON.parse(data.contact);

    const existingRestaurant = await Restaurant.findById(req.params.id);
    if (!existingRestaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    // 1. Sanitize & Normalize Contact Information
    if (data.phone !== undefined || data.contact?.primaryPhone !== undefined) {
      const cleanPhone = sanitizeMobile(data.phone !== undefined ? data.phone : data.contact?.primaryPhone);
      data.phone = cleanPhone;
      if (!data.contact) data.contact = existingRestaurant.contact ? (existingRestaurant.contact.toObject?.() || existingRestaurant.contact) : {};
      data.contact.primaryPhone = cleanPhone;
    }

    if (data.email !== undefined || data.contact?.email !== undefined) {
      const cleanEmail = (data.email !== undefined ? data.email : data.contact?.email || '').trim().toLowerCase();
      data.email = cleanEmail;
      if (!data.contact) data.contact = existingRestaurant.contact ? (existingRestaurant.contact.toObject?.() || existingRestaurant.contact) : {};
      data.contact.email = cleanEmail;
    }

    if (data.website !== undefined || data.websiteUrl !== undefined) {
      const rawWebsite = data.website !== undefined ? data.website : data.websiteUrl;
      if (typeof rawWebsite === 'string') {
        const cleanWeb = rawWebsite.trim();
        data.websiteUrl = cleanWeb;
        data.website = {
          subdomain: existingRestaurant.website?.subdomain || cleanWeb.replace(/^https?:\/\//i, '').split('/')[0].split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '') || 'restaurant',
          status: existingRestaurant.website?.status || 'published',
          url: cleanWeb
        };
      } else if (typeof data.website === 'object' && data.website !== null) {
        data.websiteUrl = data.website.url || data.websiteUrl || existingRestaurant.websiteUrl;
      }
    }

    // 2. Sanitize & Sync Admin Information
    if (data.admin) {
      data.admin.name = (data.admin.name || existingRestaurant.admin?.name || '').trim();
      data.admin.email = (data.admin.email || existingRestaurant.admin?.email || '').trim().toLowerCase();
      data.admin.phone = sanitizeMobile(data.admin.phone || existingRestaurant.admin?.phone);

      // Check if email changed and is taken by another user
      if (data.admin.email && data.admin.email !== existingRestaurant.admin?.email) {
        const emailTaken = await User.findOne({ email: data.admin.email, restaurantId: { $ne: existingRestaurant._id } });
        if (emailTaken) {
          return res.status(400).json({ success: false, message: 'Admin email already in use by another user' });
        }
      }

      // Sync with User login model
      await User.findOneAndUpdate(
        { restaurantId: existingRestaurant._id, role: 'restaurant_admin' },
        {
          $set: {
            name: data.admin.name,
            email: data.admin.email,
            phone: data.admin.phone,
            mobile: data.admin.phone
          }
        }
      );
    }

    // 3. Package resolution
    if (data.subscription && (data.subscription.package || data.subscription.packageName)) {
      const pName = data.subscription.packageName || data.subscription.package;
      const pkgDoc = await Package.findOne({ name: new RegExp('^' + pName + '\$', 'i') });
      if (pkgDoc) {
        data.subscription.packageId = pkgDoc._id;
        data.subscription.packageName = pkgDoc.name;
      }
    }
    
    if (req.file) {
      data.logo = `/uploads/restaurants/${req.file.filename}`;
    }

    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk update status
// @route   PATCH /api/restaurants/bulk/status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    await Restaurant.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    await User.updateMany(
      { restaurantId: { $in: ids }, role: 'restaurant_admin' },
      { $set: { status } }
    );
    
    res.status(200).json({ success: true, message: `Updated ${ids.length} restaurants to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle single restaurant status
// @route   PATCH /api/restaurants/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    
    restaurant.status = restaurant.status === 'active' ? 'inactive' : 'active';
    await restaurant.save();

    await User.updateMany(
      { restaurantId: restaurant._id, role: 'restaurant_admin' },
      { $set: { status: restaurant.status } }
    );
    
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Send invitation email to restaurant admin
// @route   POST /api/restaurants/:id/send-invite
exports.sendInvite = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const user = await User.findOne({ email: restaurant.admin.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    // 1. Generate an activation token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d'
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const activationLink = `${frontendUrl}/setup-password?token=${token}&email=${user.email}`;

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333;">Welcome to Tablly!</h2>
        <p>Hi ${user.name},</p>
        <p>Your restaurant <strong>${restaurant.name}</strong> has been successfully created on the Tablly platform.</p>
        <p>Please click the button below to activate your account and set your secure password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Activate Account</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #0070f3;">${activationLink}</p>
        <p>Welcome aboard!</p>
        <p>The Tablly Team</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Tablly - Activate Your Account',
        html: emailHTML,
      });

      res.status(200).json({ 
        success: true, 
        message: 'Invitation email sent successfully'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({ success: false, message: 'Email could not be sent. Please check SMTP settings.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get public restaurant portfolio by subdomain or ID
// @route   GET /api/restaurants/portfolio/:subdomain
// @access  Public
exports.getRestaurantPortfolio = async (req, res) => {
  try {
    const { subdomain } = req.params;
    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Subdomain is required' });
    }

    const cleanSubdomain = subdomain.trim().toLowerCase();
    const mongoose = require('mongoose');

    // 1. Find by website.subdomain (case-insensitive)
    let restaurant = await Restaurant.findOne({
      'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
    }).select('-admin.password');

    // 2. Fallback: If not found and param is a valid MongoDB ObjectId
    if (!restaurant && mongoose.isValidObjectId(cleanSubdomain)) {
      restaurant = await Restaurant.findById(cleanSubdomain).select('-admin.password');
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: `Restaurant '${subdomain}' not found`
      });
    }

    // Check if website is published
    const WebsiteConfig = require('../models/WebsiteConfig');
    const websiteConfig = await WebsiteConfig.findOne({ restaurantId: restaurant._id });

    const isRestaurantPublished = restaurant.website?.status === 'published';
    const isConfigPublished = websiteConfig?.websiteStatus === 'published';

    const hasSubdomain = Boolean(
      (restaurant.website?.subdomain && restaurant.website.subdomain.trim()) ||
      (websiteConfig?.restaurantSlug && websiteConfig.restaurantSlug.trim())
    );

    const isPublished = hasSubdomain && (isRestaurantPublished || isConfigPublished) &&
      restaurant.website?.status !== 'draft' &&
      websiteConfig?.websiteStatus !== 'draft';

    if (!isPublished) {
      return res.status(404).json({
        success: false,
        isUnpublished: true,
        message: `Website for '${subdomain}' is currently unpublished`
      });
    }

    const restaurantData = restaurant.toObject ? restaurant.toObject() : { ...restaurant };
    const rawColors = websiteConfig?.websiteColors?.toObject ? websiteConfig.websiteColors.toObject() : websiteConfig?.websiteColors;
    restaurantData.websiteColors = {
      primary: '#f29191',
      secondary: '#b1e5e6',
      background: '#ffffff',
      text: '#1f2937',
      ...(rawColors || {})
    };
    if (websiteConfig) {
      restaurantData.websiteConfig = websiteConfig;
    }

    const WebsiteSection = require('../models/WebsiteSection');
    let sections = await WebsiteSection.find({ restaurantId: restaurant._id, enabled: true }).sort({ order: 1 });

    // Check if footer is present in enabled sections
    let footerSec = sections.find((s) => s.sectionId === 'footer' || s.type === 'footer');
    if (!footerSec) {
      // Check if footer exists in DB and was explicitly disabled
      const dbFooter = await WebsiteSection.findOne({ restaurantId: restaurant._id, sectionId: 'footer' });
      if (!dbFooter) {
        // Not yet created in DB, provide default enabled footer
        footerSec = {
          sectionId: 'footer',
          type: 'footer',
          title: 'Footer',
          enabled: true,
          order: 8,
          content: {
            title: restaurant.name || '',
            subtitle: restaurant.tagline || 'Authentic Indian Flavors',
            description: restaurant.shortDescription || restaurant.description || '',
            socialLinks: {
              instagram: restaurant.socialLinks?.instagram || '',
              facebook: restaurant.socialLinks?.facebook || '',
              twitter: restaurant.socialLinks?.twitter || '',
              youtube: restaurant.socialLinks?.youtube || '',
              linkedin: restaurant.socialLinks?.linkedin || '',
              whatsapp: restaurant.socialLinks?.whatsapp || restaurant.contact?.whatsapp || ''
            },
            sectionLinks: [
              { id: 'hero', label: 'Home', href: '#hero', enabled: true },
              { id: 'about', label: 'About Us', href: '#about', enabled: true },
              { id: 'menu', label: 'Menu', href: '#menu', enabled: true },
              { id: 'offers', label: 'Offers', href: '#offers', enabled: true },
              { id: 'gallery', label: 'Gallery', href: '#gallery', enabled: true },
              { id: 'map', label: 'Location', href: '#map', enabled: true },
              { id: 'inquiry', label: 'Contact', href: '#inquiry', enabled: true }
            ]
          }
        };
        sections = [...sections, footerSec];
      }
    }

    // Check if reviews is present in enabled sections
    let reviewsSec = sections.find((s) => s.sectionId === 'reviews' || s.type === 'reviews');
    if (!reviewsSec) {
      // Check if reviews exists in DB and was explicitly disabled
      const dbReviews = await WebsiteSection.findOne({ restaurantId: restaurant._id, sectionId: 'reviews' });
      if (!dbReviews) {
        reviewsSec = {
          sectionId: 'reviews',
          type: 'reviews',
          title: 'Customer Reviews',
          enabled: true,
          order: 6,
          content: {
            title: 'Customer Reviews',
            description: 'What our guests say about their dining experience'
          }
        };
        sections = [...sections, reviewsSec];
        sections.sort((a, b) => a.order - b.order);
      }
    }

    restaurantData.sections = sections || [];
    restaurantData.footer = footerSec?.content || null;

    // If 'menu' section is enabled, populate popular categories and top 10 items per category
    const menuSec = sections.find((s) => s.sectionId === 'menu' || s.type === 'menu');
    if (menuSec) {
      const MenuCategory = require('../models/MenuCategory');
      const MenuItem = require('../models/MenuItem');
      const content = menuSec.content || {};

      let topCategoryIds = [];
      if (Array.isArray(content.categoryIds) && content.categoryIds.length > 0) {
        topCategoryIds = content.categoryIds.slice(0, 5);
      } else if (Array.isArray(content.categoryConfigs) && content.categoryConfigs.length > 0) {
        topCategoryIds = content.categoryConfigs.map((c) => c.categoryId).filter(Boolean).slice(0, 5);
      }

      let categories = [];
      if (topCategoryIds.length > 0) {
        const fetchedCats = await MenuCategory.find({
          _id: { $in: topCategoryIds },
          restaurantId: restaurant._id,
          status: 'active'
        });
        categories = topCategoryIds
          .map((id) => fetchedCats.find((c) => c._id.toString() === id.toString()))
          .filter(Boolean);
      }

      // If no categories configured in section, fallback to categories marked isTopCategory: true
      if (categories.length === 0) {
        categories = await MenuCategory.find({
          restaurantId: restaurant._id,
          status: 'active',
          isTopCategory: true
        }).sort({ displayOrder: 1, createdAt: 1 }).limit(5);
      }

      // If still none, fallback to first 5 active categories
      if (categories.length === 0) {
        categories = await MenuCategory.find({
          restaurantId: restaurant._id,
          status: 'active'
        }).sort({ displayOrder: 1, createdAt: 1 }).limit(5);
      }

      const categoryItemMap = content.categoryItemMap || {};
      const categoryConfigs = content.categoryConfigs || [];
      const popularCategories = [];
      const allCategoryItems = [];

      for (const cat of categories) {
        const catIdStr = cat._id.toString();
        let configuredItemIds = categoryItemMap[catIdStr] ||
          categoryConfigs.find((c) => c.categoryId?.toString() === catIdStr)?.itemIds || [];

        let items = [];
        if (Array.isArray(configuredItemIds) && configuredItemIds.length > 0) {
          const configuredItems = await MenuItem.find({
            _id: { $in: configuredItemIds.slice(0, 10) },
            restaurantId: restaurant._id,
            status: 'available'
          });
          items = configuredItemIds
            .slice(0, 10)
            .map((id) => configuredItems.find((i) => i._id.toString() === id.toString()))
            .filter(Boolean);
        }

        // If no configured items or empty list, fetch top items in this category (prioritize popular/bestseller)
        if (items.length === 0) {
          items = await MenuItem.find({
            restaurantId: restaurant._id,
            categoryId: cat._id,
            status: 'available'
          }).sort({ isPopular: -1, isBestseller: -1, createdAt: 1 }).limit(10);
        }

        popularCategories.push({
          _id: cat._id,
          id: cat._id,
          name: cat.name,
          description: cat.description || '',
          image: cat.image || '',
          items: items
        });

        items.forEach((item) => allCategoryItems.push(item));
      }

      restaurantData.popularCategories = popularCategories;

      if (allCategoryItems.length > 0) {
        restaurantData.popularItems = allCategoryItems;
      } else {
        restaurantData.popularItems = await MenuItem.find({
          restaurantId: restaurant._id,
          status: 'available'
        }).sort({ isPopular: -1, isBestseller: -1 }).limit(8);
      }
    }

    // If 'offers' section is enabled, populate active offers
    const offersSec = sections.find((s) => s.sectionId === 'offers' || s.type === 'offers');
    if (offersSec) {
      const Offer = require('../models/Offer');
      const now = new Date();
      const activeOffers = await Offer.find({
        restaurantId: restaurant._id,
        status: 'active',
        $or: [
          { 'validity.endDate': { $exists: false } },
          { 'validity.endDate': null },
          { 'validity.endDate': { $gte: now } }
        ]
      }).sort({ createdAt: -1 }).limit(6);
      restaurantData.activeOffers = activeOffers;
    }

    // If 'reviews' section is enabled, populate public customer reviews and aggregate rating stats
    if (reviewsSec) {
      const CustomerReview = require('../models/CustomerReview');
      const reviews = await CustomerReview.find({
        restaurantId: restaurant._id,
        status: { $ne: 'rejected' }
      })
        .sort({ submittedAt: -1 })
        .limit(20);

      const allStats = await CustomerReview.aggregate([
        { $match: { restaurantId: restaurant._id, status: { $ne: 'rejected' } } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      restaurantData.reviews = reviews.map((r) => ({
        id: r._id.toString(),
        _id: r._id.toString(),
        name: r.customerName || (r.customerMobile ? `User ${r.customerMobile.slice(-4)}` : 'Guest'),
        rating: r.rating,
        comment: r.comment || '',
        status: r.status,
        tableName: r.tableName || '',
        createdAt: r.submittedAt ? r.submittedAt.toISOString() : (r.createdAt ? r.createdAt.toISOString() : new Date().toISOString())
      }));

      restaurantData.reviewStats = {
        averageRating: allStats[0]?.averageRating ? Number(allStats[0].averageRating.toFixed(1)) : 0,
        totalReviews: allStats[0]?.totalReviews || 0
      };
    }

    res.status(200).json({
      success: true,
      data: restaurantData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify restaurant subdomain and tableId for public ordering portal
// @route   GET /api/restaurants/verify-table/:subdomain/:tableId
// @access  Public
exports.verifyTableSession = async (req, res) => {
  try {
    const { subdomain, tableId } = req.params;

    if (!subdomain || !subdomain.trim()) {
      return res.status(400).json({
        success: false,
        errorType: 'MISSING_SUBDOMAIN',
        message: 'Subdomain is required.'
      });
    }

    if (!tableId || !tableId.trim()) {
      return res.status(400).json({
        success: false,
        errorType: 'MISSING_TABLE_ID',
        message: 'Table ID is required.'
      });
    }

    const cleanSubdomain = decodeURIComponent(subdomain).trim().toLowerCase();
    const cleanTableId = decodeURIComponent(tableId).trim();
    const mongoose = require('mongoose');

    // 1. Verify Restaurant by subdomain (or ObjectId fallback)
    let restaurant = await Restaurant.findOne({
      'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
    }).select('-admin.password');

    if (!restaurant && mongoose.isValidObjectId(cleanSubdomain)) {
      restaurant = await Restaurant.findById(cleanSubdomain).select('-admin.password');
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        errorType: 'RESTAURANT_NOT_FOUND',
        message: `Restaurant '${subdomain}' not found. Please verify the URL or scan a valid table QR code.`
      });
    }

    // 2. Check if restaurant is active
    if (restaurant.status && restaurant.status !== 'active') {
      return res.status(403).json({
        success: false,
        errorType: 'RESTAURANT_INACTIVE',
        message: `Restaurant '${restaurant.name}' is currently inactive and not accepting orders.`
      });
    }

    // 3. Find Table for this specific restaurant
    const Table = require('../models/Table');
    let table = await Table.findOne({
      restaurantId: restaurant._id,
      $or: [
        ...(mongoose.isValidObjectId(cleanTableId) ? [{ _id: cleanTableId }] : []),
        { tableNo: cleanTableId },
        { tableNo: { $regex: new RegExp(`^${cleanTableId}$`, 'i') } },
        { tableId: cleanTableId }
      ]
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        errorType: 'TABLE_NOT_FOUND',
        message: `Table '${cleanTableId}' was not found for ${restaurant.name}. Please scan the QR code located on your table.`
      });
    }

    // 4. Check Table status
    if (table.status && table.status !== 'active') {
      return res.status(403).json({
        success: false,
        errorType: 'TABLE_INACTIVE',
        message: `Table ${table.tableNo || table.tableId} is currently inactive and not accepting orders. Please speak with a restaurant staff member.`
      });
    }

    // 5. Find active session for this table
    const Session = require('../models/Session');
    const Order = require('../models/Order');
    const Customer = require('../models/Customer');

    const activeSession = await Session.findOne({
      restaurantId: restaurant._id,
      tableId: table._id,
      status: 'active'
    });

    let sessionOrders = [];
    if (activeSession) {
      if (activeSession.customerMobile) {
        const cleanMobile = String(activeSession.customerMobile).replace(/\D/g, '').slice(-10);
        if (cleanMobile.length === 10) {
          const customer = await Customer.findOne({ restaurantId: restaurant._id, mobile: cleanMobile });
          if (customer) {
            const sessionFavs = new Set((activeSession.favorites || []).map(String));
            const customerFavs = new Set((customer.favorites || []).map(String));
            const merged = Array.from(new Set([...sessionFavs, ...customerFavs]));
            const currSession = activeSession.favorites || [];
            if (merged.length !== currSession.length || !merged.every((id, idx) => currSession[idx] === id)) {
              activeSession.favorites = merged;
              await activeSession.save();
            }
            const currCust = customer.favorites || [];
            if (merged.length !== currCust.length || !merged.every((id, idx) => currCust[idx] === id)) {
              customer.favorites = merged;
              await customer.save();
            }
          }
        }
      }
      sessionOrders = await Order.find({ sessionId: activeSession._id }).sort({ createdAt: 1 });
    }

    // Return verified data
    return res.status(200).json({
      success: true,
      data: {
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          logo: restaurant.logo,
          coverImage: restaurant.coverImage,
          subdomain: restaurant.website?.subdomain,
          status: restaurant.status,
          currency: '₹'
        },
        table: {
          id: table._id,
          _id: table._id,
          tableId: table._id.toString(),
          tableNo: table.tableNo || table.tableId,
          tableName: table.tableNo || table.tableId || (table.number ? `Table ${table.number}` : "Table"),
          name: table.tableNo || table.tableId || (table.number ? `Table ${table.number}` : "Table"),
          status: table.status
        },
        session: activeSession ? {
          _id: activeSession._id,
          sessionNumber: activeSession.sessionNumber,
          status: activeSession.status,
          paymentStatus: activeSession.paymentStatus,
          subtotal: activeSession.subtotal,
          discount: activeSession.discount,
          gst: activeSession.gst ?? Math.round((activeSession.subtotal || 0) * 0.05),
          total: activeSession.total,
          customerMobile: activeSession.customerMobile,
          customerName: activeSession.customerName || null,
          customerId: activeSession.customerId || null,
          appliedOffer: activeSession.appliedOffer || (sessionOrders.find((o) => o.appliedOffer)?.appliedOffer) || null,
          favorites: activeSession.favorites || [],
          startedAt: activeSession.startedAt
        } : null,
        orders: sessionOrders
      }
    });
  } catch (error) {
    console.error('Error verifying table session:', error);
    return res.status(500).json({
      success: false,
      errorType: 'SERVER_ERROR',
      message: 'Failed to verify table session. Please try again.'
    });
  }
};
