# HomeFacts.com URL Migration Plan

**Scenario:** IDLookup / People Data Systems takes over homefacts.com and serves the rebuilt
(idlookup.me/homefacts) experience on it. This plan maps the two URL taxonomies and sequences the
migration so **HomeFacts' existing SEO equity is preserved, not lost.**

## The cardinal rule

HomeFacts' entire value is the **equity attached to its existing URLs** (rankings + backlinks accrue to
specific URLs, not to "the site"). The migration's #1 job is therefore: **do not change the URLs that hold
equity at takeover.** Modernize the *experience behind* each URL; keep the *URL itself* stable. URL
"improvements" come later (Phase 3), only after the domain is stable and only via clean 301s.

This inverts the naive instinct ("move HomeFacts onto our nicer structure"). We do the opposite: **our
rebuilt engine serves content at HomeFacts' existing URL patterns**, and our prototype URLs
(idlookup.me/homefacts/*) 301 into the homefacts.com canonical.

---

## 1. HomeFacts.com taxonomy (incumbent — source of truth for equity)

| Page type | URL pattern | Example |
|---|---|---|
| Home | `/` | `homefacts.com/` |
| Topic hub (national) | `/{topic}.html` | `/crime.html`, `/offenders.html`, `/schools.html`, `/properties.html`, `/demographics.html`, `/environmentalhazards.html`, `/earthquakes.html`, `/airquality.html`, `/methlabs.html`, `/unemployment.html`, `/more.html` |
| State topic index | `/{topic}/{StateName}.html` | `/offenders/California.html`, `/properties/California.html` |
| **City / area profile** | `/city/{StateName}/{County}-County/{City}.html` | `/city/California/Los-Angeles-County/Los-Angeles.html` |
| Property by address | *search-gated (confirm from their data/logs)* | — |
| Offender detail | *per-record (confirm pattern)* | — |
| Static | `/{name}.html` | `/advertising.html`, `/privacypolicy.html`, `/termsofuse.html` |

**Conventions (must be reproduced exactly):**
- `.html` suffix on every content URL (2013-era static-file style).
- State = **full name**, Title-Case: `California`, `New-York` (not `CA`, not lowercase).
- Geo tokens hyphenated, Title-Case: `Los-Angeles`, `San-Francisco`.
- **County is baked into the city path** as `{County}-County` (e.g. `Los-Angeles-County`).
- `robots.txt` allows Googlebot/Bingbot (Bing crawl-delay 10) and **blocks AI crawlers** (ClaudeBot, GPTBot, Bytespider, Amazonbot, PetalBot, Baidu, Yandex). `/sitemap.xml` currently 404s — **their real URL inventory must be pulled from GSC / server logs / a licensed crawl (Ahrefs/Screaming Frog), not a public sitemap.**

## 2. idlookup.me/homefacts taxonomy (our rebuilt engine)

| Page type | URL pattern | Example |
|---|---|---|
| Hub | `/homefacts` | |
| State | `/homefacts/{st}` | `/homefacts/tx` |
| City / area profile | `/homefacts/{st}/{city}` | `/homefacts/tx/austin` |
| County | `/homefacts/{st}/county/{county}` | `/homefacts/fl/county/broward` |
| ZIP | `/homefacts/zip/{zip}` | `/homefacts/zip/78701` |
| About | `/homefacts/about` | |

Conventions: lowercase state **abbreviation**, lowercase hyphen slugs, **no county in city path**, no `.html`,
`/homefacts` prefix.

## 3. Structural deltas (the transform work)

| Dimension | HomeFacts.com | idlookup.me/homefacts | Transform needed |
|---|---|---|---|
| Domain/prefix | root of `homefacts.com` | `/homefacts` subpath | drop `/homefacts` prefix on takeover |
| State token | full name (`California`) | abbrev (`ca`) | **abbrev ⇄ full-name map** (we have `states.js`) |
| Casing | Title-Case-Hyphen | lowercase-hyphen | case transform on slugs |
| City path | includes `{County}-County` | no county | **city → county lookup** (we have `counties.json` / place data) |
| Suffix | `.html` | none | add/strip `.html` |
| Topics | separate per-topic state pages | one unified area profile (all modules) | HF topic pages → our area page (+ optional `#section` anchor) |
| ZIP pages | none | yes | net-new (canonical care) |
| County pages | none (county lives in city path) | yes (own page) | net-new / map to state |

## 4. Recommended strategy — preserve HomeFacts' URLs, adopt their structure

**Serve the rebuilt experience at HomeFacts' exact existing URL patterns.** No redirects on incumbent pages
= zero equity loss. Concretely:

- Our engine gains a **homefacts.com URL adapter**: it accepts `/city/{StateName}/{County}-County/{City}.html`
  (and the topic/state patterns), parses the geo, and renders the same modules our
  `/homefacts/{st}/{city}` page renders today. Same content, incumbent URL.
- **Our prototype URLs 301 into homefacts.com** — `idlookup.me/homefacts/tx/austin` →
  `homefacts.com/city/Texas/Travis-County/Austin.html` (301). This consolidates the prototype into the real
  domain and hands its (small) equity to the canonical.
- **`rel=canonical`** on every homefacts.com page points to itself (the incumbent URL) — never to an
  idlookup.me URL.

**Why not migrate HomeFacts onto our cleaner structure at takeover?** A 301 of ~10M URLs (a) leaks a slice
of equity per hop, (b) is a massive, error-prone ruleset on a domain with a known indexing-sensitivity, and
(c) risks the whole asset for a cosmetic gain. Keep incumbent URLs; earn the right to modernize later.

## 5. The mapping table (our page type → homefacts.com canonical)

| Our URL | homefacts.com canonical | Transform | Notes |
|---|---|---|---|
| `/homefacts` | `/` | drop prefix | 301 our hub → HF home |
| `/homefacts/{st}/{city}` | `/city/{StateName}/{County}-County/{City}.html` | expand state, inject county, Title-Case, `.html` | the flagship 1:1 map; needs city→county lookup |
| `/homefacts/{st}` | `/properties/{StateName}.html` **or** state topic hub | expand state, Title-Case, `.html` | HF has no unified state page — map to their strongest state page (properties) or a new state hub that canonicals appropriately |
| `/homefacts/{st}/county/{county}` | *no HF equivalent* | — | **net-new**: keep as new canonical; internal-link from cities; do **not** 301 to a weaker page |
| `/homefacts/zip/{zip}` | *no HF equivalent* | — | **net-new**: keep; `canonical` self; ensure it doesn't cannibalize the city page (distinct intent) |
| `/homefacts/about` | `/about.html` (or map to an existing static) | — | trivial |

**And the reverse — HomeFacts pages we must keep serving (they hold equity, we have no direct analog yet):**

| homefacts.com URL | Action |
|---|---|
| `/city/{State}/{County}/{City}.html` | **Serve** via adapter → our area profile. Highest priority (flagship). |
| `/{topic}.html` (national hubs) | **Serve** — rebuild each as a topic landing (we have the data for most: crime, offenders, schools, demographics, hazards, earthquakes, air quality). `methlabs`/`unemployment` = thin; keep URL, rebuild or lightly redirect to the closest module. |
| `/{topic}/{StateName}.html` (state topic) | **Serve** — state-level topic rollup. Map to our state page filtered to that topic (or a `#section`). |
| Property-by-address | **Preserve the URL pattern**; back it with our address engine (we have `?alat=&alng=` address widgets). Confirm their exact pattern first. |
| Offender detail | **Preserve**; back with our sex-offender data. Confirm pattern + volume. |

## 6. Transform rules (implementation detail)

1. **State:** `st (ca)` ⇄ `StateName (California)` via `seo/lib/states.js`. Two-letter, uppercase in our
   world; full-name Title-Case, hyphenated for multiword (`New-York`) in theirs.
2. **County injection:** our city page has no county; HF's URL requires `{County}-County`. Resolve
   city→county from `data/places.json` / `counties.json`. **Edge cases:** independent cities (e.g. St. Louis,
   Baltimore), cities spanning multiple counties (pick HF's canonical county), NYC's five boroughs. Build a
   city→HF-county table from *their* URL inventory so we match their exact spelling, not ours.
3. **Slug casing/format:** Title-Case each word, join with `-`; strip apostrophes/periods the way HF does
   (derive the exact normalization from their live URLs, not assumptions).
4. **Suffix:** append `.html`.
5. **Golden rule:** the transform must reproduce HF's *actual* URL string byte-for-byte. Drive it from a
   **crawl of their real URLs** (the canonical list), not from our slugging — any mismatch = a 404 on an
   equity page.

## 7. Redirect / canonical / sitemap / robots mechanics

- **301s:** idlookup.me/homefacts/* → homefacts.com canonical (single hop, no chains). Implement in the SEO
  app's `middleware.js`.
- **Canonicals:** every homefacts.com page self-canonicals to its incumbent URL. Net-new pages (ZIP, county)
  self-canonical; verify they don't duplicate a city page's intent.
- **Sitemaps:** generate a fresh homefacts.com sitemap **from the crawled incumbent URL list**, prioritized
  by current traffic (GSC). Do **not** dump 10M thin URLs at once (repeat of the idlookup.me thin-content
  indexing incident — see `project_seo_indexing_incident`). Submit the high-value core first (cities, top
  topic/state pages), expand as they hold.
- **robots.txt:** decide bot policy on takeover. HF currently blocks AI crawlers + Google/Bing allowed; keep
  Google/Bing, reconsider the AI-bot blocks as a business choice. Point `Sitemap:` at the new sitemap.
- **404 discipline:** any incumbent URL that doesn't resolve to a rendered page must be caught (adapter
  fallback or a mapped redirect) — a 404 on an equity URL is the failure mode that loses rankings.

## 8. Phased rollout

- **Phase 0 — Inventory (before any switch):** pull HF's **real URL list + per-URL traffic** (GSC export,
  server logs, Ahrefs/Screaming Frog). Rank by clicks/impressions. This list *is* the migration spec.
  Confirm the property-address + offender-detail patterns. Baseline current rankings/traffic.
- **Phase 1 — Adapter + parity (no URL changes):** stand up the homefacts.com URL adapter so the top N
  incumbent URLs render our modernized content at their exact URLs. Self-canonical. Verify 200s + parity vs.
  the crawl. Keep HF's URLs identical.
- **Phase 2 — Consolidate the prototype:** 301 idlookup.me/homefacts/* → homefacts.com canonicals. Retire
  the prototype as a public surface; it becomes staging.
- **Phase 3 — (optional, later) URL modernization:** only after the domain is stable, *if* there's a real
  case, 301 incumbent `.html`/legacy URLs → cleaner URLs — carefully, high-traffic-first, monitoring
  rankings at each step. Not required for the takeover to succeed.

## 9. Risks

- **Byte-mismatch 404s** — our slugging ≠ HF's exact URL → 404 on an equity page. *Mitigation:* drive URLs
  from their real crawl, not from our generator.
- **Thin-content indexing action** — dumping millions of rebuilt-but-thin pages. *Mitigation:* sitemap the
  high-value core first; noindex/prune thin leaves (same lesson as idlookup.me).
- **County-mapping errors** — wrong county in the city path = 404. *Mitigation:* city→county table built from
  *their* URLs.
- **Redirect chains / loops** between idlookup.me, homefacts.com, and any legacy HF redirects. *Mitigation:*
  single-hop rule; audit with the seo-auditor.
- **Reputation/authority window** — a domain handover + platform change can wobble rankings short-term.
  *Mitigation:* preserve URLs (this plan), keep content parity, change one variable at a time.

## 10. Open items / data needed from NIC

1. **Full incumbent URL inventory + traffic** (GSC access or export; server logs). *The single most important
   input — the migration is only as good as this list.*
2. Exact **property-by-address** and **offender-detail** URL patterns + volumes.
3. Any **existing internal redirects** on homefacts.com (legacy chains to avoid stacking).
4. DNS/hosting control + ability to set `robots.txt`, sitemaps, and server-side routing.
5. Confirmation of which topic pages still have traffic (prune the dead: methlabs, unemployment likely thin).

---

## 11. Implementation spec — the URL adapter

**All of this lives in OUR app.** At cutover, homefacts.com is repointed (DNS/hosting) at our Next.js app and
the **2013 PHP application is retired — never modified.** "Adapter/middleware" = the routing *inside our app*
that recognizes HomeFacts' URL shapes; it is not a proxy in front of, or a change to, their code. NIC's
engineering effort is zero (hand over the URL list + repoint DNS). Prerequisite for a clean flip: our app must
answer every *trafficked* HomeFacts URL type before cutover (rebuild each page type first; long-tail unbuilt
types get built or gracefully handled). The three pieces:

- a **global URL mode** (so no ISR component ever reads the host — avoids the
`DYNAMIC_SERVER_USAGE` 500 we already hit), **middleware** (Edge — *may* read host/path) that rewrites
incumbent URLs to our renderers and redirects the prototype, and a **city→county table** that lets us
reconstruct HF's exact URLs.

### 11a. Global URL mode (config, not per-request)

The SEO app already generates `/homefacts/{st}/{city}` links. Add a single build-time switch so every
canonical/link builder emits the right grammar:

```js
// seo/lib/hfUrls.js
// URL_MODE flips the whole app's HomeFacts URL grammar. Set via env at deploy; NOT read per-request
// (ISR server components must never read headers/host — that throws DYNAMIC_SERVER_USAGE in prod).
export const URL_MODE = process.env.HF_URL_MODE || 'idlookup'; // 'idlookup' | 'homefacts'

// Canonical URL + internal links for a city page, in whichever grammar is active.
export function hfCityPath(st, citySlug) {
  if (URL_MODE === 'homefacts') {
    const c = lookupCounty(st, citySlug);           // from the city→county table (11c)
    if (!c) return null;                            // no county → cannot build HF URL (log + fall back)
    return `/city/${c.stateName}/${c.county}-County/${c.cityName}.html`;
  }
  return `/homefacts/${st}/${citySlug}`;
}
export function hfHomePath()      { return URL_MODE === 'homefacts' ? '/' : '/homefacts'; }
export function hfStatePath(st)   { return URL_MODE === 'homefacts' ? `/properties/${expandState(st)}.html` : `/homefacts/${st}`; }
```

Then the page components build canonicals/links **through `hfCityPath()` etc.**, never hard-coding
`/homefacts/...`. At homefacts.com takeover, deploy with `HF_URL_MODE=homefacts` and every page self-canonicals
to its incumbent URL automatically.

### 11b. Middleware (`seo/middleware.js`)

Runs on the Edge runtime, so it *can* read host + path. Two responsibilities:

```js
// Pattern for the flagship city URL. Derive the EXACT regex from HF's real URLs (11c), not assumptions.
const HF_CITY = /^\/city\/([^/]+)\/(.+)-County\/([^/]+)\.html$/i;
const HF_STATE_TOPIC = /^\/(offenders|properties|schools|crime|demographics|environmentalhazards|earthquakes|airquality)\/([^/]+)\.html$/i;

export function middleware(req) {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;

  // (A) ON homefacts.com — REWRITE incumbent URLs to our internal renderers (URL stays HF-shaped).
  if (host.endsWith('homefacts.com')) {
    let m;
    if (pathname === '/') return NextResponse.rewrite(new URL('/homefacts', req.url));
    if ((m = pathname.match(HF_CITY))) {
      const st = abbrev(m[1]);                 // California → ca
      const city = slug(m[3]);                 // Los-Angeles → los-angeles
      return NextResponse.rewrite(new URL(`/homefacts/${st}/${city}`, req.url));
    }
    if ((m = pathname.match(HF_STATE_TOPIC))) {
      const st = abbrev(m[2]);
      return NextResponse.rewrite(new URL(`/homefacts/${st}?topic=${m[1]}`, req.url));
    }
    // topic hubs, static pages, property/offender-detail → their own rewrites (add as built)
    return NextResponse.next();               // unmatched → 404 handler (never silently drop an equity URL)
  }

  // (B) ON idlookup.me (Phase 2) — 301 the prototype INTO the homefacts.com canonical.
  if (pathname.startsWith('/homefacts/')) {
    const target = hfCanonicalOnHomefacts(pathname); // build absolute https://www.homefacts.com/... URL
    if (target) return NextResponse.redirect(target, 301);
  }
  return NextResponse.next();
}
```

Key points: **rewrite** (not redirect) on homefacts.com so the URL stays incumbent; **301** on idlookup.me so
the prototype consolidates. Single hop, no chains. `abbrev()`/`slug()`/`expandState()` come from
`seo/lib/states.js` + the normalization derived from HF's real URLs.

### 11c. The city→county table (the load-bearing artifact)

HF's city URL needs the county; ours doesn't. Build the authoritative table **from HF's crawled URLs** so it
matches byte-for-byte:

```js
// seo/scripts/build-hf-county-map.mjs
// INPUT: hf-urls.txt — the crawled list of real homefacts.com /city/... URLs (from GSC / logs / licensed crawl).
// OUTPUT: data/hf-county-map.json  keyed `${abbrev(State)}/${slug(City)}` → { stateName, county, cityName }
//         (HF's EXACT strings, so hfCityPath() reconstructs the URL byte-for-byte).
for (const url of read('hf-urls.txt')) {
  const m = url.match(/\/city\/([^/]+)\/(.+)-County\/([^/]+)\.html$/i);
  if (!m) continue;
  const [ , stateName, county, cityName ] = m;
  map[`${abbrev(stateName)}/${slug(cityName)}`] = { stateName, county, cityName };
}
```

- **Source of truth = their crawl**, not our `places.json`. Our data is the *interim* fallback (to prototype
  before we have their list) but WILL differ on: independent cities (St. Louis, Baltimore, Carson City — no
  `-County` or a special form), multi-county cities (HF picks one canonical county), NYC's five boroughs,
  and casing/punctuation. Every mismatch = a 404 on an equity page → reconcile against their list before
  go-live.
- **Collision guard:** two different HF cities can slug-collide (`Saint-Louis` vs `St-Louis`). Key on HF's
  actual token; if our `slug()` produces a different token than HF uses, prefer HF's — store an override list.
- **Coverage check:** before flipping `HF_URL_MODE=homefacts`, assert every high-traffic HF city URL in the
  crawl resolves through `hfCityPath()` back to the identical string. Any miss is a launch blocker.

### 11d. Build order

1. Get `hf-urls.txt` (Phase 0). 2. `build-hf-county-map.mjs` → `hf-county-map.json`. 3. Add `hfUrls.js`
+ route all link/canonical building through it. 4. Add middleware (A)+(B). 5. Round-trip test the top-N URLs
(HF URL → rewrite → render → canonical === original HF URL). 6. Deploy staging on a homefacts.com preview,
verify 200s + parity. 7. Flip `HF_URL_MODE=homefacts` at cutover.

---

**Bottom line:** at takeover we **keep HomeFacts' URLs and change what's behind them.** Our engine learns to
speak HomeFacts' URL grammar (state-name + county-in-path + `.html`); our prototype URLs 301 into it. Equity
preserved, experience modernized, and URL cleanup deferred to a later, optional, careful phase.
