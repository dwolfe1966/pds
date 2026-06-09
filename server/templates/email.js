// server/templates/email.js
// Returns HTML email strings for each transactional type.

function base(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#1a56db;padding:24px 32px;">
<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">IDLookup</span>
</td></tr>
<tr><td style="padding:32px;">${bodyHtml}</td></tr>
<tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 IDLookup. All rights reserved.</p>
<p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">
<a href="{{unsubscribe_url}}" style="color:#9ca3af;">Unsubscribe</a> ·
<a href="{{privacy_url}}" style="color:#9ca3af;">Privacy Policy</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function welcomeEmail(user) {
  const name = user.fullName ? user.fullName.split(' ')[0] : 'there';
  return base('Welcome to IDLookup', `
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Welcome, ${name}!</h2>
<p style="margin:0 0 16px;color:#374151;line-height:1.6;">Your IDLookup account is ready. You now have access to our database of over 247 million records.</p>
<p style="margin:0 0 24px;color:#374151;line-height:1.6;">Start searching for people by name, phone number, or email address.</p>
<a href="${APP_URL}/dashboard" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#6b7280;font-size:14px;">Need help? Reply to this email or visit our support center.</p>
`);
}

function paymentConfirmationEmail(user, plan, opts = {}) {
  const name = user.fullName ? user.fullName.split(' ')[0] : 'there';
  const planName = plan || 'Pro';
  const amount = opts.price || '$29.99/mo';
  return base('Payment Confirmed — IDLookup', `
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Payment Confirmed</h2>
<p style="margin:0 0 16px;color:#374151;line-height:1.6;">Hi ${name}, your <strong>${planName}</strong> subscription is now active.</p>
<table width="100%" cellpadding="12" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin:0 0 24px;">
<tr><td style="color:#374151;font-size:14px;">Plan</td><td style="color:#111827;font-weight:600;text-align:right;">${planName}</td></tr>
<tr style="border-top:1px solid #e5e7eb;"><td style="color:#374151;font-size:14px;">Amount</td><td style="color:#111827;font-weight:600;text-align:right;">${amount}</td></tr>
<tr style="border-top:1px solid #e5e7eb;"><td style="color:#374151;font-size:14px;">Status</td><td style="color:#059669;font-weight:600;text-align:right;">Active</td></tr>
</table>
<a href="${APP_URL}/account" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View Account</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#6b7280;font-size:14px;">You can manage or cancel your subscription anytime from your account page.</p>
`);
}

function alertDigestEmail(user, alerts) {
  const name = user.fullName ? user.fullName.split(' ')[0] : 'there';
  const alertRows = (alerts || []).slice(0, 10).map(a =>
    `<tr style="border-top:1px solid #e5e7eb;">
      <td style="padding:10px 0;color:#374151;font-size:14px;">${a.name || a.keyword || 'Alert'}</td>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;text-align:right;">${a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</td>
    </tr>`
  ).join('');
  return base('Your Weekly Alert Digest — IDLookup', `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Weekly Digest</h2>
<p style="margin:0 0 24px;color:#374151;line-height:1.6;">Hi ${name}, here's a summary of your active alerts:</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><th style="text-align:left;padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Alert</th>
<th style="text-align:right;padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Created</th></tr>
${alertRows || '<tr><td colspan="2" style="padding:10px 0;color:#9ca3af;font-size:14px;">No active alerts.</td></tr>'}
</table>
<br>
<a href="${APP_URL}/alerts" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Manage Alerts</a>
`);
}

// --- Shared helpers for lifecycle templates ---------------------------------
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '833-861-9230';

function firstName(user) {
  return user && user.fullName ? user.fullName.split(' ')[0] : 'there';
}
function h2(t) {
  return `<h2 style="margin:0 0 16px;color:#111827;font-size:22px;">${t}</h2>`;
}
function p(t) {
  return `<p style="margin:0 0 16px;color:#374151;line-height:1.6;">${t}</p>`;
}
function button(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a>`;
}
const RULE = '<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">';
function fineprint(t) {
  return `<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">${t}</p>`;
}
function supportLine() {
  return fineprint(`Need help? Reply to this email or call ${SUPPORT_PHONE}, Monday–Friday, 9am–5pm ET.`);
}

// --- cancel ------------------------------------------------------------------
function cancelEmail(user, opts = {}) {
  const name = firstName(user);
  const orderNumber = opts.orderNumber || '';
  const accessEndDate = opts.accessEndDate || 'the end of your billing period';
  const reactivateUrl = opts.reactivateUrl || `${APP_URL}/account`;
  return base('Your IDLookup membership is canceled', `
${h2('Your membership is canceled')}
${p(`Hi ${name}, we've canceled the auto-renewal on your IDLookup membership${orderNumber ? ` (order #${orderNumber})` : ''}. You won't be charged again.`)}
${p(`Your access stays active until <strong>${accessEndDate}</strong>. Until then you can keep running searches and viewing reports — nothing changes until that date.`)}
${p(`Changed your mind? Turn renewal back on anytime before ${accessEndDate} and keep everything without interruption.`)}
${button(reactivateUrl, 'Reactivate Membership')}
${RULE}
${supportLine()}
`);
}

// --- optout request ----------------------------------------------------------
function optOutRequestEmail(opts = {}) {
  const email = opts.email || 'your address';
  const confirmUrl = opts.optOutConfirmUrl || '#';
  const requestId = opts.optOutRequestId || '';
  return base('Confirm your IDLookup opt-out request', `
${h2('Confirm your opt-out request')}
${p(`We received a request to remove information associated with <strong>${email}</strong> from IDLookup.AI search results.`)}
${p('To protect against fraudulent removals, please confirm this request within 48 hours:')}
${button(confirmUrl, 'Confirm Opt-Out')}
${p(`Once confirmed, your information will be removed from our search results within 48 hours${requestId ? ` (request ID: ${requestId})` : ''}.`)}
${RULE}
${fineprint('If you did not make this request, you can safely ignore this email — no changes will be made.')}
`);
}

// --- reset password ----------------------------------------------------------
function passwordResetEmail(user, opts = {}) {
  const name = firstName(user);
  const email = opts.email || (user && user.email) || 'your account';
  const resetUrl = opts.resetUrl || '#';
  return base('Reset your IDLookup password', `
${h2('Reset your password')}
${p(`Hi ${name}, we received a request to reset the password for your IDLookup account (${email}).`)}
${p('Click below to choose a new password. This link expires in 60 minutes.')}
${button(resetUrl, 'Reset Password')}
${RULE}
${fineprint("If you didn't request this, you can ignore this email — your password won't change. IDLookup will never ask for your password by phone or email.")}
`);
}

// --- signup (trial welcome) --------------------------------------------------
function signupEmail(user, opts = {}) {
  const name = firstName(user);
  const orderNumber = opts.orderNumber || '';
  const trialStartDate = opts.trialStartDate || 'today';
  const trialEndDate = opts.trialEndDate || 'your trial end date';
  const price = opts.price || '$49.98';
  const period = opts.period || '30 days';
  return base('Welcome to IDLookup.AI — your trial is active', `
${h2(`Welcome, ${name}!`)}
${p(`Your IDLookup.AI account is ready and your 7-day Unlimited Search trial is active as of ${trialStartDate}.`)}
${p('You now have access to over 247 million records. Search by name, phone, or email — and view up to 5 full reports per day.')}
${button(`${APP_URL}/dashboard`, 'Start Searching')}
${RULE}
${fineprint(`A quick note on billing: we charged $1.00 today${orderNumber ? ` (order #${orderNumber})` : ''} for your first report. If you do nothing, your trial converts to an Unlimited Search subscription on <strong>${trialEndDate}</strong> at ${price} every ${period}. Cancel anytime before then and you won't be charged again.`)}
<br>
${supportLine()}
`);
}

// --- uncancel ----------------------------------------------------------------
function uncancelEmail(user, opts = {}) {
  const name = firstName(user);
  const orderNumber = opts.orderNumber || '';
  const billingDate = opts.billingDate || 'your next billing date';
  const price = opts.price || '$49.98';
  return base("You're all set — your IDLookup membership is active again", `
${h2("You're all set!")}
${p(`Hi ${name}, we've reactivated auto-renewal on your IDLookup membership${orderNumber ? ` (order #${orderNumber})` : ''}. Your access continues without interruption.`)}
${p(`Your next billing date is <strong>${billingDate}</strong> at ${price}, and you'll keep full access to unlimited searches and up to 5 reports per day.`)}
${button(`${APP_URL}/dashboard`, 'Go to Dashboard')}
${RULE}
${supportLine()}
`);
}

// --- remarketing (winback drip, steps 1-4) -----------------------------------
// Targets lapsed trials (voluntary or failed-payment) and non-renewing subscribers.
const REMARKETING = {
  1: {
    subject: () => 'Your IDLookup searches are paused',
    heading: 'Your searches are paused',
    lead: (o) => `your IDLookup.AI access ended${o.accessEndDate ? ` on <strong>${o.accessEndDate}</strong>` : ''}, so your searches and saved reports are paused for now.`,
    detail: () => `The people you were looking up haven't gone anywhere — and our database of 247M+ records is updated constantly. Reactivate in one click and pick up right where you left off.`,
    cta: 'Reactivate Now',
    footer: () => `If there's anything we could have done better, just reply to this email — a real person reads every one.`,
  },
  2: {
    subject: (o) => o.searchSubject ? `Still searching for ${o.searchSubject}?` : 'Pick up where you left off',
    heading: 'Pick up where you left off',
    lead: () => `a lot can change in a public record in just a few days — new addresses, phone numbers, and relatives get added all the time.`,
    detail: (o) => `Your IDLookup.AI account is ready whenever you are. Reactivate for unlimited searches plus up to 5 full reports a day — just ${o.price || '$49.98'}/month, cancel anytime.`,
    cta: 'Reactivate Now',
    footer: () => `Questions before you come back? Call ${SUPPORT_PHONE}, Monday–Friday, 9am–5pm ET.`,
  },
  3: {
    subject: () => 'A special offer to bring you back to IDLookup',
    heading: "We'd love to have you back",
    lead: (o) => `for a limited time, reactivate your IDLookup.AI membership and get <strong>${o.winbackOffer || 'a special discount'}</strong> on your next billing cycle.`,
    detail: () => `That's full access to 247M+ records, unlimited searches, and up to 5 reports per day — at your lowest price yet.`,
    cta: 'Claim Your Offer',
    footer: (o) => o.offerExpiryDate ? `This offer expires ${o.offerExpiryDate}. After that, standard pricing applies.` : `This is a limited-time offer.`,
  },
  4: {
    subject: () => 'Last call — your IDLookup account closes soon',
    heading: 'Last call',
    lead: (o) => `this is the last time we'll reach out about your IDLookup.AI account${o.email ? ` (${o.email})` : ''}.`,
    detail: (o) => `If you'd like to keep your account and saved search history, reactivate${o.offerExpiryDate ? ` before <strong>${o.offerExpiryDate}</strong>` : ' now'}. After that we'll close the account to keep your data tidy — no hard feelings, and you're always welcome back.`,
    cta: 'Keep My Account',
    footer: () => `Prefer to stop these emails? <a href="{{unsubscribe_url}}" style="color:#6b7280;">Unsubscribe here</a>.`,
  },
};
function remarketingSubject(step, opts = {}) {
  const v = REMARKETING[step] || REMARKETING[1];
  return v.subject(opts);
}
function remarketingEmail(user, step = 1, opts = {}) {
  const name = firstName(user);
  const v = REMARKETING[step] || REMARKETING[1];
  const reactivateUrl = opts.reactivateUrl || `${APP_URL}/account`;
  return base(v.subject(opts), `
${h2(v.heading)}
${p(`Hi ${name}, ${v.lead(opts)}`)}
${p(v.detail(opts))}
${button(reactivateUrl, v.cta)}
${RULE}
${fineprint(v.footer(opts))}
`);
}

// --- message created ---------------------------------------------------------
function messageCreatedSubject(opts = {}) {
  return `New message about your IDLookup request — ${opts.messageSubject || 'your request'}`;
}
function messageCreatedEmail(user, opts = {}) {
  const name = firstName(user);
  const messageSubject = opts.messageSubject || 'your request';
  const messagePreview = opts.messagePreview || '';
  const threadUrl = opts.threadUrl || `${APP_URL}/account`;
  const preview = messagePreview
    ? `<table width="100%" cellpadding="16" cellspacing="0" style="background:#f9fafb;border-left:3px solid #1a56db;border-radius:6px;margin:0 0 24px;"><tr><td style="color:#374151;font-size:14px;font-style:italic;line-height:1.6;">${messagePreview}</td></tr></table>`
    : '';
  return base(messageCreatedSubject(opts), `
${h2('You have a new message')}
${p(`Hi ${name}, you have a new message on your IDLookup.AI support request regarding "<strong>${messageSubject}</strong>".`)}
${preview}
${button(threadUrl, 'View Message')}
${RULE}
${fineprint('You can also reply directly to this email and it will be added to your thread. Our team is available Monday–Friday, 9am–5pm ET.')}
`);
}

function broadcastEmail(subject, body) {
  const safeBody = body.replace(/\n/g, '<br>');
  return base(subject, `
<div style="color:#374151;line-height:1.7;">${safeBody}</div>
`);
}

module.exports = {
  welcomeEmail,
  paymentConfirmationEmail,
  alertDigestEmail,
  broadcastEmail,
  cancelEmail,
  optOutRequestEmail,
  passwordResetEmail,
  signupEmail,
  uncancelEmail,
  remarketingEmail,
  remarketingSubject,
  messageCreatedEmail,
  messageCreatedSubject,
};
