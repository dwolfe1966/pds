// Renders each lifecycle email template (server/templates/email.js) with realistic
// sample data into a standalone, self-contained .html file under docs/email-previews/.
// These are PREVIEW artifacts — open in a browser or hand to an ESP for review.
// Re-run after editing templates: `node scripts/build-email-previews.js`.
const fs = require('fs');
const path = require('path');
const t = require('../server/templates/email');

const OUT = path.join(__dirname, '..', 'docs', 'email-previews');
fs.mkdirSync(OUT, { recursive: true });

// Sample data — clearly fictional, illustrative of every dynamic token.
const user = { fullName: 'Jordan Smith', email: 'jordan.smith@example.com' };
const sample = {
  cancel:        () => t.cancelEmail(user, { orderNumber: 'A1B2C3D4', accessEndDate: 'Jul 5, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'optout-request': () => t.optOutRequestEmail({ email: user.email, optOutConfirmUrl: 'https://idlookup.ai/opt-out/confirm?id=req_8f3a', optOutRequestId: 'req_8f3a2c' }),
  'reset-password': () => t.passwordResetEmail(user, { email: user.email, resetUrl: 'https://idlookup.ai/reset?token=sample' }),
  signup:        () => t.signupEmail(user, { orderNumber: 'A1B2C3D4', trialStartDate: 'Jun 5, 2026', trialEndDate: 'Jun 12, 2026' }),
  uncancel:      () => t.uncancelEmail(user, { orderNumber: 'A1B2C3D4', billingDate: 'Jul 5, 2026' }),
  'remarketing-1': () => t.remarketingEmail(user, 1, { accessEndDate: 'Jun 1, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-2': () => t.remarketingEmail(user, 2, { searchSubject: 'John Q. Public', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-3': () => t.remarketingEmail(user, 3, { winbackOffer: '50% off your first month', offerExpiryDate: 'Jun 30, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-4': () => t.remarketingEmail(user, 4, { email: user.email, offerExpiryDate: 'Jul 10, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'message-created': () => t.messageCreatedEmail(user, { messageSubject: 'Billing question', messagePreview: "Thanks for reaching out — we've reviewed your account and issued a refund of $49.98.", threadUrl: 'https://idlookup.ai/account' }),
};

// Footer tokens left as {{...}} in base() — fill with sample URLs for preview.
const fillTokens = (html) => html
  .replace(/\{\{unsubscribe_url\}\}/g, 'https://idlookup.ai/unsubscribe?e=sample')
  .replace(/\{\{privacy_url\}\}/g, 'https://idlookup.ai/privacy');

const order = Object.keys(sample);
let indexRows = '';
for (const name of order) {
  const html = fillTokens(sample[name]());
  const file = `${name}.html`;
  fs.writeFileSync(path.join(OUT, file), html, 'utf8');
  // pull the <title> for the index
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, name])[1];
  indexRows += `  <li><a href="${file}">${name}</a> — <span style="color:#6b7280">${title}</span></li>\n`;
  console.log('wrote', path.relative(path.join(__dirname, '..'), path.join(OUT, file)));
}

// A simple index to browse them all.
const index = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>IDLookup email previews</title>
<style>body{font-family:Arial,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;color:#111827}
h1{font-size:22px}li{margin:8px 0;line-height:1.5}a{color:#1a56db}</style></head>
<body><h1>IDLookup — lifecycle email previews</h1>
<p style="color:#6b7280">Sample-data renders of <code>server/templates/email.js</code>. Open any file in a browser.</p>
<ul>\n${indexRows}</ul></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), index, 'utf8');
console.log('wrote docs/email-previews/index.html');
console.log(`\nDone — ${order.length} email previews + index.`);
