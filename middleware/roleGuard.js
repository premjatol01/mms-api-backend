/**
 * roleGuard — allow only specific roles through.
 *
 * Usage (after `protect`):
 *   router.get('/profile', protect, roleGuard('restaurant_admin'), getProfile);
 *   router.get('/all',     protect, roleGuard('super_admin', 'restaurant_admin'), getAll);
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};

module.exports = { roleGuard };
