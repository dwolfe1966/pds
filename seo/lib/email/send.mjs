// Provider-agnostic transactional/marketing email send + template rendering (independent of BC).
// PROVIDER is env-selected so we can swap ESPs without touching templates/crons.
// Env (Vercel → SEO project):
//   EMAIL_PROVIDER         'resend' | 'sendgrid' (default: auto — resend if RESEND_API_KEY set, else sendgrid)
//   RESEND_API_KEY         required when provider = resend
//   SENDGRID_API_KEY       required when provider = sendgrid
//   EMAIL_FROM             e.g. "IDLookup <alerts@e.idlookup.ai>"  (from-domain must be authenticated in the ESP)
//   EMAIL_BRAND_NAME       display name (default "IDLookup")
//   EMAIL_BASE_URL         consumer base (default "https://www.idlookup.ai")
//   EMAIL_ASM_GROUP_ID     SendGrid-only unsubscribe-group id (server-side unsub). Ignored by Resend.
//   EMAIL_UNSUBSCRIBE_URL  first-party unsubscribe endpoint (default idlookup.me/api/email/unsubscribe) — used
//                          by Resend + any non-ASM provider, and for the List-Unsubscribe header.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sgMail from '@sendgrid/mail';
import { isSuppressed, logSend } from './emails-db.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAND = process.env.EMAIL_BRAND_NAME || 'IDLookup';
const BASE = (process.env.EMAIL_BASE_URL || 'https://www.idlookup.ai').replace(/\/$/, '');

// Provider selection: explicit EMAIL_PROVIDER wins; otherwise prefer whichever key is present (resend first).
export const emailProvider = (process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'sendgrid')).toLowerCase();
// True when the selected provider has its key set. `hasSendgrid` kept as a back-compat alias (imported by the
// abandoned-recovery cron + sendCampaign as the "email enabled" gate).
export const hasEmail = emailProvider === 'resend' ? !!process.env.RESEND_API_KEY : !!process.env.SENDGRID_API_KEY;
export const hasSendgrid = hasEmail;
if (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let _tpl = null;
function template() {
  if (_tpl == null) _tpl = fs.readFileSync(path.join(DIR, 'checkout-abandoned.html'), 'utf8');
  return _tpl;
}

/** Build the resume link back into the unlock flow (login → member person detail). */
function unlockUrl(personId, stage) {
  const redirect = personId ? `/people/${encodeURIComponent(personId)}` : '/dashboard';
  const qs = new URLSearchParams({
    redirect,
    utm_source: 'email',
    utm_medium: 'abandoned_recovery',
    utm_campaign: stage === 'followup' ? 'checkout_abandoned_followup' : 'checkout_abandoned',
  });
  return `${BASE}/login?${qs.toString()}`;
}

// Unsubscribe link. Preferred path is a SendGrid ASM group: when EMAIL_ASM_GROUP_ID is set,
// emit SendGrid's substitution tag — it's replaced at send time with a working, per-recipient,
// group-aware one-click unsubscribe URL (and suppression is enforced server-side). The tag
// must NOT be HTML-escaped, so callers insert it raw. Fallback = our own /unsubscribe URL.
const ASM_UNSUB_TAG = '<%asm_group_unsubscribe_raw_url%>';
// ASM is a SendGrid-only feature; ignore any stale EMAIL_ASM_GROUP_ID when the provider is Resend.
function usingAsm() { return emailProvider === 'sendgrid' && !!process.env.EMAIL_ASM_GROUP_ID; }
function unsubscribeUrl(email) {
  if (usingAsm()) return ASM_UNSUB_TAG;
  return unsubEndpoint(email); // real first-party endpoint (Resend / non-ASM)
}

/** Target person card (Name / Age / Location) — only when we know a name. */
function targetCard(target) {
  const name = target && target.name ? String(target.name).trim() : '';
  if (!name) return '';
  const bits = [];
  if (target.age) bits.push(`Age ${esc(target.age)}`);
  if (target.location) bits.push(esc(target.location));
  const sub = bits.length
    ? `<div style="font-size:14px;color:#475569;margin-top:4px;">${bits.join(' &nbsp;·&nbsp; ')}</div>`
    : '';
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;width:100%;">
            <tr><td style="border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Your report on</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;">${esc(name)}</div>
              ${sub}
            </td></tr>
          </table>`;
}

/**
 * Render the abandoned-checkout recovery email.
 * @param {object} row  { email, person_id, meta }  (meta = { recipientName, target:{name,age,location} })
 * @param {'first'|'followup'} stage
 * @returns {{ subject, html, text }}
 */
export function renderCheckoutAbandoned(row, stage = 'first') {
  const meta = (row && row.meta && typeof row.meta === 'object') ? row.meta : {};
  const firstName = (meta.recipientName || '').toString().trim();
  const target = meta.target || null;
  const targetName = target && target.name ? String(target.name).trim() : '';

  // Copy branches on whether we know a target person. With a target it's a report-unlock
  // recovery ("unlock your report on John"); with no target (general/promo signup abandon,
  // no report exists yet) it's an honest account-activation nudge — no phantom "report".
  const namePrefix = firstName ? `${firstName}, ` : '';
  let subject, headline, bodyIntro, ctaLabel;
  if (targetName) {
    headline = `You're one step away on ${esc(targetName)}`;
    ctaLabel = 'Unlock My Report →';
    if (stage === 'followup') {
      subject = `${namePrefix}${targetName}'s report is still waiting`;
      bodyIntro = `your report on ${esc(targetName)} is still ready — you didn't finish checkout. Pick up right where you left off.`;
    } else {
      subject = `${namePrefix}unlock your report on ${targetName}`;
      bodyIntro = `you started your report but didn't finish checkout. The results are compiled and ready — pick up right where you left off.`;
    }
  } else {
    headline = "You're almost set up";
    ctaLabel = 'Finish Setting Up →';
    if (stage === 'followup') {
      subject = `${namePrefix}your account is almost ready`;
      bodyIntro = `your IDLookup account is almost ready — just finish checkout to activate it and start running searches.`;
    } else {
      subject = `${namePrefix}finish setting up your account`;
      bodyIntro = `you're almost set up. Finish checkout to activate your account and start running unlimited people searches.`;
    }
  }
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);

  // ASM tag must go in raw (it's a SendGrid token, not a literal URL); a real URL is escaped.
  const unsub = unsubscribeUrl(row.email);
  const unsubHtml = usingAsm() ? unsub : esc(unsub);

  const html = template()
    .replace(/\{\{brandName\}\}/g, esc(BRAND))
    .replace(/\{\{firstName\}\}/g, esc(firstName || 'there'))
    .replace(/\{\{headline\}\}/g, headline)
    .replace(/\{\{bodyIntro\}\}/g, bodyIntro)
    .replace(/\{\{ctaLabel\}\}/g, esc(ctaLabel))
    .replace(/\{\{targetCard\}\}/g, targetCard(target))
    .replace(/\{\{unlockUrl\}\}/g, esc(unlockUrl(row.person_id, stage)))
    .replace(/\{\{unsubscribeUrl\}\}/g, unsubHtml);

  // Plaintext part mirrors the HTML copy (bodyIntro is HTML-escaped for the markup; unescape
  // the couple of entities we introduce so the text part reads clean).
  const bodyIntroText = bodyIntro.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const text = [
    `Hi ${firstName || 'there'},`,
    '',
    bodyIntroText,
    targetName ? `\nYour report on: ${targetName}${target.age ? ` (Age ${target.age})` : ''}${target.location ? ` — ${target.location}` : ''}` : '',
    '',
    `${targetName ? 'Unlock it here' : 'Finish here'}: ${unlockUrl(row.person_id, stage)}`,
    '',
    `Secure checkout · Cancel anytime · Instant access`,
    '',
    `Unsubscribe: ${usingAsm() ? '(one-click link in the email)' : unsubscribeUrl(row.email)}`,
  ].filter((l) => l !== '').join('\n');

  return { subject, html, text };
}

// Absolute first-party unsubscribe endpoint (SEO app) — real URL for the List-Unsubscribe header and for
// non-ASM providers' visible link. Defaults to the SEO Vercel app where the suppression DB + handler live.
function unsubEndpoint(email) {
  const base = process.env.EMAIL_UNSUBSCRIBE_URL || 'https://idlookup.me/api/email/unsubscribe';
  return `${base}${base.includes('?') ? '&' : '?'}e=${encodeURIComponent(email || '')}`;
}

/** Send one email via the selected provider. Throws if the provider key is missing. Returns a SendGrid-shaped
 *  array ([{ headers: { 'x-message-id' } }]) so callers can extract a provider id uniformly. */
export async function sendEmail({ to, subject, html, text }) {
  if (!hasEmail) throw new Error(`${emailProvider} not configured`);
  const from = process.env.EMAIL_FROM || `${BRAND} <alerts@e.idlookup.ai>`;

  if (emailProvider === 'resend') {
    // Resend has no ASM; add RFC 8058 one-click List-Unsubscribe (Gmail/Yahoo bulk requirement) pointing at
    // our first-party endpoint. Suppression is enforced our side (isSuppressed) before every send.
    const unsub = unsubEndpoint(to);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to, subject, html, text,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`resend ${res.status}: ${String(t).slice(0, 200)}`); }
    const d = await res.json().catch(() => ({}));
    return [{ statusCode: res.status, headers: { 'x-message-id': (d && d.id) || null } }];
  }

  // sendgrid
  if (!process.env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not set');
  const msg = { to, from, subject, html, text };
  const asm = process.env.EMAIL_ASM_GROUP_ID;
  if (asm) msg.asm = { groupId: Number(asm) };
  return sgMail.send(msg);
}

// ── Platform layer: shared layout + suppression-aware, logged campaign send ──────────────────────

/** Shared, responsive HTML chrome every non-abandoned campaign renders into (single source of truth
 *  for brand header, footer, and the CAN-SPAM unsubscribe line). */
export function renderLayout({ preheader = '', bodyHtml, unsubHtml, footerNote = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
  <tr><td style="padding:18px 24px;border-bottom:1px solid #eef2f7;"><span style="font-weight:800;color:#0d5d2f;font-size:18px;">${esc(BRAND)}</span></td></tr>
  <tr><td style="padding:24px;">${bodyHtml}</td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.6;">
    ${footerNote ? `${esc(footerNote)}<br>` : ''}
    You're receiving this because you have an ${esc(BRAND)} account. <a href="${unsubHtml}" style="color:#64748b;">Unsubscribe</a>.
  </td></tr>
</table></td></tr></table></body></html>`;
}

/** WELCOME lifecycle email — the first new campaign proving the generalized platform. */
export function renderWelcome({ firstName, email } = {}) {
  const name = (firstName || '').toString().trim();
  const unsub = unsubscribeUrl(email);
  const unsubHtml = usingAsm() ? unsub : esc(unsub);
  const cta = `${BASE}/dashboard?utm_source=email&utm_medium=lifecycle&utm_campaign=welcome`;
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Welcome${name ? `, ${esc(name)}` : ''} 👋</h1>
    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">Your ${esc(BRAND)} account is ready. Two things worth doing first:</p>
    <ul style="margin:0 0 18px;padding-left:18px;color:#334155;font-size:15px;line-height:1.7;">
      <li><strong>See who's searching for you</strong> — confirm your identity to reveal it.</li>
      <li><strong>Check your exposure</strong> — see what's public and control it.</li>
    </ul>
    <a href="${esc(cta)}" style="display:inline-block;background:#0d5d2f;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:15px;">Go to your dashboard →</a>`;
  const html = renderLayout({ preheader: 'Your account is ready — see who’s searching for you.', bodyHtml: body, unsubHtml });
  const text = [`Welcome${name ? `, ${name}` : ''}!`, '', `Your ${BRAND} account is ready.`, '',
    '• See who\'s searching for you — confirm your identity to reveal it.', '• Check your exposure — see what\'s public and control it.', '',
    `Dashboard: ${cta}`].join('\n');
  return { subject: `Welcome to ${BRAND}${name ? `, ${name}` : ''}`, html, text };
}

// Campaign registry — render(vars) → {subject,html,text}. Add lifecycle flows here.
const CAMPAIGNS = { welcome: renderWelcome };

/**
 * Suppression-aware, logged send. Either pass a registered `campaign` + `vars` (rendered here), or a
 * pre-rendered {subject,html,text}. Suppressed recipients are logged + skipped (never sent). Returns
 * { status: 'sent'|'suppressed'|'error'|'disabled' }.
 */
export async function sendCampaign({ to, campaign, vars = {}, subject, html, text, meta = {} }) {
  if (!hasSendgrid) return { status: 'disabled' };
  if (await isSuppressed(to)) {
    await logSend({ email: to, campaign, subject, status: 'suppressed', meta });
    return { status: 'suppressed' };
  }
  let payload = { subject, html, text };
  if (campaign && CAMPAIGNS[campaign]) payload = CAMPAIGNS[campaign]({ ...vars, email: to });
  if (!payload.subject || !payload.html) return { status: 'error' };
  try {
    const res = await sendEmail({ to, subject: payload.subject, html: payload.html, text: payload.text });
    const providerId = res && res[0] && res[0].headers && res[0].headers['x-message-id'];
    await logSend({ email: to, campaign, subject: payload.subject, status: 'sent', providerId, meta });
    return { status: 'sent', providerId };
  } catch (e) {
    await logSend({ email: to, campaign, subject: payload.subject, status: 'error', meta: { ...meta, error: String(e && e.message || e) } });
    return { status: 'error' };
  }
}
