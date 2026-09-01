---
name: project_paid_search_migration
description: Paid Google Search migration plan — eCPA-safe doctrine + SSN-prohibited + $1-copy-rebuild gotchas
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

Google Search campaign migration (compet → our v11 funnel). Docs in `docs/growth/`: `roadmap-paid-google-search-migration.md` (waves) · `paid-search-build-sheet.md` (spec) · `paid-search-wave0-punchlist.md` (tracked prereqs) · `paid-search-wave1-keywords-adcopy.md` (ported keywords + compliant copy). Data: `docs/ads/compet/` (Campaign/Ad/Search-keyword reports; keyword report is 538MB — stream-extract by campaign, don't load). See [[project_paid_search_migration]] parent [[project_seo_migration_affiliate_roadmap]].

**eCPA-safe doctrine (owner's hard constraint — do NOT reset bids/broaden kw casually):** migrate like-for-like; the LANDING is the one unavoidable change (isolate it). Bid = **Target CPA from day one seeded at proven eCPA (portfolio-pooled), NOT uncapped Maximize Conversions**. Freeze keywords/match at migration; volume expansion = separate "expansion sibling" campaign, never mixed into the core. Guard: small budget + **eCPA kill-switch (pause at proven ×1.4 after ≥15 conv)**; respect conversion lag; prefer in-place modify (repoint landing, keep bid learning). Lowest-eCPA-risk volume source = SEO, not kw broadening.

**Two findings that change the plan:**
1. **SSN is PROHIBITED — do not migrate.** Proven SSN keywords (`find someone by social security number`, `ssn finder`) violate Google policy (facilitating SSN access) → account-suspension risk. The 2.49–2.81× SSN ROAS is NOT portable. Fold compliant slice into Public Records; legal sign-off gates it (punch-list D1).
2. **Ad copy must be REBUILT, not ported.** Every source campaign runs `$1 / Credit Card Required / Cheapest` copy pointing at competitor domains (inmatessearcher/privaterecords/backgroundcheckers). Keep value-prop headlines, drop price/CC hooks, no guilt implication (criminal/arrests). The `$1` hook drove CVR → compliant copy is the isolated change to watch on eCPA.

**Proven core (account 2.22× overall):** Inmate (Lower 3.06×/Upper 1.87×, top volume) · Public Records (2.08–2.81×) · Life-events (Death-Upper 2.02×, Divorce-Upper 1.57×) · Criminal (Court 2.75×, Arrests 2.0×, Police 1.44× watch). Widespread **missing-Google-tag** misconfig hides conversions (whole Reverse Phone vertical). Landings = `idlookup.ai/name/landing/v11?shns=<id>`.

**⚠️ WHY PAID SEARCH TOOK 12 WEEKS (owner-authoritative 2026-09-01 — I had this WRONG).** I inferred it was a
conversion-tracking/measurement chain. It was not. Truth:
1. Tracking problems existed **at the start only** and were fixed in **~1 month**.
2. The rest was the **Google Ads bid-strategy learning loop**, which is paced by Google, not by us:
   (a) set bidding to **Maximize Conversions** → (b) reach **~30 conversions** (Google's threshold) →
   (c) add a **fixed tCPA** → (d) see whether volume holds → (e.1) if volume **collapses**, go back to (a) and
   rebuild → (e.2) if volume holds, step tCPA down over a **5–7 stage sequence**, each stage needing to
   re-stabilise. Each stage has its own learning period; going too fast undoes the previous stage.
3. Goal = **parity with compet's efficiency** so we can say the platform is "close enough to support the key
   partner migration."

**⚠️ The bid work leaves NO commit trace** — it happens in the Google Ads console. Any commit-based effort
analysis therefore UNDERSTATES paid effort. Say so when charting it.

**Key partner postbacks: UNKNOWN.** Do NOT assert the key partner needs a postback — that has never been
established. The 2026-09-01 postback spec was for **Fluent**, a different partner. See [[project_seo_migration_affiliate_roadmap]].
