// Twilio Lookup v2 — line-type intelligence (carrier + line type) as a DESCRIPTIVE "line safety" signal for
// the reverse-phone "is this call safe?" flow (P2). Keys stay server-side (TWILIO_ACCOUNT_SID / _AUTH_TOKEN).
//
// Compliance: we surface line type + carrier + a DESCRIPTIVE risk band derived from line type — never a crowd
// "reported as spam by N users" assertion (Twilio doesn't provide that, and our framing line requires
// descriptive, not an eligibility/risk assertion about the owner). sms_pumping_risk (a fraud score) is
// optional and cost-gated behind TWILIO_SMS_PUMPING_RISK=1 (it's ~$0.03 vs ~$0.008 for line type).
//
// Returns { available:false, ... } (never throws) when keys are unset or the number is invalid, so the funnel
// degrades gracefully to the plain owner reveal.
//
// Cache-first (phoneIntelDb): a number's line type/carrier is stable, so the first lookup is stored in Neon
// and reused for later checks (teaser retries, repeat searches) without re-incurring Twilio cost.
import { getCachedPhoneIntel, setCachedPhoneIntel } from './phoneIntelDb.mjs';
import { tryConsumeService } from './serviceBudget.mjs';

const LOOKUP_BASE = 'https://lookups.twilio.com/v2/PhoneNumbers';

function toE164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return null;
}

// VoIP / toll-free / premium lines are disproportionately used for robocalls & spam — a DESCRIPTIVE property of
// the LINE, not a claim about the person. Mobile/landline read as ordinary.
const ELEVATED_TYPES = new Set(['voip', 'nonFixedVoip', 'tollFree', 'premium', 'sharedCost', 'uan']);
function riskFromType(type) {
  if (!type) return 'unknown';
  if (ELEVATED_TYPES.has(type)) return 'elevated';
  if (['mobile', 'landline', 'fixedVoip', 'personal'].includes(type)) return 'low';
  return 'unknown';
}

const EMPTY = { available: false, valid: null, lineType: null, carrier: null, riskLevel: 'unknown' };

export async function getPhoneIntel({ phone } = {}) {
  // Auth accepts EITHER a Twilio API Key pair (SK… + secret) OR the account (AC… + auth token). Lookup v2
  // isn't account-scoped in the URL, so API-Key Basic auth works without the Account SID. API Key preferred.
  const sid = process.env.TWILIO_API_KEY || process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN;
  const e164 = toE164(phone);
  if (!sid || !token || !e164) return EMPTY;

  const cached = await getCachedPhoneIntel(phone);
  if (cached) return cached;
  if (!(await tryConsumeService('twilio'))) return EMPTY; // daily Twilio Lookup spend cap reached → skip live call

  const fields = ['line_type_intelligence'];
  if (process.env.TWILIO_SMS_PUMPING_RISK === '1') fields.push('sms_pumping_risk');
  const url = `${LOOKUP_BASE}/${encodeURIComponent(e164)}?Fields=${fields.join(',')}`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) return EMPTY;
    const d = await res.json();
    const lti = d.line_type_intelligence || {};
    const type = lti.type || null;
    let riskLevel = riskFromType(type);
    const spr = d.sms_pumping_risk;
    if (spr && spr.carrier_risk_category === 'high') riskLevel = 'elevated';
    const result = {
      available: true,
      valid: d.valid !== false,
      lineType: type,                 // mobile | landline | voip | nonFixedVoip | tollFree | ...
      carrier: lti.carrier_name || null,
      riskLevel,                      // low | elevated | unknown  (descriptive)
    };
    await setCachedPhoneIntel(phone, result);
    return result;
  } catch {
    return EMPTY;
  }
}
