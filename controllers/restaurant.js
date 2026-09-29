const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');

// @desc    Get all restaurants (with filters and pagination)
// @route   GET /api/restaurants
exports.getRestaurants = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      subscriptionStatus, 
      package: subPackage, 
      city, 
      dateFrom, 
      dateTo,
      page = 1,
      limit = 10 
    } = req.query;

    const query = {};

    // Filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'admin.name': { $regex: search, $options: 'i' } },
        { 'admin.email': { $regex: search, $options: 'i' } },
        { 'admin.phone': { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (subscriptionStatus) query['subscription.status'] = subscriptionStatus;
    if (subPackage) query['subscription.packageName'] = { $regex: new RegExp(`^${subPackage}$`, 'i') };
    if (city) query['address.city'] = { $regex: new RegExp(`^${city}$`, 'i') };
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await Restaurant.countDocuments(query);
    const restaurants = await Restaurant.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: restaurants,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new restaurant
// @route   POST /api/restaurants
exports.createRestaurant = async (req, res) => {
  try {
    const data = { ...req.body };
    
    // Parse nested objects that might be stringified if using form-data
    if (typeof data.admin === 'string') data.admin = JSON.parse(data.admin);
    if (typeof data.address === 'string') data.address = JSON.parse(data.address);
    if (typeof data.subscription === 'string') data.subscription = JSON.parse(data.subscription);
    
    // 1. Validate Admin Email Uniqueness & Generate Temp Password
    let tempHashedPassword;
    if (data.admin && data.admin.email) {
      const existingUser = await User.findOne({ email: data.admin.email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Admin email already exists' });
      }

      // Generate a temporary random password (user will set real one via invite link)
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const salt = await bcrypt.genSalt(10);
      tempHashedPassword = await bcrypt.hash(tempPassword, salt);
    } else {
      return res.status(400).json({ success: false, message: 'Admin email is required' });
    }

    if (req.file) {
      data.logo = `/uploads/restaurants/${req.file.filename}`;
    }

    // 2. Create the Restaurant
    const restaurant = await Restaurant.create(data);

    // 3. Create the corresponding User for Login (Starts inactive until invite accepted)
    await User.create({
      name: data.admin.name,
      email: data.admin.email,
      password: tempHashedPassword,
      phone: data.admin.phone,
      role: 'restaurant_admin',
      restaurantId: restaurant._id,
      status: 'inactive' // They must activate via email
    });

    res.status(201).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
exports.updateRestaurant = async (req, res) => {
  try {
    const data = { ...req.body };
    
    if (typeof data.admin === 'string') data.admin = JSON.parse(data.admin);
    if (typeof data.address === 'string') data.address = JSON.parse(data.address);
    if (typeof data.subscription === 'string') data.subscription = JSON.parse(data.subscription);
    
    if (req.file) {
      data.logo = `/uploads/restaurants/${req.file.filename}`;
    }

    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk update status
// @route   PATCH /api/restaurants/bulk/status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    
    await Restaurant.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );
    
    res.status(200).json({ success: true, message: `Updated ${ids.length} restaurants to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle single restaurant status
// @route   PATCH /api/restaurants/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    
    restaurant.status = restaurant.status === 'active' ? 'inactive' : 'active';
    await restaurant.save();
    
    res.status(200).json({ success: true, data: restaurant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Send invitation email to restaurant admin
// @route   POST /api/restaurants/:id/send-invite
exports.sendInvite = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const user = await User.findOne({ email: restaurant.admin.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    // 1. Generate an activation token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d'
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const activationLink = `${frontendUrl}/setup-password?token=${token}&email=${user.email}`;

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333;">Welcome to Tablly!</h2>
        <p>Hi ${user.name},</p>
        <p>Your restaurant <strong>${restaurant.name}</strong> has been successfully created on the Tablly platform.</p>
        <p>Please click the button below to activate your account and set your secure password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Activate Account</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #0070f3;">${activationLink}</p>
        <p>Welcome aboard!</p>
        <p>The Tablly Team</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Tablly - Activate Your Account',
        html: emailHTML,
      });

      res.status(200).json({ 
        success: true, 
        message: 'Invitation email sent successfully'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({ success: false, message: 'Email could not be sent. Please check SMTP settings.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

