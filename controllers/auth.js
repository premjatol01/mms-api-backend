const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Auth user (login) & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user email
    const user = await User.findOne({ email });

    // Check if user exists and password matches
    if (user && (await bcrypt.compare(password, user.password))) {
      if (user.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Your account is inactive' });
      }

      // Generate token and set cookie
      const token = generateToken(res, user._id, user.role, user.restaurantId);

      // Update last login timestamp
      user.lastLoginAt = new Date();
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            restaurantId: user.restaurantId
          },
          token // optionally return token in body for clients that can't use cookies
        },
        message: 'Logged in successfully'
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register super admin (Seed endpoint)
// @route   POST /api/auth/register-super-admin
// @access  Public (Should be protected or removed in production)
const registerSuperAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'super_admin'
    });

    if (user) {
      const token = generateToken(res, user._id, user.role, user.restaurantId);

      res.status(201).json({
        success: true,
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          token
        },
        message: 'Super admin created successfully'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

const jwt = require('jsonwebtoken');

// @desc    Setup password via invite token
// @route   POST /api/auth/setup-password
// @access  Public
const setupPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Please provide token and new password' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.status = 'active'; // Activate the account

    await user.save();

    res.status(200).json({ success: true, message: 'Password set successfully. You can now login.' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid or expired token' });
  }
};

const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Helper regex for email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Request password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Input validations
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format' });
    }

    // 2. Find user
    const user = await User.findOne({ email: trimmedEmail });

    // Security practice: Return success even if user not found to prevent user enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // 3. Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and store in user model
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes

    await user.save();

    // 4. Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // 5. Send email
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #fffaf5; border: 1px solid #ede4dc; border-radius: 12px; color: #2b2118;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #d9480f; margin: 0; font-size: 24px;">Tablly Restaurant Platform</h2>
          <p style="color: #786154; margin-top: 4px; font-size: 13px;">Password Reset Request</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">Hello <strong>${user.name || 'Admin'}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #4a3b32;">
          You requested to reset your password for your restaurant admin account. Please click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #d9480f; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #786154; line-height: 1.5;">
          This link will expire in <strong>30 minutes</strong>. If you did not request this reset, you can safely ignore this email; your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #ede4dc; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9c887e; text-align: center;">
          &copy; ${new Date().getFullYear()} Tablly Technologies. All rights reserved.
        </p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset Your Restaurant Admin Password - Tablly',
        html: message,
      });

      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Email delivery failed. Please check SMTP settings or try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing request' });
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // 1. Input validations
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password is too long (maximum 128 characters)' });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // 2. Hash token to look up in DB
    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link. Please request a new one.'
      });
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 4. Clear reset token & expire
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
};

module.exports = {
  setupPassword,
  loginUser,
  registerSuperAdmin,
  logoutUser,
  forgotPassword,
  resetPassword
};

