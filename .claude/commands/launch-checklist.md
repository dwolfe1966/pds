---
description: Emit the IDLookup launch-readiness must-do list and verify each item against current code/state.
---

Walk the launch checklist for the IDLookup production rollout (target window 2026-05-11 → 2026-05-16). For each item, check current state and report status (✅ done / ⚠️ partial / ❌ open). Cite `file:line` where relevant.

## Items to verify

1. **Subscription state authority — `billing.getOrders()` is the only source of paid status.**
   - Grep for `isPaid`, `isSubscriber`, `subscriber:` in `src/` and confirm none gate UI.
   - Confirm `AuthContext` and `Dashboard2` derive paid status from a `getOrders()`-backed selector.

2. **Confirmation page → dashboard paid-state flow works.**
   - Trace: `PaymentPage.js` → success path → does it await/refresh `getOrders()` before navigating?
   - Confirm dashboard reflects paid state on the first render after purchase.

3. **Deployed bundle hash matches local `build/`.**
   - This is operational, not a code check — recommend running the `deploy-verifier` agent against the production host once uploaded.

4. **Admin user-detail completeness.**
   - `src/pages/admin/UserDetailPage.js` must surface orders, searches, logins, reports.
   - Confirm Searches and Reports tabs (`c693b86`); confirm logins data path.

5. **Consumer bundle has zero vendor / endpoint info.**
   - Recommend running the `launch-readiness-checker` agent on the latest `build/`.
   - Quick spot check: `grep -c "ByteCrtrs\|bytecrtrs\|csrWrapper" build/*.js 2>/dev/null` should be 0.

6. **Production env file sanity.**
   - `.env.production`: `REACT_APP_USE_MOCK_API=false`, `REACT_APP_NEW_API_ENABLED=true`, `REACT_APP_USE_NEW_API_AUTH=true`, `REACT_APP_NEW_API_URL=/api`.
   - No `localhost` / `127.0.0.1` references.

7. **WSFY (Who's Searching For You) is behind a "Coming Soon" banner — no live API call that would 500.**
   - `src/pages/member/WhoIsSearchingPage.js` should render the banner unconditionally.

8. **Orphaned routes / dead nav links.**
   - Cross-check `src/App.js` routes against `MemberNav`, `AdminNav`, `SalesNav`. Past gotcha: `EmailBroadcastPage` orphaned for weeks.

9. **No source maps in `build/`.**
   - `ls build/*.map 2>/dev/null` — should be empty.

10. **BC cert sanity.**
    - All absolute hostnames in `src/` and `.env.*` should be in `dev.admin.www.bytecrtrs.com` or `dev.gwhubadmin.www.bytecrtrs.com` SAN, OR be relative `/api`. Hardcoded `dev1.dev.www.bytecrtrs.com` and `dev.www.bytecrtrs.com` references in `apiWrapper.js` are known fallbacks — flag if newly added.

11. **Colored card-brand logos on every checkout surface (card-brand / TRX compliance).**
    - Required by the card brands (flagged by payments provider TRX): the colored Visa/Mastercard/Amex/Discover acceptance marks must be visible at checkout.
    - Confirm `CardBrandMarks` is imported and rendered on EVERY card-entry surface — currently `src/pages/sales/PaymentPage.js` AND `src/pages/sales/SearchDetailPreviewVariantB.js` (inline checkout). Grep: `grep -rl 'name="cardNumber"' src/pages` → each hit must render `<CardBrandMarks`.
    - Marks must be visible by default (not only on detection); detected brand emphasized, others dimmed. Inline SVG, NOT image assets (Parcel resolves `.png` imports to `{}` at runtime).
    - Card/Expiry/CVV fields must NOT show the red error border on first load — only after blur or a failed submit (gate `inputError` on `touched.X`).

## Reporting format

```
🚀 Launch Checklist
Date: <today>  Branch: <git branch>  HEAD: <short SHA>

1. Subscription authority         ✅ / ⚠️ / ❌  — <one-line note>
2. Payment → dashboard flow       …
...

Open items:
- <highest-priority outstanding>
- ...

Net read: GO / GO-WITH-FIXES / NO-GO — <one-sentence recommendation>
```

Don't mutate code; this is a status-only report. Cap at 500 words.
