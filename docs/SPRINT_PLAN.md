# Sprint Plan — Member Experience & Signup Flow

**Date:** 2026-03-15
**Sprint focus:** Visitor signup/payment flow validation + member page UI uplift

---

## 1. Signup → Payment → Member Flow: Bugs & Gaps

### SignupPage (`src/pages/sales/SignupPage.js`)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| A | Success message always says "Redirecting to payment…" even on the unpaid path | line 187 | Branch on `selectedPersonId` to show correct destination |
| B | Error block leaks dev hint ("check that the server is running") to end users | lines 263–265 | Remove `NODE_ENV` check; strip server-running hint from production render |
| C | No password minimum-length validation | handleSubmit | Reject before API call if `form.password.length < 8` |
| D | No password confirmation field | form | Add `confirmPassword` field; block submit if mismatch |
| E | User object built after signup may omit `id` field | lines 97–103 | Always extract `id` from `response.user?.id || response.user?._id` |

### PaymentPage (`src/pages/sales/PaymentPage.js`)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| F | No "skip payment" path for users who want to access dashboard without paying | JSX after `</form>` | Add "I'll upgrade later" link → `navigate('/dashboard')` |
| G | Post-payment fallback navigates to `/people/${selectedPersonId}` (teaser ID, not `commerceContentId`) | lines 197–199 | Only navigate to `/people/` if `reportResult.commerceContentId` is available |
| H | Billing first/last name fields are `required` but not pre-populated from `userInfo` | useState initializer | Init `billingFirstName` / `billingLastName` from `userInfo` in `useState` |
| I | `?simulate=failure` is not guarded by `NODE_ENV` — works in production | line 164 | Wrap `simulateParam` logic in `process.env.NODE_ENV === 'development'` check |
| J | Success message always says "Redirecting to your report…" even when going to /dashboard | line 237 | Branch on `selectedPerson` presence |

### Auth / Routing Gaps

| # | Issue | Files | Fix |
|---|-------|-------|-----|
| K | `ProtectedRoute` redirects to `/login` with no `?redirect=` param | `ProtectedRoute.js:12` | Append `?redirect=<currentPath>` to login redirect |
| L | `LoginPage` ignores `?redirect=` param after login | `LoginPage.js` | After successful login, check `?redirect=` and navigate there |
| M | No "unpaid member" guard — free-tier users can access all member features | All member pages | After subscription context is added: redirect to `/payment` if no active plan |
| N | `AlertsPage` `fetchAlerts` runs with potentially null token | `AlertsPage.js:24-27` | Add `token` to `useEffect` deps; add early `if (!token) return` guard |

---

## 2. Member Pages — UI Improvement Priority

| Rank | Page | Current State | Key Issues |
|------|------|--------------|------------|
| 1 | **SettingsPage** | 80 lines, zero styling | No design system, bare inputs, no feedback UX, no password confirmation |
| 2 | **ProfilePage** | 95 lines, minimal inline | No avatar, no phone field, no member-since display, silent save |
| 3 | **AlertsPage** | 92 lines, unstyled list | No empty-state art, no type badges, no delete confirmation |
| 4 | **AccountPage** | 363 lines, inline green styles | Needs subscription badge, cancel modal, billing history, upgrade CTA |
| 5 | **DashboardHome** | 340 lines, CSS Module (best) | Hardcoded "Pro Member / Active", no subscription-aware branching |

---

## 3. Enhancements by Page

### SettingsPage (Priority 1)
- Wrap in max-width card container using `var(--color-primary)` headings
- Add `confirmPassword` field with match validation
- Add min-length hint (≥ 8 chars) below password field
- Add "Notification Preferences" section (email alerts, weekly digest, marketing emails)
- Green success / red error banners replacing plain `<p>` tags
- "Danger Zone" section with disabled "Delete Account" placeholder

### ProfilePage (Priority 2)
- Avatar circle at top (initials from `fullName`, dark green background)
- "Member Since" line from `profile.createdAt`
- Add `phone` field (mock API supports it in seed data)
- Disabled email field with explanation note
- Inline green success banner on save (not silent)
- "Back to Dashboard" link in header row

### AlertsPage (Priority 3)
- "Create Alert" card above list with `criteria` + `frequency` + submit
- Helper text: "e.g., John Smith, New York"
- Alert list cards: green left accent, frequency badge (Instant=green, Daily=blue, Weekly=purple)
- Empty state with CTA: "Create your first alert"
- Inline delete confirmation ("Are you sure?") replacing `window.confirm`
- Fix `useEffect` token dependency (Gap N above)

### AccountPage (Priority 4)
- Plan & Billing card: colored status badge ("Active" green / "No Plan" gray)
- Upgrade CTA button for users with no subscription → `/payment`
- Cancel Subscription: replace `window.confirm` with inline confirmation modal
- "All reports loaded" note when pagination is exhausted
- CSS Module migration (file: `AccountPage.module.css`)

### DashboardHome (Priority 5)
- Subscription-aware status banner (fetch plan; show "Free Account + Upgrade" if no plan)
- "Complete Your Profile" yellow banner when `!user.zip || !user.fullName`
- Skeleton pulse animation for metric values instead of `...`
- Recent Reports quick-view panel in activity grid

---

## 4. Implementation Sequence

### Phase 1 — Flow Correctness (blocking)
1. Fix SignupPage success message (Issue A) — 15 min
2. Remove dev error hint from SignupPage (Issue B) — 5 min
3. Pre-fill PaymentPage billing names from `userInfo` (Issue H) — 20 min
4. Add "I'll upgrade later" skip to PaymentPage (Issue F) — 15 min
5. Fix PaymentPage fallback navigation (Issue G) — 20 min
6. Guard `?simulate` behind `NODE_ENV` (Issue I) — 10 min
7. Fix AlertsPage token dep in `useEffect` (Gap N) — 10 min

### Phase 2 — Member Page UI (designer + developer)
8. SettingsPage full redesign
9. ProfilePage redesign
10. AlertsPage redesign
11. AccountPage CSS Module + badge + modal
12. DashboardHome subscription-aware banner

### Phase 3 — Auth Infrastructure
13. Add subscription context to `AuthContext`
14. Add `?redirect=` support to `ProtectedRoute` + `LoginPage`
15. Unpaid member guard in `ProtectedRoute`

### Phase 4 — Polish
16. Password confirmation on SignupPage
17. "Manage My Data" section in AccountPage → pre-populated opt-out flow

---

## 5. Design System Compliance

All member pages must use:
- `var(--color-primary)` (`#0d5d2f`) for headings and CTAs
- `var(--spacing-*)` for padding/margin/gap
- `var(--radius-xl)` (0.75rem) for section cards
- `var(--shadow-sm)` / `var(--shadow-md)` for card states
- CSS Modules following `DashboardHome.module.css` as reference pattern

Source of truth: `src/styles/variables.css` + `src/styles/designSystem.js`
