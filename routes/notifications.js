const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

router.use(protect);

/**
 * GET /api/notifications
 * Returns latest notifications and unread count for current user/restaurant.
 */
router.get('/', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);

    const baseFilter = isSuperAdmin
      ? { recipientType: 'super_admin' }
      : {
          recipientType: 'restaurant',
          restaurantId: req.user.restaurantId,
        };

    const queryFilter = { ...baseFilter };
    if (req.query.unreadOnly === 'true') {
      queryFilter.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(queryFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ ...baseFilter, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const filter = { _id: req.params.id };

    if (!isSuperAdmin) {
      filter.restaurantId = req.user.restaurantId;
    }

    const notification = await Notification.findOneAndUpdate(
      filter,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marks all unread notifications as read.
 */
router.patch('/read-all', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const filter = isSuperAdmin
      ? { recipientType: 'super_admin', isRead: false }
      : {
          recipientType: 'restaurant',
          restaurantId: req.user.restaurantId,
          isRead: false,
        };

    await Notification.updateMany(filter, {
      isRead: true,
      readAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all as read',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
router.delete('/:id', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const filter = { _id: req.params.id };

    if (!isSuperAdmin) {
      filter.restaurantId = req.user.restaurantId;
    }

    const deleted = await Notification.findOneAndDelete(filter);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
});

module.exports = router;
