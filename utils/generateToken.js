const jwt = require('jsonwebtoken');

const generateToken = (res, userId, role, restaurantId) => {
  const token = jwt.sign({ userId, role, restaurantId }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });

  // Set JWT as HTTP-only cookie
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
    sameSite: 'strict', // Prevent CSRF attacks
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
  });

  return token;
};

module.exports = generateToken;
