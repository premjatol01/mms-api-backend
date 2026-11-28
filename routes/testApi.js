const express = require('express');
const router = express.Router();
const { seedDatabase } = require('../utils/seedDatabase');
const mongoose = require('mongoose');

// @route   POST /api/test/seed  or  GET /api/test/seed
// @desc    Seed comprehensive demo/test data for the entire Tablly platform
// @access  Public (Dev / Test utility)
const handleSeed = async (req, res) => {
  try {
    const reset = req.query.reset === 'false' || req.body?.reset === false ? false : true;
    console.log(`[Test API] Starting database seed (reset=${reset})...`);
    
    const summary = await seedDatabase({ reset });
    
    return res.status(200).json({
      success: true,
      message: 'Demo data seeded successfully for entire project!',
      credentials: {
        superAdmin: {
          email: 'admin@tablly.com',
          password: 'Admin@1234',
          portal: 'Super Admin Dashboard'
        },
        restaurantAdmin: {
          email: 'admin@urbancafe.com',
          password: 'Password@1234',
          restaurant: 'Urban Cafe & Bistro',
          subdomain: 'urbancafe',
          qrMenuUrl: 'http://urbancafe.localhost:3000/menu/Table 01'
        }
      },
      summary
    });
  } catch (error) {
    console.error('[Test API] Error seeding database:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to seed database',
      error: error.message
    });
  }
};

router.post('/seed', handleSeed);
router.get('/seed', handleSeed);

// @route   GET /api/test/status
// @desc    Check database connection and counts of all collections
router.get('/status', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    const collections = await mongoose.connection.db.listCollections().toArray();
    const stats = {};
    
    for (const col of collections) {
      stats[col.name] = await mongoose.connection.db.collection(col.name).countDocuments();
    }
    
    return res.status(200).json({
      success: true,
      database: mongoose.connection.name,
      connected: isConnected,
      counts: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/test/email (or GET /api/test/email?to=...)
// @desc    Diagnose email dispatch live on Render/Vercel and return detailed provider logs
router.all('/email', async (req, res) => {
  const sendEmail = require('../utils/sendEmail');
  const targetEmail = req.query.to || req.body?.to || process.env.SMTP_EMAIL || 'test@example.com';

  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_api_key_here');
  const activeMode = provider === 'resend' || (hasResend && provider !== 'smtp') ? 'resend' : 'smtp';

  try {
    console.log(`[Diagnostic Email] Sending test email to ${targetEmail} via ${activeMode}...`);
    const result = await sendEmail({
      email: targetEmail,
      subject: `[Tablly Diagnostic] Test Email (${activeMode.toUpperCase()})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Tablly Email Diagnostics</h2>
          <p>This is a test email dispatched from <strong>${activeMode.toUpperCase()}</strong>.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Recipient: ${targetEmail}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Test email successfully dispatched to ${targetEmail}`,
      activeMode,
      details: result,
      env: {
        EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || '(not set)',
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_api_key_here'),
        SMTP_HOST: process.env.SMTP_HOST || '(not set)',
        SMTP_PORT: process.env.SMTP_PORT || '(not set)',
        SMTP_EMAIL: process.env.SMTP_EMAIL ? `${process.env.SMTP_EMAIL.slice(0, 3)}***` : '(not set)',
      }
    });
  } catch (err) {
    console.error('[Diagnostic Email Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Email dispatch failed',
      activeMode,
      error: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      env: {
        EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || '(not set)',
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_api_key_here'),
        SMTP_HOST: process.env.SMTP_HOST || '(not set)',
        SMTP_PORT: process.env.SMTP_PORT || '(not set)',
        SMTP_EMAIL: process.env.SMTP_EMAIL ? `${process.env.SMTP_EMAIL.slice(0, 3)}***` : '(not set)',
      }
    });
  }
});

module.exports = router;
