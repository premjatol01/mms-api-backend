const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');

/**
 * Protect middleware — verifies JWT from cookie or Authorization header.
 * Attaches `req.user = { _id, name, email, role, restaurantId }` on success.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Prefer Bearer token in Authorization header (explicit token sent by client app)
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fall back to HTTP-only cookie
    else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // Verify token with fallback between header and cookie if both are present
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'tablly_super_secret_key_2026');
    } catch (tokenErr) {
      // If header token failed and an alternative cookie exists, attempt verifying the cookie
      if (req.cookies?.jwt && token !== req.cookies.jwt) {
        decoded = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET || 'tablly_super_secret_key_2026');
      } else {
        throw tokenErr;
      }
    }

    // Attach minimal user to request (avoid leaking password)
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    // Check user active status
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact administrator.' });
    }

    // If restaurant admin, also verify restaurant active status
    if (user.role === 'restaurant_admin' && user.restaurantId) {
      const restaurant = await Restaurant.findById(user.restaurantId).select('status');
      if (restaurant && restaurant.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Your restaurant account is inactive. Please contact administrator.' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    const isExpired = error.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: isExpired ? 'Token expired' : 'Not authorized, invalid token',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

module.exports = { protect };
