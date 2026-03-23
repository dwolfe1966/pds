# Weekly Code Review & Status — March 11, 2026

## 1. Recent Changes (Last Week)

### Commits (Mar 5–9, 2026)
- **322e4f7** Merge main
- **87d03bf** claude payment stuff
- **97da565** updated docs
- **a777484** claude search work
- **c78dbdf** claude updates - non-teaser search for members
- **1b63345** user creation updates

### Key Modified Areas
- **Payment/Signup**: `PaymentPage.js`, `SignupPage.js` — commerce billing, user creation flow
- **API layer**: `apiRouter.js`, `apiWrapper.js` — teaser search routing, ByteCrtrs integration
- **Docs**: `COMMERCE_BILLING_USER_CREATION_REVIEW.md`, `TROUBLESHOOTING.md`, `USER_CREATION_BEFORE_PAYMENT_RECOMMENDATIONS.md`

### Current Architecture
- **Teaser search**: Forced to ByteCrtrs API (no mock fallback) via `FORCE_NEW_API_ENDPOINTS`
- **Proxy**: Express proxy at `/api/proxy/*` forwards to `https://dev1.dev.www.bytecrtrs.com/api`
- **Captcha**: Proxy warms up captcha cookies when none present; uses `CAPTCHA_PASS` env var (default: `bcEdgeApiPass`)

---

## 2. Teaser Search ByteCrtrs Fixes Applied

### Issues Addressed
1. **Library source**: Switched from ByteCrtrs CDN to local `/libs/api-wrapper/index.iife.js` to avoid CDN failures and version drift.
2. **Response adapter**: Replaced `getTotal?.()` with `getTotalCount()` to match the ByteCrtrs library API.
3. **searchContextKey fallback**: Added hardcoded fallbacks (`sale.name.teaser`, `sale.phone.teaser`, `sale.email.teaser`) when the library is not loaded so the API always receives a valid `searchContextKey`.

### Files Changed
- `public/index.html` — use local API library
- `src/services/apiAdapter.js` — fix `getTotalCount` usage
- `src/api.js` — add `searchContextKey` fallback

---

## 3. Verification Steps

1. **Start both servers**: `npm run dev` (frontend on 3000, server on 3001)
2. **Run a name search**: Go to `/name/landing` → enter name → loader → results
3. **Check server logs**: Look for `[Proxy] ✓ Search request SUCCEEDED` or error details
4. **If 412**: Ensure `CAPTCHA_PASS=bcEdgeApiPass` (or your dev pass) is set; proxy will warm up captcha cookies
5. **If 500**: Inspect `[Proxy] Response data (full)` in server logs for ByteCrtrs error details

---

## 4. Environment Variables (Teaser Search)

| Variable | Purpose | Default |
|----------|---------|---------|
| `REACT_APP_USE_API_PROXY` | Use proxy for ByteCrtrs | `true` |
| `REACT_APP_PROXY_URL` | Proxy base URL | `http://localhost:3001/api/proxy` |
| `EXTERNAL_API_URL` | ByteCrtrs API (server) | `https://dev1.dev.www.bytecrtrs.com/api` |
| `CAPTCHA_PASS` | Dev captcha bypass token | `bcEdgeApiPass` |

## 5. Integration Fixes (Mar 11) – Match Dev Page

Aligned with [ByteCrtrs dev page](https://dev1.dev.www.bytecrtrs.com/test/development.html):

- **contextKey**: API expects `contextKey` (not `searchContextKey`). Client and reportService now send `contextKey`.
- **No commerceContentId on initial search**: Dev page does not send it; proxy removes it for non-pagination requests.
- **CDN library**: Using ByteCrtrs CDN library (same as dev page).
- **Origin/Referer**: Proxy sets these to ByteCrtrs domain to mimic same-origin.
