const PlatformSettings = require('../models/PlatformSettings');

// @desc    Get platform settings
// @route   GET /api/platform-settings
exports.getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne();
    
    // If settings don't exist yet, return a default object or create one
    if (!settings) {
      settings = await PlatformSettings.create({
        platformName: 'Tablly',
        platformStatus: 'Active',
        maintenanceEnabled: false,
        maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon.'
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
    const {
      platformName,
      platformStatus,
      maintenanceEnabled,
      maintenanceMessage,
      companyName,
      supportEmail,
      supportPhone,
      address,
      websiteUrl,
      copyrightText,
      currency,
      timezone,
      dateFormat,
      timeFormat,
      platformWebsiteEnabled,
      restaurantWebsiteAvailability
    } = req.body;
    
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

    // Determine maintenance state safely across boolean, string, or number values
    const isMaintenance =
      maintenanceEnabled === true ||
      maintenanceEnabled === 'true' ||
      maintenanceEnabled === 1 ||
      maintenanceEnabled === '1' ||
      platformStatus === 'Maintenance';

    const updateData = {};

    if (platformName !== undefined && platformName.trim()) {
      updateData.platformName = platformName.trim();
    }

    updateData.maintenanceEnabled = isMaintenance;
    if (isMaintenance) {
      updateData.platformStatus = 'Maintenance';
      updateData.maintenanceMessage = (maintenanceMessage && maintenanceMessage.trim())
        ? maintenanceMessage.trim()
        : 'We are currently performing scheduled maintenance. Please check back soon.';
    } else {
      if (platformStatus === 'Maintenance') {
        updateData.platformStatus = 'Active';
      } else if (platformStatus) {
        updateData.platformStatus = platformStatus;
      }
      if (maintenanceMessage !== undefined) {
        updateData.maintenanceMessage = maintenanceMessage.trim();
      }
    }

    // Relative path cleanup for logo and favicon
    const sanitizeUrl = (url) => {
      if (!url) return '';
      // Strip any accidental localhost / domain prefix so clean relative path is stored
      return url.replace(/^https?:\/\/[^/]+/i, '');
    };

    if (logoUrl !== undefined) updateData.logoUrl = sanitizeUrl(logoUrl);
    if (faviconUrl !== undefined) updateData.faviconUrl = sanitizeUrl(faviconUrl);

    // General & platform optional fields
    const optionalText = {
      companyName,
      supportEmail,
      supportPhone,
      address,
      websiteUrl,
      copyrightText,
      currency,
      timezone,
      dateFormat,
      timeFormat
    };

    for (const [key, val] of Object.entries(optionalText)) {
      if (val !== undefined) updateData[key] = val;
    }

    if (platformWebsiteEnabled !== undefined) {
      updateData.platformWebsiteEnabled = platformWebsiteEnabled === true || platformWebsiteEnabled === 'true';
    }
    if (restaurantWebsiteAvailability !== undefined) {
      updateData.restaurantWebsiteAvailability = restaurantWebsiteAvailability === true || restaurantWebsiteAvailability === 'true';
    }

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

    res.status(200).json({ success: true, data: settings, message: 'Platform settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
