const CmsSection = require('../models/CmsSection');
const CmsConfig = require('../models/CmsConfig');

const DEFAULT_SECTIONS = [
  {
    sectionId: 'hero',
    type: 'hero',
    title: 'Hero Banner',
    description: 'Main introduction with headline, subtext, CTA buttons and banner image',
    enabled: true,
    order: 1,
    content: {
      heading: 'Manage Your Restaurant Smarter and Faster',
      subheading: 'All-in-one QR ordering, menu management, and real-time kitchen operations',
      description: 'Transform your dining experience with Tablly. Streamlined table-side QR menus, contactless ordering, instant kitchen sync, and powerful analytics.',
      primaryButtonText: 'Get Started Free',
      primaryButtonLink: '/login',
      secondaryButtonText: 'Explore Demo',
      secondaryButtonLink: '#demo',
      imageUrl: ''
    }
  },
  {
    sectionId: 'about',
    type: 'about',
    title: 'About Tablly',
    description: 'Platform mission, introduction, and key operational metrics',
    enabled: true,
    order: 2,
    content: {
      title: 'Built for Modern Restaurateurs',
      subtitle: 'Empowering hospitality businesses of all sizes',
      description: 'Tablly was crafted from the ground up to eliminate order bottlenecks, speed up table turns, and provide restaurant guests with a seamless digital dining experience.',
      stat1Value: '500+',
      stat1Label: 'Restaurants Powered',
      stat2Value: '2.5M+',
      stat2Label: 'Orders Processed',
      stat3Value: '99.9%',
      stat3Label: 'Platform Uptime',
      imageUrl: ''
    }
  },
  {
    sectionId: 'features',
    type: 'features',
    title: 'Platform Features',
    description: 'Core capabilities and benefits offered to dining venues',
    enabled: true,
    order: 3,
    content: {
      title: 'Everything You Need to Run Front & Back of House',
      subtitle: 'Designed to make every shift smoother',
      featuresList: [
        {
          title: 'Dynamic QR Menus',
          description: 'Instantly update items, prices, and special tags with zero re-printing costs.'
        },
        {
          title: 'Instant Kitchen Display',
          description: 'Live order routing straight to kitchen screens for faster order preparation.'
        },
        {
          title: 'Smart Offers & Combos',
          description: 'Drive repeat dining visits with automated promotional deals and rewards.'
        },
        {
          title: 'Real-Time Insights',
          description: 'Actionable sales metrics, popular item analysis, and peak-hour tracking.'
        }
      ]
    }
  },
  {
    sectionId: 'pricing',
    type: 'pricing',
    title: 'Subscription Plans',
    description: 'Overview of available subscription tiers and value propositions',
    enabled: true,
    order: 4,
    content: {
      title: 'Simple, Transparent Pricing',
      subtitle: 'Choose the plan that fits your restaurant stage',
      note: 'All plans include seamless QR ordering and 24/7 priority customer support.'
    }
  },
  {
    sectionId: 'testimonials',
    type: 'testimonials',
    title: 'Customer Stories',
    description: 'Real testimonials and feedback from restaurant partners',
    enabled: true,
    order: 5,
    content: {
      title: 'Trusted by Hospitality Leaders',
      subtitle: 'See what restaurant owners and managers have to say about Tablly',
      testimonialsList: [
        {
          name: 'Rakesh Kumar',
          role: 'Owner, Urban Cafe',
          quote: 'Tablly cut our table wait times in half. Guests love scanning the QR and ordering directly.',
          rating: 5
        },
        {
          name: 'Priya Nair',
          role: 'Founder, Spice Route',
          quote: 'Onboarding our staff took one afternoon. The kitchen display system is rock solid.',
          rating: 5
        },
        {
          name: 'Marco Lin',
          role: 'Manager, Lin\'s Kitchen',
          quote: 'Support has been ultra-responsive, and orders flow seamlessly during peak dinner rush.',
          rating: 5
        }
      ]
    }
  },
  {
    sectionId: 'cta',
    type: 'cta',
    title: 'Call to Action Banner',
    description: 'Prominent bottom banner encouraging restaurants to onboard',
    enabled: true,
    order: 6,
    content: {
      title: 'Ready to Supercharge Your Restaurant?',
      description: 'Join hundreds of dining spots already using Tablly to delight guests and grow revenue.',
      buttonText: 'Get Started Today',
      buttonLink: '/login'
    }
  },
  {
    sectionId: 'footer',
    type: 'footer',
    title: 'Footer & Contact',
    description: 'Platform contact details, address, social links, and copyright',
    enabled: true,
    order: 7,
    content: {
      aboutText: 'Tablly is the next-generation restaurant operations & digital menu platform.',
      supportEmail: 'support@tablly.com',
      supportPhone: '+91 98765 43210',
      address: 'Tech Park, Suite 400, Mumbai, India',
      copyright: '© 2026 Tablly. All rights reserved.',
      twitterUrl: 'https://twitter.com/tablly',
      linkedinUrl: 'https://linkedin.com/company/tablly',
      instagramUrl: 'https://instagram.com/tablly'
    }
  }
];

// Helper to seed default sections if none exist
async function ensureDefaultSections() {
  const count = await CmsSection.countDocuments();
  if (count === 0) {
    await CmsSection.insertMany(DEFAULT_SECTIONS);
  }
  let config = await CmsConfig.findOne();
  if (!config) {
    config = await CmsConfig.create({
      websiteStatus: 'published',
      websiteUrl: 'http://localhost:3000',
      publishedAt: new Date()
    });
  }
  return config;
}

// @desc    Get all CMS data (config & sections)
// @route   GET /api/cms
// @access  Public / Private
exports.getCmsData = async (req, res) => {
  try {
    const config = await ensureDefaultSections();
    const sections = await CmsSection.find().sort({ order: 1 });
    res.status(200).json({
      success: true,
      data: {
        config,
        sections
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update CMS config (status, url)
// @route   PUT /api/cms/config
// @access  Private (Super Admin)
exports.updateCmsConfig = async (req, res) => {
  try {
    let config = await CmsConfig.findOne();
    if (!config) {
      config = new CmsConfig();
    }
    const { websiteStatus, websiteUrl } = req.body;
    if (websiteStatus) {
      config.websiteStatus = websiteStatus;
      if (websiteStatus === 'published' && !config.publishedAt) {
        config.publishedAt = new Date();
      }
    }
    if (websiteUrl) config.websiteUrl = websiteUrl;
    await config.save();

    res.status(200).json({
      success: true,
      data: config,
      message: 'Website configuration updated'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Publish website
// @route   POST /api/cms/publish
// @access  Private (Super Admin)
exports.publishWebsite = async (req, res) => {
  try {
    let config = await CmsConfig.findOne();
    if (!config) config = new CmsConfig();
    config.websiteStatus = 'published';
    config.publishedAt = new Date();
    await config.save();

    res.status(200).json({
      success: true,
      data: config,
      message: 'Website published successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unpublish website
// @route   POST /api/cms/unpublish
// @access  Private (Super Admin)
exports.unpublishWebsite = async (req, res) => {
  try {
    let config = await CmsConfig.findOne();
    if (!config) config = new CmsConfig();
    config.websiteStatus = 'draft';
    await config.save();

    res.status(200).json({
      success: true,
      data: config,
      message: 'Website unpublished'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a section's content
// @route   PUT /api/cms/sections/:sectionId
// @access  Private (Super Admin)
exports.updateCmsSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { content, title, description, enabled } = req.body;

    let section = await CmsSection.findOne({ sectionId });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    if (content !== undefined) section.content = content;
    if (title !== undefined) section.title = title;
    if (description !== undefined) section.description = description;
    if (enabled !== undefined) section.enabled = enabled;

    await section.save();

    res.status(200).json({
      success: true,
      data: section,
      message: `${section.title} updated successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle section enabled status
// @route   PATCH /api/cms/sections/:sectionId/toggle
// @access  Private (Super Admin)
exports.toggleCmsSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    let section = await CmsSection.findOne({ sectionId });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    section.enabled = !section.enabled;
    await section.save();

    res.status(200).json({
      success: true,
      data: section,
      message: `${section.title} ${section.enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
