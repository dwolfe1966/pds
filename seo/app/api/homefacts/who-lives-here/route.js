// "Who lives here" — reverse-address → residents, as a PRIVACY-PRESERVING TEASER. Given a street address
// (from the address search), calls Enformion PersonSearch with an Addresses filter and returns ONLY masked
// data: a count and per-resident masked initials + age band. NEVER returns full names / PII — the real reveal
// happens in the gated people-search funnel (FCRA permission). Opted-out records are dropped entirely. Runs
// server-side, user-initiated (an address search), budget-guarded — never on a crawl.
import { tryConsumeEnformionLane } from '../../../../lib/enformionBudget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "1600 CONGRESS AVE, AUSTIN, TX, 78701" → { line1, line2 }
function splitAddress(addr) {
  const parts = String(addr || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { line1: parts[0], line2: parts.slice(1).join(', ') };
}
const initialsBand = (p) => {
  const nm = p.name && typeof p.name === 'object' ? p.name : {};
  const fi = String(nm.firstName || '').trim().slice(0, 1).toUpperCase();
  const li = String(nm.lastName || '').trim().slice(0, 1).toUpperCase();
  const age = typeof p.age === 'number' ? p.age : parseInt(p.age, 10);
  const band = Number.isFinite(age) && age > 0 ? `${Math.floor(age / 10) * 10}s` : null;
  return (fi || li) ? { initials: `${fi || '?'}. ${li || '?'}.`, band } : null;
};

export async function GET(request) {
  const addr = (new URL(request.url).searchParams.get('addr') || '').trim();
  const parts = splitAddress(addr);
  if (!parts) return Response.json({ count: 0, residents: [] });

  const APN = process.env.ENFORMION_AP_NAME, APP = process.env.ENFORMION_AP_PASSWORD;
  if (!APN || !APP) return Response.json({ count: 0, residents: [], unconfigured: true });

  // Budget guard — its OWN daily lane, isolated from the shared divorce/marriage cap so a burst of those can
  // never starve this teaser. Default 300/day if ENFORMION_WLH_DAILY_CAP is unset (demo-proof + cost-safe).
  const wlhCap = parseInt(process.env.ENFORMION_WLH_DAILY_CAP || '300', 10);
  if (!(await tryConsumeEnformionLane('wlh', wlhCap))) return Response.json({ count: 0, residents: [], budget: true });

  const base = (process.env.ENFORMION_API_URL || 'https://devapi.endato.com').replace(/\/$/, '');
  let data;
  try {
    const res = await fetch(`${base}/PersonSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'galaxy-ap-name': APN, 'galaxy-ap-password': APP, 'galaxy-search-type': 'Person' },
      body: JSON.stringify({ Addresses: [{ AddressLine1: parts.line1, AddressLine2: parts.line2 }], Page: 1, ResultsPerPage: 12 }),
      signal: AbortSignal.timeout(12000),
    });
    data = await res.json().catch(() => null);
    if (!res.ok || !data || data.isError) return Response.json({ count: 0, residents: [] });
  } catch { return Response.json({ count: 0, residents: [] }); }

  // Only NON-opted-out residents; mask everything.
  const persons = (Array.isArray(data.persons) ? data.persons : []).filter((p) => !p.isOptedOut);
  const residents = persons.map(initialsBand).filter(Boolean).slice(0, 6);
  return Response.json({ count: persons.length, residents }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
