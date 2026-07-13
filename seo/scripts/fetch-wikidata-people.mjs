// "Notable people from [City]" for the directory pages — the on-brand Wikidata (CC0)
// add for a people-search site. Uses the QIDs resolved by fetch-wikidata.mjs
// (city-wiki.json) to query, per city, the most-notable humans born there (P19),
// ranked by sitelink count (a notability proxy), each linking to Wikipedia.
//
// One query per city (~2,000), throttled — run in the background. Writes
// seo/data/city-people.json keyed "ST/slug" → [{ name, occ, url }] (top ~10).
//
// Run:  node scripts/fetch-wikidata-people.mjs [--only CA/los-angeles,NY/new-york]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const UA = 'idlookup-seo/1.0 (https://idlookup.me; davidw@peopledatasystems.ai)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

const argv = process.argv.slice(2);
const ONLY = (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '')?.split(',').filter(Boolean) || [];

// Names + Wikipedia links only. (Occupation via P106 is multi-valued; SAMPLE picks a
// random one and mislabels — "Walt Disney (actor)" — so we omit it for credibility.)
const query = (qid) => `SELECT ?person ?name (COUNT(DISTINCT ?sl) AS ?links) (SAMPLE(?article) AS ?url) WHERE {
  ?person wdt:P19 wd:${qid} ; wdt:P31 wd:Q5 ; rdfs:label ?name . FILTER(LANG(?name)="en")
  ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> .
  ?sl schema:about ?person .
}
GROUP BY ?person ?name
ORDER BY DESC(?links)
LIMIT 10`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function peopleFor(qid) {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query(qid))}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results.bindings.map((r) => ({
    name: r.name.value,
    url: r.url?.value || null,
  })).filter((p) => p.url);
}

(async () => {
  const wiki = JSON.parse(fs.readFileSync(path.join(DATA, 'city-wiki.json'), 'utf8'));
  const outPath = path.join(DATA, 'city-people.json');
  const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const entries = Object.entries(wiki).filter(([k, v]) => v.qid && (!ONLY.length || ONLY.includes(k)));

  let done = 0, withPeople = 0, fails = 0;
  for (const [key, v] of entries) {
    try {
      const people = await peopleFor(v.qid);
      if (people.length) { out[key] = people; withPeople++; }
    } catch (e) { fails++; if (fails <= 5) console.error(`  ${key} (${v.qid}): ${e.message}`); }
    done++;
    if (done % 100 === 0) { fs.writeFileSync(outPath, JSON.stringify(out)); console.log(`${done}/${entries.length} (${withPeople} with people, ${fails} fails)`); }
    await sleep(900);
  }
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`\n✅ ${withPeople}/${entries.length} cities have notable people (${fails} fails). Wrote data/city-people.json`);
})();
