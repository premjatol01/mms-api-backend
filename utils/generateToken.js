const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tablly_super_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh_2026');

/**
 * Generate Access Token
 * @param {string} userId
 * @param {string} role
 * @param {string} restaurantId
 * @param {string} expiresIn
 */
const generateAccessToken = (userId, role, restaurantId, expiresIn = '12h') => {
  return jwt.sign(
    { userId, role, restaurantId, tokenType: 'access' },
    JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Generate Refresh Token
 * @param {string} userId
 * @param {string} role
 * @param {string} restaurantId
 * @param {string} expiresIn
 */
const generateRefreshToken = (userId, role, restaurantId, expiresIn = '30d') => {
  return jwt.sign(
    { userId, role, restaurantId, tokenType: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn }
  );
};

/**
 * Set HTTP cookies and return tokens based on role and rememberMe flag.
 * For Restaurant Admin:
 *   - rememberMe === true: 1-hour access token + 30-day refresh token
 *   - rememberMe === false: 12-hour access token ONLY (no refresh token)
 * For other roles:
 *   - Default 1-day access token
 */
const setAuthCookiesAndTokens = (res, user, rememberMe = false) => {
  const isRestroAdmin = user.role === 'restaurant_admin';
  const isProd = process.env.NODE_ENV !== 'development';

  let accessToken;
  let refreshToken = null;

  if (isRestroAdmin) {
    if (rememberMe) {
      // Remember Me checked: short-lived access token + long-lived refresh token
      accessToken = generateAccessToken(user._id, user.role, user.restaurantId, '1h');
      refreshToken = generateRefreshToken(user._id, user.role, user.restaurantId, '30d');

      // Set refresh token cookie (30 days)
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Set access token cookie (1 hour)
      res.cookie('jwt', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 1 * 60 * 60 * 1000, // 1 hour
      });
    } else {
      // Remember Me NOT checked: Access token expires strictly in 12 hours
      accessToken = generateAccessToken(user._id, user.role, user.restaurantId, '12h');

      // Clear any prior refresh token cookie
      res.cookie('refreshToken', '', {
        httpOnly: true,
        expires: new Date(0),
      });

      // Set access token cookie (12 hours)
      res.cookie('jwt', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
      });
    }
  } else {
    // Other roles: default 1-day token
    accessToken = generateAccessToken(user._id, user.role, user.restaurantId, '1d');
    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 1 * 24 * 60 * 60 * 1000,
    });
  }

  return { accessToken, refreshToken };
};

// Legacy default export for backwards compatibility
const generateToken = (res, userId, role, restaurantId) => {
  return generateAccessToken(userId, role, restaurantId, '1d');
};

module.exports = generateToken;
module.exports.generateAccessToken = generateAccessToken;
module.exports.generateRefreshToken = generateRefreshToken;
module.exports.setAuthCookiesAndTokens = setAuthCookiesAndTokens;
module.exports.JWT_SECRET = JWT_SECRET;
module.exports.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;
