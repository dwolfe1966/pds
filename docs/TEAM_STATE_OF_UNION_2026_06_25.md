# IDLookup — State of the Union (Team Meeting, 2026-06-25)

**Context:** Pushing paid traffic live today. BC went live in production 2026-06-23. This doc covers five buckets: Consumer Web App, CSR Web App, Email, Reporting, and Cross-Cutting Platform.

> ⚠️ **#1 thing the whole team should know:** a full session of consumer + tracking fixes is **committed and pushed to `main` but NOT yet deployed** to the production VPS. The consumer bundle (`public.d0d4af35.js`) is built, verified, and ready to upload — **but until that upload happens, none of it is live.** Everything marked "✅ done" below is done *in code*; "live" requires the deploy.

---

## 1. Consumer Web App

### ✅ Recently accomplished (in code; pending deploy)
1. **Fixed 7 paid funnels that were invisible to Google Ads.** Name V2/V5 and Phone V2–V6 ran their search inline and bypassed the loader, so they fired **none** of the conversion/measurement signals. They now delegate to the loader — runtime-verified end-to-end.
2. **Phone funnel error dead-end fixed** — a failed search used to dump the visitor back to the landing page (losing their number); now preserved through the loader.
3. **Honest "state required" labeling** on name funnels (was "optional / you can skip," then it blocked you).
4. **Phone results page made mobile-responsive** (was fixed desktop padding, cramped on phones).
5. **Graceful Contact Us 412 handling** — a blocked submit now shows a friendly message + support number instead of a raw error.
6. **Support phone updated** to 866-204-1902 (old number fully removed).
7. (Earlier) Contact form 400 fix (stray `targetUserId` broke every member submit); free-trial banner hidden per owner.

### ⏭️ Next
1. **DEPLOY the bundle (the gate).** Nothing above is live until `build/` is uploaded to the VPS.
2. **Verify the funnels on prod** post-deploy (walk name/v2 + phone/v2; confirm conversion signals fire). Prod search is Turnstile-gated, so needs a human to solve the captcha.
3. **Per-ad-unit content optimization** (owner, this week): the inmate/criminal/business ad units promise data the generic results page doesn't show yet — align copy *or* surface that data.
4. **Remaining funnel UX:** premature "Searching…" interstitial ordering; the phone/email "state" step that collects input but never uses it; V1 landings have no FCRA consent step while V2–V6 do.
5. **Contact form Turnstile rendering** (deferred) — only needed if BC's anti-abuse rule challenges *real* customers; currently it just fails gracefully.

### 🔎 Assessment
The funnel fix is the highest-dollar item in the building: **7 paid ad units have been spending money with zero conversion signal back to Google.** That's been bleeding budget the entire time they've been live. The fix is verified but **not yet deployed** — deploying it is the single most valuable action today. Secondary risk: the Contact form *fails* (gracefully) for any email domain or volume that trips BC's anti-abuse rule — if a real paying customer hits it, they can't reach support.

---

## 2. CSR Web App (Admin)
*(No CSR code changed this session; status is per memory / last verified ~2026-06-19.)*

### ✅ Recently accomplished
1. **Logged-in CSR identity shown in top nav** (name/email, links to dashboard).
2. **Definitive CSR price panel** — pulls the real next-charge + date from `user.getOrder` schedule (BC "Ask A" resolved with Kwan, 2026-06-23).
3. **8 CSR reads migrated to lib-first** (csrWrapper IIFE) with live verification.
4. **`csrManager` role-gate fixed**; BC partially opened the collections CSR needs.
5. **CSR single-search + fuller order data**; multiple live triage sessions resolved deploy-skew bugs.

### ⏭️ Next
1. **Resolve the 4 open BC asks (B/C/D/E):** `billing.sale` for CSR-created orders, `commerceOrder` access, `userContact` confirmation, and `findAllUserContacts` (currently 403).
2. **Deploy the admin bundle** (candidate `admin.5613cbd9.js`) — also not yet shipped.
3. **EmailTickets inbox** — depends on the BC `userContact` endpoint landing (dedup + per-user enumeration).
4. **Pass full customer address** on CSR actions when fields are filled.
5. **`_viaCsr` mutation-safety hardening** (see assessment).

### 🔎 Assessment
CSR is **gated on ByteCrtrs** more than on our code — 4 open asks block real functionality. Known structural hazard: the shared `_viaCsr` helper re-runs mutations on a post-send throw and can mask wrong-shaped lib responses as empty lists — a financial-integrity risk to clean up before heavy CSR mutation use. CSR is **not the launch-day critical path** (consumer + reporting are), but the admin bundle should be deployed alongside consumer.

---

## 3. Email

### ✅ Recently accomplished
1. **Cracked BC's template engine** — it evaluates JavaScript in `${...}` (confirmed via a live `${if}` render). Means we can format dates/money ourselves, no BC dependency.
2. **Rehabbed 10 transactional templates** (signup, cancel, uncancel, contact-confirmation, reset-password, CSR-reply, remarketing 1–4) → `docs/email-templates/`.
3. **Found + fixed systemic bugs:** hardcoded "IDLookup" (breaks other brands), raw ISO timestamps as dates, unformatted money ("$1", "30 Day"), and a customer email that leaked internal sentinels back to the user.
4. **Found the biggest one:** **all 4 remarketing emails were missing their CTA button** — conversion emails with no way to convert.

### ⏭️ Next
1. **Answer 5 BC token questions** (below) — esp. the upgrade/checkout **path token**, or every remarketing CTA links nowhere.
2. **Upload the 10 templates** to BC's new HTML tool.
3. **One test send** to confirm rendering + formatting.
4. **Welcome-on-signup email** (BC ask #21) — confirm it actually sends now.
5. Decide whether we also want a **separate internal CS notification** email.

### 🔎 Assessment
The email layer was in worse shape than expected — the **remarketing series (paid trial non-converters) literally could not convert** because the templates had no buttons. That's a direct, ongoing revenue leak on warm leads. Fixes are ready but **blocked on a few BC token names we don't have** (the upgrade path is the critical one). Low risk to ship once those are confirmed.

---

## 4. Reporting / Analytics

### ✅ Recently accomplished
1. **GA4 dataLayer bridge** — every consumer telemetry event now also flows to GTM→GA4 (namespaced `client_*`, PII-free by construction).
2. **`actor` dimension** — every event tags visitor vs member, so we can split pre-signup vs post-login searches.
3. **Unique funnel-page identity** — `search_type` + `variant` + `step` on every funnel event.
4. **Per-ad-unit conversion attribution** — `funnel_variant`/`funnel_search_type` on the actual Google Ads conversion events.
5. **Two reference docs** for the team: `docs/EVENTS_CATALOG.md` (full event inventory, for Jerome) and `docs/GA4_SETUP.md` (GTM wiring guide).

### ⏭️ Next
1. **Wire GA4 in GTM** (console work, per the guide): config tag + event tags + triggers + variables. **This is what actually captures the data we're now emitting.**
2. **Confirm Google Ads conversions** are firing (the standalone Ads gtag is disabled; conversions should flow via the GTM container).
3. **GA4 DebugView QA** — verify events arrive and **no PII** leaks.
4. **Mark `purchase` / `sign_up` as key events** in GA4.
5. Roll GA4 to the **other two brands** (PeopleSearcher, InmateFinderHub) once idlookup is proven.

### 🔎 Assessment
We are about to spend on paid traffic while the analytics pipe is **half-connected**: the app *emits* everything correctly, but **nothing captures it until the GTM tags are built.** If we push traffic before GA4 + Ads conversions are wired, we're optimizing spend blind. **GA4/GTM wiring should happen today, alongside the deploy.** Caveat for Jerome: there are two session IDs (BC tracking store vs GTM/GA4) joined on `trackingSessionId` — documented, but a reporting nuance.

---

## 5. Cross-Cutting / Platform

### ✅ Recently accomplished
1. **ByteCrtrs live in production** (2026-06-23) — real auth/search/billing.
2. **BC removed the prod password-captcha**; remaining gating is a Cloudflare Turnstile anti-abuse rule.
3. **Security:** open-redirect + 4 Dependabot alerts patched (2026-06-22).
4. **Browser-automation agent** (Playwright MCP) stood up for end-to-end testing / online tasks.
5. **Deployment model confirmed:** production is a pure React SPA; `/server` is dev-mock only; emails + persistence are BC-side.

### ⏭️ Next
1. **Deploy consumer + admin bundles** to the VPS (manual upload — no CI/CD).
2. **Triage 3 new Dependabot vulns** (1 high) flagged on push — post-launch.
3. **BC anti-abuse rule tuning** — allowed email domains + per-domain daily cap (owner ↔ BC).
4. **Document BC template/token reference** (we're reverse-engineering hook + path tokens email by email).
5. **Production observability** — `console.*` is stripped in prod, and there's no error monitoring; consider a lightweight client error reporter.

### 🔎 Assessment
The platform's biggest fragility is **operational, not code:** deploys are a **manual VPS upload with no CI/CD or rollback**, and **prod has no error visibility** (console stripped, no monitoring) — so a live bug is hard to even detect, let alone diagnose. We also carry a **heavy ByteCrtrs dependency**: open asks, an anti-abuse rule we don't control, and undocumented template tokens. None of this blocks launch, but the deploy-and-observe loop is the thing most likely to bite us once real traffic is flowing.

---

## TL;DR — the three things that matter most today
1. **Deploy the consumer bundle.** 7 paid funnels are bleeding ad spend with no conversion tracking until it ships. *(then admin bundle)*
2. **Wire GA4 + Google Ads conversions in GTM.** We're about to pay for traffic we currently can't measure.
3. **Unblock email** with the 5 BC token answers, then upload — the remarketing series can't convert warm leads as-is.

### Open questions for ByteCrtrs (blocks email + clarity)
1. Upgrade/checkout **path token** (`comp.client.paths.?`) — guessed `payment`; wrong key breaks all remarketing CTAs.
2. `code.campaign` hook — does it expose `to.firstName`, the **searched subject**, and an **offer/expiry**?
3. Reset-password link — does `url.login` reach a **set-new-password** page or just login?
4. **Anti-abuse rule** config — are real domains (gmail etc.) + real daily volume safe from challenge?
5. Any **pre-formatted date/money tokens**, or do we keep formatting in-template?
