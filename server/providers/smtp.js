// server/providers/smtp.js
// Generic SMTP provider via nodemailer. Works with Mailgun, Postmark, Mailtrap, etc.
// Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (true/false)
//           EMAIL_FROM, EMAIL_FROM_NAME

let nodemailer;
try {
  nodemailer = require('nodemailer');
  console.log('[email] Provider: SMTP (' + (process.env.SMTP_HOST || 'localhost') + ')');
} catch (e) {
  throw new Error('[email] SMTP selected but nodemailer is not installed. Run: npm run install-server');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM = process.env.EMAIL_FROM || 'noreply@idlookup.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'IDLookup';

async function send({ to, subject, html }) {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM}>`,
    to,
    subject,
    html,
  });
}

module.exports = { send };
