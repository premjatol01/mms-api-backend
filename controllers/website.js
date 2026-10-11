const mongoose = require('mongoose');
const WebsiteConfig = require('../models/WebsiteConfig');
const WebsiteSection = require('../models/WebsiteSection');
const Inquiry = require('../models/Inquiry');
const Restaurant = require('../models/Restaurant');

// Standard 7 default sections in fixed order (Reordering is disabled)
const DEFAULT_SECTIONS = [
  {
    sectionId: 'hero',
    type: 'hero',
    title: 'Hero Section',
    description: 'Main introduction with headline and image',
    enabled: true,
    order: 1,
    content: {
      heading: 'Welcome to Our Restaurant',
      description: 'Experience delicious food made with fresh ingredients. Join us for an unforgettable culinary journey.',
      buttonText: 'View Menu',
      buttonAction: 'menu',
      imageUrl: ''
    }
  },
  {
    sectionId: 'about',
    type: 'about',
    title: 'About Restaurant',
    description: 'Restaurant introduction with photo',
    enabled: true,
    order: 2,
    content: {
      title: 'About Our Kitchen',
      description: 'We are dedicated to serving authentic recipes with a modern twist. Our chefs use only the freshest ingredients to create memorable dining experiences.',
      imageUrl: ''
    }
  },
  {
    sectionId: 'menu',
    type: 'menu',
    title: 'Popular Menu',
    description: 'Popular dishes from your Menu, with a full menu popup',
    enabled: true,
    order: 3,
    content: {
      title: 'Popular Menu',
      description: 'Our most loved dishes, picked by our guests',
      showViewAll: true,
      viewAllLabel: 'View All Menu',
      colors: {
        background: '#ffffff',
        accent: '#2a7c13'
      }
    }
  },
  {
    sectionId: 'offers',
    type: 'offers',
    title: 'Special Offers',
    description: 'Current restaurant offers',
    enabled: true,
    order: 4,
    content: {
      title: 'Special Offers',
      description: 'Check out our latest deals and promotions'
    }
  },
  {
    sectionId: 'gallery',
    type: 'gallery',
    title: 'Gallery',
    description: 'Photos of your food and restaurant',
    enabled: true,
    order: 5,
    content: {
      title: 'Gallery',
      description: 'A glimpse of our food and ambience',
      images: []
    }
  },
  {
    sectionId: 'map',
    type: 'map',
    title: 'Map & Location',
    description: 'Google Maps and restaurant address',
    enabled: true,
    order: 6,
    content: {
      title: 'Find Us',
      description: 'Visit us for lunch or dinner. We would love to see you.',
      mapSource: 'location',
      embedUrl: '',
      zoom: 15,
      showDirections: true,
      location: {
        addressLine: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        latitude: '',
        longitude: ''
      }
    }
  },
  {
    sectionId: 'inquiry',
    type: 'inquiry',
    title: 'Contact / Inquiry',
    description: 'Customer inquiry form',
    enabled: true,
    order: 7,
    content: {
      title: 'Contact Us',
      description: 'Have a question? Send us an inquiry.',
      fields: {
        name: { enabled: true, required: true },
        mobile: { enabled: true, required: true },
        email: { enabled: true, required: false },
        purpose: { enabled: true, required: false },
        message: { enabled: true, required: true }
      },
      purposeOptions: ['General Inquiry', 'Table Reservation', 'Private Event', 'Feedback']
    }
  }
];

/**
 * @desc    Get website config and all sections for the logged-in restaurant
 * @route   GET /api/restaurant/website/config
 * @access  Private (restaurant_admin)
 */
exports.getWebsiteConfig = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // 1. Find or initialize WebsiteConfig
    let config = await WebsiteConfig.findOne({ restaurantId });
    if (!config) {
      config = await WebsiteConfig.create({
        restaurantId,
        restaurantName: restaurant.name || '',
        restaurantSlug: restaurant.website?.subdomain || '',
        baseDomain: process.env.BASE_DOMAIN || 'localhost:3000',
        description: restaurant.shortDescription || restaurant.description || '',
        phone: restaurant.contact?.primaryPhone || restaurant.admin?.phone || '',
        email: restaurant.contact?.email || restaurant.admin?.email || '',
        address: restaurant.detailedAddress?.line1 || restaurant.address?.fullAddress || '',
        websiteStatus: restaurant.website?.status === 'published' ? 'published' : 'draft',
        websiteColors: {
          primary: '#2a7c13',
          secondary: '#76c457',
          background: '#ffffff',
          text: '#1f2937'
        }
      });
    }

    // 2. Find or initialize WebsiteSections
    let sections = await WebsiteSection.find({ restaurantId }).sort({ order: 1 });
    if (!sections || sections.length === 0) {
      const sectionsToCreate = DEFAULT_SECTIONS.map((s) => ({
        ...s,
        restaurantId,
        // pre-fill map location if restaurant address exists
        content: s.sectionId === 'map' ? {
          ...s.content,
          location: {
            ...s.content.location,
            addressLine: restaurant.detailedAddress?.line1 || restaurant.address?.fullAddress || '',
            city: restaurant.detailedAddress?.city || restaurant.address?.city || '',
            state: restaurant.detailedAddress?.state || restaurant.address?.state || '',
            pincode: restaurant.detailedAddress?.pincode || restaurant.address?.pincode || ''
          }
        } : s.content
      }));

      sections = await WebsiteSection.insertMany(sectionsToCreate);
    }

    // Normalize sections format so frontend receives `id` matching `sectionId`
    const formattedSections = sections.map((s) => ({
      id: s.sectionId,
      _id: s._id,
      type: s.type,
      title: s.title,
      description: s.description,
      enabled: s.enabled,
      order: s.order,
      content: s.content
    }));

    res.status(200).json({
      success: true,
      data: {
        config,
        sections: formattedSections
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update basic website information or colors
 * @route   PUT /api/restaurant/website/config
 * @access  Private (restaurant_admin)
 */
exports.updateWebsiteConfig = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { restaurantName, description, phone, email, address, websiteColors, restaurantSlug } = req.body;

    const updateFields = {};
    if (restaurantName !== undefined) updateFields.restaurantName = restaurantName;
    if (description !== undefined) updateFields.description = description;
    if (phone !== undefined) updateFields.phone = phone;
    if (email !== undefined) updateFields.email = email;
    if (address !== undefined) updateFields.address = address;
    if (websiteColors) updateFields.websiteColors = websiteColors;
    if (restaurantSlug !== undefined) updateFields.restaurantSlug = restaurantSlug;

    const config = await WebsiteConfig.findOneAndUpdate(
      { restaurantId },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    // Sync back to Restaurant model
    const restaurantUpdates = {};
    if (restaurantName) restaurantUpdates.name = restaurantName;
    if (description) restaurantUpdates.shortDescription = description;
    if (restaurantSlug) restaurantUpdates['website.subdomain'] = restaurantSlug;
    if (Object.keys(restaurantUpdates).length > 0) {
      await Restaurant.findByIdAndUpdate(restaurantId, { $set: restaurantUpdates });
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Publish website
 * @route   POST /api/restaurant/website/publish
 * @access  Private (restaurant_admin)
 */
exports.publishWebsite = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const config = await WebsiteConfig.findOneAndUpdate(
      { restaurantId },
      { $set: { websiteStatus: 'published', publishedAt: new Date() } },
      { new: true }
    );

    await Restaurant.findByIdAndUpdate(restaurantId, {
      $set: { 'website.status': 'published' }
    });

    res.status(200).json({
      success: true,
      message: 'Website published successfully',
      data: { websiteStatus: 'published' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Unpublish website
 * @route   POST /api/restaurant/website/unpublish
 * @access  Private (restaurant_admin)
 */
exports.unpublishWebsite = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const config = await WebsiteConfig.findOneAndUpdate(
      { restaurantId },
      { $set: { websiteStatus: 'draft' } },
      { new: true }
    );

    await Restaurant.findByIdAndUpdate(restaurantId, {
      $set: { 'website.status': 'draft' }
    });

    res.status(200).json({
      success: true,
      message: 'Website unpublished',
      data: { websiteStatus: 'draft' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all website sections
 * @route   GET /api/restaurant/website/sections
 * @access  Private (restaurant_admin)
 */
exports.getSections = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const sections = await WebsiteSection.find({ restaurantId }).sort({ order: 1 });

    const formatted = sections.map((s) => ({
      id: s.sectionId,
      _id: s._id,
      type: s.type,
      title: s.title,
      description: s.description,
      enabled: s.enabled,
      order: s.order,
      content: s.content
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update specific section content
 * @route   PUT /api/restaurant/website/sections/:sectionId
 * @access  Private (restaurant_admin)
 */
exports.updateSection = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { sectionId } = req.params;
    const { content, title, description, enabled } = req.body;

    const updateFields = {};
    if (content !== undefined) updateFields.content = content;
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (enabled !== undefined) updateFields.enabled = enabled;

    const section = await WebsiteSection.findOneAndUpdate(
      { restaurantId, sectionId },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      data: {
        id: section.sectionId,
        _id: section._id,
        type: section.type,
        title: section.title,
        description: section.description,
        enabled: section.enabled,
        order: section.order,
        content: section.content
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Toggle a section enabled / disabled
 * @route   PATCH /api/restaurant/website/sections/:sectionId/toggle
 * @access  Private (restaurant_admin)
 */
exports.toggleSection = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { sectionId } = req.params;

    const existing = await WebsiteSection.findOne({ restaurantId, sectionId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const newEnabled = req.body.enabled !== undefined ? req.body.enabled : !existing.enabled;
    existing.enabled = newEnabled;
    await existing.save();

    res.status(200).json({
      success: true,
      data: {
        id: existing.sectionId,
        enabled: existing.enabled
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get customer inquiries for restaurant
 * @route   GET /api/restaurant/website/inquiries
 * @access  Private (restaurant_admin)
 */
exports.getInquiries = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { search, status, purpose, page = 1, limit = 50 } = req.query;

    const query = { restaurantId };
    if (status) query.status = status;
    if (purpose) query.purpose = purpose;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Inquiry.countDocuments(query);
    const inquiries = await Inquiry.find(query)
      .sort({ submittedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Map `_id` to `id` for frontend convenience
    const formatted = inquiries.map((inq) => ({
      id: inq._id.toString(),
      _id: inq._id,
      name: inq.name,
      mobile: inq.mobile,
      email: inq.email,
      purpose: inq.purpose,
      message: inq.message,
      status: inq.status,
      submittedAt: inq.submittedAt
    }));

    res.status(200).json({
      success: true,
      data: formatted,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get inquiry stats (counts by status)
 * @route   GET /api/restaurant/website/inquiries/stats
 * @access  Private (restaurant_admin)
 */
exports.getInquiryStats = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const [total, newCount, inProgress, resolved] = await Promise.all([
      Inquiry.countDocuments({ restaurantId }),
      Inquiry.countDocuments({ restaurantId, status: 'new' }),
      Inquiry.countDocuments({ restaurantId, status: 'in_progress' }),
      Inquiry.countDocuments({ restaurantId, status: 'resolved' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        new: newCount,
        inProgress,
        resolved
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update inquiry status
 * @route   PATCH /api/restaurant/website/inquiries/:id/status
 * @access  Private (restaurant_admin)
 */
exports.updateInquiryStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const inquiry = await Inquiry.findOneAndUpdate(
      { _id: id, restaurantId },
      { $set: { status } },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: inquiry._id.toString(),
        status: inquiry.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Submit inquiry from public website
 * @route   POST /api/restaurant/website/public/inquiry/:subdomain
 * @access  Public
 */
exports.submitPublicInquiry = async (req, res) => {
  try {
    const { subdomain } = req.params;
    const { name, mobile, email, purpose, message } = req.body;

    if (!name || !mobile || !message) {
      return res.status(400).json({ success: false, message: 'Name, mobile, and message are required' });
    }

    // Find restaurant by subdomain
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const restaurant = await Restaurant.findOne({
      'website.subdomain': { $regex: new RegExp(`^${cleanSubdomain}$`, 'i') }
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const inquiry = await Inquiry.create({
      restaurantId: restaurant._id,
      name,
      mobile,
      email,
      purpose,
      message,
      status: 'new'
    });

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully',
      data: inquiry
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
