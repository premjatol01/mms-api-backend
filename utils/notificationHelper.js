const Notification = require('../models/Notification');
const {
  emitToSuperAdmin,
  emitToRestaurant,
  emitToAllRestaurants,
} = require('../socket');

/**
 * Creates and delivers a notification (persists to DB and emits over Socket.io).
 *
 * @param {Object} params
 * @param {'super_admin'|'restaurant'} params.recipientType
 * @param {string|null} [params.restaurantId] - Restaurant ID if recipientType is 'restaurant'
 * @param {string[]} [params.targetRoles] - Target roles (['all', 'admin', 'manager', 'kitchen', 'cashier'])
 * @param {'lead'|'subscription'|'order'|'biz_growth'|'system'|'waiter_call'|'ticket'} params.category
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.actionUrl] - Route URL to open when clicked
 * @param {Object} [params.metadata]
 * @param {boolean} [params.broadcastAll] - If true, emits to all connected restaurants
 */
async function sendNotification({
  recipientType,
  restaurantId = null,
  targetRoles = ['all'],
  category,
  title,
  message,
  actionUrl = '',
  metadata = {},
  broadcastAll = false,
}) {
  try {
    const doc = await Notification.create({
      recipientType,
      restaurantId: restaurantId || null,
      targetRoles,
      category,
      title,
      message,
      actionUrl,
      metadata,
    });

    const payload = doc.toObject();

    if (recipientType === 'super_admin') {
      emitToSuperAdmin('notification:new', payload);
    } else if (broadcastAll) {
      emitToAllRestaurants('notification:new', payload);
    } else if (restaurantId) {
      emitToRestaurant(restaurantId, 'notification:new', payload);
    }

    return doc;
  } catch (error) {
    console.error('[NotificationHelper] Failed to create notification:', error.message);
    return null;
  }
}

module.exports = { sendNotification };
