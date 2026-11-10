const User = require('../models/User');
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

exports.getSuperAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Super admin not found' });
    }

    const cleanPhone = sanitizeMobile(user.mobile || user.phone);
    const uAddr = user.personalAddress || {};

    const personalAddress = {
      line1: uAddr.line1 || '',
      line2: uAddr.line2 || '',
      area: uAddr.area || '',
      landmark: uAddr.landmark || '',
      city: uAddr.city || '',
      state: uAddr.state || 'Rajasthan',
      country: uAddr.country || 'India',
      pincode: uAddr.pincode || ''
    };

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name || 'Super Admin',
        email: user.email,
        phone: cleanPhone,
        mobile: cleanPhone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        personalAddress
      }
    });
  } catch (error) {
    console.error('Error fetching super admin profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSuperAdminProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, mobile, phone, email, personalAddress } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const cleanMobile = sanitizeMobile(mobile || phone);
    if (!cleanMobile || cleanMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
    }

    // Check email uniqueness if email provided and changed
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: cleanEmail, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already in use by another user' });
      }
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

    const updatePayload = {
      name: name.trim(),
      phone: cleanMobile,
      mobile: cleanMobile,
      personalAddress: sanitizedAddress
    };

    if (email) {
      updatePayload.email = email.trim().toLowerCase();
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
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
    console.error('Error updating super admin profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.changeSuperAdminPassword = async (req, res) => {
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
    console.error('Error changing super admin password:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
