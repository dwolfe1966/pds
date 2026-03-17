// server/providers/index.js
// Provider factory — selects email backend via EMAIL_PROVIDER env var.
//
// Supported values (case-insensitive):
//   console   — logs to stdout, no real sends (default in dev)
//   sendgrid  — SendGrid API (requires SENDGRID_API_KEY)
//   ses       — AWS SES (requires AWS_REGION + AWS credentials)
//   smtp      — Generic SMTP (requires SMTP_HOST, SMTP_USER, SMTP_PASS)
//
// To swap providers, change EMAIL_PROVIDER in .env and restart the server.
// No other code needs to change.

const name = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

const registry = {
  console: () => require('./console'),
  sendgrid: () => require('./sendgrid'),
  ses: () => require('./ses'),
  smtp: () => require('./smtp'),
};

if (!registry[name]) {
  throw new Error(
    `[email] Unknown EMAIL_PROVIDER="${name}". Valid options: ${Object.keys(registry).join(', ')}`
  );
}

module.exports = registry[name]();
