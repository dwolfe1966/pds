# How to run the CSR API demo (`scripts/demo-bc-csr-asks.js`)

A single, self-contained script that calls BC's **own deployed API** and prints what it returns for
each open ask. It asserts nothing — you read BC's live responses and judge for yourself. **Read-only**:
it only calls finders/getters (no writes, no sales, no mutations).

## Accounts — you supply your own
The script contains **no credentials** (we never commit secrets). It reads them from environment
variables. Use **any CSR/admin account** — ideally a fully-provisioned production CSR account, so the
results reflect a real CSR's permissions (not a limited test login).

```
CSR_USER   = <your CSR/admin login>
CSR_PWD    = <password>
```

## Prerequisites
- **Node.js 18+**
- **Playwright (Chromium)** — the script drives a headless browser so it loads the real
  `csrWrapper` / `ApiWrapper` IIFEs exactly as the CSR app does:
  ```
  npm install -D @playwright/test
  npx playwright install chromium
  ```
  (If you already have this repo set up, both are already installed.)

## Run it
```
CSR_USER='you@example.com' CSR_PWD='••••••' node scripts/demo-bc-csr-asks.js
```

### Optional overrides (env vars)
| Var | Default | Purpose |
|---|---|---|
| `ADMIN_HOST` | `dev.admin.www.bytecrtrs.com` | CSR/admin host the script logs into |
| `CONSUMER_URL` | `https://dev.www.idlookup.ai` | consumer host (used only for the ASK A offer contrast) |
| `TEST_USER_ID` | a dev user id | a userId used for the read-only per-user checks |

Example against a different env:
```
ADMIN_HOST='admin.www.bytecrtrs.com' CONSUMER_URL='https://www.idlookup.ai' \
CSR_USER='you@example.com' CSR_PWD='••••••' node scripts/demo-bc-csr-asks.js
```

## What you'll see
For each ask it prints: **WE CALL → BC RETURNS → EXPECTED → VERDICT**, plus a working contrast where one
exists, then a one-line SUMMARY. The four sections:
- **ASK A — offer lookup** (CSR context 403s; same offer resolves for consumers)
- **ASK B — CSR `billing.sale`** (no CSR billing namespace; consumer sale has no `payerId`)
- **ASK C — global order search** (`commerceOrder` 403 for every brand)
- **CONFIRM — `userContact` data model** (a question, not a defect)

## Notes
- If you see **"Login could not be confirmed (cold session). Re-run."** — that's an occasional
  first-request timing hiccup on the deployed login, not a result. Just run it again.
- Every check is repeated across `idlookup` / `bytecrtrs` / no-brand, so a brand filter can't be
  mistaken for the cause.
- Two earlier asks (`findAdmin`, `tracking.findUser`) were removed after this same demo proved them
  not-BC-issues — see `BC_CSR_ASKS_PACKAGE.md` ("Resolved on our side").
