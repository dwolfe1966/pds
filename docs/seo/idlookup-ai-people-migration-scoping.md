# SEO directory → idlookup.ai migration — scoping / findings

**Date:** 2026-07-23  **Status:** findings report (no code touched yet — decision needed)

## Why we're doing this

idlookup.me (the Vercel/Neon SEO directory) is **not gaining traffic** and the diagnosis is
**domain authority**, not technique. Evidence: Google indexed-count flat, 17 impressions/7d,
Validate-Fix still pending after the 7/12–7/15 deindex cascade; **Bing has zero data**; ~13k pages
sit in "discovered – not indexed" (Google *declined* them). The technical layer is correct and
freshly cleaned (thin name pages noindexed + de-listed 7/20). A ~7-week-old standalone domain that
took a deindex hit simply has no trust — and authority can't be sitemap'd.

**The lever:** serve the directory from **idlookup.ai**, our established, revenue-bearing, branded
domain, so it inherits real domain authority instead of starting from zero on a burned .me.

## The inherent constraint

The authority we want to borrow *lives at* idlookup.ai, which sits behind BC's edge. Inheriting it
**necessarily means one change at BC's DNS/edge layer** — there is no way around that; it's the whole
point. The goal is to make that change as **small, reversible, and independence-preserving** as
possible. The findings below determine which change is smallest.

## Infrastructure findings (verified live 2026-07-23)

| Fact | Evidence | Implication |
|---|---|---|
| idlookup.ai DNS = **Cloudflare, but DNS-only (grey cloud)** | NS = `*.ns.cloudflare.com`; **no `cf-ray`** on apex or www; apex A = `170.9.20.28` (not a Cloudflare IP) → straight to BC nginx | **Cloudflare Workers/Rules can't intercept idlookup.ai traffic.** A Cloudflare edge proxy is NOT available unless BC enables proxying (orange cloud) on their production domain — a bigger change that could affect the consumer app. |
| Canonical host is **www.idlookup.ai** | root `idlookup.ai` 301 → `www.idlookup.ai` | New host must play nicely with the www canonicalization. |
| **`/people/:id` is a live, revenue-critical consumer route** | `src/App.js:293  path="/people/:id"` (paywalled person-detail / report unlock); `www.idlookup.ai/people` serves the SPA shell (411 B) | **A subpath at `idlookup.ai/people/*` COLLIDES** with the report pages — `/people/ca` would be parsed as report-id `ca`. Carving the SEO patterns away from report-ids on the revenue domain is fragile and risky. |
| `people.idlookup.ai` is **unused** | `dig people.idlookup.ai` → empty | Free to claim as a subdomain. |
| idlookup.me = **Vercel** | `server: Vercel`, `x-vercel-id` | The app stays exactly where it is; only the hostname in front of it changes. |

## Options

| # | Approach | Authority | BC involvement | Collision | Independence | Verdict |
|---|---|---|---|---|---|---|
| **1** | **Subdomain `people.idlookup.ai` → Vercel** (one CNAME, DNS-only) | Strong — subdomain on the idlookup.ai brand; Google largely consolidates subdomain authority with the root | **One DNS record** (CNAME `people` → `cname.vercel-dns.com`, grey cloud) + maybe one TXT to verify | **None** (separate host) | **Maximal** — we own the whole Vercel app; BC touches one DNS record; leave-BC = repoint one CNAME | ✅ **RECOMMENDED** |
| 2 | Subpath `idlookup.ai/people/*` via **Cloudflare Worker** | Strongest (true subfolder) | **High** — BC must enable Cloudflare proxying on prod **and** run a path-scoped Worker | **Yes** — must exclude `/people/{reportId}` from the SEO patterns on the revenue domain | Low — our SEO now depends on BC's Worker; if it breaks, SEO breaks | ❌ blocked by grey-cloud + collision |
| 3 | Subpath via **BC nginx reverse-proxy** at origin | Strongest | **Highest** — BC edits production nginx | Same collision as #2 | Lowest — deep BC entanglement | ❌ heaviest, most fragile |
| 4 | Do nothing (stay on idlookup.me) | None (proven) | None | — | Total | ❌ this is what's failing |

**The infrastructure makes the call.** Grey-cloud DNS kills the Cloudflare-Worker subpath; the live
`/people/:id` report route makes *any* subpath a revenue-domain collision risk. The subdomain avoids
both, needs the single smallest BC action possible, and keeps us 100% independent on Vercel.

Modern Google (Mueller, repeatedly) treats subdomain-vs-subfolder as a **minor** ranking factor —
the decisive win here is moving off a burned standalone TLD onto the aged, branded idlookup.ai, which
the subdomain fully delivers.

## Recommended plan — `people.idlookup.ai`

**The ONE BC ask (minimal, reversible):**
> Add a DNS record in Cloudflare for idlookup.ai: **`people` CNAME → `cname.vercel-dns.com`**, set
> **DNS-only (grey cloud)**. (Plus one TXT record if Vercel's domain-verification asks for it.)
> Nothing else — no proxying, no origin/nginx change, no consumer-app impact.

**Everything else is ours, on Vercel (no BC involvement):**
1. **Vercel** — add `people.idlookup.ai` to the SEO project; Vercel issues SSL and gives the CNAME
   target for the ask above.
2. **Canonical host swap** — set the app's canonical base to `https://people.idlookup.ai` so every
   `<link canonical>`, sitemap `<loc>`, and internal link emits the new host. Regenerate
   `sitemapv2.xml` + `sitemap-directory.xml` + `robots.txt` on the new host.
3. **301 everything** — redirect every `idlookup.me/<path>` → `https://people.idlookup.ai/<path>`
   (Vercel redirect / middleware). **Keep idlookup.me alive as a pure redirector for months** so the
   little crawl equity it has flows to the new host.
4. **GSC** — add `people.idlookup.ai` as a property; use **Change of Address** from the idlookup.me
   property (this is a full-hostname move, so it qualifies); submit new sitemaps; Request Indexing on
   ~10 hero city/state pages.
5. **Content scope — move the CURATED set only:** `/people` hub + 52 states + ~1,909 cities +
   roster-state counties + the ~980 unique-content name pages (person_profiles). **Do NOT bring the
   ~41k thin noindex name-in-city pages** onto the branded domain — leave them noindexed/410 on
   idlookup.me. Importing thin pages is exactly the trust problem we're escaping; don't put it on the
   money domain.

**Independence story (directly addresses the owner's concern):** BC's *entire* footprint is one DNS
record they add in the Cloudflare DNS panel. We keep full ownership of the app, the hosting (Vercel),
the SSL, and every deploy. If we ever separate from BC, we repoint one CNAME. No lock-in, no shared
runtime, no origin coupling.

## Sequencing note

This is the real fix, but it's gated on the one BC DNS ask + a GSC change-of-address, and recovery
still takes weeks. In parallel, the idlookup.me Validate-Fix is owner-gated in GSC (can't force). No
other technical change to idlookup.me will move the needle — the ceiling is the domain.

## Open decision for the owner

- **Confirm direction: subdomain `people.idlookup.ai` (recommended)** vs holding out for a true
  subpath (needs BC to re-architect their edge + solve the `/people/:id` collision — not worth it now;
  can revisit once the subdomain proves the model).
- Minor: counties are only listed for 4 states (CA/FL/GA/PA) — confirm that's intentional
  (roster-coverage) before the sitemap regenerates on the new host.
