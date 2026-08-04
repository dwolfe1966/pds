# CSR — User Detail: What Every Action Does

Reference for the **User Detail** page (`/users/:id`) in the CSR/admin app. Every action a CSR can take on a customer, what it *actually* does under the hood, and — critically — its effect on **billing** vs **login access** (the #1 source of confusion).

> **The one rule to remember:** **Login access** and **billing** are two separate switches.
> - **Suspend** flips *access* off. Billing keeps running.
> - **Cancel Subscription** flips *billing* off. Access stays on until the period ends.
> Doing one does **not** do the other.

Source: `src/pages/admin/UserDetailPage.js` (+ `userState.js`, `RefundEmailModal.js`). Last verified 2026-08-04.

---

## Where the actions live

Actions are in **two places** on the page:

1. **Left action rail** (always visible beside the profile) — the high-frequency account actions.
2. **"Actions" tab** (right panel) — a "Recommended Actions" list with everything else.

Some actions appear in **both** (e.g. Suspend). They're the same action.

---

## 1) Left action rail (always visible)

| Action | What it does | Under the hood | Billing effect | Access effect | Reversible? |
|---|---|---|---|---|---|
| **Suspend Account** | Locks the customer out — they can't log in | `adminSuspendUser` → user status `blocked` | ❌ **None — keeps billing** | 🔒 Blocked immediately | ✅ Unsuspend |
| **Unsuspend Account** | Restores login | `POST /users/:id/unsuspend` → status `active` | None | 🔓 Restored | — |
| **Cancel Subscription** | Stops future charges (cancel-at-period-end) | `adminCancelOrder(orderId, true)` → `cancelUncancelOrder` | ✅ **Stops future billing** | Stays on until period end, then expires | ✅ Reactivate |
| **Log in as user** (impersonate) | One-click link to sign in *as* the customer and troubleshoot | `adminGetAutoLoginUrl` → bearer login link | None | None (it's *your* view of their account) | N/A — link is single-use, logged, never stored |

**Notes**
- **Cancel Subscription** only becomes clickable when the account has an *active* subscription. Otherwise it's greyed with "No active subscription to cancel."
- **Log in as user** generates a live credential — admins only, and every use writes an audit note (the note records who/when, never the URL).

---

## 2) "Actions" tab — Recommended Actions

| Action | What it does | Under the hood | Notes |
|---|---|---|---|
| **Edit User Profile** | Edit name / email / phone / etc. | `adminUpdateUser` | Writes an audit note. |
| **Opt out of Email** | Unsubscribes the customer's email from **marketing** email | `optOutManagedContact('email')` | Does **not** stop transactional/account email (receipts, resets). Note logged. |
| **Opt out of SMS** | Unsubscribes their phone from **marketing** SMS | `optOutManagedContact('phone')` | Same as above for texts. Note logged. |
| **Request Data Removal** | Files a data-removal request | `adminCreateNote` + `adminCreateCsrMail` to ops | ⚠️ Does **NOT** delete data itself — there's no CSR delete endpoint. It logs a note and emails ops; actual removal happens off-platform per SOP. |
| **Suspend / Unsuspend Account** | *Same action as the left rail* | `adminSuspendUser` | Blocks login only — **does not stop billing**. |
| **Issue Refund (Most Recent Order)** | Opens the refund screen for the latest order | Navigates to `/purchases/:orderId` | Doesn't refund here — it *takes you* to the Purchase Detail page, where the refund actually executes (`adminRefundPurchase`). |
| **Request Billing Action** | Emails the **finance team** to make a billing change | `RefundEmailModal` → `adminCreateCsrMail` to finance | For billing actions a CSR can't/shouldn't do directly. Finance responds ~1 business day. |
| **View All Orders** | Lists all of this customer's orders | Navigates to `/purchases?userId=` | Read-only navigation. |
| **Create Order (Agent)** | Creates a new subscription order (e.g. retention save / comp) | `adminCreateOrder` with a chosen offer | Uses card on file or a comp offer. Requires a reason. Audited. |

---

## Billing actions — which tool for what

There are **four** billing-related tools and they are easy to confuse:

| Goal | Use | Effect |
|---|---|---|
| Customer wants to **stop paying / leave** | **Cancel Subscription** (left rail) | Stops future charges; keeps access to end of paid period |
| **Refund a charge** that already happened | **Issue Refund** → Purchase Detail | Returns money on a specific payment |
| A billing change **you can't do yourself** | **Request Billing Action** | Emails finance to handle it |
| **Give** the customer a plan / retention offer | **Create Order (Agent)** | Creates a new order |
| Block a **bad actor / fraud** (not a normal cancel) | **Suspend** | Blocks login (billing continues — usually pair with Cancel) |

---

## ⚠️ Known sources of confusion (flagged for cleanup)

1. **Suspend ≠ Cancel** — the historical trap. CSRs suspended thinking it cancels billing; it doesn't (customer stays charged while locked out). *Mitigated 2026-08-04:* the Suspend dialog and an inline helper now spell this out, and a Cancel Subscription button was added to the left rail.
2. **Suspend appears twice** (left rail + Actions tab) — same action, two entry points. Harmless but redundant.
3. **Cancel Subscription is only on the left rail**, not in the Actions tab — inconsistent with Suspend. *Candidate:* mirror it into the Actions tab so both live together.
4. **"Issue Refund" doesn't refund on this page** — it navigates to Purchase Detail. The label reads like a one-click action.
5. **"Issue Refund" vs "Request Billing Action"** — both are refund-adjacent: the first is *do it now* (direct), the second is *ask finance*. The labels don't make that distinction obvious.
6. **"Request Data Removal" doesn't remove data** — it files a request; removal is off-platform.

---

## Glossary (the canonical definitions, from `CSR_TERMS`)

- **Suspend** — Lock the account (user can't log in). Reversible via Unsuspend. **Does not stop billing.**
- **Cancel** — Stop the subscription's future billing (cancel-at-period-end). Access continues until period end. Reversible via Reactivate.
- **Void** — Kill a charge before it settles — no money moves.
- **Refund** — Return money on a charge that already settled.
