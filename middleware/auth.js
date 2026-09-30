const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware — verifies JWT from cookie or Authorization header.
 * Attaches `req.user = { _id, name, email, role, restaurantId }` on success.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Prefer HTTP-only cookie (primary flow)
    if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }
    // 2. Fall back to Bearer token in Authorization header (e.g. Postman testing)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach minimal user to request (avoid leaking password)
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

module.exports = { protect };
