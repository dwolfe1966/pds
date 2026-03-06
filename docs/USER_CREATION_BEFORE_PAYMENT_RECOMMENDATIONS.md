# User Creation Before Payment – Recommendations

**Date:** January 26, 2025  
**Context:** Create users before payment; unpaid users should use the web and receive emails as prospects to convert.

---

## Business Model Summary

| Stage | User State | Capabilities |
|-------|------------|--------------|
| **1. Signup** | Unpaid prospect | Account created, no payment |
| **2. Engagement** | Unpaid prospect | Use web experience, receive emails |
| **3. Conversion** | Paid customer | Full access, reports, etc. |

---

## 1. Recommended User Flow

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Signup (free)  │ ──► │  Unpaid prospect    │ ──► │  Payment         │
│  email, name,   │     │  • Browse/search    │     │  commerceBilling │
│  password,      │     │  • Teaser results   │     │  /sale           │
│  optin          │     │  • Receive emails   │     │                  │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
         │                            │                         │
         │                            │                         │
         ▼                            ▼                         ▼
   User created                 Lead nurturing            Paid customer
   (no payment)                 (conversion funnel)       (full access)
```

---

## 2. Architecture Recommendations

### 2.1 Separate Signup from Payment

**Recommendation:** Keep signup and payment as distinct steps.

| Step | Purpose | API / Backend |
|------|---------|---------------|
| **Signup** | Create user account, capture email + optin | Mock API or ByteCrtrs signup (if available) |
| **Payment** | Process sale for existing user | `commerceBilling/sale` |

**Why:** Unpaid users must exist in the system before payment. They need accounts to log in, use the web, and be targeted by email.

### 2.2 User Creation Backend Options

| Option | Pros | Cons |
|--------|------|-----|
| **A. Mock API (current)** | Already implemented, full control | Not production-ready, separate from ByteCrtrs |
| **B. ByteCrtrs signup endpoint** | Single system, consistent auth | Need to confirm if it exists in API |
| **C. Your own backend** | Full control, email integration | More infrastructure |

**Recommendation:**  
- **Short term:** Keep mock signup for development; ensure it stores `email`, `optin`, and supports email sending.  
- **Long term:** Confirm with ByteCrtrs whether they expose a signup/user-creation endpoint. If yes, migrate signup to ByteCrtrs.

### 2.3 commerceBilling/sale for Existing Users

When a user who already has an account completes payment:

- **userInfo** should identify the existing user (email, firstName, lastName, optin), not create a new one.
- The API may treat `userInfo` as “who is buying” rather than “create new user.”
- Confirm with ByteCrtrs: does `userInfo` always create a user, or does it only create when no user exists?

**Recommendation:**  
- For logged-in users: prefill `userInfo` from the current user.  
- For guests: either require login before payment, or support guest checkout if the API allows.

---

## 3. Unpaid User Capabilities

### 3.1 Web Experience (No Payment Required)

| Capability | Recommendation |
|------------|----------------|
| **Teaser search** | Allow without auth (visitor) or with auth (prospect) |
| **Landing pages** | Public |
| **Opt-out flow** | Public |
| **Dashboard / account** | Require auth (prospect or paid) |
| **Full reports** | Require payment |

**Recommendation:**  
- Allow teaser search for both visitors and logged-in prospects.  
- Require signup (free) to unlock features like saved searches, alerts, or a simple dashboard.  
- Gate full reports behind payment.

### 3.2 Email Capability

| Requirement | Implementation |
|-------------|-----------------|
| **Store email + optin** | Signup form captures `optin`; persist in user record |
| **Send emails** | Integrate with email provider (SendGrid, Mailchimp, etc.) |
| **Segment by paid/unpaid** | Flag or field on user: `isPaid` or `subscriptionStatus` |

**Recommendation:**  
- Add `optin` (boolean) to signup and user model.  
- Add `emailVerified` flow if needed for deliverability.  
- Use `subscriptionStatus` (or similar) to segment: unpaid vs paid.

---

## 4. Implementation Recommendations

### 4.1 Signup Page

- **Keep** as the first step; do not require payment.
- **Collect:** email, password, firstName, lastName, optin.
- **Flow:** Signup → redirect to dashboard or home (not payment).
- **Optional:** “Upgrade” or “Complete purchase” CTA for conversion.

### 4.2 Payment Page

- **Require** logged-in user (or support guest checkout if API allows).
- **Prefill** `userInfo` from current user when logged in.
- **Use** `commerceBilling/sale` only for payment, not for user creation.
- **Flow:** User clicks “Upgrade” or “Buy report” → Payment page → `commerceBilling/sale`.

### 4.3 Revert PaymentPage Changes (If Needed)

The recent change added user creation fields to the Payment page and used `userInfo` for creation. Given the new model:

- **Option A:** Remove account fields from Payment page; require login first; prefill `userInfo` from auth.
- **Option B:** Keep account fields only for guest checkout (if supported); otherwise require login.

### 4.4 Entry Points for Unpaid Users

| Entry Point | Action |
|-------------|--------|
| Search result → “View full report” | Prompt signup (free) → then “Upgrade to view” |
| Home / landing | Signup CTA, no payment |
| Email link | Login or signup → conversion CTA |

---

## 5. Data Model Considerations

### 5.1 User Record (Unpaid Prospect)

```
{
  id, email, passwordHash, firstName, lastName,
  optin: true,           // Marketing emails
  emailVerified: false, // Optional verification
  subscriptionStatus: 'unpaid' | 'active' | 'cancelled',
  createdAt, ...
}
```

### 5.2 Segmentation for Email

- **Unpaid + optin:** Prospects for conversion emails.
- **Paid:** Transactional and retention emails.
- **Unpaid + no optin:** No marketing emails.

---

## 6. Summary Checklist

| # | Recommendation |
|---|-----------------|
| 1 | Keep signup separate from payment; create users first |
| 2 | Allow unpaid users to use web (teaser search, browse) |
| 3 | Store `optin` and support email sending for prospects |
| 4 | Use `commerceBilling/sale` for payment only; prefill `userInfo` from logged-in user |
| 5 | Require login before payment (or support guest checkout if API allows) |
| 6 | Add “Upgrade” / “Complete purchase” CTAs for conversion |
| 7 | Confirm with ByteCrtrs: signup endpoint and `userInfo` semantics for existing users |

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2025
