// Renders each lifecycle email template (server/templates/email.js) into standalone
// .html files under docs/email-previews/. Produces TWO sets:
//   docs/email-previews/<name>.html            → filled with realistic SAMPLE data
//   docs/email-previews/with-tokens/<name>.html → dynamic values left as {{tokens}}
// The token set is for an ESP / merge-field handoff; the sample set is for visual
// review. Re-run after editing templates: `node scripts/build-email-previews.js`.
process.env.APP_URL = process.env.APP_URL || 'https://idlookup.ai'; // prod links in previews
const fs = require('fs');
const path = require('path');
const t = require('../server/templates/email');

const OUT = path.join(__dirname, '..', 'docs', 'email-previews');
const OUT_TOK = path.join(OUT, 'with-tokens');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT_TOK, { recursive: true });

// ---- SAMPLE data (realistic, clearly fictional) ----------------------------
const sUser = { fullName: 'Jordan Smith', email: 'jordan.smith@example.com' };
const sampleSet = {
  cancel:           () => t.cancelEmail(sUser, { orderNumber: 'A1B2C3D4', accessEndDate: 'Jul 5, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'optout-request': () => t.optOutRequestEmail({ email: sUser.email, optOutConfirmUrl: 'https://idlookup.ai/opt-out/confirm?id=req_8f3a', optOutRequestId: 'req_8f3a2c' }),
  'reset-password': () => t.passwordResetEmail(sUser, { email: sUser.email, resetUrl: 'https://idlookup.ai/reset?token=sample' }),
  signup:           () => t.signupEmail(sUser, { orderNumber: 'A1B2C3D4', trialStartDate: 'Jun 5, 2026', trialEndDate: 'Jun 12, 2026' }),
  uncancel:         () => t.uncancelEmail(sUser, { orderNumber: 'A1B2C3D4', billingDate: 'Jul 5, 2026' }),
  'remarketing-1':  () => t.remarketingEmail(sUser, 1, { accessEndDate: 'Jun 1, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-2':  () => t.remarketingEmail(sUser, 2, { searchSubject: 'John Q. Public', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-3':  () => t.remarketingEmail(sUser, 3, { winbackOffer: '50% off your first month', offerExpiryDate: 'Jun 30, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'remarketing-4':  () => t.remarketingEmail(sUser, 4, { email: sUser.email, offerExpiryDate: 'Jul 10, 2026', reactivateUrl: 'https://idlookup.ai/account' }),
  'message-created':() => t.messageCreatedEmail(sUser, { messageSubject: 'Billing question', messagePreview: "Thanks for reaching out — we've reviewed your account and issued a refund of $49.98.", threadUrl: 'https://idlookup.ai/account' }),
};

// ---- TOKEN data (merge fields preserved as {{...}}) ------------------------
// Passing token strings as the template args renders them where values go.
// firstName(user) does fullName.split(' ')[0]; a token has no space so it survives.
const kUser = { fullName: '{{first_name}}', email: '{{email}}' };
const tokenSet = {
  cancel:           () => t.cancelEmail(kUser, { orderNumber: '{{order_number}}', accessEndDate: '{{access_end_date}}', reactivateUrl: '{{reactivate_url}}' }),
  'optout-request': () => t.optOutRequestEmail({ email: '{{email}}', optOutConfirmUrl: '{{optout_confirm_url}}', optOutRequestId: '{{optout_request_id}}' }),
  'reset-password': () => t.passwordResetEmail(kUser, { email: '{{email}}', resetUrl: '{{reset_url}}' }),
  signup:           () => t.signupEmail(kUser, { orderNumber: '{{order_number}}', trialStartDate: '{{trial_start_date}}', trialEndDate: '{{trial_end_date}}' }),
  uncancel:         () => t.uncancelEmail(kUser, { orderNumber: '{{order_number}}', billingDate: '{{billing_date}}' }),
  'remarketing-1':  () => t.remarketingEmail(kUser, 1, { accessEndDate: '{{access_end_date}}', reactivateUrl: '{{reactivate_url}}' }),
  'remarketing-2':  () => t.remarketingEmail(kUser, 2, { searchSubject: '{{search_subject}}', reactivateUrl: '{{reactivate_url}}' }),
  'remarketing-3':  () => t.remarketingEmail(kUser, 3, { winbackOffer: '{{winback_offer}}', offerExpiryDate: '{{offer_expiry_date}}', reactivateUrl: '{{reactivate_url}}' }),
  'remarketing-4':  () => t.remarketingEmail(kUser, 4, { email: '{{email}}', offerExpiryDate: '{{offer_expiry_date}}', reactivateUrl: '{{reactivate_url}}' }),
  'message-created':() => t.messageCreatedEmail(kUser, { messageSubject: '{{message_subject}}', messagePreview: '{{message_preview}}', threadUrl: '{{message_thread_url}}' }),
};

// Footer tokens left as {{...}} by base(). Sample set fills them; token set keeps them.
const fillFooter = (html) => html
  .replace(/\{\{unsubscribe_url\}\}/g, 'https://idlookup.ai/unsubscribe?e=sample')
  .replace(/\{\{privacy_url\}\}/g, 'https://idlookup.ai/privacy');

const names = Object.keys(sampleSet);
const sampleRows = [], tokenRows = [];
for (const name of names) {
  const sampleHtml = fillFooter(sampleSet[name]());
  fs.writeFileSync(path.join(OUT, `${name}.html`), sampleHtml, 'utf8');
  const tokenHtml = tokenSet[name](); // keep {{unsubscribe_url}}/{{privacy_url}} as tokens too
  fs.writeFileSync(path.join(OUT_TOK, `${name}.html`), tokenHtml, 'utf8');
  const title = (sampleHtml.match(/<title>([^<]*)<\/title>/) || [, name])[1];
  sampleRows.push(`  <li><a href="${name}.html">${name}</a> — <span style="color:#6b7280">${title}</span></li>`);
  tokenRows.push(`  <li><a href="with-tokens/${name}.html">${name}</a></li>`);
  console.log('wrote', `${name}.html`, '+', `with-tokens/${name}.html`);
}

const index = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>IDLookup email previews</title>
<style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#111827}
h1{font-size:22px}h2{font-size:16px;margin-top:28px}li{margin:7px 0;line-height:1.5}a{color:#1a56db}
.cols{display:flex;gap:48px;flex-wrap:wrap}.cols>div{flex:1;min-width:260px}code{background:#f3f4f6;padding:1px 4px;border-radius:3px}</style></head>
<body><h1>IDLookup — lifecycle email previews</h1>
<p style="color:#6b7280">Renders of <code>server/templates/email.js</code>. Two sets per email.</p>
<div class="cols">
<div><h2>Sample data (visual review)</h2><ul>\n${sampleRows.join('\n')}\n</ul></div>
<div><h2>With {{variables}} (ESP / merge fields)</h2><ul>\n${tokenRows.join('\n')}\n</ul></div>
</div></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), index, 'utf8');
console.log(`\nDone — ${names.length} emails × 2 sets (sample + tokens) + index.`);
