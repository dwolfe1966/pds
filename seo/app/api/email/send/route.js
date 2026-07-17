// POST /api/email/send — generic first-party campaign send (marketing/lifecycle; BC keeps transactional).
// App-key gated (it can send to arbitrary addresses). Suppression-aware + logged in sendCampaign.
// Body: { to, campaign, vars?, meta? }  OR  { to, subject, html, text?, meta? } for a pre-rendered send.
import { sendCampaign } from '../../../../lib/email/send.mjs';
import { checkAppKey, unauthorized } from '../../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

function cors(origin) {
  return {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export async function POST(req) {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || !body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.to))) {
    return new Response(JSON.stringify({ error: 'valid "to" required' }), { status: 400, headers });
  }
  try {
    const result = await sendCampaign({
      to: String(body.to),
      campaign: body.campaign || (body.subject ? 'adhoc' : undefined),
      vars: body.vars || {},
      subject: body.subject, html: body.html, text: body.text,
      meta: body.meta || {},
    });
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'send failed' }), { status: 500, headers });
  }
}
