# IDL capability checklist — "can we migrate a compet partner?"

**Framing (David/Jerome/Kwan, 2026-07-24):** the strategic prize is migrating compet's partners onto IDL to
stabilize the company financially. So "match & beat compet" isn't an abstract benchmark — it's **the concrete
capability bar a compet partner needs before we can move them.** This is that list: what IDL must do for a
partner, what we have, what's a gap, owner, status. It's the shared definition of "parity" so it stops being a
subjective "we're close / we're far" argument.

Legend: ✅ have · 🟡 partial · ❌ gap · N/A

## 1. Acquisition / entry (how partner traffic lands & converts)
| Capability | Status | Notes |
|---|---|---|
| Name funnel (landing → SRP → SUP → payment) | ✅ | v3/v11 validated live to payment 2026-07-24 |
| Email funnel | ✅ | `/email/landing/v2…v6` |
| **Phone funnel + internal APIs** | 🟡→❌ | landings exist (`/phone/landing/v2…v6`), but end-to-end phone→report + BC-side phone APIs need confirmation. Jerome flagged; **verify what's real vs missing.** |
| Partner **pre-pop + auto-submit** from URL params | 🟡 | Built for homefacts (name+city+state → auto-prime → SRP). **Each partner/entry type needs its own variant.** |
| Entry variant: **URL params → generic SUP as the first page** (e.g. Incent) | ❌ | Jerome's example. Not built — a SUP-first prepop entry is a distinct pattern from SRP-first. |
| Per-partner attribution (shN + placement) | ✅ | campaignRegistry + shN + GTM; homefacts shN keys live |
| Records-intent flows (SO / background / public) | ✅ (new, beyond compet) | differentiation, not parity |

## 2. Conversion / checkout
| Capability | Status | Notes |
|---|---|---|
| $1 trial → recurring sale (BC billing.sale) | ✅ | working; sale path untouched |
| Thin-match / zero-result handling | 🟡 | works; TooManyMatches on common names is common — worth a smarter retry (age/city narrow) |
| BIN / card-quality outcomes | ✅ (BC-owned) | BC blocks low-approval BINs (approval-rate, cross-volume). Bad-BIN declines = **traffic quality**, not a bug. **Keep compet BIN logic out of FE/CSR content.** |
| Offer/pricing per partner | 🟡 | campaign.offer.shmName supported; confirm per-partner offer coverage |

## 3. Data / enrichment (the payoff)
| Capability | Status | Notes |
|---|---|---|
| Core person report (BC/IDI) | ✅ | |
| Incarceration / booking augmentation | ✅ live | verified in prod (12/4/5 records across names) |
| **Life-events (divorce/marriage) augmentation** | ❌ live in prod | `/api/life-events` returns 0 for all names — **ENFORMION_* keys likely unset on prod deploy.** Confirm + enable. |
| Sex-offender (NSOPW) | ✅ (post-pay + flag pre-pay) | compliance-framed |
| Inmate DB freshness | 🟡 | live/on-demand crawls updating; **scheduled batch crawler down = GitHub Actions billing** (owner fix) |

## 4. CSR / back-office (a partner's customers must be serviceable)
| Capability | Status | Notes |
|---|---|---|
| Billing status matches BC.admin | ✅ | classifier aligned **72/72** to BC.admin on live data (M-code taxonomy, fraud=flag, voluntary/involuntary) |
| Cancelled/fraud not shown as "Active" | ✅ fixed 2026-07-24 | order-list badges keyed on subStatus (ibarra690 fix); vCard already correct |
| Billing events / decline detail | ✅ | Orders&Payments events table + decline gloss |
| CSR impersonation (log in as user) | ✅ | getAutoLoginUrl wired |
| Customers not getting billed (gaps) | 🟡 | Jerome flagged; **get the specific cases** to close |
| Refunds / cancels / suspends from CSR | ✅ | wired |
| CSR consistency across ALL surfaces | 🟡 | audited billing surfaces; UsersPage plan-*filter* still uses old getPlanState (display uses classifier) — cleanup |

## 5. Compliance / separation (non-negotiable)
| Item | Status |
|---|---|
| Compet/BIN internal logic **must NOT appear in FE or CSR content** (compet separation) | ✅ agreed — audit content to confirm |
| FCRA disclaimers across funnels | ✅ |
| Registry (NSOPW) display limits | ✅ |

---

## The honest read
- **Closest to parity:** name/email funnels, checkout, CSR billing, records differentiation.
- **Real gaps that block a partner migration:** (1) phone funnel + APIs, (2) SUP-first / per-partner prepop entry variants (Incent-style), (3) life-events enrichment down in prod, (4) specific "not getting billed" cases, (5) inmate-crawler billing.
- **Not gaps, just misread:** bad-BIN declines (traffic quality), and much of the CSR "nothing made sense" is now fixed (72/72 + the cancel badge).

## Next actions (owners)
- **David:** GitHub Actions billing (unblocks inmate crawler); confirm the "not getting billed" cases with Jerome; decide first partner to target.
- **Claude:** SUP-first prepop entry variant; verify/confirm phone-funnel completeness; the UsersPage filter cleanup.
- **BC (Kwan/Jerome):** confirm ENFORMION_* prod env (life-events); phone-funnel BC APIs; per-partner offer coverage.
