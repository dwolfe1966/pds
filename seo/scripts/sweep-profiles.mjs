#!/usr/bin/env node
/**
 * sweep-profiles.mjs — the scalable populate process.
 *
 * Drives the REAL prod IIFE in a Playwright browser (which clears Cloudflare
 * Turnstile where a raw server fetch 412s), sweeping the ranked name queue ×
 * all 50 states, adapting each teaser, and UPSERTING into Neon Postgres by the
 * stable public id. Resumable (skips name×state already in sweep_log),
 * rate-limited, idempotent.
 *
 * Requires DATABASE_URL. Turnstile may throw an interactive challenge under
 * load — run HEADED=1 so a human can solve it; the script pauses on a failure
 * burst and resumes.
 *
 *   DATABASE_URL=... HEADED=1 node seo/scripts/sweep-profiles.mjs --names 50
 *   DATABASE_URL=... node seo/scripts/sweep-profiles.mjs --names 25 --states CA,TX,NY --limit 500
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { adaptTeaserResponse } from './lib/adapt-teaser.mjs';
import { hasDb, dbUpsertProfile, dbLogSweep, dbSweptSet, dbCount } from '../lib/db.mjs';

const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const NAMES_N = parseInt(arg('--names') || '50', 10);
const LIMIT = parseInt(arg('--limit') || '1000000', 10);
const TARGET = parseInt(arg('--target') || '0', 10); // stop once the DB reaches this many profiles
const STATES = arg('--states') ? arg('--states').split(',').map((s) => s.trim().toUpperCase()) : ALL_STATES;
const HEADED = process.env.HEADED === '1';
// SLOW by default — pacing is what keeps Turnstile passing invisibly. ~1 call / 4.5s.
const DELAY = parseInt(process.env.SWEEP_DELAY_MS || '4500', 10);

if (!hasDb) { console.error('✗ Set DATABASE_URL (the Neon connection string) first.'); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function* topNames(n) {
  const file = path.join(HERE, '..', 'data', 'name-pairs.ndjson');
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let c = 0;
  for await (const line of rl) {
    if (!line.trim() || c >= n) break;
    const { first, last } = JSON.parse(line);
    yield { first, last }; c++;
  }
}

// Runs IN THE BROWSER: one teaser, returns trimmed identities the adapter needs.
function inPageTeaser({ first, last, state }) {
  const w = window.ApiWrapper.getInstance({ endpointUrl: '/api' });
  const CK = ['isCriminal','criminalCount','isPropertyOwner','propertyCount','hasForeclosure','foreclosureCount','hasBankruptcy','bankruptcyCount','hasLien','lienCount','hasJudgment','judgmentCount','hasVehicle','vehicleCount','hasAircraft','aircraftCount','hasAssociatedBusiness','associatedBusinessCount','hasProfessionalLicense','professionalLicenseCount','hasEmployment','employmentCount','emailCount','phoneCount','addressCount','relativeCount','hasRelatives'];
  return w.api.idLookup.searchTeaser({ type: 'name', fName: first, lName: last, state, contextKey: 'sale.name.teaser' }).then((res) => {
    const failed = res && res.getFailedCode ? res.getFailedCode() : null;
    const d = res && res.getData ? res.getData() : res;
    const t = (d && d.commerceContent && d.commerceContent.raws && d.commerceContent.raws[0] && d.commerceContent.raws[0].transient) || (d && d.raws && d.raws[0] && d.raws[0].transient) || {};
    const ids = (t.identities || []).map((i) => { const o = {
      nameList: (i.nameList || []).map((n) => ({ data: n.data, first: n.first, last: n.last, middle: n.middle, meta: { firstSeen: n.meta && n.meta.firstSeen } })),
      dobList: (i.dobList || []).map((x) => ({ age: x.age })),
      addressList: (i.addressList || []).map((a) => ({ city: a.city, state: a.state })),
      relationshipList: (i.relationshipList || []).map((r) => ({ name: { first: r.name && r.name.first, last: r.name && r.name.last }, relationshipName: r.relationshipName })),
      extId: 'x' }; CK.forEach((k) => (o[k] = i[k])); return o; });
    return { failed, total: t.total || 0, identities: ids };
  }).catch((e) => ({ failed: 'ERR', total: 0, identities: [], err: String(e && e.message || e) }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser = null, page = null;

// (Re)establish a trusted browser session. Retries FOREVER with backoff — so the
// run rides through a Turnstile flag / IP cooldown instead of dying.
async function ensureSession() {
  for (let attempt = 1; ; attempt++) {
    try {
      if (browser) { try { await browser.close(); } catch { /* ignore */ } }
      browser = await chromium.launch({ headless: !HEADED });
      page = await browser.newPage();
      await page.goto('https://www.idlookup.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!window.ApiWrapper, { timeout: 25000 });
      if (attempt > 1) console.log('  ✓ session re-established');
      return;
    } catch (e) {
      const wait = Math.min(60000 * attempt, 300000); // 1min → 5min cap
      console.warn(`  session launch failed (attempt ${attempt}: ${String(e.message).slice(0, 70)}) — likely Turnstile/cooldown; waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

(async () => {
  const swept = await dbSweptSet();
  const startCount = await dbCount();
  console.log(`Sweep: top ${NAMES_N} names × ${STATES.length} states · ${swept.size} combos done · db=${startCount}${TARGET ? ` · target=${TARGET}` : ''} · delay=${DELAY}ms · headed=${HEADED}`);
  await ensureSession();

  let searches = 0, upserts = 0, skipped = 0, fails = 0, streak = 0;
  outer:
  for await (const { first, last } of topNames(NAMES_N)) {
    const nameSlug = slug(`${first}-${last}`);
    for (const state of STATES) {
      if (swept.has(`${nameSlug}|${state}`)) { skipped++; continue; }
      if (searches >= LIMIT) break outer;
      if (TARGET && searches % 20 === 0 && (await dbCount()) >= TARGET) { console.log(`  target ${TARGET} reached`); break outer; }

      let r;
      try {
        r = await page.evaluate(inPageTeaser, { first, last, state });
      } catch (e) {
        console.warn(`  evaluate failed (${String(e.message).slice(0, 50)}) — relaunching…`);
        await ensureSession();
        try { r = await page.evaluate(inPageTeaser, { first, last, state }); } catch { r = { failed: 'ERR' }; }
      }
      searches++;

      if (r && !r.failed && r.identities && r.identities.length) {
        const payload = { commerceContent: { raws: [{ transient: { identities: r.identities, total: r.total } }] } };
        const { profiles } = adaptTeaserResponse(payload, { first, last, state });
        for (const p of profiles) { await dbUpsertProfile(p); upserts++; }
        await dbLogSweep(nameSlug, state, r.total, profiles.length);
        streak = 0;
      } else if (r && r.failed === 'TooManyMatches') {
        await dbLogSweep(nameSlug, state, r.total || 0, 0); // legit empty — mark done
        streak = 0;
      } else {
        // captcha / blocked / transient — do NOT mark done (retry next run); back off.
        fails++; streak++;
      }

      if (searches % 10 === 0) console.log(`  ${searches} searches · +${upserts} profiles · db≈${startCount + upserts} · ${fails} fails`);

      // Failure burst → Turnstile re-challenging: cool down + relaunch a fresh session.
      if (streak >= 5) {
        console.warn(`  ⚠ ${streak} fails in a row — cooling 2min + relaunching (Turnstile)…`);
        await sleep(120000);
        await ensureSession();
        streak = 0;
      }
      await sleep(DELAY + Math.floor(Math.random() * 1500));
    }
  }
  console.log(`\n✓ done: ${searches} searches · +${upserts} upserts · ${skipped} already-done · db holds ${await dbCount()}`);
  try { await browser.close(); } catch { /* ignore */ }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
