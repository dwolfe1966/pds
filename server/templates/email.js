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
<a href="http://localhost:3000/dashboard" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#6b7280;font-size:14px;">Need help? Reply to this email or visit our support center.</p>
`);
}

function paymentConfirmationEmail(user, plan) {
  const name = user.fullName ? user.fullName.split(' ')[0] : 'there';
  const planName = plan || 'Pro';
  return base('Payment Confirmed — IDLookup', `
<h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Payment Confirmed</h2>
<p style="margin:0 0 16px;color:#374151;line-height:1.6;">Hi ${name}, your <strong>${planName}</strong> subscription is now active.</p>
<table width="100%" cellpadding="12" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin:0 0 24px;">
<tr><td style="color:#374151;font-size:14px;">Plan</td><td style="color:#111827;font-weight:600;text-align:right;">${planName}</td></tr>
<tr style="border-top:1px solid #e5e7eb;"><td style="color:#374151;font-size:14px;">Amount</td><td style="color:#111827;font-weight:600;text-align:right;">$29.99/mo</td></tr>
<tr style="border-top:1px solid #e5e7eb;"><td style="color:#374151;font-size:14px;">Status</td><td style="color:#059669;font-weight:600;text-align:right;">Active</td></tr>
</table>
<a href="http://localhost:3000/account" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View Account</a>
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
<a href="http://localhost:3000/alerts" style="display:inline-block;background:#1a56db;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Manage Alerts</a>
`);
}

function broadcastEmail(subject, body) {
  const safeBody = body.replace(/\n/g, '<br>');
  return base(subject, `
<div style="color:#374151;line-height:1.7;">${safeBody}</div>
`);
}

module.exports = { welcomeEmail, paymentConfirmationEmail, alertDigestEmail, broadcastEmail };
