const axios = require('axios');
const Staff = require('../models/Staff');
const User = require('../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends push notifications to a list of Expo push tokens.
 * Expo's push service delivers to Google FCM (Android) and Apple APNs (iOS) for free.
 * 
 * @param {string[]} tokens - Array of ExponentPushToken strings
 * @param {object} message - { title, body, data, sound, channelId }
 */
async function sendPushNotification(tokens, { title, body, data = {}, sound = 'default', channelId = 'orders-alerts' }) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  // Filter valid Expo push tokens
  const validTokens = Array.from(new Set(tokens)).filter((t) => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')));
  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    sound,
    title,
    body,
    data,
    priority: 'high',
    channelId,
    _displayInForeground: true,
  }));

  // Chunk messages in batches of 100 (Expo limit)
  const chunks = [];
  while (messages.length > 0) {
    chunks.push(messages.splice(0, 100));
  }

  for (const chunk of chunks) {
    try {
      await axios.post(EXPO_PUSH_URL, chunk, {
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
    } catch (err) {
      console.error('Error sending Expo push notification:', err.response?.data || err.message);
    }
  }
}

/**
 * Broadcasts a push notification to all staff & admins registered under a restaurant.
 * 
 * @param {string} restaurantId 
 * @param {object} payload - { title, body, data }
 */
async function sendPushToRestaurant(restaurantId, payload) {
  if (!restaurantId) return;

  try {
    const [staffDocs, userDocs] = await Promise.all([
      Staff.find({ restaurantId, pushTokens: { $exists: true, $ne: [] } }).select('pushTokens'),
      User.find({ restaurantId, pushTokens: { $exists: true, $ne: [] } }).select('pushTokens'),
    ]);

    const tokenSet = new Set();
    staffDocs.forEach((s) => (s.pushTokens || []).forEach((t) => tokenSet.add(t)));
    userDocs.forEach((u) => (u.pushTokens || []).forEach((t) => tokenSet.add(t)));

    const allTokens = Array.from(tokenSet);
    if (allTokens.length > 0) {
      await sendPushNotification(allTokens, payload);
    }
  } catch (error) {
    console.error('Error in sendPushToRestaurant:', error.message);
  }
}

/**
 * Registers or updates a device push token for a logged-in user or staff.
 */
async function registerDevicePushToken(userId, email, restaurantId, pushToken) {
  if (!pushToken) return;

  try {
    const promises = [];
    if (userId) {
      promises.push(
        User.findByIdAndUpdate(userId, { $addToSet: { pushTokens: pushToken } })
      );
    }
    if (email && restaurantId) {
      promises.push(
        Staff.findOneAndUpdate(
          { email: email.toLowerCase(), restaurantId },
          { $addToSet: { pushTokens: pushToken } }
        )
      );
    }
    await Promise.all(promises);
  } catch (err) {
    console.error('Error saving push token:', err.message);
  }
}

module.exports = {
  sendPushNotification,
  sendPushToRestaurant,
  registerDevicePushToken,
};
