// Ingest Florida OBIS bulk data → Neon `fl_inmates`. Free, no key. Run monthly.
//
// USAGE:
//   1. Download the OBIS zip(s) from fdc.myflorida.com (statistics-and-publications → OBIS database),
//      unzip into a directory of tab-delimited .txt files.
//   2. node --env-file=.env.local scripts/ingest-florida-obis.mjs <dir>
//
// The parser is HEADER-DRIVEN (reads the first row as column names, maps by fuzzy name) so it's robust
// to OBIS's exact layout — if a field doesn't map, check the file's header row and add an alias below.
// Streams line-by-line + batches upserts, so it handles the 1M+ release rows without loading into memory.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!URL) { console.error('No DB URL'); process.exit(1); }
const sql = neon(URL);
const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('usage: ingest-florida-obis.mjs <dir-of-unzipped-obis-files>'); process.exit(1); }

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const H = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// candidate header names per target field (OBIS layout varies; add aliases as needed)
const COLS = {
  dc: ['dcnumber', 'dcnbr', 'dc'],
  last: ['lastname', 'lname', 'offenderlastname'],
  first: ['firstname', 'fname', 'offenderfirstname'],
  middle: ['middlename', 'mname'],
  race: ['race'],
  sex: ['sex', 'gender'],
  dob: ['birthdate', 'dob', 'dateofbirth'],
  facility: ['currentfacility', 'facility', 'currentlocation', 'location', 'facilityname'],
  status: ['custodystatus', 'status', 'currentcustody'],
  release: ['releasedate', 'currentreleasedate', 'tentativereleasedate'],
};

function findFile(re) { return fs.readdirSync(dir).find((f) => re.test(f.toLowerCase())); }

// Header-driven streaming parse. onRow(recordObj) per data line. Returns count.
async function parseTab(file, want, onRow) {
  const full = path.join(dir, file);
  const rl = readline.createInterface({ input: fs.createReadStream(full), crlfDelay: Infinity });
  let idx = null; let n = 0;
  for await (const line of rl) {
    const cells = line.split('\t');
    if (idx === null) {
      const hmap = {}; cells.forEach((h, i) => { hmap[H(h)] = i; });
      idx = {};
      for (const [k, aliases] of Object.entries(want)) { const a = aliases.find((x) => hmap[x] != null); idx[k] = a != null ? hmap[a] : -1; }
      continue;
    }
    if (!line.trim()) continue;
    const rec = {}; for (const [k, i] of Object.entries(idx)) rec[k] = i >= 0 ? (cells[i] || '').trim() : '';
    if (!rec.dc) continue;
    onRow(rec); n++;
  }
  return n;
}

async function main() {
  // ── offenses + aliases (grouped by DC) first, so roots can attach them ──
  const offenses = new Map(); const aliases = new Map();
  const offFile = findFile(/offenses/);
  if (offFile) {
    await parseTab(offFile, { dc: COLS.dc, desc: ['offensedescription', 'offense', 'chargedescription', 'statutedescription'], statute: ['statute', 'offensestatute'] }, (r) => {
      const arr = offenses.get(r.dc) || []; const d = [r.desc, r.statute].filter(Boolean).join(' — '); if (d) arr.push(d); offenses.set(r.dc, arr);
    });
    console.log(`offenses: ${offenses.size} inmates`);
  }
  const aliasFile = findFile(/alias/);
  if (aliasFile) {
    await parseTab(aliasFile, { dc: COLS.dc, last: COLS.last, first: COLS.first }, (r) => {
      const arr = aliases.get(r.dc) || []; const nm = [r.first, r.last].filter(Boolean).join(' '); if (nm) arr.push(nm); aliases.set(r.dc, arr);
    });
    console.log(`aliases: ${aliases.size} inmates`);
  }

  // ── roots (active + release) → upsert ──
  const roots = fs.readdirSync(dir).filter((f) => /root/.test(f.toLowerCase()) && /\.txt$/i.test(f));
  if (!roots.length) { console.error('no *root*.txt files found in', dir); process.exit(1); }
  let batch = []; let total = 0;
  const flush = async () => {
    if (!batch.length) return;
    const payload = batch; batch = [];
    await sql`
      INSERT INTO fl_inmates (dc_number, first_name, middle_name, last_name, first_norm, last_norm, race, sex,
        birth_date, custody_status, facility, release_date, offenses, aliases, source_file)
      SELECT x.dc_number, x.first_name, x.middle_name, x.last_name, x.first_norm, x.last_norm, x.race, x.sex,
        x.birth_date, x.custody_status, x.facility, x.release_date, x.offenses, x.aliases, x.source_file
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(dc_number text, first_name text,
        middle_name text, last_name text, first_norm text, last_norm text, race text, sex text, birth_date text,
        custody_status text, facility text, release_date text, offenses jsonb, aliases jsonb, source_file text)
      ON CONFLICT (dc_number) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
        first_norm=EXCLUDED.first_norm, last_norm=EXCLUDED.last_norm, facility=EXCLUDED.facility,
        custody_status=EXCLUDED.custody_status, release_date=EXCLUDED.release_date, offenses=EXCLUDED.offenses,
        aliases=EXCLUDED.aliases, updated_at=now()`;
  };
  for (const rf of roots) {
    const active = /active/.test(rf.toLowerCase());
    const n = await parseTab(rf, COLS, (r) => {
      batch.push({
        dc_number: r.dc, first_name: r.first, middle_name: r.middle, last_name: r.last,
        first_norm: norm(r.first), last_norm: norm(r.last), race: r.race || null, sex: r.sex || null,
        birth_date: r.dob || null, custody_status: r.status || (active ? 'active' : 'released'),
        facility: r.facility || null, release_date: r.release || null,
        offenses: JSON.stringify(offenses.get(r.dc) || []), aliases: JSON.stringify(aliases.get(r.dc) || []),
        source_file: rf,
      });
    });
    // flush handled by a size cap
    while (batch.length >= 2000) { const chunk = batch.splice(0, 2000); const save = batch; batch = chunk; await flush(); batch = save; }
    await flush();
    total += n; console.log(`${rf}: ${n} rows (running ${total})`);
  }
  const [c] = await sql`SELECT count(*)::int n FROM fl_inmates`;
  console.log(`DONE — fl_inmates now has ${c.n} rows`);
}
main().catch((e) => { console.error(e); process.exit(1); });
