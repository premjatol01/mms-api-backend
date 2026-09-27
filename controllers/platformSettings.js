const PlatformSettings = require('../models/PlatformSettings');

// @desc    Get platform settings
// @route   GET /api/platform-settings
exports.getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne();
    
    // If settings don't exist yet, return a default object or create one
    if (!settings) {
      settings = await PlatformSettings.create({
        platformName: 'Menu Management System',
        platformStatus: 'Active',
        maintenanceEnabled: false
      });
    }

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update platform settings
// @route   PUT /api/platform-settings
exports.updatePlatformSettings = async (req, res) => {
  try {
    const { platformName, platformStatus, maintenanceEnabled, maintenanceMessage } = req.body;
    
    let logoUrl = req.body.logoUrl;
    let faviconUrl = req.body.faviconUrl;

    if (req.files) {
      if (req.files.logo && req.files.logo.length > 0) {
        logoUrl = `/uploads/platform/${req.files.logo[0].filename}`;
      }
      if (req.files.favicon && req.files.favicon.length > 0) {
        faviconUrl = `/uploads/platform/${req.files.favicon[0].filename}`;
      }
    }

    const updateData = {
      platformName,
      platformStatus,
      maintenanceEnabled: maintenanceEnabled === 'true', // formData casts boolean to string
      maintenanceMessage
    };

    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (faviconUrl !== undefined) updateData.faviconUrl = faviconUrl;

    let settings = await PlatformSettings.findOne();
    
    if (!settings) {
      settings = await PlatformSettings.create(updateData);
    } else {
      settings = await PlatformSettings.findByIdAndUpdate(
        settings._id,
        updateData,
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
