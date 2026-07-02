#!/usr/bin/env node
/**
 * Generate src/pages/admin/zipGeo.data.js — a compact ZIP → "City|ST" map for
 * CSR display (customer profile shows "City, ST" next to the billing ZIP until
 * BC returns real address data — ASK H).
 *
 * Source: GeoNames US postal data (https://download.geonames.org/export/zip/US.zip),
 * licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Attribution
 * is carried in the generated file header and the UI tooltip.
 *
 * Usage:
 *   node scripts/generate-zip-geo.js [path/to/US.txt]
 * With no arg it downloads US.zip to a temp dir and extracts US.txt (needs `unzip`).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'src', 'pages', 'admin', 'zipGeo.data.js');
const SOURCE_URL = 'https://download.geonames.org/export/zip/US.zip';

async function resolveInput() {
  const arg = process.argv[2];
  if (arg) return arg;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zipgeo-'));
  const zipPath = path.join(tmp, 'US.zip');
  console.log(`downloading ${SOURCE_URL} …`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zipPath, 'US.txt', '-d', tmp]);
  return path.join(tmp, 'US.txt');
}

(async () => {
  const input = await resolveInput();
  const lines = fs.readFileSync(input, 'utf8').split('\n');
  const map = {};
  let rows = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    // GeoNames TSV: country, zip, place, stateName, stateAbbr, county, …
    const [, zip, place, , stateAbbr] = line.split('\t');
    if (!/^\d{5}$/.test(zip) || !place || !stateAbbr) continue;
    // First entry wins — GeoNames lists the primary place first for a ZIP.
    if (!map[zip]) { map[zip] = `${place}|${stateAbbr}`; rows += 1; }
  }
  const generatedAt = new Date().toISOString().slice(0, 10);
  const body =
    `// GENERATED — do not edit. \`node scripts/generate-zip-geo.js\` (${generatedAt})\n` +
    `// ZIP → "City|ST". Data © GeoNames (geonames.org), CC BY 4.0.\n` +
    `// Loaded ONLY via dynamic import (src/pages/admin/zipCity.js) so it stays\n` +
    `// out of the main admin bundle.\n` +
    `export default ${JSON.stringify(map)};\n`;
  fs.writeFileSync(OUT, body);
  console.log(`wrote ${OUT}: ${rows} ZIPs, ${(body.length / 1024 / 1024).toFixed(2)} MB raw`);
})().catch((e) => { console.error(e.message); process.exit(1); });
