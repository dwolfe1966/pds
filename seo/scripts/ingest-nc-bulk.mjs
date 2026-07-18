// Ingest the North Carolina DAC bulk offender extract → Neon `inmates` (source='nc-bulk'). Free, no key.
// Public records: "all public information on all NC DAC offenders convicted since 1972."
//
// SOURCE (one file, ~40MB zip → ~557MB fixed-width .dat):
//   Downloads page:  https://webapps.doc.state.nc.us/opi/downloads.do?method=view
//   Data file:       https://opus.doc.state.nc.us/offenders/INMT4AA1.zip  (member INMT4AA1.dat)
//   Each .zip bundles a self-describing <NAME>.des layout (Name / Description / Type / Start / Length).
//
// ⚠️ FILE CHOICE — we use INMT4AA1 ("Inmate Profile"), NOT OFNT3AA1. Despite its name, OFNT3AA1
//   ("Offender Profile") holds only PHYSICAL description (height/weight/eyes/birthplace…) and carries
//   NO offender name — useless for people-search. INMT4AA1 is the one-row-per-inmate identity file that
//   actually has last/first/middle/suffix name + sex + race + DOB + record status + facility.
//
// FIXED-WIDTH LAYOUT (verified against the shipped INMT4AA1.des; positions are 1-BASED start + length,
//   values are full human-readable strings space-padded to the field width; record length 1026 + LF):
//   DOC number  1..7   | last 8..27 | first 28..38 | middle-init 39 | suffix 40..42
//   sex 47..76 | race 77..106 | DOB(YYYY-MM-DD) 107..116 | record-status 147..176
//   admin-status 177..206 | facility 482..511
//
// USAGE (streams the .dat straight out of the .zip via system `unzip -p` — no 557MB extract to disk;
//   no unzip npm dep, none is installed):
//   node --env-file=.env.local scripts/ingest-nc-bulk.mjs --file=/path/INMT4AA1.zip --limit=500
//   node --env-file=.env.local scripts/ingest-nc-bulk.mjs --file=/path/INMT4AA1.zip          # full run
//   (accepts a raw .dat path too. --limit default 500 = safe test; omit/large for a full load.)
import fs from 'node:fs';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { upsertInmates, hasInmatesDb } from '../lib/inmatesDb.mjs';

if (!hasInmatesDb) { console.error('No DB URL (LEADS_DATABASE_URL/DATABASE_URL). Run with --env-file=.env.local'); process.exit(1); }

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const FILE = arg('file');
const LIMIT = Number(arg('limit', '500')) || Infinity; // default: safe 500-row test
const MEMBER = arg('member', 'INMT4AA1'); // .dat member name inside the zip
if (!FILE || !fs.existsSync(FILE)) { console.error('usage: --file=<INMT4AA1.zip|.dat> [--limit=N] [--member=INMT4AA1]'); process.exit(1); }

// 1-based [start, length] per INMT4AA1.des. slice() is 0-based → start-1.
const F = { doc: [1, 7], last: [8, 20], first: [28, 11], midInit: [39, 1], suffix: [40, 3],
  sex: [47, 30], race: [77, 30], dob: [107, 10], recStatus: [147, 30], admStatus: [177, 30], facility: [482, 30] };
const RECLEN = 1026;
const cut = (line, [start, len]) => line.slice(start - 1, start - 1 + len).trim();
const nn = (s) => (s && s !== 'UNKNOWN' ? s : null); // treat NC's 'UNKNOWN' sentinel as absent

function ageFromDob(dob) { // dob = 'YYYY-MM-DD'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || ''); if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3]; if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const now = new Date(); let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 && age <= 120 ? age : null;
}

// Stream the fixed-width .dat: from a .zip via `unzip -p`, or a plain .dat file. Returns { input, close }.
function openStream() {
  if (/\.zip$/i.test(FILE)) {
    const child = spawn('unzip', ['-p', FILE, `${MEMBER}.dat`], { stdio: ['ignore', 'pipe', 'ignore'] });
    child.on('error', (e) => { console.error('unzip failed (is the `unzip` binary installed?):', e.message); process.exit(1); });
    // On early --limit break we stop reading ~550MB early; kill the child so we exit cleanly (no SIGPIPE hang).
    return { input: child.stdout, close: () => { try { child.kill('SIGTERM'); } catch { /* noop */ } } };
  }
  return { input: fs.createReadStream(FILE), close: () => {} };
}

async function main() {
  const stream = openStream();
  const rl = readline.createInterface({ input: stream.input, crlfDelay: Infinity });
  const BASE = 'https://webapps.doc.state.nc.us/opi';
  let batch = []; let parsed = 0; let wrote = 0;
  const flush = async () => { if (!batch.length) return; const b = batch; batch = []; wrote += await upsertInmates(b); };

  for await (const raw of rl) {
    const line = raw.replace(/\r$/, '');
    if (line.length < RECLEN - 2) continue; // guard against a short/trailer line
    const id = cut(line, F.doc); if (!/^\d{7}$/.test(id)) continue; // DOC# is a 7-digit key
    const first = cut(line, F.first), last = cut(line, F.last);
    const middle = cut(line, F.midInit), suffix = cut(line, F.suffix);
    const dob = cut(line, F.dob);
    const status = nn(cut(line, F.recStatus)) || nn(cut(line, F.admStatus));
    batch.push({
      source: 'nc-bulk', sourceName: 'North Carolina DAC',
      firstName: first || '', lastName: last || '',
      name: [first, middle, last, suffix].filter(Boolean).join(' '),
      age: ageFromDob(dob), birthDate: dob || null,
      gender: nn(cut(line, F.sex)), race: nn(cut(line, F.race)),
      state: 'NC', inmateId: id,
      mugshotUrl: `${BASE}/viewpicture.do?method=view&showDate=N&pictureType=I&pictureSequence=1&offenderID=${id}`,
      charges: [], facility: nn(cut(line, F.facility)), county: null, releaseStatus: status,
    });
    parsed++;
    if (batch.length >= 1000) await flush();
    if (parsed >= LIMIT) break;
  }
  rl.close(); stream.close();
  await flush();
  console.log(`parsed ${parsed} record(s) · upserted ${wrote} into inmates (state=NC, source=nc-bulk)${LIMIT !== Infinity ? ` · --limit=${LIMIT}` : ''}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
