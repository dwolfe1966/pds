#!/usr/bin/env node
/*
 * Delivery changelog generator — derives "bugs + features delivered" from git history.
 * Source of truth = Conventional-Commit messages (fix/feat/…). Deterministic + idempotent.
 *
 * Usage:
 *   node scripts/changelog.js                         # last 30 days, delivered types, CSV
 *   node scripts/changelog.js --since="2026-05-28"
 *   node scripts/changelog.js --all                   # include internal (docs/chore/test/…)
 *   node scripts/changelog.js --format=md|csv|json
 *   node scripts/changelog.js --format=json --webhook="$CHANGELOG_SHEET_URL"
 *                                                     # POST rows to the Apps Script bridge
 *                                                     # (the bridge de-dupes by commit hash)
 */
const { execSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const since = args.since || '6 months ago';
const format = args.format || 'csv';
const includeAll = !!args.all;

// Conventional-commit type → display label + whether it's a team-facing "delivery".
const TYPE_MAP = {
  fix:      { label: 'Bug fix',     delivered: true },
  feat:     { label: 'Feature',     delivered: true },
  perf:     { label: 'Improvement', delivered: true },
  polish:   { label: 'Polish',      delivered: true },
  harden:   { label: 'Security',    delivered: true },
  content:  { label: 'Content',     delivered: true },
  refactor: { label: 'Refactor',    delivered: false },
  docs:     { label: 'Docs',        delivered: false },
  test:     { label: 'Tests',       delivered: false },
  chore:    { label: 'Chore',       delivered: false },
  memory:   { label: 'Internal',    delivered: false },
  demo:     { label: 'Internal',    delivered: false },
  agents:   { label: 'Internal',    delivered: false },
};

const SEP = '\x1f';
const REC = '\x1e';
const raw = execSync(
  `git log --since="${since}" --date=short --pretty=format:"${REC}%H${SEP}%h${SEP}%ad${SEP}%s"`,
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const rows = raw.split(REC).filter(Boolean).map((r) => {
  const p = r.split(SEP);
  const full = (p[0] || '').trim();
  const short = (p[1] || '').trim();
  const date = (p[2] || '').trim();
  const subject = (p[3] || '').trim();
  const m = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.*)$/);
  const type = m ? m[1] : 'other';
  const meta = TYPE_MAP[type] || { label: 'Other', delivered: false };
  return {
    date,
    type: meta.label,
    breaking: !!(m && m[3]),
    area: (m && m[2]) || '',
    summary: m ? m[4] : subject,
    commit: short,
    full,
  };
});

const filtered = rows.filter((r) => {
  if (includeAll) return true;
  const entry = Object.values(TYPE_MAP).find((t) => t.label === r.type);
  return entry ? entry.delivered : false;
});

function csvCell(s) {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`webhook ${res.status}: ${text}`);
  process.stderr.write(`webhook ok: ${text}\n`);
}

(async () => {
  if (args.webhook) {
    // Token travels in the POST body (not the URL) so special chars (&, %, $, !) can't
    // break the query string. Set CHANGELOG_SHEET_TOKEN (env) or pass --token=…
    const token = args.token || process.env.CHANGELOG_SHEET_TOKEN || '';
    await post(String(args.webhook), { token, rows: filtered });
    return;
  }
  if (format === 'json') {
    process.stdout.write(JSON.stringify(filtered, null, 2) + '\n');
  } else if (format === 'md') {
    process.stdout.write('| Date | Type | Area | Summary | Commit |\n|---|---|---|---|---|\n');
    for (const r of filtered) {
      process.stdout.write(`| ${r.date} | ${r.type} | ${r.area} | ${r.summary.replace(/\|/g, '\\|')} | \`${r.commit}\` |\n`);
    }
  } else {
    process.stdout.write('Date,Type,Area,Summary,Commit\n');
    for (const r of filtered) {
      process.stdout.write([r.date, r.type, r.area, r.summary, r.commit].map(csvCell).join(',') + '\n');
    }
  }
})();
