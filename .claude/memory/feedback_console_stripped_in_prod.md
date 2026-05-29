---
name: Production strips all console.* via babel-plugin-transform-remove-console
description: Production builds remove every console.log/warn/error/debug. Diagnostic strategies that rely on "look at the console" don't work on the deployed site.
type: feedback
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
The repo's `babel.config.js` has a `production` env that includes the `transform-remove-console` plugin. This means **every `console.log`, `console.warn`, `console.error`, `console.debug`, and `console.info` call gets stripped from the production bundle**.

**Why:** Originally added so internal endpoint paths, BC IIFE diagnostics, and request/response dumps never reach end users (comment in `babel.config.js:10-12`).

**How to apply:**

- **Don't ask the user to "check the console for an error message" when debugging a production-deployed bundle.** The error log won't be there even if a catch block fires.
- The `dbg / dbgWarn / dbgError` helpers in `src/services/_debug.js` are redundant with this babel plugin in prod — they no-op there regardless. Still useful in dev (where the plugin doesn't run) because they're cheaper than `console.*`.
- For production-visible diagnostics, use one of:
  1. **Visible UI error state** — surface `error.message` in the page state instead of silently navigating away. Example: `setFinalStatus(\`Search failed: \${msg}\`)` in `NameSearchLandingV5Page.js`'s catch (2026-05-14 patch).
  2. **Global `window` attach** — `window._lastSearchError = { error, when, variant }` lets the user inspect via `window._lastSearchError` in DevTools after a navigation. Survives the redirect because it's on `window`, not a stripped console call.
  3. **Tracking event** — `track('client_error', { source, message, stack })` via the tracking-api so production errors get logged server-side.
  4. **Temporarily disable** the plugin in `babel.config.js` for a one-off prod-debug build; remember to re-enable before the next deploy.
- When auditing "why is X failing silently in production?", **assume every catch block in the codebase has its console.* stripped**. The silent-fail pattern is `catch (e) { console.error(...); navigate('/.../?error=true'); }` — only the navigate happens in prod; the user sees the generic error page with no idea why.
- Audit-worthy before launch: sweep `src/pages/` for catch blocks that only console.error and don't update UI state. Add `setErrorState(e.message)` and/or `window._lastError = e` to each.

**Discovered 2026-05-14** during V5 wizard search debug — spent multiple debug turns chasing "why does V5's search fail with no console output?" before realizing all console.error calls were stripped from the bundle.
