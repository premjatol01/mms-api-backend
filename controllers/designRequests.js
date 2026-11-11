const DesignRequest = require('../models/DesignRequest');

// @desc    Get all design requests for the logged-in restaurant admin
// @route   GET /api/design-requests
// @access  Private (restaurant_admin)
exports.getDesignRequests = async (req, res) => {
  try {
    const requests = await DesignRequest.find({ restaurantId: req.user.restaurantId })
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get design requests error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get single design request
// @route   GET /api/design-requests/:id
// @access  Private (restaurant_admin, super_admin)
exports.getDesignRequestById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role === 'restaurant_admin') {
      query.restaurantId = req.user.restaurantId;
    }
    const request = await DesignRequest.findOne(query).populate('restaurantId', 'name email phone logo');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Design request not found' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Get design request by id error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create a new design request
// @route   POST /api/design-requests
// @access  Private (restaurant_admin)
exports.createDesignRequest = async (req, res) => {
  try {
    const { description, requestType, title } = req.body;
    
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    // Normalize requestType
    let normalizedType = 'Menu Design';
    if (requestType) {
      const lower = String(requestType).toLowerCase().replace(/[^a-z]/g, '');
      if (lower.includes('banner') || lower.includes('offer')) normalizedType = 'Offer Banner Design';
      else if (lower.includes('qr')) normalizedType = 'QR Template Design';
      else if (lower.includes('menu')) normalizedType = 'Menu Design';
      else normalizedType = requestType;
    }

    const payload = {
      restaurantId: req.user.restaurantId,
      description: description.trim(),
      requestType: normalizedType,
      title: title?.trim() || ''
    };

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      payload.attachment = {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        url: `${baseUrl}/uploads/design-requests/${req.file.filename}`
      };
    }

    const request = await DesignRequest.create(payload);
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Create design request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// @desc    Get all design requests across all restaurants
// @route   GET /api/design-requests/all
// @access  Private (super_admin)
exports.getAllDesignRequests = async (req, res) => {
  try {
    const requests = await DesignRequest.find()
      .populate('restaurantId', 'name email phone logo')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    console.error('Get all design requests error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update design request status & attach completed assets
// @route   PUT /api/design-requests/:id/status
// @access  Private (super_admin)
exports.updateDesignRequestStatus = async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;
    
    if (status && !['pending', 'in_progress', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (adminRemarks !== undefined) updateData.adminRemarks = adminRemarks;
    if (status === 'completed') updateData.completedAt = new Date();

    if (req.file) {
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      updateData.completedAttachment = {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        url: `${baseUrl}/uploads/design-requests/${req.file.filename}`
      };
    } else if (req.body.completedAttachmentUrl) {
      updateData.completedAttachment = {
        name: req.body.completedAttachmentName || 'completed-design.png',
        url: req.body.completedAttachmentUrl
      };
    }

    const request = await DesignRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Design request not found' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Update design request status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};
