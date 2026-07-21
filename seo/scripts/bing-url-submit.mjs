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

const urls = fs.readFileSync(FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 100);
console.log(`Bing URL submission — ${urls.length} URLs, dry=${dry}`);
console.log(`  sample: ${urls[0]} … ${urls[urls.length - 1]}`);

if (dry) { console.log('DRY RUN — no request sent.'); process.exit(0); }
if (!KEY) { console.error('✗ BING_WEBMASTER_KEY not set (Bing WMT → Settings → API access). Aborting.'); process.exit(1); }

const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${KEY}`;
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ siteUrl: SITE, urlList: urls }),
});
const text = await res.text().catch(() => '');
if (res.status === 200) {
  console.log(`✓ Submitted ${urls.length} URLs → HTTP 200`);
} else {
  console.error(`✗ HTTP ${res.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
