---
name: project-seo-teaser-2026-07-16
description: ASK SEO-TEASER — server-to-server (headless) call path to BC's EXISTING teaser search so the idlookup.me SEO backend can lazy-populate the public directory; blocker is Cloudflare Turnstile (NOT BC's password.v0 captcha, which is off on prod); registered 2026-07-16, drafted NOT sent
metadata:
  type: project
---

**ASK SEO-TEASER — registered 2026-07-16 in `docs/BC_CONSUMER_FEATURE_ASKS.md`. Status: drafted, NOT sent.**

Consumer/infra track (NOT a CSR letter — sibling to [[project-wsfy-auth-2026-07-14]]; both are
idlookup.me-backend Vercel+Neon capability asks). Capability ask → demo-gate does not apply; evidence is a
code/operational fact, not a live demo.

**Ask (one capability):** a **headless, server-callable path to the EXISTING teaser search** — the same
`name + state [+ city] → teaser identities` call the consumer funnel uses. NOT a new endpoint, NOT new
fields, NOT a bulk data feed/license. Two pieces, BC picks the mechanism: (a) a **Turnstile/bot-gate
exception/allowlist** (or header/token) for our SEO server; (b) a **service credential** (API key / bearer
/ semi-public app-key) to call it absent a browser session.

**Why:** powers "lazy populate" of the public SEO directory (idlookup.me → idlookup.ai/people). On crawl of
a name×city page we chose to expose, our server calls teaser, caches individuals into Neon `person_profiles`,
renders crawlable profiles. Scales the directory WITHOUT a bulk IDI feed (owner: "bulk IDI ask will be hard").

**Kwan-proof hook (the crux — retires the task's "captcha is off so this is unblocked" premise):** TWO
different gates, easy to conflate. BC's `password.v0` captcha is OFF on prod (2026-06-24,
[[project_bc_removed_prod_captcha]]) — that's `apiWrapper._csrPost` 412 / `executePasswordCaptcha`, NOT the
blocker. The live blocker is **Cloudflare Turnstile at the front door.** Anchor line: `seo/scripts/sweep-
profiles.mjs:5-6` — *"Drives the REAL prod IIFE in a Playwright browser (which clears Cloudflare Turnstile
where a raw server fetch 412s)."* Must run `HEADED=1` for a human to solve it; cools down + relaunches on a
re-challenge burst. So teaser is browser-only today; a headless/server fetch 412s at Turnstile.

**Framing = SMALL:** endpoint already exists at the same prod URL, returns the shape we already adapt
(`adaptTeaserResponse`→`adaptIdentity`; name/age/`CITY, ST`/relatives/`*Count`+`has*`). We're asking BC to
**let our server through the existing bot gate**, not to build anything. Volume bound (lead with this vs a
metering objection): ISR 60-day revalidate → **~1 teaser call / name×city / 60 days**, capped by OUR sitemap;
sweep throttled ~1 call/4.5s.

**IP-allowlist caveat folded in:** Vercel serverless has **no stable egress IP** → IP-allowlist is fragile;
a key/bearer is more robust. Named up front so BC picks a durable mechanism.

**Open questions for BC:** (1) preferred auth mechanism (key / bearer / app-key / IP-allowlist)? (2) are
server-side teaser calls metered/billed differently from consumer teaser? (3) rate limit to design cadence
around?

**INTERNAL open risk (NOT in the BC note — us-vs-IDI, not a BC ask):** lazy-populate caches teaser results
into a persistent Neon store = **automated ingestion**, which the 2026-07-08 flag in
[[project_seo_idi_display_license]] calls out — the IDI *standard* T&C prohibit bulk automated use /
ingestion on separate clauses from public-display. Display-licensed ≠ ingestion-licensed. Verify the bespoke
written grant covers automated server-side ingestion BEFORE building the pipeline. Does NOT block this BC
ask (which is purely the call path), but must be resolved before we scale populate.

**How to apply:** BC-facing note = `docs/BC_CONSUMER_FEATURE_ASKS.md` SEO-TEASER section + Summary row.
When batching to BC, anchor on the `sweep-profiles.mjs:5-6` line (the demo-less "literal string" analog).
Register count of consumer/infra asks: WSFY-AUTH (1) + SEO-TEASER (1) + Alerts (4); WISFY data ask = 0
(superseded). Related: [[project-asks-e-h-2026-07-02]] (same register).
