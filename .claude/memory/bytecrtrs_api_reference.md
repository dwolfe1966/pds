---
name: ByteCrtrs API reference
description: Complete ByteCrtrs ApiWrapper method signatures, paths, and required parameters
type: reference
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
All methods are on the `window.ApiWrapper` instance returned by `window.ApiWrapper.getInstance({ endpointUrl })`.
Our app accesses them via `apiWrapper.js` which wraps the instance.

## Auth

**Login** — `wrapper.api.auth.login({ username, password })`
- POST `/api/auth/login`
- `username` field (NOT `email`) — our adapter maps `email → username`
- Calling without params checks if the user's session is already logged in

**Logout** — `wrapper.api.auth.logout()`
- POST `/api/auth/logout`

## ID Lookup (Search & Reports)

**Teaser Search** — `wrapper.api.idLookup.searchTeaser(params)`
- POST `/api/idLookup/teaser/search`
- Name: `{ fName, lName, state, type: 'name', contextKey: window.ApiWrapper.contextKey.sale.name.teaser }`
- Phone: `{ phone, type: 'phone', contextKey: window.ApiWrapper.contextKey.sale.phone.teaser }`
- Email: `{ email, type: 'email', contextKey: window.ApiWrapper.contextKey.sale.email.teaser }`
- **`contextKey` is required** — use `window.ApiWrapper.contextKey.sale.<type>.teaser`
- Pagination: `response.getIdentities()` for first page, `await response.getMore()` for next page
- `response.hasMore()` returns boolean

**Create Report** — `wrapper.api.idLookup.createReport(params)`
- POST `/api/idLookup/report/create`
- By extId: `{ type: 'extId', extId: identity.extId, contextKey: window.ApiWrapper.contextKey.sale.name.report, teaserInput: teaserResponse.getTeaserInput() }`
- By phone: `{ type: 'reversePhone', phone, contextKey: window.ApiWrapper.contextKey.sale.phone.report }`
  - Verified 2026-05-29: BC returns 400 without `contextKey` even though older docs implied only `type + phone` was required. `sale.phone.report` resolves on the live IIFE.
- contextKey values: `sale.name.report`, `sale.phone.report`, `sale.email.report`
- **`teaserInput` is required for extId case** — call `teaserResponse.getTeaserInput()` from the searchTeaser response
- **`teaserInput` is NOT required for reversePhone case** — phone bypasses the teaser step
- **`contextKey` is required for ALL cases**

**Get Report (detail)** — `wrapper.api.idLookup.getReport({ commerceContentId })`
- GET `/api/idLookup/report/detail/:commerceContentId`
- `commerceContentId` = the `_id` value from getReports response array

**Get Reports (list)** — `wrapper.api.idLookup.getReports({ lastId? })`
- GET `/api/idLookup/report/list?lastId={lastCommerceContentId}`
- Returns `response.commerceContents` array
- First page: call without `lastId`
- Next page: `getReports({ lastId: lastCommerceContent._id })`
- `commerceContent.data.teaserInput` = original search params

**Download PDF** — `wrapper.api.idLookup.downloadPdfReport({ commerceContentId })`
- Opens a PDF download popup window (user clicks Confirm to download)
- Only valid for detail reports (createReport results), NOT teaser search commerceContentId

## Commerce Billing

**Billing Sale** — `wrapper.api.billing.sale(params)`
- POST `/commerceBilling/sale`
- Full params:
```js
{
  userInfo: { email, firstName, lastName, optin },
  billings: [{
    billingType: 'creditCard',
    creditCard: { pan, expYear, expMonth, cvv },
    billingAddress: { firstName, lastName, street1, zip, bogusFields: { firstName: false, lastName: false, street1: true, ... } }
  }],
  commerceOfferKeys: [{ key: 'comp.offer.signup.main', target: 'main', options: {} }],
  sequenceOption: { thinMatch: false, thinMatchDataProviderDown: false, thinMatchTooManyResults: false, thinMatchNoResults: false, thinMatchGeographic: false },
  queryString: 'refer_partnerId=p1&refer_afid=af1'  // from URL at time of signup
}
```

**Token Sale** (card update) — `wrapper.api.billing.tokenSale(params)`
- POST `/commerceBilling/tokenSale`
- For updating saved card — no card details needed, uses stored token
- Params: `{ commerceOfferKeys, sequenceOption, queryString }`
- `commerceOfferKeys key`: `'comp.offer.updateCard.main'`

**Billing Signup** — `wrapper.api.billing.signup(params)`
- POST `/commerceBilling/signup`
- `{ userInfo: { email, firstName, lastName, optin }, queryString }`
- Called during signup to register user in ByteCrtrs billing system before payment

## User Profile / Account

**Update Profile** — `wrapper.api.user.update({ firstName?, lastName?, phone? })`
- POST `/api/user/update`
- All fields optional; pass only the ones being changed

**Change Password** — `wrapper.api.user.changePassword(password)`
- POST `/api/user/changePassword`

**Reset Password** — `wrapper.api.user.resetPassword(email)`
- POST `/api/user/resetPassword`
- Sends email with login link

## Subscription / Orders (authoritative source for "is paid")

**Get Orders** — `wrapper.api.billing.getOrders()`
- POST `/api/commerceBilling/getUserOrders`
- Returns array of orders. Each has `transient.canceled / cancelable / uncancelable` flags
- **This is THE source of truth for subscription state** — see `feedback_subscription_state_authority.md`

**Get Activated Product Types** — `wrapper.api.billing.getActivatedProductTypes()`
- POST `/api/commerceBilling/getActivatedProductTypes`

**Cancel / Uncancel Order** — `wrapper.api.billing.cancelOrUncancelOrder(flag, orderId)`
- POST `/api/commerceBilling/cancelOrUncancelOrder`
- `flag`: true=cancel, false=uncancel

**Find Offer By shmName** — `wrapper.api.offer.findByShmName({ shmName, key? })`
- POST `/commerce/offer/findByShmName`
- `shmName`: name starting with `comp.`; `key` defaults to `main`
- Returns `commerceProducts` and `transient.priceInfo` (s0, s1 prices and s1 period)

## Statistics (member dashboard counters)

- `wrapper.api.idLookup.countUserTeaserSearches()` — GET `/api/idLookup/statistic/userTeaserSearches`
- `wrapper.api.idLookup.countUserReportCreations()` — GET `/api/idLookup/statistic/userReportCreations`
- `wrapper.api.idLookup.countUserPdfDownloads()` — GET `/api/idLookup/statistic/userPdfDownloads`

## Contact Messages

**Create Contact (unauthed)** — `wrapper.api.message.contact.create(params)`
- POST `/api/contactMessage/create`
- Two shapes: `{ category: 'billing', date, name, email, zip, last4, phone?, orderId? }` OR `{ category: 'general', topic, name, email, phone, description, orderId, zip?, last4? }`

**User Reply via Email Link** — `wrapper.api.message.contact.reply({ contactMessageId, hash, message, contentType, attachments? })`
- POST `/api/contactMessage/userReply`
- `contactMessageId` and `hash` come from email reply link querystring

**Contact Histories** — `wrapper.api.message.contact.histories({ contactMessageId, hash, lastId? })`
- GET `/api/contactMessage/histories`

**User Contact (logged-in)** — `wrapper.api.user.createContact({ message, parentCsrMessageId, contentType, attachments? })`
- POST `/api/message/userContact`
- `parentCsrMessageId` from email querystring when replying to CSR mail

**User Contact List** — `wrapper.api.user.getContacts({ lastId? })`
- POST `/api/message/userContact/list`
- Returns 10 entries per page

## Managed Contact (alerts / opt-in addresses)

**Create Managed Contact** — `wrapper.api.managedContact.create({ type, contactAddress, campaignKey? })`
- POST `/api/managedContact/create`
- `type`: 'email' or 'phone'
- `contactAddress`: email or phone number
- `campaignKey`: optional (e.g., 'guest')

## Tracking

**Create Tracking Event** — `wrapper.api.tracking.create(data)`
- POST `/api/tracking/create`
- `data`: arbitrary `Record<string, any>`

## Other

**OptOut Page** — `window.ApiWrapper.goPage('optOut', { newPage: true })`
- Opens ByteCrtrs-hosted optout page in new window (`newPage: true`) or redirects current page (`newPage: false`)
- This is the recommended approach — NOT our custom optout form

## Context Keys

```
window.ApiWrapper.contextKey.sale.name.teaser   // name teaser search
window.ApiWrapper.contextKey.sale.phone.teaser  // phone teaser search
window.ApiWrapper.contextKey.sale.email.teaser  // email teaser search
window.ApiWrapper.contextKey.sale.name.report   // name report create
window.ApiWrapper.contextKey.sale.phone.report  // phone report create
window.ApiWrapper.contextKey.sale.email.report  // email report create
```

## Known Gaps in Our Implementation (as of 2026-03-17)

| Issue | Impact | Fix needed |
|-------|--------|-----------|
| `contextKey` missing from teaser search calls | Search may fail or return wrong results | Add `window.ApiWrapper.contextKey.sale.<type>.teaser` to all search calls |
| `contextKey` + `teaserInput` missing from createReport | Report creation may fail | Pass both from teaser response |
| `getReports` vs our `getReportList` wrapper tries multiple names | May hit wrong method | Confirm `wrapper.api.idLookup.getReports` works via our apiWrapper.getReportList() |
| OptOut: our custom form vs `ApiWrapper.goPage('optOut')` | BC-hosted optout is the intended path | Evaluate whether to use BC-hosted page or keep custom form |
| Signup JWT still comes from mock server | Auth gap for production | ByteCrtrs login now wired; signup token source still mock |
