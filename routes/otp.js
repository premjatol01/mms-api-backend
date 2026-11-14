const express = require('express');
const router = express.Router();
const OtpVerification = require('../models/OtpVerification');
const { sendWhatsAppOtp } = require('../services/whatsappOtpService');

/**
 * POST /api/otp/send
 * Sends OTP via WhatsApp (or Dev Mock mode).
 */
router.post('/send', async (req, res) => {
  try {
    const { mobile, channel = 'whatsapp' } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number',
      });
    }

    // Rate limiting: Prevent spamming within 30 seconds
    const existing = await OtpVerification.findOne({ mobile: cleanMobile });
    if (existing && Date.now() - new Date(existing.updatedAt).getTime() < 30 * 1000) {
      const waitSec = Math.ceil((30 * 1000 - (Date.now() - new Date(existing.updatedAt).getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSec} seconds before requesting a new OTP.`,
      });
    }

    // Generate secure 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save or update existing OTP record
    await OtpVerification.findOneAndUpdate(
      { mobile: cleanMobile },
      {
        otp: generatedOtp,
        channel,
        attempts: 0,
        verified: false,
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send via WhatsApp service
    const dispatchResult = await sendWhatsAppOtp(cleanMobile, generatedOtp);

    return res.status(200).json({
      success: true,
      message: dispatchResult.mode === 'live'
        ? 'OTP sent to your WhatsApp!'
        : 'OTP generated (Dev Mock mode - check terminal)',
      devCode: dispatchResult.devCode, // populated only in dev mode for testing convenience
      mode: dispatchResult.mode,
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
      error: error.message,
    });
  }
});

/**
 * POST /api/otp/verify
 * Validates the OTP submitted by the user.
 */
router.post('/verify', async (req, res) => {
  try {
    const { mobile, code } = req.body;

    if (!mobile || !code) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP code are required' });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const cleanCode = String(code).trim();

    const record = await OtpVerification.findOne({ mobile: cleanMobile });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or was not requested. Please request a new code.',
      });
    }

    // Check attempts to prevent brute force
    if (record.attempts >= 5) {
      await OtpVerification.deleteOne({ _id: record._id });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // Verification check (allow dev bypass 123456 or 1234 if in development)
    const isDevBypass =
      process.env.NODE_ENV !== 'production' &&
      (cleanCode === '123456' || cleanCode === '1234');

    const isValid = record.otp === cleanCode || isDevBypass;

    if (!isValid) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${5 - record.attempts} attempts remaining.`,
      });
    }

    // Success: Delete the OTP record so it cannot be reused
    await OtpVerification.deleteOne({ _id: record._id });

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Mobile number verified successfully!',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error.message,
    });
  }
});

module.exports = router;
