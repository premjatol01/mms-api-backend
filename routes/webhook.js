const express = require('express');
const router = express.Router();

/**
 * GET /api/webhook/whatsapp
 * Endpoint for Meta webhook verification handshake.
 */
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'tablly_webhook_secret_2026';

  if (mode === 'subscribe' && (token === expectedToken || token === 'tablly_webhook_secret_2026')) {
    console.log('[WhatsApp Webhook] Handshake verified successfully with Meta!');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Verification token mismatch. Received:', token);
  return res.sendStatus(403);
});

/**
 * POST /api/webhook/whatsapp
 * Receives delivery statuses (sent, delivered, read) and customer replies.
 */
router.post('/whatsapp', (req, res) => {
  // Always return 200 OK fast so Meta doesn't throttle or retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Status updates (sent, delivered, read, failed)
      if (value?.statuses && value.statuses[0]) {
        const s = value.statuses[0];
        console.log(`[WhatsApp Status] ID: ${s.id} | Status: ${s.status} | Recipient: ${s.recipient_id}`);
      }

      // Incoming customer messages
      if (value?.messages && value.messages[0]) {
        const m = value.messages[0];
        console.log(`[WhatsApp Incoming] From: ${m.from} | Type: ${m.type}`);
      }
    }
  } catch (err) {
    console.warn('[WhatsApp Webhook] Parsing error:', err.message);
  }
});

module.exports = router;
