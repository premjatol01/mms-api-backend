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
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create a new design request
// @route   POST /api/design-requests
// @access  Private (restaurant_admin)
exports.createDesignRequest = async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    const payload = {
      restaurantId: req.user.restaurantId,
      description
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
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get all design requests across all restaurants
// @route   GET /api/design-requests/all
// @access  Private (super_admin)
exports.getAllDesignRequests = async (req, res) => {
  try {
    const requests = await DesignRequest.find()
      .populate('restaurantId', 'restaurantName email phone')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update design request status
// @route   PUT /api/design-requests/:id/status
// @access  Private (super_admin)
exports.updateDesignRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'in_progress', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const request = await DesignRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Design request not found' });
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
