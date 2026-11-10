const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const bcrypt = require('bcryptjs');

// Helper to clean mobile to strictly 10 digits
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

/**
 * @desc    Get restaurant admin account profile and personal address
 * @route   GET /api/restaurant/account
 * @access  Private (restaurant_admin)
 */
exports.getAccountDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let restaurant = null;
    if (user.restaurantId) {
      restaurant = await Restaurant.findById(user.restaurantId);
    }

    const rAdmin = restaurant?.admin || {};
    const uAddr = user.personalAddress || {};
    const rAddr = rAdmin.personalAddress || {};

    // Merge existing data that Super Admin added or user saved
    const personalAddress = {
      line1: uAddr.line1 !== undefined && uAddr.line1 !== '' ? uAddr.line1 : (rAddr.line1 || ''),
      line2: uAddr.line2 !== undefined && uAddr.line2 !== '' ? uAddr.line2 : (rAddr.line2 || ''),
      area: uAddr.area || rAddr.area || '',
      landmark: uAddr.landmark || rAddr.landmark || '',
      city: uAddr.city || rAddr.city || '',
      state: uAddr.state || rAddr.state || 'Rajasthan',
      country: uAddr.country || rAddr.country || 'India',
      pincode: uAddr.pincode || rAddr.pincode || ''
    };

    const cleanPhone = sanitizeMobile(user.mobile || user.phone || rAdmin.phone);

    const accountData = {
      id: user._id,
      name: user.name || rAdmin.name || '',
      email: user.email || rAdmin.email || '',
      phone: cleanPhone,
      mobile: cleanPhone,
      role: user.role || 'restaurant_admin',
      status: user.status || 'active',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      personalAddress,
      restaurant: restaurant ? {
        id: restaurant._id,
        name: restaurant.name || '',
        logo: restaurant.logo || null,
        status: restaurant.status || 'active',
        restaurantType: restaurant.restaurantType || '',
        city: restaurant.detailedAddress?.city || restaurant.address?.city || '',
        state: restaurant.detailedAddress?.state || restaurant.address?.state || '',
        fullAddress: restaurant.address?.fullAddress || ''
      } : null
    };

    res.status(200).json({
      success: true,
      data: accountData
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update restaurant admin account profile and personal address
 * @route   PUT /api/restaurant/account
 * @access  Private (restaurant_admin)
 */
exports.updateAccountDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, mobile, phone, personalAddress } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const cleanMobile = sanitizeMobile(mobile || phone);
    if (!cleanMobile || cleanMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
    }

    if (personalAddress?.pincode) {
      const pin = String(personalAddress.pincode).trim();
      const country = personalAddress.country || 'India';
      if (country === 'India' && !/^\d{6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit PIN code' });
      }
    }

    const sanitizedAddress = {
      line1: (personalAddress?.line1 || '').trim(),
      line2: (personalAddress?.line2 || '').trim(),
      area: (personalAddress?.area || '').trim(),
      landmark: (personalAddress?.landmark || '').trim(),
      city: (personalAddress?.city || '').trim(),
      state: (personalAddress?.state || 'Rajasthan').trim(),
      country: (personalAddress?.country || 'India').trim(),
      pincode: (personalAddress?.pincode || '').trim()
    };

    // Update User model
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          name: name.trim(),
          phone: cleanMobile,
          mobile: cleanMobile,
          personalAddress: sanitizedAddress
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    // Keep Restaurant.admin model synchronized
    if (updatedUser.restaurantId) {
      await Restaurant.findByIdAndUpdate(updatedUser.restaurantId, {
        $set: {
          'admin.name': name.trim(),
          'admin.phone': cleanMobile,
          'admin.personalAddress': sanitizedAddress
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account details updated successfully',
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: cleanMobile,
        mobile: cleanMobile,
        role: updatedUser.role,
        status: updatedUser.status,
        personalAddress: sanitizedAddress
      }
    });
  } catch (error) {
    console.error('Error updating account details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Change restaurant admin password
 * @route   PUT /api/restaurant/account/change-password
 * @access  Private (restaurant_admin)
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Current password is required' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
