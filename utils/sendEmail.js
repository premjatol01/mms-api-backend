const nodemailer = require('nodemailer');
const { Resend } = require('resend');

/**
 * Universal Email Sender (Hybrid: Resend HTTP API + SMTP)
 *
 * Mode selection:
 * 1. If EMAIL_PROVIDER === 'resend' OR RESEND_API_KEY is present without SMTP_ENABLED=true:
 *    Uses Resend over HTTPS (Port 443). 100% immune to Render/Vercel port blocks.
 * 2. If EMAIL_PROVIDER === 'smtp' OR (SMTP_HOST and SMTP_EMAIL are configured):
 *    Uses standard Nodemailer SMTP (Port 587 / 465).
 */
const sendEmail = async (options) => {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const useResend = provider === 'resend' || (hasResend && provider !== 'smtp');

  // --- PATH 1: Resend HTTP API (For testing on Render / Vercel without port blocks) ---
  if (useResend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('[Email] RESEND_API_KEY is required when using Resend provider.');
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    // On free Resend test tier without domain setup, from must be "onboarding@resend.dev"
    // When you verify your domain, you can set FROM_EMAIL=team@yourdomain.com
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      'Tablly <onboarding@resend.dev>';

    const res = await resend.emails.send({
      from: fromAddress,
      to: options.email,
      subject: options.subject,
      html: options.html || options.message,
    });

    if (res.error) {
      console.error('[Resend Error]:', res.error);
      throw new Error(res.error.message || 'Failed to dispatch email via Resend');
    }

    console.log('[Resend] Email sent successfully! ID:', res.data?.id);
    return res.data;
  }

  // --- PATH 2: Standard SMTP (For local or live production on dedicated host / paid Render) ---
  const port = Number(process.env.SMTP_PORT) || 587;
  const isPort465 = port === 465;
  const cleanPassword = process.env.SMTP_PASSWORD ? String(process.env.SMTP_PASSWORD).replace(/\s+/g, '') : '';

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: isPort465,
    requireTLS: !isPort465,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: cleanPassword,
    },
    tls: {
      rejectUnauthorized: true,
    },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 7000,
  });

  const message = {
    from: `${process.env.FROM_NAME || 'Tablly'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html || options.message,
  };

  const info = await transporter.sendMail(message);
  console.log('[SMTP] Message sent: %s', info.messageId);
  return info;
};

module.exports = sendEmail;
