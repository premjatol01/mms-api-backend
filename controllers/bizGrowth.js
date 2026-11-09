const BizGrowth = require('../models/BizGrowth');

// Extract YouTube video ID from various YouTube URL formats
const extractYoutubeId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

// -----------------------------------------------------------------------------
// SUPER ADMIN CONTROLLERS
// -----------------------------------------------------------------------------

/**
 * @desc    Get all Biz Growth resources with stats & filtering (Super Admin)
 * @route   GET /api/biz-growth/admin
 * @access  Private (super_admin)
 */
exports.getAdminBizGrowth = async (req, res) => {
  try {
    const { type, status, category, search, page = 1, pageSize = 12 } = req.query;

    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { sourceName: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } }
      ];
    }

    const numPage = Math.max(1, parseInt(page, 10) || 1);
    const numPageSize = Math.max(1, parseInt(pageSize, 10) || 12);
    const skip = (numPage - 1) * numPageSize;

    const [total, items, statsAgg] = await Promise.all([
      BizGrowth.countDocuments(query),
      BizGrowth.find(query).sort({ createdAt: -1 }).skip(skip).limit(numPageSize),
      BizGrowth.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            youtube: { $sum: { $cond: [{ $eq: ['$type', 'youtube'] }, 1, 0] } },
            blog: { $sum: { $cond: [{ $eq: ['$type', 'blog'] }, 1, 0] } },
            news: { $sum: { $cond: [{ $eq: ['$type', 'news'] }, 1, 0] } },
            social: { $sum: { $cond: [{ $eq: ['$type', 'social'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = statsAgg[0] || {
      total: 0,
      active: 0,
      youtube: 0,
      blog: 0,
      news: 0,
      social: 0
    };
    delete stats._id;

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        stats,
        page: numPage,
        pageSize: numPageSize
      }
    });
  } catch (error) {
    console.error('Error fetching admin biz growth:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create Biz Growth resource (Super Admin)
 * @route   POST /api/biz-growth/admin
 * @access  Private (super_admin)
 */
exports.createBizGrowth = async (req, res) => {
  try {
    const {
      title,
      type,
      description,
      content,
      url,
      thumbnail: directThumbnail,
      category,
      platform,
      sourceName,
      readTime,
      status,
      featured,
      order
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Resource title is required' });
    }

    if (!type || !['blog', 'youtube', 'news', 'social'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Valid resource type is required (blog, youtube, news, social)' });
    }

    let resolvedThumbnail = directThumbnail || '';

    // If an image was uploaded via multipart/form-data
    if (req.file) {
      resolvedThumbnail = `/uploads/biz-growth/${req.file.filename}`;
    }

    // Auto-derive YouTube thumbnail if empty and it's a YouTube video
    if (!resolvedThumbnail && type === 'youtube' && url) {
      const ytId = extractYoutubeId(url);
      if (ytId) {
        resolvedThumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }

    const resource = new BizGrowth({
      title: title.trim(),
      type,
      description: description ? description.trim() : '',
      content: content ? content.trim() : '',
      url: url ? url.trim() : '',
      thumbnail: resolvedThumbnail,
      category: category && category.trim() ? category.trim() : 'Marketing',
      platform: platform && platform.trim() ? platform.trim() : (type === 'social' ? 'Instagram' : ''),
      sourceName: sourceName && sourceName.trim() ? sourceName.trim() : 'Tablly Growth Team',
      readTime: readTime && readTime.trim() ? readTime.trim() : (type === 'youtube' ? '10 min video' : '5 min read'),
      status: status === 'inactive' ? 'inactive' : 'active',
      featured: featured === true || featured === 'true',
      order: Number(order) || 0,
      createdBy: req.user?._id
    });

    await resource.save();

    res.status(201).json({
      success: true,
      message: 'Biz Growth resource created successfully',
      data: resource
    });
  } catch (error) {
    console.error('Error creating biz growth:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update Biz Growth resource (Super Admin)
 * @route   PUT /api/biz-growth/admin/:id
 * @access  Private (super_admin)
 */
exports.updateBizGrowth = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await BizGrowth.findById(id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const {
      title,
      type,
      description,
      content,
      url,
      thumbnail: directThumbnail,
      category,
      platform,
      sourceName,
      readTime,
      status,
      featured,
      order
    } = req.body;

    if (title !== undefined) resource.title = title.trim();
    if (type !== undefined) resource.type = type;
    if (description !== undefined) resource.description = description.trim();
    if (content !== undefined) resource.content = content.trim();
    if (url !== undefined) resource.url = url.trim();
    if (category !== undefined) resource.category = category.trim();
    if (platform !== undefined) resource.platform = platform.trim();
    if (sourceName !== undefined) resource.sourceName = sourceName.trim();
    if (readTime !== undefined) resource.readTime = readTime.trim();
    if (status !== undefined) resource.status = status;
    if (featured !== undefined) resource.featured = featured === true || featured === 'true';
    if (order !== undefined) resource.order = Number(order) || 0;

    if (req.file) {
      resource.thumbnail = `/uploads/biz-growth/${req.file.filename}`;
    } else if (directThumbnail !== undefined) {
      resource.thumbnail = directThumbnail;
    }

    // Auto-update YouTube thumbnail if empty and type is youtube
    if (!resource.thumbnail && resource.type === 'youtube' && resource.url) {
      const ytId = extractYoutubeId(resource.url);
      if (ytId) {
        resource.thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
    }

    await resource.save();

    res.status(200).json({
      success: true,
      message: 'Biz Growth resource updated successfully',
      data: resource
    });
  } catch (error) {
    console.error('Error updating biz growth:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete Biz Growth resource (Super Admin)
 * @route   DELETE /api/biz-growth/admin/:id
 * @access  Private (super_admin)
 */
exports.deleteBizGrowth = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await BizGrowth.findByIdAndDelete(id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting biz growth:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Toggle Biz Growth resource status (Super Admin)
 * @route   PATCH /api/biz-growth/admin/:id/status
 * @access  Private (super_admin)
 */
exports.toggleBizGrowthStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await BizGrowth.findById(id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    resource.status = resource.status === 'active' ? 'inactive' : 'active';
    await resource.save();

    res.status(200).json({
      success: true,
      message: `Resource status changed to ${resource.status}`,
      data: resource
    });
  } catch (error) {
    console.error('Error toggling biz growth status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// -----------------------------------------------------------------------------
// RESTAURANT ADMIN CONTROLLERS
// -----------------------------------------------------------------------------

/**
 * @desc    Get active Biz Growth resources for Restaurant Admin
 * @route   GET /api/biz-growth
 * @access  Private (restaurant_admin, super_admin)
 */
exports.getRestaurantBizGrowth = async (req, res) => {
  try {
    const { type, category, search, page = 1, pageSize = 24 } = req.query;

    const query = { status: 'active' };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { sourceName: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } }
      ];
    }

    const numPage = Math.max(1, parseInt(page, 10) || 1);
    const numPageSize = Math.max(1, parseInt(pageSize, 10) || 24);
    const skip = (numPage - 1) * numPageSize;

    const [total, items, categories] = await Promise.all([
      BizGrowth.countDocuments(query),
      BizGrowth.find(query)
        .sort({ featured: -1, order: 1, createdAt: -1 })
        .skip(skip)
        .limit(numPageSize),
      BizGrowth.distinct('category', { status: 'active' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        categories: categories.filter(Boolean),
        page: numPage,
        pageSize: numPageSize
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant biz growth:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single Biz Growth resource detail and increment view count
 * @route   GET /api/biz-growth/:id
 * @access  Private (restaurant_admin, super_admin)
 */
exports.getBizGrowthById = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await BizGrowth.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    );

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    res.status(200).json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error fetching biz growth resource:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
