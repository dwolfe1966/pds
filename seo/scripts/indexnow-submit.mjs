// IndexNow submission — tell Bing (+ Yandex/Seznam via the shared endpoint) about our URLs.
//
// Usage:
//   node scripts/indexnow-submit.mjs                             # directory sitemap URLs (default)
//   node scripts/indexnow-submit.mjs --scope=directory           # same as default
//   node scripts/indexnow-submit.mjs --scope=directory --dry     # count + preview only, no POST
//   node scripts/indexnow-submit.mjs --scope=directory --max=50000  # cap the number submitted
//   node scripts/indexnow-submit.mjs --endpoint=https://www.bing.com/indexnow   # Bing-only endpoint
//
// The key file (app/<key>.txt/route.js) MUST be live at https://idlookup.me/<key>.txt first — the script
// verifies this and aborts if not (deploy the SEO app before submitting).
import { INDEXNOW_KEY } from '../app/6c3e1fbdcbb8c90fc1447f0420d19164.txt/route.js';

const HOST = 'idlookup.me';
const SITE = `https://${HOST}`;
const KEY_LOCATION = `${SITE}/${INDEXNOW_KEY}.txt`;
// Shared endpoint distributes to ALL participating engines (Bing included). Override with --endpoint.
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000;      // IndexNow hard cap per request
const PAUSE_MS = 1500;    // polite delay between batches

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const scope = args.scope || 'directory';
const endpoint = args.endpoint || DEFAULT_ENDPOINT;
const dry = !!args.dry;
const cap = args.max ? parseInt(args.max, 10) : Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'idlookup-indexnow/1.0' } });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return res.text();
}

async function collectUrls() {
  if (scope === 'conservative' || scope === 'full') {
    console.warn(`  scope=${scope} is retired; using sitemap-directory.xml instead`);
  }
  if (scope === 'directory' || scope === 'conservative' || scope === 'full') {
    // The QUALITY core — the single sitemap robots.txt points at. This is what to ping after adding
    // differentiated pages or refreshing the submitted directory set.
    return locs(await fetchText(`${SITE}/sitemap-directory.xml`));
  }
  throw new Error(`Unknown scope "${scope}". Use --scope=directory.`);
}

async function verifyKeyLive() {
  try {
    const res = await fetch(KEY_LOCATION);
    const body = (await res.text()).trim();
    if (res.ok && body === INDEXNOW_KEY) return true;
    console.error(`✗ Key file check failed: ${KEY_LOCATION} → HTTP ${res.status}, body "${body.slice(0, 40)}"`);
    return false;
  } catch (e) { console.error(`✗ Key file unreachable: ${e.message}`); return false; }
}

async function submitBatch(urlList) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.status === 200 || res.status === 202, text: text.slice(0, 200) };
}

(async () => {
  console.log(`IndexNow submit — scope=${scope}, endpoint=${endpoint}, dry=${dry}`);
  console.log(`  key=${INDEXNOW_KEY}  keyLocation=${KEY_LOCATION}`);

  let urls = await collectUrls();
  // De-dupe + keep only same-host absolute URLs (IndexNow rejects cross-host).
  urls = [...new Set(urls)].filter((u) => { try { return new URL(u).host === HOST; } catch { return false; } });
  if (Number.isFinite(cap)) urls = urls.slice(0, cap);
  console.log(`  collected ${urls.length} unique in-host URLs`);
  console.log(`  sample: ${urls.slice(0, 2).join('  ')}${urls.length > 2 ? '  …  ' + urls.slice(-1) : ''}`);
  if (!urls.length) { console.log('nothing to submit'); return; }

  if (dry) { console.log(`DRY RUN — would POST ${Math.ceil(urls.length / BATCH)} batch(es) of ≤${BATCH}. No request sent.`); return; }

  if (!(await verifyKeyLive())) {
    console.error('ABORT — deploy the SEO app so the key file is live, then re-run.');
    process.exit(1);
  }
  console.log(`✓ key file live at ${KEY_LOCATION}`);

  let sent = 0, okBatches = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const r = await submitBatch(batch);
    sent += batch.length; if (r.ok) okBatches++;
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: ${batch.length} URLs → HTTP ${r.status} ${r.ok ? 'OK' : 'FAIL ' + r.text}`);
    if (i + BATCH < urls.length) await sleep(PAUSE_MS);
  }
  console.log(`Done — submitted ${sent} URLs in ${Math.ceil(urls.length / BATCH)} batch(es), ${okBatches} accepted.`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
