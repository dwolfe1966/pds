# Use-Case Testing Checklist

**Date:** January 2025  
**Changes tested:** Opt-out Search, Real Payment, Search Pagination, Report List, Consistent searchContextKey

---

## Prerequisites

1. **Start servers:** `npm run dev` (runs API on 3001, frontend on 3000)
2. **Test credentials:** `paid@test.com` / `password123` (member with subscription)

---

## 1. Opt-out Search

**What to test:** Selecting a result on the opt-out results page checks opt-out status before proceeding.

### Steps

1. Go to http://localhost:3000/opt-out
2. Enter a name (e.g. **John Smith**) and state (e.g. **FL**), click Search
3. Wait for results
4. Click "Request Opt-Out" on a result

### Expected

- Brief "Checking opt-out status…" message
- If API returns "already opted out": green banner "X has already been opted out"
- Otherwise: Navigate to `/opt-out/request?resultId=...`

### Notes

- If `optOut/search` API is not available or returns an error, the flow still proceeds (graceful fallback)
- Check browser console for `[OptOut] searchOptOut failed, proceeding` in dev

---

## 2. Real Payment

**What to test:** Payment page tries ByteCrtrs `billing.sale` first, falls back to mock.

### Steps

1. Go to http://localhost:3000/name/landing/v2
2. Complete the flow: name → location → details → confirm
3. After search completes, you’ll land on results
4. Click a result → signup if needed → reach Payment page
5. Fill card (e.g. 4242424242424242), expiry, CVV, ZIP
6. Click "Complete Purchase"

### Expected

- Payment succeeds (either via ByteCrtrs or mock)
- Success message and redirect to report or dashboard

### Notes

- If `commerceBilling/sale` fails, mock `updateSubscription` is used
- Dev hint: `?simulate=success` or `?simulate=failure` for testing

---

## 3. Search Pagination (Load More)

**What to test:** "Load more results" appears when more results exist.

### Member flow

1. Log in as `paid@test.com`
2. Go to http://localhost:3000/people-search
3. Search for **tim chin** (or a name that returns multiple results)
4. On results page, check for "Load more results" button
5. Click it and confirm more results load

### Sales flow (visitor)

1. Log out (or use incognito)
2. Go to http://localhost:3000
3. Use search bar: **John Smith** + state **FL**
4. On results page, check for "Load more results" if available

### Expected

- "Load more results" only when ByteCrtrs API returns paginated data
- Button shows "Loading…" while fetching
- New results append to the list

### Notes

- Load more only appears when results come from a direct `api.searchPeople` call (not from sessionStorage)
- NameSearchLandingV2Page stores results in sessionStorage and navigates, so Load more won’t appear for that flow

---

## 4. Report List

**What to test:** Dashboard and Account show reports from ByteCrtrs API.

### Steps

1. Log in as `paid@test.com`
2. Go to http://localhost:3000/dashboard
3. Check "Reports Generated" count and "Recent Activity"
4. Go to http://localhost:3000/account
5. Check "Your Reports" section

### Expected

- Reports load from ByteCrtrs `report/list` when available
- Counts and list display correctly
- "Load More Reports" works if there are more

### Notes

- ByteCrtrs report list may be session-based; reports might be empty until reports are created in the same session
- Mock API fallback is disabled for report-list (forced to new API)

---

## 5. Consistent searchContextKey

**What to test:** Correct context keys for sale vs member, name/phone/email.

### Steps

1. Open browser DevTools → Console
2. **Visitor (sale):** Log out, go to http://localhost:3000/people-search or search from home
3. Run a name search
4. Look for: `[API] Using searchContextKey: sale.name.teaser (sale, name)`
5. **Member:** Log in as `paid@test.com`, run a name search
6. Look for: `[API] Using searchContextKey: member.name.teaser (member, name)`

### Expected

- Sale flow: `sale.name.teaser` (or `sale.phone.teaser` / `sale.email.teaser`)
- Member flow: `member.name.teaser` (or `member.phone.teaser` / `member.email.teaser`)
- Report creation uses `.report` variant (e.g. `sale.name.report`)

---

## Quick Reference

| Use-case        | URL / Flow                          | Key check                          |
|-----------------|-------------------------------------|------------------------------------|
| Opt-out Search  | /opt-out → search → select result   | "Checking opt-out status" or banner |
| Real Payment    | /name/landing/v2 → … → Payment      | Success or mock fallback           |
| Load More       | /people-search (member) or search   | "Load more results" button         |
| Report List     | /dashboard, /account                | Reports section populated          |
| Context Keys    | Any search + DevTools                | Console log with correct key       |

---

## Troubleshooting

- **502 / 412 from proxy:** Captcha or cookies; proxy should warm up captcha for teaser search
- **404 for searches/profile-views:** Mock API; ensure server is running and restarted after changes
- **Empty report list:** ByteCrtrs may use session; create a report in the same session first
