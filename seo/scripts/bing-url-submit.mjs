// Submit priority URLs to Bing's URL Submission API (100/day quota, GUARANTEED processing — unlike
// IndexNow, which Bing processes at its discretion). Reads seo/bing-priority-urls.txt (from
// gen-bing-priority-urls.mjs). Needs a Bing Webmaster API key: Bing Webmaster Tools → Settings → API
// access → generate key. Set BING_WEBMASTER_KEY (env or .env.local).
//
// Usage:
//   node --env-file=.env.local scripts/bing-url-submit.mjs           # submit the file
//   node --env-file=.env.local scripts/bing-url-submit.mjs --dry     # preview only
import fs from 'node:fs';

const SITE = 'https://idlookup.me';
const KEY = process.env.BING_WEBMASTER_KEY || process.env.BING_API_KEY;
const dry = process.argv.includes('--dry');
const FILE = new URL('../bing-priority-urls.txt', import.meta.url);

// URLs are pre-sorted highest-value first (root → state hubs → county hubs → name-in-state), so when the
// daily quota is smaller than the list we submit the TOP-N that fit.
const allUrls = fs.readFileSync(FILE, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s.startsWith('http')).slice(0, 100);
console.log(`Bing URL submission — ${allUrls.length} candidate URLs, dry=${dry}`);

if (dry) { console.log(`  sample: ${allUrls[0]} … ${allUrls[allUrls.length - 1]}\nDRY RUN — no request sent.`); process.exit(0); }
if (!KEY) { console.error('✗ BING_WEBMASTER_KEY not set (Bing WMT → Settings → API access). Aborting.'); process.exit(1); }

// Bing's daily URL-submission quota is site-specific (small for young domains, grows with authority).
// Check it so we submit only what fits instead of a whole-batch rejection.
let daily = allUrls.length;
try {
  const q = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUrlSubmissionQuota?apikey=${KEY}&siteUrl=${encodeURIComponent(SITE)}`);
  const qj = await q.json().catch(() => null);
  const rem = qj?.d?.DailyQuota;
  if (Number.isFinite(rem)) { daily = rem; console.log(`  daily quota remaining: ${rem}`); }
} catch { /* fall back to submitting the full list */ }

const urls = allUrls.slice(0, Math.max(0, daily));
if (!urls.length) { console.log('Daily quota exhausted — nothing to submit today.'); process.exit(0); }

const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${KEY}`;
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ siteUrl: SITE, urlList: urls }),
});
const text = await res.text().catch(() => '');
if (res.status === 200) {
  console.log(`✓ Submitted top ${urls.length} URLs → HTTP 200`);
} else {
  console.error(`✗ HTTP ${res.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
