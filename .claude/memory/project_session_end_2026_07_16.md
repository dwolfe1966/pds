---
name: project_session_end_2026_07_16
description: "Pick-up state 2026-07-16 — SEO indexing rescue, WSFY retroactive-match + 3-tier identity, vCard-replace done, north-star pivot captured"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Session 2026-07-16. All work committed + pushed to main. Restarting in a few hours.

## What shipped today (chronological)
1. **SEO individual-profile leaf pages** (`7b8ef77`) + **geo pipeline bug fix** (`0bd3d7c`) — captured
   teasers store real city/state (was silently null; derived from location history). See
   [[project_seo_individual_profiles]].
2. **BC ask `SEO-TEASER` registered** (drafted, NOT sent) — server-side teaser for lazy-pull; KEY
   finding: blocker is Cloudflare **Turnstile**, not password captcha; + IDI ingestion-license caveat.
3. **SEO INDEXING RESCUE** (`2bda4ed` sitemapv2 + `e5d6902` robots) — impressions dropped 7/13 (360k
   thin pages on a 2-wk-old domain + 8-chunk sitemap index; Bing saw "8 URLs"). Fix = conservative
   flat **`/sitemapv2.xml`** (~1000 top city/state URLs) + robots repointed to it. **Owner resubmits
   in Search Console + Bing.** Full diagnosis in [[project_seo_indexing_incident]].
4. **WSFY fundamental issue** — "do new accounts match HISTORICAL searches?" → **YES, verified** (fresh
   selfUserId matched 9). Shipped: verification probe (`scripts/wsfy-match-check.mjs`), **3-tier subject
   identity** (mapped self-identify > card info > self-provided; NEVER account name = search target),
   **cardholder-name capture at checkout**, and **named affinity callouts + sameStateCount** in the WSFY
   payment teaser ("1 worked at Google", "5 searching from your state"). Commits `c0b4ad7`, `f6fd73e`,
   `281965f`. See [[project_wsfy_self_build]].
5. **"Replace the vCard" backlog item RESOLVED** (layout was already done via `isSelfContext`; content
   done today). [[project_backlog]] updated.
6. **North-star captured**: [[project_freemium_identity_community]] — transactional search → freemium
   identity community; crux = the two-class data problem (non-member broker records).

## Deploy state (owner action)
- **SEO/server changes auto-deploy via Vercel** (sitemapv2, robots, wsfy.mjs hierarchy + highlights,
  geo fix, profile leaves). Owner: **resubmit sitemapv2.xml**.
- **Consumer bundle `public.28de962a.js`** (latest; supersedes ab25eee4) — NOT yet on BC. Contains the
  checkout cardholder-name capture + WSFY teaser named-callouts. Owner uploads to BC.
- Several earlier consumer bundles also un-deployed (identity/profile/WSFY work) — piling up.

## Recommended next (my read)
Both unblocked AND launch-relevant, and everything this week depends on them:
1. **WSFY auth-hardening** — `/api/wsfy` + ingest trust a client-asserted `tier`; spoof → unmask
   searcher names. Validate BC token server-side, derive tier from it.
2. **Confirm the identity-verification gate** — KBA shipped (`f7b007f`), but verify the paid identity
   surfaces (report pull, WSFY reveal, exposure controls) are actually gated behind it, not just that
   KBA exists.
Big-ticket (PayPal, email platform) are BC/decision-gated; SEO lazy-pull is BC-blocked (SEO-TEASER + IDI).

## Cautions (unchanged)
No prod BC creds; no prod mutation probes; PII never to GA4; CTA color `#0d5d2f`; console.* stripped in
prod; extId ephemeral; the Neon `member_enrichment.attributes` now also holds cardName/providedName for
WSFY fallback — don't clobber.
