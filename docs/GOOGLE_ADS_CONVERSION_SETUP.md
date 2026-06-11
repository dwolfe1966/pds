# Google Ads conversion tracking via GTM — setup guide

**Goal:** track **sign-up** and **payment** conversions from Google Ads using GTM.
**Status of our code:** ✅ done — the app already pushes both events to the dataLayer. No
frontend change is needed; the remaining work is in the **GTM container** and **Google Ads**.

Google Ads account: **`AW-18044069648`**.

---

## What the app already pushes (verified in source)

| Conversion | dataLayer `event` | Variables available | Fired from |
|---|---|---|---|
| **Sign-up** | `sign_up` | `method`, `search_type` | `gtmSignUp()` → `src/hooks/useSignup.js` on signup completion |
| **Payment** | `purchase` | `value` (**= $1.00 trial price**), `currency` (`USD`), `offer_key`, `items[]` — plus `orderId`, `transactionAmount`, `transactionCurrency` from the canonical context | `gtmPurchase()` + `setTransaction()` → `src/pages/sales/PaymentPage.js` after `billing.sale` |

> ⚠️ The client-side `purchase` event fires with the **$1 trial** value, not $49.98. It
> measures **trial starts** — the right early signal for Ads bidding. Counting the $49.98
> at trial-end is a separate **offline/server-side** conversion (see "Trial→$49.98" below).

Event/payload definitions live in `src/services/gtm.js` (`gtmSignUp`, `gtmPurchase`) and
`src/services/gtmContext.js` (`setTransaction` → `orderId`/`transactionAmount`/`transactionCurrency`).

---

## Part A — Google Ads: create 2 conversion actions
Tools & settings → **Conversions** → **+ New conversion action** → **Website** → choose
**manual / "use a different method" → Google Tag Manager**. Create two:

1. **"Sign-up"** — Category *Sign-up*, Value *Don't use a value*, Count *One*.
2. **"Trial start (Payment)"** — Category *Purchase*, Value *Use a different value for each
   conversion* (passed from the dataLayer), Count *One*.

Google gives a **Conversion ID** (`AW-18044069648`) and a unique **Conversion Label** per
action. Copy both labels for Part B.

---

## Part B — GTM container

### 1. Variables (User-Defined → Data Layer Variable)
- `DLV - value` → Data Layer Variable Name: `value`
- `DLV - currency` → `currency`
- `DLV - orderId` → `orderId`

### 2. Triggers (Custom Event)
- `CE - sign_up` → Event name: `sign_up`
- `CE - purchase` → Event name: `purchase`

### 3. Tags
- **`Conversion Linker`** — tag type *Conversion Linker* → trigger **All Pages**. Do this
  first; it sets the first-party cookies / GCLID capture for accurate attribution.
- **`Ads - Sign-up`** — *Google Ads Conversion Tracking*: Conversion ID `AW-18044069648`,
  Label `<signup label>` → trigger **CE - sign_up**.
- **`Ads - Payment`** — *Google Ads Conversion Tracking*: Conversion ID `AW-18044069648`,
  Label `<payment label>`, **Value** `{{DLV - value}}`, **Currency** `{{DLV - currency}}`,
  **Transaction ID** `{{DLV - orderId}}` → trigger **CE - purchase**.

### 4. Publish the container.

---

## Part C — Verify
1. GTM **Preview** → run a real signup + a test payment. In Tag Assistant, `sign_up` should
   fire `Ads - Sign-up` and `purchase` should fire `Ads - Payment` (value/currency/txn-id set).
2. Google Ads → Conversions: each action flips **Unverified → Recording conversions** within
   a few hours of the first real fire.

---

## ⚠️ Container gotcha (production)
The Ads tags must live in the GTM container that actually loads on the live domain. BC
injects the container via `comp.client.init.header` (`comp.brand.gtm`). Per-brand mapping:

| Domain | Correct container |
|---|---|
| `idlookup.ai` | `GTM-THCSBJWN` |
| `dev.www.idlookup.ai` | `GTM-WV7N6WWP` (dev) |
| `peoplesearcher.ai` | `GTM-PBFRPKNX` |
| `inmatefinderhub.com` | `GTM-TF6NWS79` |

**Known issue:** `idlookup.ai` and `inmatefinderhub.com` currently load the **dev** container
(`GTM-WV7N6WWP`), not their own — a BC `comp.brand.gtm` misconfig (see
`docs/BC_GTM_BRAND_CONTAINER.md`). Fix that (or temporarily add the tags to whichever
container is live) before relying on production conversions.

---

## Later: Trial → $49.98 offline conversion
The $49.98 charge happens server-side at trial-end with no browser session, so it needs an
**Offline Conversion Import** (GCLID captured at the ad click → uploaded when BC charges the
trial) or **Enhanced Conversions for Leads** (hashed email). Requires a BC "trial converted"
signal/webhook. Scope this as a follow-up when ready.
