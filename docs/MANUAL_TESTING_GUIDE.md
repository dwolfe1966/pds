# IDLookup.AI — Manual Testing Guide
**Last updated:** April 9, 2026

---

## Environments & Credentials

| Environment | URL | Notes |
|-------------|-----|-------|
| **Consumer (production)** | `https://dev.www.idlookup.ai` | Live BC API |
| **Admin (production)** | `https://dev.www.bytecrtrs.com/admin` | Must use **https** |
| **Consumer (local)** | `http://localhost:3000` | Mock search/auth |
| **Admin (local)** | `http://localhost:3003` | Requires proxy running |

### Credentials

| Account | Email | Password | Role | Notes |
|---------|-------|----------|------|-------|
| Admin/CSR | `admin@admin.admin` | `bcEdgeApiPass123!@#` | admin | BC CSR account |
| Test member | *(create via signup flow)* | *(must meet complexity)* | member | Password: 8+ chars, upper+lower+number+special |

### Local Development Commands
```bash
npm run dev              # Consumer app (3000) + mock API (3001) + tracking (3002)
npm run dev:admin        # Admin app (3003) + mock API + tracking
npm run install-server   # First-time setup for mock API
npm run install-tracking # First-time setup for tracking API
```

---

## Part 1: Visitor Experience (Unauthenticated)

The visitor funnel: **Landing Page → Loader → Search Results → Preview/Teaser → Signup → Payment → Member**

### 1.1 Landing Pages

Each search type has 6 design variations for A/B testing.

#### Name Search Landings
| URL | Variation |
|-----|-----------|
| `/name/landing` | v1 (base) |
| `/name/landing/v2` | v2 |
| `/name/landing/v3` | v3 |
| `/name/landing/v4` | v4 |
| `/name/landing/v5` | v5 |
| `/name/landing/v6` | v6 |

**Test inputs:** First name, Last name, State (optional), City (optional), Age range (optional)

#### Phone Search Landings
| URL | Variation |
|-----|-----------|
| `/phone/landing` | v1 (base) |
| `/phone/landing/v2` | v2 |
| `/phone/landing/v3` | v3 |
| `/phone/landing/v4` | v4 |
| `/phone/landing/v5` | v5 |
| `/phone/landing/v6` | v6 |

**Test input:** 10-digit phone number

#### Email Search Landings
| URL | Variation |
|-----|-----------|
| `/email/landing` | v1 (base) |
| `/email/landing/v2` | v2 |
| `/email/landing/v3` | v3 |
| `/email/landing/v4` | v4 |
| `/email/landing/v5` | v5 |
| `/email/landing/v6` | v6 |

**Test input:** Email address

#### Other Entry Points
| URL | Description |
|-----|-------------|
| `/` | Homepage (redirects to `/dashboard` if logged in) |
| `/search` | Generic search landing |
| `/search/all` | Tabbed search (name, phone, email) |

### 1.2 Search Flow

After submitting a search from any landing page:

| Step | URL | What to Test |
|------|-----|-------------|
| Loader | `/name/loader`, `/phone/loader`, `/email/loader` | Progress animation, phases display, search completes |
| Results | `/name/search-result`, `/phone/search-result`, `/email/search-result` | Result cards render, count shown, click card to view preview |

### 1.3 Search Result Preview Variations

After clicking a result card, visitors see a teaser/preview page with locked data and signup CTAs. **8 variations** controlled by `?v=` parameter.

| URL | Variant | Layout |
|-----|---------|--------|
| `/search/:id?v=1` | v1 | Inline signup form + full locked preview |
| `/search/:id?v=2` | v2 | Inline signup + benefits rectangle |
| `/search/:id?v=3` | v3 | CTA buttons only (no inline form) |
| `/search/:id?v=a` | Variant A | VCard + free signup form |
| `/search/:id?v=b` | Variant B | Experimental design B |
| `/search/:id?v=c` | Variant C | Experimental design C |
| `/search/:id?v=d` | Variant D | Experimental design D |
| `/search/:id?v=e` | Variant E | Experimental design E |
| `/search/:id` | Random | Randomly selects from all 8 variants |

**What to test on each variant:**
- [ ] Locked sections visible (phones, emails, addresses, criminal records, relatives)
- [ ] Unlocked teaser data shown (name, age, location)
- [ ] Signup CTA present and clickable
- [ ] Inline signup form works (v1, v2, a)
- [ ] CTA redirects to signup page (v3)

### 1.4 Signup

| URL | Description |
|-----|-------------|
| `/signup` | Standard signup form |
| `/signup/v2` | Stepped signup variant |
| `/name/signup?selected=<id>` | Signup from name search (pre-fills person info) |

**Test cases:**
- [ ] Email validation (valid format, unique)
- [ ] Password complexity: min 8 chars, uppercase, lowercase, number, special character
- [ ] Error messages for weak passwords
- [ ] Successful signup redirects to `/payment`
- [ ] Query params preserved: `?selected=`, `?personName=`, `?personLocation=`, `?personAge=`

### 1.5 Payment

| URL | Description |
|-----|-------------|
| `/payment` | Payment/billing page after signup |
| `/payment?upgrade=1` | Upgrade prompt for free members |

**Test cases:**
- [ ] Credit card form renders
- [ ] Payment processes (test card on dev environment)
- [ ] Subscription activates on success
- [ ] Redirects to report detail (`/people/:id`) after payment
- [ ] Error handling for declined cards

### 1.6 Opt-Out Flow (Public)

| URL | Description |
|-----|-------------|
| `/opt-out` | Opt-out search landing |
| `/opt-out-results` | Opt-out search results |
| `/opt-out/request` | Submit opt-out request form |

### 1.7 Legal / Static Pages

| URL | Description |
|-----|-------------|
| `/about` | About page |
| `/contact` | Contact page |
| `/partner` | Partner page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/refund` | Refund policy |
| `/suppression-list` | Suppression list info |
| `/cpcc` | CPCC page |
| `/addon` | Add-on services page |

---

## Part 2: Member Experience (Authenticated)

Login at `/login` with a member account (create one via the signup flow).

### 2.1 Dashboard & Navigation

| URL | Description | What to Test |
|-----|-------------|-------------|
| `/dashboard` | Main dashboard | Recent activity, quick actions, subscription status |
| `/people-search` | Member search page | Name/phone/email search tabs, city + age range filters |
| `/people-results` | Search results | Results display, pagination, click to view report |
| `/people/:id` | Full report detail | All 10 sections render (see below) |

### 2.2 Report Detail Sections

When viewing `/people/:id`, verify these 10 sections:

1. **Personal Information** — Name, aliases, DOB, age, gender, data provider
2. **Address History** — Street, city, state, ZIP, date ranges, "Current" label
3. **Phone Numbers** — Number, type, carrier, date ranges
4. **Email Addresses** — Address, type, date ranges
5. **Relatives & Associates** — Name, relationship, age, location
6. **Employment** — Employer, title, city/state, dates
7. **Education** — School, degree, dates
8. **Social Media & Online** — Network, URL, username
9. **Sex Offender Registry** — Offenders nearby or "clear" banner
10. **Additional Identities** — Secondary identity cards

**Summary bar** should show counts for: Phones, Emails, Addresses, Relatives, Employment, Nearby Offenders.

### 2.3 Account & Settings

| URL | Description | What to Test |
|-----|-------------|-------------|
| `/account` | Account management | View subscription, change password, view saved reports |
| `/who-is-searching` | Who viewed your profile | Page renders (may show empty state) |
| `/alerts` | Search alerts | Page renders |
| `/search-history` | Past searches | Lists previous searches |
| `/logout` | Sign out | Clears session, redirects to `/` |

### 2.4 PDF Download

On the report detail page (`/people/:id`), test the PDF download button. Also available from:
- Dashboard (recent reports)
- Account page (saved reports)

---

## Part 3: Admin Experience

### 3.1 Login

| URL | Description |
|-----|-------------|
| `https://dev.www.bytecrtrs.com/admin` | Admin landing page (if not logged in) |
| `https://dev.www.bytecrtrs.com/admin/login` | Admin login page |

**Credentials:** `admin@admin.admin` / `bcEdgeApiPass123!@#`

**Test cases:**
- [ ] Login form renders
- [ ] Invalid credentials show error
- [ ] Successful login redirects to `/admin/users`
- [ ] Nav bar appears with green header after login
- [ ] Sign out button works

### 3.2 Customer Management

| URL | Description | BC API |
|-----|-------------|--------|
| `/admin/users` | Customer Directory | `user.find` |
| `/admin/users/:id` | Customer Profile | `user.getUserDetail` |

**Customer Directory tests:**
- [ ] Customer list loads with real BC data
- [ ] Pagination works (Load More button)
- [ ] Nav bar search input finds customers by email
- [ ] Advanced Search panel: email (server-side), phone/zip/CC (client-side filters)
- [ ] Status filter (Active/All)
- [ ] Card view toggle
- [ ] "Details" link opens customer profile

**Customer Profile tests:**
- [ ] Profile card: name, email, status, tier, short ID, copy ID button
- [ ] All emails and phones listed
- [ ] Device type, IP address, last active shown (if BC provides)
- [ ] **Orders & Payments tab:**
  - [ ] Orders display as expandable cards
  - [ ] Click to expand shows payment rows
  - [ ] Payment details: date, amount, type (sale/refund/void), status, card, device
  - [ ] "Full Detail" link works
  - [ ] Load More Payments button
- [ ] **Refund controls:**
  - [ ] "Refund" button on each eligible sale payment
  - [ ] Inline refund form: editable amount, refund/void selector, confirm/cancel
  - [ ] "Refund All" button on order card
  - [ ] Batch refund confirmation modal with breakdown
  - [ ] Cancel Order / Reactivate Order buttons
- [ ] **Logins tab** — shows "not available" message (no BC endpoint)
- [ ] **Activity tab** — shows "not available" message (no BC endpoint)
- [ ] **Notes tab:**
  - [ ] Notes load from BC API (not localStorage)
  - [ ] Add Note form works
  - [ ] Note shows author name and timestamp
- [ ] **Actions tab:**
  - [ ] Send Password Reset Email
  - [ ] Suspend/Unsuspend Account
  - [ ] Issue Refund (navigates to order)
  - [ ] View All Orders

### 3.3 Order Management

| URL | Description | BC API |
|-----|-------------|--------|
| `/admin/orders` | All orders | `user.findOrders` |
| `/admin/purchases` | User-specific orders | `user.findOrders` |
| `/admin/purchases/:id` | Order detail | `user.getOrder`, `findOrderPayments`, `findOrderHistories` |

**Test cases:**
- [ ] Order list loads
- [ ] Order detail shows payments, history, schedule
- [ ] Refund from order detail page
- [ ] Cancel/reactivate from order detail

### 3.4 Opt-Outs (Combined Page)

| URL | Description | BC API |
|-----|-------------|--------|
| `/admin/data-removal` | Opt-Outs (tabbed) | `optOut.find`, `managedContact.find` |

**Tab 1 — Data Removal Requests:**
- [ ] List loads from BC
- [ ] Search by email/ID
- [ ] Status filter (Pending/Approved/Rejected)
- [ ] Approve button disabled with "Managed in BC admin panel" message
- [ ] Pagination

**Tab 2 — Phone Opt-Outs:**
- [ ] Phone contacts load from BC
- [ ] Phone numbers formatted correctly
- [ ] Active/Opted Out status badges
- [ ] "Opt Out" button works (calls `managedContact.unsubscribe`)
- [ ] Search by phone number
- [ ] Pagination

### 3.5 Other Admin Pages

| URL | Description | Data Source | What to Test |
|-----|-------------|-------------|-------------|
| `/admin/unsubscribe` | Email unsubscribe management | BC API | List loads, unsubscribe action works |
| `/admin/notes` | Notes (all users) | BC API | Notes list, create/update note |
| `/admin/mail-log` | CSR mail log | BC API | Mail list loads, send new CSR mail |
| `/admin/cs-reps` | CS Rep management | BC API | Create rep form (with password validation), update rep by ID |
| `/admin/email` | Email broadcast | Mock only | Compose form renders |
| `/admin/analytics` | Analytics dashboard | Tracking API | Session data from tracking API |
| `/admin/permissions` | Permissions matrix | localStorage | Yellow "local data" banner, grid renders |
| `/admin/content` | Content & UX management | localStorage | Yellow banner, CRUD works locally |
| `/admin/offers` | Offers & Products | localStorage | Yellow banner, stocks/products/offers tabs |
| `/admin/tickets` | Support tickets | localStorage | Yellow banner, ticket list + reply |
| `/admin/sessions` | Activity & Logs | Tracking API | Events/sessions from tracking API |

### 3.6 Navigation

**Nav items (14 total):**
Customers, Orders, Opt-Outs, Unsubscribed, Notes, Tickets, Mail Log, CS Reps, Broadcast, Analytics, Permissions, Content & UX, Offers, Activity & Logs

**Test:**
- [ ] All nav links work
- [ ] Active link highlighted
- [ ] Customer search input in nav bar
- [ ] Mobile hamburger menu
- [ ] Sign out button

### 3.7 Redirects (Removed Pages)

These old URLs should redirect:
| Old URL | Redirects To |
|---------|-------------|
| `/admin/payments` | `/admin/orders` |
| `/admin/phone-optout` | `/admin/data-removal` |
| `/admin/email-search` | `/admin/users` |
| `/admin/timesheets` | `/admin/analytics` |
| `/admin/logs` | `/admin/sessions` |
| `/admin/ux` | `/admin/content` |
| `/admin/uxc-history` | `/admin/content` |

---

## Quick Smoke Test Checklist

### Consumer App (5 minutes)
- [ ] Homepage loads (`/`)
- [ ] Name search landing v1 loads (`/name/landing`)
- [ ] Search produces results → loader → results page
- [ ] Preview page renders with locked sections (`/search/:id?v=1`)
- [ ] Login works (`/login`)
- [ ] Dashboard loads for authenticated user (`/dashboard`)
- [ ] Report detail shows all 10 sections (`/people/:id`)

### Admin App (5 minutes)
- [ ] Landing page loads (`https://dev.www.bytecrtrs.com/admin`)
- [ ] Login works with admin credentials
- [ ] Customer Directory loads with real users
- [ ] Click Details → Customer Profile loads
- [ ] Orders & Payments tab shows data
- [ ] Opt-Outs page loads with both tabs
- [ ] Sign out works

---

## Known Limitations

1. **Admin login requires HTTPS** — `http://dev.www.bytecrtrs.com/admin` will fail on API calls (CORS: http→https)
2. **Customer search** — only email works server-side; phone/zip/CC are client-side filters on loaded data
3. **Logins & Activity tabs** — show "not available" (no BC endpoint exists)
4. **CS Rep list** — BC cannot filter users by role; page provides create/update forms only
5. **Approve opt-out** — button disabled; approval must be done in BC's admin panel
6. **Pages with yellow banner** — data stored in browser only, not persisted to server
7. **Local dev search** — uses mock data; BC search only works on production (IIFE captcha requirement)
