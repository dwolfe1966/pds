// server/providers/sendgrid.js
// SendGrid provider. Requires @sendgrid/mail in server/node_modules.
// Env vars: SENDGRID_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME

let sgMail;
try {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('[email] Provider: SendGrid');
} catch (e) {
  throw new Error('[email] SendGrid selected but @sendgrid/mail is not installed. Run: npm run install-server');
}

const FROM = process.env.EMAIL_FROM || 'noreply@idlookup.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'IDLookup';

async function send({ to, subject, html }) {
  await sgMail.send({
    to,
    from: { email: FROM, name: FROM_NAME },
    subject,
    html,
  });
}

module.exports = { send };
