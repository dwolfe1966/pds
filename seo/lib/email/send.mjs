// SendGrid send + template rendering for our own marketing emails (independent of BC).
// Env (Vercel → SEO project):
//   SENDGRID_API_KEY       required to actually send
//   EMAIL_FROM             e.g. "IDLookup <alerts@e.idlookup.ai>"
//   EMAIL_BRAND_NAME       display name (default "IDLookup")
//   EMAIL_BASE_URL         consumer base (default "https://www.idlookup.ai")
//   EMAIL_ASM_GROUP_ID     optional SendGrid unsubscribe-group id (recommended for CAN-SPAM)
//   EMAIL_UNSUBSCRIBE_URL  fallback unsubscribe link when no ASM group
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sgMail from '@sendgrid/mail';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAND = process.env.EMAIL_BRAND_NAME || 'IDLookup';
const BASE = (process.env.EMAIL_BASE_URL || 'https://www.idlookup.ai').replace(/\/$/, '');

export const hasSendgrid = !!process.env.SENDGRID_API_KEY;
if (hasSendgrid) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
function usingAsm() { return !!process.env.EMAIL_ASM_GROUP_ID; }
function unsubscribeUrl(email) {
  if (usingAsm()) return ASM_UNSUB_TAG;
  const base = process.env.EMAIL_UNSUBSCRIBE_URL || `${BASE}/unsubscribe`;
  return `${base}${base.includes('?') ? '&' : '?'}e=${encodeURIComponent(email || '')}`;
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

/** Send one email via SendGrid. Throws if no API key. Returns SendGrid response. */
export async function sendEmail({ to, subject, html, text }) {
  if (!hasSendgrid) throw new Error('SENDGRID_API_KEY not set');
  const from = process.env.EMAIL_FROM || `${BRAND} <alerts@e.idlookup.ai>`;
  const msg = { to, from, subject, html, text };
  const asm = process.env.EMAIL_ASM_GROUP_ID;
  if (asm) msg.asm = { groupId: Number(asm) };
  return sgMail.send(msg);
}
