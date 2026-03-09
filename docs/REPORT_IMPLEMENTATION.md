# Report Creation & Viewing — Implementation Notes

**Completed:** March 2026
**Branch:** main

---

## Overview

This document describes the implementation of full report creation and viewing for members, using the ByteCrtrs `idLookup/report/create` and `idLookup/report/detail` endpoints.

---

## What Changed

### 1. `src/services/apiAdapter.js` — New `adaptReportDetailResponse()`

Added a dedicated adapter function for full-report responses (both create and detail). It handles three response shapes from the ByteCrtrs library:

| Shape | When it occurs |
|-------|---------------|
| Library object with `getData()` | ByteCrtrs IIFE library wraps the response; `getData()` returns `params.response.data` |
| `response.params.response.data` | Older library versions or proxy-forwarded responses |
| Direct `response.raws` | Mock API or pre-adapted responses |

Extracted fields:
- `commerceContentId` — from `commerceContent._id`, `commerceContents[0]._id`, or top-level
- `raws[]` — the full raws array
- `identities` — from `raws[0].transient.identities`
- `fullContact` — from `raws[1].transient.fullContact` (phones, emails, addresses, relatives, social)
- `familyWatchdog` — from `raws[2].transient.familyWatchdog` (offenders array)

### 2. `src/services/apiRouter.js` — Use `adaptReportDetailResponse`

Both `create-report` and `get-report` cases in `callNewAPI()` now call `adaptReportDetailResponse()` instead of the old `adaptReportResponse()`. The result flows through as a rich structured object.

### 3. `src/services/reportService.js` — Rich return values

`createReport()`, `getReportDetail()`, `createReportForIdentity()`, and `createReportForPhone()` now all return:

```js
{
  success: true,
  commerceContentId: string | null,
  identities: Array,        // from raws[0]
  fullContact: Object|null, // from raws[1]
  familyWatchdog: Object|null, // from raws[2]
  raws: Array,
  reportData: Object,       // raw API response data
  fullResponse: Object      // original library response
}
```

### 4. `src/pages/member/SearchResultDetailPage.js` — Proper UI

**Data flow fix:** `setReport(result)` now stores the full rich result object (previously stored `result.reportData`, which lacked the extracted fields).

**`extractReportData()`** accesses `result.identities`, `result.fullContact`, `result.familyWatchdog` directly, with fallbacks to `result.raws` for backward compatibility.

**New inline sub-components:**

| Component | Renders |
|-----------|---------|
| `FullContactSection` | Phones (pill badges), emails, addresses, relatives, social profiles |
| `FamilyWatchdogSection` | Green "none found" banner, or list of offenders with distance/offense/address |
| `IdentityCard` | Name + addresses + phones for secondary identities |
| `formatPhone()` | Formats 10/11-digit strings as `(NXX) NXX-XXXX` |

Replaces `<pre>{JSON.stringify(...)}</pre>` blocks with structured, readable sections.

### 5. `.env` — `REACT_APP_USE_NEW_API_REPORTS=true`

Enabled the feature flag. Note: the `create-report`, `get-report`, and `report-list` endpoints are also in `FORCE_NEW_API_ENDPOINTS` in `apiRouter.js`, so they bypass the flag and always use ByteCrtrs regardless.

### 6. Phone Search — `createReportForPhone()`

Added in an earlier session: `MemberGeneralSearchPage` phone tab now calls `createReportForPhone(phone)` directly (ByteCrtrs `report/create` with `type: 'reversePhone'`), bypassing the teaser step and navigating directly to `/people/:commerceContentId`.

---

## Report Data Flow (End-to-End)

```
Member phone search
  └─ MemberGeneralSearchPage.handlePhoneSubmit()
       └─ createReportForPhone(phone)
            └─ api.createReport({ type: 'reversePhone', phone })
                 └─ apiRouter.callNewAPI('create-report')
                      └─ apiWrapper.createReport(params)          ← ByteCrtrs IIFE
                           └─ adaptReportDetailResponse(response)
                                └─ { commerceContentId, identities, fullContact, familyWatchdog }
  └─ navigate('/people/:commerceContentId')

Member name/email search (existing teaser flow)
  └─ SearchResultDetailPage mounts with :id
       ├─ Try getReportDetail(id)  ← assumes id is commerceContentId
       │    └─ api.getReportDetail(id) → adaptReportDetailResponse → rich result
       │    └─ setReport(result)
       │
       └─ Fallback: createReportForIdentity(extId, identity)
            └─ api.createReport({ type: 'extId', extId, searchContextKey })
                 └─ adaptReportDetailResponse → rich result
            └─ getReportDetail(commerceContentId) → setReport(result)
            └─ navigate('/people/:commerceContentId', { replace: true })
```

---

## Test Suite

### Setup

- **Framework:** Jest 29 + Babel
- **Environment:** jsdom (for sessionStorage support)
- **Files:** `src/tests/`, `src/__mocks__/`, `babel.config.js`
- **Commands:** `npm test`, `npm run test:watch`, `npm run test:coverage`

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `src/tests/apiAdapter.test.js` | 12 | `adaptReportDetailResponse`, `adaptReportListResponse`, `adaptIdentity` |
| `src/tests/reportService.test.js` | 26 | `createReport`, `getReportDetail`, `getReportList`, `createReportForIdentity`, `createReportForPhone`, `getExistingReportId` |

All 38 tests pass.

### Key test scenarios

- Multiple response shapes for `adaptReportDetailResponse` (raw `.raws`, `getData()` library pattern, `params.response.data`)
- `adaptReportListResponse` via `getReports()` method, `getData()`, `commerceContents` key, `data.reports` key
- `createReport` / `getReportDetail` return structure validation
- Error propagation from all service methods
- `commerceContentId` sessionStorage storage when identity context matches
- `createReportForPhone` passes `type: 'reversePhone'` correctly
- `getExistingReportId` context matching

---

## Known Limitations / Future Work

- **FullContact schema is assumed.** The UI handles `phones`, `emails`, `addresses`, `relatives`, `socialProfiles` keys. If the live ByteCrtrs API uses different keys (e.g., `phoneNumbers`, `emailAddresses`), the `FullContactSection` component needs to be updated. Multiple aliases are already handled in the component.
- **FamilyWatchdog offender schema is assumed.** Renders `name`, `distance`, `offenseDescription`, `address`. Adjust if the live API differs.
- **No skeleton loading states.** The loading indicator is a plain text paragraph. A `LoadingSkeleton` component would improve perceived performance.
- **Report list (AccountPage / DashboardHome)** uses `getReportList()` but report name extraction from `teaserInput` is fragile. A dedicated `getReportTitle()` helper normalising across response shapes would help.
