# Paid Search — Wave 0 punch-list (tracked)

**Purpose:** the prerequisites that must be **done + verified** before any Wave-1 spend. Update `Status`
in the repo as items land. **Nothing in Wave 1 launches until the exit gate is green.**

**Status key:** ☐ todo · ◐ in progress · ☑ done · ⛔ blocked
**Owner key:** L Lead · D Developer · A Analyst · Dz Designer

| # | Status | Item | Owner | Notes / acceptance |
|---|---|---|---|---|
| **A. Conversion tracking (the #1 blocker)** |||||
| A1 | ☐ | Audit every **"Eligible (Misconfigured) — missing a Google tag"** campaign | A | List: Reverse Phone ×3, PS-Main-lower, LE-marriage-lower, LE-divorce-lower, BG-Misc-Misc. These spend **untracked**. |
| A2 | ☐ | Install/verify the **Google tag** (gtag/GTM) on every funnel page | D | v11 landing + each SUP + **purchase/confirmation** page |
| A3 | ☐ | **GCLID capture → persisted to the BC sale** | D | gclid captured on landing, carried in `referralParams` alongside `shns`, written to `commerceorders.refer`. **No gclid at the sale = no attribution = eCPA reads ∞.** Make-or-break. |
| A4 | ☐ | Conversion action = **purchase**, value = **order value**, count = one-per-click | A | Enable Enhanced Conversions if feasible |
| A5 | ☐ | **Verify on a REAL purchase** | D/A | Test buy → appears in Google Ads "Recent conversions" + GA4 realtime (real human, not headless) |
| **B. Guardrails (before spend)** |||||
| B1 | ☐ | Build the **portfolio Target CPA** bid strategy | A | Pools learning across the migrated core |
| B2 | ☐ | Build the **eCPA kill-switch** automated rule | A | Pause/alert if 7-day Cost/conv > **proven ×1.4** AND conv ≥ 15 (floor kills noise) |
| B3 | ☐ | Set **daily budget caps** (Wave-1 starts) + confirm rule coverage | A | Budgets are ceilings, not targets |
| **C. Structure & hygiene** |||||
| C1 | ☐ | **Account-ownership check per campaign** → modify-in-place vs rebuild | L/A | Anything already in our account: repoint landing to v11, **keep bid learning** (lowest eCPA risk) |
| C2 | ☐ | Conversion actions, **naming** (`Vertical – Segment – v1`), **geo = US**, ad schedule | A | |
| C3 | ☐ | **Shared negative-keyword** + brand lists | A | jobs, "how to", free-only, DIY, competitor brands as needed |
| C4 | ☐ | **v11 CVR pre-check** per vertical | A | Estimate from existing traffic so the landing (the one changed variable) isn't blind |
| C5 | ☐ | Confirm the **`shns` id map** + resolver → correct SUP per campaign | D | ids in the build sheet; default v11 where no SUP |
| **D. Compliance (gates the sensitive verticals)** |||||
| D1 | ⛔ | **SSN policy/legal sign-off** | L | Proven SSN keywords ("find someone by ssn", "ssn finder") are **Google-prohibited**. Do NOT migrate as-is — see keyword doc. Blocks the SSN campaigns only. |
| D2 | ☐ | **Criminal / arrests copy** review | L | No guilt implication; "records may be available"; no individual targeting |
| D3 | ☐ | Confirm **no "$1 / credit-card-required"** creative anywhere | L/Dz | Source copy is built on it → must be rebuilt compliant (see ad-copy doc) |

**Wave-0 exit gate (all must be true):**
- ☐ A real purchase attributes in **both** Google Ads + GA4 (A5)
- ☐ Portfolio tCPA + eCPA kill-switch live (B1–B2)
- ☐ Ownership decided per campaign; naming/geo/negatives/shns set (C1–C5)
- ☐ SSN sign-off resolved (D1) — or SSN held out of Wave 1
