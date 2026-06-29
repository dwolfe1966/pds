# LP funnel-tracking consistency audit (for BC reporting)

**Date:** 2026-06-29 · **Trigger:** BC reporting validated **Name LP v3** (real-match + thin-match walks) and asked whether the other LP→signup flows track the same way so one funnel report works across all of them.

**Scope:** the full funnel per vertical — LP wizard → loader → results → signup → payment — across **Name / Phone / Email × versions V2–V6** (15 LP files).

---

## Verdict by layer

### ✅ LP wizard steps — consistent within each vertical (verified)
Every version (V2/V4/V5/V6) emits **identical `search_step` events to its vertical's V3** — confirmed by a structure-normalized diff of all 15 files (the only diffs are code layout — inline `if` vs wrapper — not events). So the v3 step pattern Jerome mapped **is already replicated** across the A/B versions. Per-vertical sequences:

| Vertical | LP step sequence (the `search_step` `step` values) |
|---|---|
| **Name** | `searching-one` → `location` → `searching-two` → `details` → `confirm` → `final-search` (+ `landing_view`, `fcra_agree`) |
| **Phone** | `searching-one` → `location` → `confirm` → `final-search` (+ `landing_view`, `fcra_agree`) |
| **Email** | `searching-one` → `email` → `context` → `confirm` → `final-search` (+ `landing_view`, `fcra_agree`) |

### ✅ Signup + payment — shared, so consistent
`signup_complete` (useSignup), `payment_start` / `payment_complete` / `gtmPurchase` (PaymentPage) are single shared code paths → identical for every flow.

### ✅ Thin-match zero-state — same mechanism
All three results pages use the same `readThinMatch` + `campaign.search.zeroState === 'thinMatch'` logic, and all emit `results_view`. So the thin signature (results_view fires; rc=0) is driven consistently.

### ⚠️ `teaser_view` / `result_click` — per-vertical results pages, NOT yet verified identical
These live in separate pages (`SearchResultsPage` / `PhoneSearchResultsPage` / `EmailSearchResultsPage`). `results_view` is consistent, but `teaser_view`/`result_click` emission differs by page (e.g. phone emits `result_click` with a masked name; name/email emit via different components). **The thin-match SKIP (no teaser_view/result_click on rc=0) needs to be confirmed identical across all three.** → audit item.

### ⚠️ Cross-vertical step mapping — the real blocker for ONE report
Name has **4** LP steps; phone/email have **3**. And the **same step value sits at a different funnel depth**: `confirm` is **S4** in name but **S3** in phone/email. So a single report keyed on the `step` value can't align verticals (the "Step 3 / Step 4" rows mean different things per vertical).

---

## The decision (drives whether any code change is needed)

**Option A — per-vertical funnel reports (no code change).** BC builds a Name / Phone / Email funnel template. Within each, all versions are already consistent (verified). Ship today.

**Option B — one unified cross-vertical report (small code change).** Add two canonical fields to every funnel event:
- `step_index` (1, 2, 3, 4…) — the funnel position, vertical-agnostic
- `step_action` (`view` | `submit` | `outcome`)

Then BC maps any vertical to a uniform "Step N view/submit" grid regardless of internal step names, and the thin/real outcome rows stay aligned. This is the clean way to get a single report that survives funnel-shape differences.

**Recommendation:** if Jerome wants **one** report across name/phone/email → **Option B** (I add `step_index`/`step_action` to the `search_step` + results events; ~contained change, all in `trackingService`/the wizards). If per-vertical reports are fine → **Option A**, and the only remaining work is verifying the `teaser_view`/`result_click` thin-skip parity across the three results pages.

---

## Next steps
1. **Confirm with BC: one unified report (B) or per-vertical (A)?**
2. Either way: **verify `teaser_view`/`result_click` fire identically (and skip identically on thin) across the 3 results pages** — the one place real divergence could hide.
3. If B: add `step_index` + `step_action` to funnel events (single pass).
