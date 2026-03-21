# Demo Walkthrough — March 20, 2026

## Quick Start (run before the demo)

```bash
npm run dev
```

Opens three processes:
- **React app** → http://localhost:3000
- **Mock API** → http://localhost:3001
- **Tracking API** → http://localhost:3002

---

## 1. Features Complete

### Core Demo Path (ByteCrtrs API)
- **Name search** — live teaser results from ByteCrtrs (visitor + member)
- **Phone search** — reverse phone lookup via ByteCrtrs reversePhone report
- **Email search** — live teaser results from ByteCrtrs
- **Signup** — full registration flow (`/signup`), ByteCrtrs `billingSignup()` called on submit
- **Multi-step signup variant** — `/signup/v2` with 4-step wizard and password strength meter
- **Payment** — ByteCrtrs `commerceBilling/sale` for card processing (`/payment`)
- **Login** — ByteCrtrs auth (`REACT_APP_USE_NEW_API_AUTH=true`), JWT stored in localStorage
- **Report viewing** — full structured report display: identities, phone/email/address contact data, FamilyWatchdog offender check
- **PaidRoute guard** — unpaid users redirected to `/payment?upgrade=1` before viewing reports

### Member Dashboard
- Subscription status badge (Active/Inactive), upgrade CTA for unpaid users
- "Complete Your Profile" banner when name/zip missing
- Quick actions: People Search, Alerts, Account
- Skeleton loading states throughout

### Member Pages
- Profile page (phone, zip, name, avatar initials, member-since)
- Settings (password change, notification preferences)
- Alerts (create/manage search alerts)
- Account (subscription status, billing history, cancel modal)
- Who's Searching For You

### Visitor Funnel
- Landing page variants: Name (V1–V6), Phone (V1–V6), Email (V1–V6)
- Loader pages with scanning animation and phase cycling
- Teaser/preview pages with amber CTA block and "recently viewed" note
- Token refresh: 401 → auto-refresh → retry → else logout

### Admin
- Users, Sessions, Purchases, CS Rep Management, Data Removal pages (mock data)
- Analytics page — funnel bar chart, daily line chart, KPI conversion rates, variant table
- Email Broadcast — compose and send to member segments, view email log

### Infrastructure
- Event tracking on all 9 funnel steps (landing → report view)
- Standalone tracking API with NDJSON storage (port 3002)
- Error boundaries, 404 page
- 215 passing Jest tests across 10 suites

---

## 2. Features Not Complete

| Area | Status |
|---|---|
| ByteCrtrs auth | **Wired** (`USE_NEW_API_AUTH=true`) but JWT from ByteCrtrs differs from mock shape — login may fall back to mock depending on server state |
| Opt-out flow | ByteCrtrs `optOut.request` not fully wired — form exists, pre-populated from report page, but API call uses mock |
| Admin pages | All mock-only (ByteCrtrs has admin API endpoints but migration not done) |
| Email platform | Console-log fallback only — requires `SENDGRID_API_KEY` in `.env` for real sends |
| Scheduled email digest | Not implemented (weekly digest job) |
| Persistent event storage | Tracking API uses NDJSON file — no DB backend |
| A/B variant tagging | `landing_view` only wired for Name V1; phone/email landing variants missing |
| CI/CD pipeline | Not configured |
| Toast notifications | Inline state only — no global toast system |

---

## 3. Sprint History

### Sprint 1 — Foundation & Core API (Early March)
- Established hybrid API router (ByteCrtrs new API + mock fallback)
- Name/phone/email teaser search live via ByteCrtrs
- Report creation and detail view with structured UI (FullContact, FamilyWatchdog, Identities)
- Payment via `commerceBilling/sale`
- Opt-out search status check
- All three visitor search funnels (sales flow)
- Fixed systemic `api.post/api.put` signature bug across 8 files
- Fixed response-unwrapping key mismatches across 6 admin/member pages

### Sprint 2 — Member Experience Uplift (March 15)
- SignupPage: password validation, correct redirect messaging
- PaymentPage: billing name pre-fill, "upgrade later" skip button, success message branching
- DashboardHome: profile completion banner, richer empty state
- AccountPage: subscription badge, upgrade CTA, cancel confirmation modal, pagination
- SettingsPage: password min-length, notification preferences section
- ProfilePage: phone field, save success banner, avatar initials, member-since display
- AlertsPage: `useEffect` token dependency bug fixed
- CSS Modules added for all member pages

### Sprint 3 — Visitor Funnel & Conversion (March 16)
- Subscription context (`isPaid`, `refreshSubscription`) added to AuthContext
- DashboardHome subscription-aware banners (paid/unpaid)
- Landing page variants: Name V1–V6, Phone V1–V6, Email V1–V6 (18 pages)
- Multi-step signup `/signup/v2` — 4 steps with password strength meter
- PaidRoute guard: unpaid users redirected before report access
- Loader scanning animation with phase cycling
- Teaser page amber CTA block + "recently viewed" note
- Token refresh: 401 → auto-retry → logout
- `?redirect=` param on ProtectedRoute → LoginPage

### Sprint 4 — Tracking, Analytics & Email (March 17–18)
- `trackingService.js` — fire-and-forget event posting
- Event tracking wired: `search_submit`, `teaser_view`, `signup_complete`, `payment_complete`, `results_view`, `signup_start`, `payment_start`, `report_view`, `landing_view`
- Standalone tracking API (port 3002) with NDJSON store, summary endpoint
- AnalyticsPage: KPI cards, funnel bar chart, daily line chart, variant table, top events table
- Skeleton loading components across dashboard, account, alerts pages
- Email platform: welcome + payment confirmation + broadcast emails (console fallback)
- EmailBroadcastPage: compose UI, email log table
- 215 passing / 241 total Jest tests

---

## 4. Demo Walkthrough

### Pre-demo checklist
- [ ] `npm run dev` running (all 3 servers)
- [ ] http://localhost:3000 loads
- [ ] Browser dev tools closed (clean look)
- [ ] Incognito tab ready for signup demo

---

### Step 1 — Visitor Name Search (ByteCrtrs live)

1. Go to **http://localhost:3000**
2. Type a first and last name (e.g., `John Smith`) and a state
3. Click **Search**
4. Watch the loader scanning animation → teaser results page
5. Note the amber CTA block mid-page prompting signup

**What this shows:** Live ByteCrtrs name teaser search, visitor funnel UX.

---

### Step 2 — Signup (New Account)

> Use an incognito window so you start unauthenticated.

1. From the teaser results page click **View Full Report** or **Sign Up**
2. Route: `/signup` — fill in:
   - **Email:** any new email (e.g., `demo@example.com`)
   - **Password:** at least 8 characters
   - **Full Name:** your name
   - **ZIP:** any 5-digit ZIP
3. Click **Create Account**
4. You will be redirected to `/payment` (because a search target was selected)

**Alternative — multi-step signup:**
- Go to **http://localhost:3000/signup/v2**
- 4-step wizard: Intent → Password (with strength meter) → Name+ZIP → Consent

---

### Step 3 — Payment (ByteCrtrs commerceBilling)

1. On the Payment page (`/payment`), enter card details:
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g., `12/27`)
   - **CVV:** `123`
   - **Billing name:** pre-filled from signup
2. Click **Complete Purchase**
3. On success → redirects to the report detail page for the selected person

**What this shows:** ByteCrtrs `commerceBilling/sale` end-to-end.

---

### Step 4 — Login (Existing Paid Account)

Use the pre-seeded **paid member** account:

| Field | Value |
|---|---|
| Email | `paid@test.com` |
| Password | `password123` |

1. Go to **http://localhost:3000/login**
2. Enter credentials above
3. Redirects to `/dashboard`
4. Dashboard shows **"Pro Member / Active"** subscription banner

**Admin account:**

| Field | Value |
|---|---|
| Email | `admin@test.com` |
| Password | `admin123` |

---

### Step 5 — Member Search & Report Viewing

> Logged in as `paid@test.com`

1. From the dashboard click **People Search**
2. Search by name — enter `John Smith` and a state
3. Click a result → full report loads at `/people/:id`
4. Report sections visible:
   - **Contact Info** — phones, emails, addresses
   - **Identities** — name variations, age, DOB
   - **FamilyWatchdog** — sex offender check

**Phone search:**
1. Click the **Phone** tab in the search bar
2. Enter any 10-digit number (e.g., `5551234567`)
3. Navigates directly to the report (no teaser step)

---

### Step 6 — Admin Analytics (bonus)

1. Login as `admin@test.com` / `admin123`
2. Go to **http://localhost:3000/admin/analytics**
3. Shows funnel conversion rates, daily event chart, landing variant breakdown

---

### Credential Summary

| Account | Email | Password | Notes |
|---|---|---|---|
| Paid member | `paid@test.com` | `password123` | Active subscription, can view reports |
| Free member | `member@test.com` | `password123` | No subscription — redirected to /payment |
| Admin | `admin@test.com` | `admin123` | Full admin dashboard access |
| New signup | any new email | 8+ chars | Use incognito for fresh signup demo |

---

*Generated March 20, 2026*
