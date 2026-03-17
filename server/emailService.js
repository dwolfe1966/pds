// server/emailService.js
// Provider-agnostic email service. All delivery is delegated to the active
// provider (selected by EMAIL_PROVIDER env var — see server/providers/index.js).
// Swapping providers requires only a .env change and server restart.

const templates = require('./templates/email');
const provider = require('./providers');

const emailLog = [];

async function _send(to, subject, html, type) {
  const entry = {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to,
    subject,
    type,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };
  try {
    await provider.send({ to, subject, html, type });
    emailLog.push(entry);
  } catch (err) {
    entry.status = 'failed';
    entry.error = err.message;
    emailLog.push(entry);
    console.error('[email] send failed:', err.message);
  }
  return entry;
}

async function sendWelcome(user) {
  return _send(user.email, 'Welcome to IDLookup!', templates.welcomeEmail(user), 'welcome');
}

async function sendPaymentConfirmation(user, plan) {
  return _send(user.email, 'Payment Confirmed — IDLookup', templates.paymentConfirmationEmail(user, plan), 'payment_confirmation');
}

async function sendAlertDigest(user, alerts) {
  return _send(user.email, 'Your Weekly Alert Digest — IDLookup', templates.alertDigestEmail(user, alerts), 'alert_digest');
}

async function sendBroadcast(recipients, subject, html) {
  const results = [];
  for (const user of recipients) {
    const r = await _send(user.email, subject, html, 'broadcast');
    results.push(r);
  }
  return results;
}

module.exports = { emailLog, sendWelcome, sendPaymentConfirmation, sendAlertDigest, sendBroadcast };
