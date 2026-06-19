# Run the CSR API demo

Calls BC's own API and prints what it returns for each open ask. Read-only.

```
node scripts/demo-bc-csr-asks.js
```

- Uses a shared **dev** test account by default. To run with your own CSR account (recommended):
  ```
  CSR_USER='you@…' CSR_PWD='••••' node scripts/demo-bc-csr-asks.js
  ```
- One-time setup if needed: `npm i -D @playwright/test && npx playwright install chromium`
- If it prints "Login could not be confirmed", just run it again (cold-session hiccup).
