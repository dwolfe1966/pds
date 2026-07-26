// /api/email/unsubscribe?e=<email> — first-party CAN-SPAM unsubscribe for non-ASM providers (Resend).
//   GET  → add to suppression + render a small confirmation page (the visible "Unsubscribe" link).
//   POST → RFC 8058 one-click (List-Unsubscribe-Post) → add to suppression, 200. Mail clients call this.
// Suppression is honored by isSuppressed() before every send. Never throws user-facing errors.
import { addSuppression } from '../../../../lib/email/emails-db.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAND = process.env.EMAIL_BRAND_NAME || 'IDLookup';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;">
<div style="max-width:480px;margin:12vh auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px 28px;text-align:center;">
  <div style="font-weight:800;color:#0d5d2f;font-size:20px;margin-bottom:16px;">${BRAND}</div>
  ${body}
</div></body></html>`;
}

async function suppress(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(em)) return false;
  try { await addSuppression(em, 'unsubscribe', 'email-link'); return true; } catch { return false; }
}

export async function GET(req) {
  const email = new URL(req.url).searchParams.get('e');
  const ok = await suppress(email);
  const body = ok
    ? `<h1 style="font-size:19px;color:#0f172a;margin:0 0 10px;">You're unsubscribed</h1>
       <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">You won't receive further marketing emails from ${BRAND}. Account and billing notices may still be sent.</p>`
    : `<h1 style="font-size:19px;color:#0f172a;margin:0 0 10px;">Unsubscribe link invalid</h1>
       <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">We couldn't process this request. Please contact support if you keep receiving emails.</p>`;
  return new Response(page('Unsubscribe', body), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(req) {
  // One-click (List-Unsubscribe-Post). Email is in the query per the header URL we emit.
  const email = new URL(req.url).searchParams.get('e');
  await suppress(email);
  return new Response(null, { status: 200 });
}
