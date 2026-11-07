const Package = require('../models/Package');

// @desc    Get all packages
// @route   GET /api/packages
// @access  Public
exports.getPackages = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const packages = await Package.find(query).sort({ price: 1, createdAt: 1 });
    res.status(200).json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single package by ID
// @route   GET /api/packages/:id
// @access  Public
exports.getPackage = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle package status
// @route   PATCH /api/packages/:id/status
// @access  Private (Super Admin)
exports.togglePackageStatus = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    pkg.status = pkg.status === 'active' ? 'inactive' : 'active';
    await pkg.save();
    res.status(200).json({ success: true, data: pkg, message: `Package ${pkg.status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
