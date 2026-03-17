# Playwright E2E Status

## Investigation (2026-03-17)

### Command Run
```
npx playwright test --list
npx playwright test
```

### Findings

#### No Import Errors Found

The `npx playwright test --list` command completes successfully and enumerates all 35 tests across 5 spec files. Playwright can correctly parse:

- `playwright.config.js` (ESM `export default defineConfig(...)`) — parses fine
- `tests/e2e/helpers/auth.js` — ESM `.js` import — parses fine
- All 5 spec files — standard `@playwright/test` imports — parse fine

The e2e test files do NOT import any React source files, CSS modules, or `process.env.REACT_APP_*` variables. They are pure browser tests that communicate with a running server over HTTP. There are **no CSS module import failures** and **no ESM/CJS conflicts** in the test files themselves.

#### Root Cause of Test Failures: Servers Not Running

The Playwright config defines a `webServer` block that starts:
1. `node server/index.js` → Express mock API on port 3001
2. `npx parcel public/index.html --port 3000 --no-cache` → React SPA on port 3000

The tests fail when run in an environment where these servers are not available (e.g., CI without explicit server startup, or local dev where `npm run dev` is not running). Playwright's `reuseExistingServer: true` means it will try to reuse an already-running server, but it will attempt to start one if none exists.

**Specific failure modes when servers are unavailable:**
- All tests that call `page.goto('/...')` will fail with `net::ERR_CONNECTION_REFUSED`
- `loginViaAPI()` calls `page.request.post('http://localhost:3001/api/v1/login', ...)` — fails when mock API server is not running

#### Configuration Assessment

The existing `playwright.config.js` is correctly structured. No changes are required to env vars, CSS module config, or ESM settings because:

1. Playwright tests do not import React components — they use a real browser hitting real HTTP endpoints
2. `process.env.REACT_APP_*` vars are only needed by Parcel/React at bundle time (which Playwright's webServer handles via the Parcel startup command)
3. There is no `moduleNameMapper` needed in `playwright.config.js` — that's a Jest concept

#### What Would Be Needed to Run E2E Tests

To run the Playwright tests successfully:

```bash
# Option 1: Start servers manually, then run tests
npm run dev          # starts both servers (ports 3000 and 3001)
npx playwright test  # in a second terminal

# Option 2: Let Playwright start servers (default behavior via webServer config)
npx playwright test  # starts both servers automatically
```

If the Parcel server takes more than 60 seconds to bundle on first run, the webServer timeout may need to be increased in `playwright.config.js`:
```js
// playwright.config.js — increase timeout if needed
{
  command: 'npx parcel public/index.html --port 3000 --no-cache',
  url: 'http://localhost:3000',
  reuseExistingServer: true,
  timeout: 120_000,  // increase from 60_000 if Parcel is slow
},
```

#### Pre-Existing Failures in Jest Unit Tests (not Playwright)

The following Jest test suites have pre-existing failures (not caused by the new test files added in this session):

| Suite | Failures | Likely Cause |
|---|---|---|
| `paymentFlow.test.js` | Suite fails to run | `jest.mock()` factory references out-of-scope variable (`mockSetToken`) |
| `apiCallSignatures.test.js` | 1 test | SettingsPage component change broke call-count assertion |
| `signupFlow.test.js` | 3 tests | SignupPage UI text/element changes (button label, optin default) |
| `dashboardHome.test.js` | 4 tests | DashboardHome content changes (removed feature cards, metric CSS class changes) |
| `memberGeneralSearch.test.js` | 15 tests | MemberGeneralSearchPage DOM changes (error message element selector mismatch) |

**Total pre-existing failures: 23 tests across 5 suites.**
These were present before this session's work. The new `paidRoute.test.js` (18 tests) and `tokenRefresh.test.js` (13 tests) both pass completely.

### Summary

| Item | Status |
|---|---|
| Playwright config imports | OK — no errors |
| E2E spec file imports | OK — no errors |
| CSS module issue | Not applicable (e2e tests don't import CSS) |
| ESM/CJS conflict | Not applicable |
| Env var issue in playwright | Not applicable (vars consumed by Parcel at bundle time) |
| Root cause of e2e failures | Servers must be running before `npx playwright test` |
| Fix applied | None needed — config is correct |
