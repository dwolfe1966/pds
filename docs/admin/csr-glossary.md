# CSR glossary — statuses & actions

Single reference for the status terms and actions in the CSR/Admin app. The two axes that
get confused — **account state** vs **subscription/billing state** — are independent.

## The mental model (read first)
- **Account state** = *can this person use the account?* (an **access** control)
- **Subscription state** = *is this subscription paying / will it bill again?* (a **billing** state)

A user has BOTH at once, in any combination (e.g. a *Suspended* account can still have a
*Cancelled* subscription).

---

## Account state (the user header's left badge)
| Term | Meaning | BC | Reversible |
|---|---|---|---|
| **Active** | Account works normally; user can log in. | `status = 'active'` | — |
| **Suspended** | Account is **shut down** — the user **can't log in / loses access**. Used for abuse, fraud, chargeback risk, or owner request. *Not* about billing. | `status = 'blocked'` ("Suspended" is our label; BC has no `suspended`) | **Suspend ↔ Unsuspend** (→ `active`) |

## Subscription / plan state (the plan badge + order status)
| Term | Meaning | BC | 
|---|---|---|
| **Free** | Signed up but **no payment collected** — not a paying customer. | no collected payment / no order |
| **Trial** | Active paid order, **still in the trial** (paid the $1, hasn't been billed a full recurring cycle yet). | active order, `collected < recurring` |
| **Subscriber** | Active **recurring** subscription — a full cycle has billed. | active order, full cycle billed |
| **Cancelled** | Subscription is **set to stop** — it **won't renew / no future charges** — but the user **keeps access until the current paid period ends** (cancel-at-period-end). | `subStatus = 'canceled'`, `status` stays `active` until `dueTimestamp` |
| **Expired** | Subscription **has ended** — no active paid order remains. | `subStatus = 'expired'` / no active order |

---

## Actions (what they do, and what they touch)
| Action | Acts on | Effect | Reverse |
|---|---|---|---|
| **Suspend** | the **account** | Locks the user out (can't log in). Punitive/protective. | **Unsuspend** |
| **Cancel** | the **subscription** | Stops future billing (cancel-at-period-end); access continues until period end. | **Reactivate** (within the period) |
| **Void** | a **charge (pre-settlement)** | Kills a charge **before** it settles — no money moves. | n/a |
| **Refund** | a **charge (settled)** | Returns money on a charge that **already** settled. | n/a |

### The distinctions that get confused
- **Suspend ≠ Cancel.** Suspend shuts down the *account*; Cancel stops the *subscription's* future billing. A cancelled subscriber still has a working account until their period ends.
- **Void ≠ Refund.** Void = before settlement (no money moved); Refund = after settlement (money returned).
- **Cancelled ≠ Suspended ≠ Expired.** Cancelled = won't renew (still has access); Suspended = locked out (access dimension); Expired = the sub already ended.

---

*Source of behavior: `src/pages/admin/userState.js` (plan state), the suspend write
(`apiRouterAdmin` → `status:'blocked'`), and the cancel/void/refund order actions. Keep this
glossary in sync if those change — and it's the source text for the in-app hover tooltips.*
