const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const WebsiteConfig = require('../models/WebsiteConfig');
const WebsiteSection = require('../models/WebsiteSection');
const Inquiry = require('../models/Inquiry');
const Restaurant = require('../models/Restaurant');

/**
 * Saves a base64 data URL to the public/uploads/website directory and returns the relative path.
 * If the input is not a base64 data URL, it returns the input unchanged.
 */
const saveBase64Image = (dataUrl, restaurantId) => {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    return dataUrl;
  }
  let ext = matches[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (ext === 'svg+xml') ext = 'svg';
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  const uploadDir = path.join(__dirname, '../public/uploads/website');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `${restaurantId || 'web'}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/website/${filename}`;
};

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
      categoryIds: [],
      categoryItemMap: {},
      categoryConfigs: [],
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
    sectionId: 'reviews',
    type: 'reviews',
    title: 'Customer Reviews',
    description: 'Guest ratings and feedback reviews',
    enabled: true,
    order: 6,
    content: {
      title: 'Customer Reviews',
      description: 'What our guests say about their dining experience'
    }
  },
  {
    sectionId: 'map',
    type: 'map',
    title: 'Map & Location',
    description: 'Google Maps and restaurant address',
    enabled: true,
    order: 7,
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
    order: 8,
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
  },
  {
    sectionId: 'footer',
    type: 'footer',
    title: 'Footer',
    description: 'Footer info, section links, and social media',
    enabled: true,
    order: 9,
    content: {
      title: 'Restaurant Name',
      subtitle: 'Authentic Indian Flavors',
      description: 'Serving delicious food crafted with passion and fresh ingredients.',
      socialLinks: {
        instagram: '',
        facebook: '',
        twitter: '',
        youtube: '',
        linkedin: '',
        whatsapp: ''
      },
      sectionLinks: [
        { id: 'hero', label: 'Home', href: '#hero', enabled: true },
        { id: 'about', label: 'About Us', href: '#about', enabled: true },
        { id: 'menu', label: 'Menu', href: '#menu', enabled: true },
        { id: 'offers', label: 'Offers', href: '#offers', enabled: true },
        { id: 'gallery', label: 'Gallery', href: '#gallery', enabled: true },
        { id: 'reviews', label: 'Reviews', href: '#reviews', enabled: true },
        { id: 'map', label: 'Location', href: '#map', enabled: true },
        { id: 'inquiry', label: 'Contact', href: '#inquiry', enabled: true }
      ]
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
    } else {
      // Sync restaurantSlug and website.subdomain if there's any discrepancy
      let configDirty = false;
      const rSubdomain = restaurant.website?.subdomain || '';
      const cSlug = config.restaurantSlug || '';

      if (rSubdomain && cSlug !== rSubdomain) {
        config.restaurantSlug = rSubdomain;
        configDirty = true;
      } else if (cSlug && !rSubdomain) {
        restaurant.website = restaurant.website || {};
        restaurant.website.subdomain = cSlug;
        await restaurant.save();
      }

      // Also ensure websiteStatus is in sync
      if (restaurant.website?.status && config.websiteStatus !== restaurant.website.status) {
        config.websiteStatus = restaurant.website.status === 'published' ? 'published' : 'draft';
        configDirty = true;
      }

      if (configDirty) {
        await config.save();
      }
    }

    // 2. Find or initialize WebsiteSections
    let sections = await WebsiteSection.find({ restaurantId }).sort({ order: 1 });
    if (!sections || sections.length === 0) {
      const sectionsToCreate = DEFAULT_SECTIONS.map((s) => ({
        ...s,
        restaurantId,
        content: s.sectionId === 'footer' ? {
          ...s.content,
          title: restaurant.name || s.content.title,
          subtitle: restaurant.tagline || s.content.subtitle || '',
          description: restaurant.shortDescription || restaurant.description || s.content.description,
          socialLinks: {
            ...s.content.socialLinks,
            instagram: restaurant.socialLinks?.instagram || '',
            facebook: restaurant.socialLinks?.facebook || '',
            twitter: restaurant.socialLinks?.twitter || '',
            youtube: restaurant.socialLinks?.youtube || '',
            linkedin: restaurant.socialLinks?.linkedin || '',
            whatsapp: restaurant.socialLinks?.whatsapp || restaurant.contact?.whatsapp || ''
          }
        } : s.sectionId === 'map' ? {
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
    } else {
      const hasFooter = sections.some((s) => s.sectionId === 'footer');
      if (!hasFooter) {
        const defaultFooter = DEFAULT_SECTIONS.find((s) => s.sectionId === 'footer');
        if (defaultFooter) {
          const footerDoc = await WebsiteSection.create({
            ...defaultFooter,
            restaurantId,
            content: {
              ...defaultFooter.content,
              title: restaurant.name || defaultFooter.content.title,
              subtitle: restaurant.tagline || defaultFooter.content.subtitle || '',
              description: restaurant.shortDescription || restaurant.description || defaultFooter.content.description,
              socialLinks: {
                ...defaultFooter.content.socialLinks,
                instagram: restaurant.socialLinks?.instagram || '',
                facebook: restaurant.socialLinks?.facebook || '',
                twitter: restaurant.socialLinks?.twitter || '',
                youtube: restaurant.socialLinks?.youtube || '',
                linkedin: restaurant.socialLinks?.linkedin || '',
                whatsapp: restaurant.socialLinks?.whatsapp || restaurant.contact?.whatsapp || ''
              }
            }
          });
          sections.push(footerDoc);
          sections.sort((a, b) => a.order - b.order);
        }
      }

      const hasReviews = sections.some((s) => s.sectionId === 'reviews');
      if (!hasReviews) {
        const defaultReviews = DEFAULT_SECTIONS.find((s) => s.sectionId === 'reviews');
        if (defaultReviews) {
          const reviewsDoc = await WebsiteSection.create({
            ...defaultReviews,
            restaurantId
          });
          sections.push(reviewsDoc);
          sections.sort((a, b) => a.order - b.order);
        }
      }
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

    const configData = config.toObject ? config.toObject() : { ...config };
    if (!configData.restaurantSlug && restaurant.website?.subdomain) {
      configData.restaurantSlug = restaurant.website.subdomain;
    }

    res.status(200).json({
      success: true,
      data: {
        config: configData,
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
    if (restaurantSlug !== undefined) restaurantUpdates['website.subdomain'] = restaurantSlug;
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
    let sections = await WebsiteSection.find({ restaurantId }).sort({ order: 1 });

    const hasFooter = sections.some((s) => s.sectionId === 'footer');
    if (!hasFooter && sections.length > 0) {
      const restaurant = await Restaurant.findById(restaurantId);
      const defaultFooter = DEFAULT_SECTIONS.find((s) => s.sectionId === 'footer');
      if (defaultFooter) {
        const footerDoc = await WebsiteSection.create({
          ...defaultFooter,
          restaurantId,
          content: {
            ...defaultFooter.content,
            title: restaurant?.name || defaultFooter.content.title,
            subtitle: restaurant?.tagline || defaultFooter.content.subtitle || '',
            description: restaurant?.shortDescription || restaurant?.description || defaultFooter.content.description,
            socialLinks: {
              ...defaultFooter.content.socialLinks,
              instagram: restaurant?.socialLinks?.instagram || '',
              facebook: restaurant?.socialLinks?.facebook || '',
              twitter: restaurant?.socialLinks?.twitter || '',
              youtube: restaurant?.socialLinks?.youtube || '',
              linkedin: restaurant?.socialLinks?.linkedin || '',
              whatsapp: restaurant?.socialLinks?.whatsapp || restaurant?.contact?.whatsapp || ''
            }
          }
        });
        sections.push(footerDoc);
        sections.sort((a, b) => a.order - b.order);
      }
    }

    const hasReviews = sections.some((s) => s.sectionId === 'reviews');
    if (!hasReviews && sections.length > 0) {
      const defaultReviews = DEFAULT_SECTIONS.find((s) => s.sectionId === 'reviews');
      if (defaultReviews) {
        const reviewsDoc = await WebsiteSection.create({
          ...defaultReviews,
          restaurantId
        });
        sections.push(reviewsDoc);
        sections.sort((a, b) => a.order - b.order);
      }
    }

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
    let { content, title, description, enabled } = req.body;

    const updateFields = {};
    if (content !== undefined) {
      if (content && typeof content === 'object') {
        content = { ...content };
        // Process gallery images array if present
        if (Array.isArray(content.images)) {
          content.images = content.images.map((img) => {
            if (img && img.url && typeof img.url === 'string' && img.url.startsWith('data:image/')) {
              return {
                ...img,
                url: saveBase64Image(img.url, restaurantId)
              };
            }
            return img;
          });
        }
        // Process hero / about single imageUrl if present
        if (content.imageUrl && typeof content.imageUrl === 'string' && content.imageUrl.startsWith('data:image/')) {
          content.imageUrl = saveBase64Image(content.imageUrl, restaurantId);
        }
      }
      updateFields.content = content;
    }
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (enabled !== undefined) updateFields.enabled = enabled;

    const section = await WebsiteSection.findOneAndUpdate(
      { restaurantId, sectionId },
      { $set: updateFields },
      { new: true, upsert: true }
    );

    if (sectionId === 'footer' && content && typeof content === 'object') {
      const socialUpdates = {};
      if (content.subtitle) socialUpdates.tagline = content.subtitle;
      if (content.socialLinks) {
        if (content.socialLinks.instagram !== undefined) socialUpdates['socialLinks.instagram'] = content.socialLinks.instagram;
        if (content.socialLinks.facebook !== undefined) socialUpdates['socialLinks.facebook'] = content.socialLinks.facebook;
        if (content.socialLinks.twitter !== undefined) socialUpdates['socialLinks.twitter'] = content.socialLinks.twitter;
        if (content.socialLinks.youtube !== undefined) socialUpdates['socialLinks.youtube'] = content.socialLinks.youtube;
        if (content.socialLinks.whatsapp !== undefined) {
          socialUpdates['socialLinks.whatsapp'] = content.socialLinks.whatsapp;
          socialUpdates['contact.whatsapp'] = content.socialLinks.whatsapp;
        }
      }
      if (Object.keys(socialUpdates).length > 0) {
        await Restaurant.findByIdAndUpdate(restaurantId, { $set: socialUpdates });
      }
    }

    if (sectionId === 'menu' && content && typeof content === 'object') {
      if (Array.isArray(content.categoryIds) && content.categoryIds.length > 0) {
        const MenuCategory = require('../models/MenuCategory');
        const catIds = content.categoryIds.slice(0, 5);
        // Reset top categories for restaurant
        await MenuCategory.updateMany(
          { restaurantId },
          { $set: { isTopCategory: false } }
        );
        // Set isTopCategory for selected categories
        for (let i = 0; i < catIds.length; i++) {
          await MenuCategory.updateOne(
            { restaurantId, _id: catIds[i] },
            { $set: { isTopCategory: true, displayOrder: i + 1 } }
          );
        }
      }
    }

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

    if (restaurant.website?.status !== 'published') {
      return res.status(403).json({ success: false, message: 'Website is currently unpublished' });
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

/**
 * @desc    Get website footer configuration
 * @route   GET /api/restaurant/website/footer
 * @access  Private (restaurant_admin)
 */
exports.getFooterConfig = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    let footer = await WebsiteSection.findOne({ restaurantId, sectionId: 'footer' });
    if (!footer) {
      const defaultFooter = DEFAULT_SECTIONS.find((s) => s.sectionId === 'footer');
      footer = await WebsiteSection.create({
        ...defaultFooter,
        restaurantId,
        content: {
          ...defaultFooter.content,
          title: restaurant.name || defaultFooter.content.title,
          subtitle: restaurant.tagline || defaultFooter.content.subtitle || '',
          description: restaurant.shortDescription || restaurant.description || defaultFooter.content.description,
          socialLinks: {
            ...defaultFooter.content.socialLinks,
            instagram: restaurant.socialLinks?.instagram || '',
            facebook: restaurant.socialLinks?.facebook || '',
            twitter: restaurant.socialLinks?.twitter || '',
            youtube: restaurant.socialLinks?.youtube || '',
            linkedin: restaurant.socialLinks?.linkedin || '',
            whatsapp: restaurant.socialLinks?.whatsapp || restaurant.contact?.whatsapp || ''
          }
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: footer.sectionId,
        _id: footer._id,
        type: footer.type,
        title: footer.title,
        description: footer.description,
        enabled: footer.enabled,
        order: footer.order,
        content: footer.content
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update website footer configuration
 * @route   PUT /api/restaurant/website/footer
 * @access  Private (restaurant_admin)
 */
exports.updateFooterConfig = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { title, subtitle, description, socialLinks, sectionLinks, enabled, content } = req.body;

    let footer = await WebsiteSection.findOne({ restaurantId, sectionId: 'footer' });
    const defaultFooter = DEFAULT_SECTIONS.find((s) => s.sectionId === 'footer');

    const existingContent = footer?.content || defaultFooter.content;
    const newContent = {
      ...existingContent,
      ...(content || {}),
    };

    if (title !== undefined) newContent.title = title;
    if (subtitle !== undefined) newContent.subtitle = subtitle;
    if (description !== undefined) newContent.description = description;
    if (socialLinks !== undefined) newContent.socialLinks = { ...existingContent.socialLinks, ...socialLinks };
    if (sectionLinks !== undefined) newContent.sectionLinks = sectionLinks;

    const newEnabled = enabled !== undefined ? enabled : (footer ? footer.enabled : true);

    footer = await WebsiteSection.findOneAndUpdate(
      { restaurantId, sectionId: 'footer' },
      {
        $set: {
          type: 'footer',
          title: 'Footer',
          description: 'Footer info, section links, and social media',
          order: 8,
          enabled: newEnabled,
          content: newContent
        }
      },
      { new: true, upsert: true }
    );

    // Sync social links to Restaurant model if provided
    if (newContent.socialLinks) {
      const socialUpdates = {};
      if (newContent.socialLinks.instagram !== undefined) socialUpdates['socialLinks.instagram'] = newContent.socialLinks.instagram;
      if (newContent.socialLinks.facebook !== undefined) socialUpdates['socialLinks.facebook'] = newContent.socialLinks.facebook;
      if (newContent.socialLinks.twitter !== undefined) socialUpdates['socialLinks.twitter'] = newContent.socialLinks.twitter;
      if (newContent.socialLinks.youtube !== undefined) socialUpdates['socialLinks.youtube'] = newContent.socialLinks.youtube;
      if (newContent.socialLinks.whatsapp !== undefined) {
        socialUpdates['socialLinks.whatsapp'] = newContent.socialLinks.whatsapp;
        socialUpdates['contact.whatsapp'] = newContent.socialLinks.whatsapp;
      }
      if (Object.keys(socialUpdates).length > 0) {
        await Restaurant.findByIdAndUpdate(restaurantId, { $set: socialUpdates });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Footer updated successfully',
      data: {
        id: footer.sectionId,
        _id: footer._id,
        type: footer.type,
        title: footer.title,
        description: footer.description,
        enabled: footer.enabled,
        order: footer.order,
        content: footer.content
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

