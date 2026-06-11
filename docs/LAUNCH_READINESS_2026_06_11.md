# Lookback & Launch Readiness — 2026-06-11

## 1. What we shipped (last ~5 days — 60+ commits)

**Director of CS/Compliance 8-item batch — all done:**
- Email **unsubscribe** (public page + footer + Account tab) · CSR **refund** fix (`billingSeriesId`) ·
  account **Messages** pagination + **inline reply** + **threading** · optional **phone** at signup ·
  dashboard **complete-profile** prompt · CSR **partial email** search · CSR **UserDetail Timeline**
  (+ searched-subject metadata).

**Consumer dashboard overhaul:** trial-transparency banner · search-as-hero reorder · membership tile
repositioned below the green strip · removed the fabricated activity feed (trust) · hid empty stat tiles
for free members · subscribe promo · a11y (white headline contrast + keyboard focus rings).

**Payments / conversion:** payment confirmation receipt + `/paymentconfirm` URL · GTM de-dup (BC is the
single source) · Google Ads event wiring · SUP-consent gating on the BC `optout` flag · documented full
Google Ads conversion setup (`docs/GOOGLE_ADS_CONVERSION_SETUP.md`).

**shN / partners:** all 7 partner tokens wired · `optout`/`thinmatch` driven by BC `comp.client.theme`.

**Other:** full property **transfer history** in reports · 4 remarketing emails reframed + tokenized ·
Terms/Privacy aligned to compliance source docs · competitor strings scrubbed · CSR member-status +
ticket→customer links.

**BC implemented (verified):** `user.find` **order-by-id** · `getUserContacts` **targetUserId** (new
threads now appear).

## 2. Where we are — open items

### Ours (code)
| Item | Priority | Status |
|---|---|---|
| `apiWrapper.js` consumer/admin split (CSR endpoint paths + `bytecrtrs` strings leak into public bundle) | **P1** | not started |
| Close `/api-test` route in prod | P1 | not started |
| Graceful **5xx handling** (a BC outage shouldn't render a wiped-looking account) | P1 | offered, not started |
| Verify **display price = actual charge** (`brand.js` shows $1/$49.98; a comment claims BC charges $0.98/$39.01) | **P0 for real payments** | needs BC confirm |
| Thin-match experience: app-style form, std password, post-signup → payment (promo-teaser variant) → dashboard | P1 | in progress |
| All signup experiences: add **phone # as optional** | P2 (backlog) | filed |
| Trial→$49.98 **offline conversion** | P2 | scoped, on hold |

### BC (asks filed in `docs/BC_*.md`)
| Ask | Severity |
|---|---|
| **`comp.brand.gtm`** loads dev container on idlookup.ai + inmatefinderhub.com → breaks prod conversions | **Launch-gating** |
| **CSR tracking `updaterId`** server-side scoping (cross-user exposure) — needs re-verify now BC is back | HIGH |
| Refund `billingSeriesId` confirm + IIFE-path question | Med |
| Text/SMS **unsubscribe** endpoint (currently STOP-only) | Med |
| Server-side **partial** email/name CSR search | Low |
| Legacy `getUserContacts` backfill | Low (optional) |

## 3. Launch Readiness Assessment

**Verdict: CONDITIONAL GO** — functionally launch-ready; gates are a short P1 code list + a few BC-side
configs + live-payment validation.

**✅ Ready:**
- Code posture audit = GO-with-fixes. No secrets in the consumer bundle (captcha pass empty, secret-scan
  clean), no source maps, no competitor strings ship, console stripped, mock API off
  (`USE_MOCK_API=false`, `NEW_API_ENABLED=true`, relative `/api`), coming-soon pages inert.
- Compliance: FCRA disclaimers, unsubscribe, legal docs aligned, PDF disclaimer active.
- **TRX production credentials obtained** → real payments now possible on production.

**🟡 Must close before/at launch:**
1. **Payments end-to-end on prod** — BC must wire the TRX prod creds into the production billing
   environment; run one real low-value production transaction (sale + the refund fix) before go-live.
2. **Price display = charge** — confirm the production BC offer charges the displayed **$1.00 / $49.98**
   (not $0.98/$39.01). Display≠charge is a card-network/ad-platform compliance risk.
3. **GTM container fix** (BC `comp.brand.gtm`) — else Google Ads conversions won't fire on prod domains.
4. **P1 code** — `apiWrapper.js` split (removes CSR endpoint + `bytecrtrs` disclosure from the public
   bundle) and close `/api-test`.

**🔴 Address (not hard blockers):**
- CSR tracking cross-user scope (`updaterId`) — HIGH if a CSR sees another user's events. We client-filter
  as a safety net; re-verify BC's server-side fix.

**Recommended pre-launch sequence:** (1) re-verify `updaterId` + run a prod test payment/refund,
(2) confirm offer pricing, (3) BC fixes the GTM container, (4) `apiWrapper` split + close `/api-test` +
5xx handling, (5) final fresh build + re-run the secret scan.

---
_Snapshot generated 2026-06-11. Bundles at time of writing: consumer `ef037536`, admin `82c0d213`._
