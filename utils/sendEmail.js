const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const port = Number(process.env.SMTP_PORT) || 587;
  const isPort465 = port === 465;

  // Clean password by stripping any accidental spaces (standard with Gmail App Passwords)
  const cleanPassword = process.env.SMTP_PASSWORD ? String(process.env.SMTP_PASSWORD).replace(/\s+/g, '') : '';

  // Create a transporter resilient to Vercel/serverless environments
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: isPort465, // true for port 465 (direct SSL), false for port 587 (STARTTLS)
    requireTLS: !isPort465, // Upgrade unencrypted connection to TLS on port 587
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: cleanPassword,
    },
    tls: {
      rejectUnauthorized: true,
    },
    connectionTimeout: 7000, // 7 seconds (avoids hitting Vercel's 10s function kill limit)
    greetingTimeout: 7000,
    socketTimeout: 7000,
  });

  // Define email options
  const message = {
    from: `${process.env.FROM_NAME || 'Tablly'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html || options.message,
  };

  // Send the email
  const info = await transporter.sendMail(message);

  console.log('Message sent: %s', info.messageId);
  return info;
};

module.exports = sendEmail;
