---
name: ReferenceError swallowed by runSearch try/catch
description: Production search "silently fails" pattern — usually an undefined identifier inside the try block, masked by the catch + console-stripping
type: feedback
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
When a name/phone/email landing wizard reports "search failed" with no useful console output and no network call to BC, the root cause is almost always a `ReferenceError` thrown inside `runSearch`'s try block — most often a missing GTM helper import (e.g. `gtmSetSearchInput`).

**Why:** the surrounding `try/catch` catches everything (including `ReferenceError`), sets the UI to "Search failed: ..." and redirects to `/name/search-result?error=true`. In production, `babel-plugin-transform-remove-console` strips all `console.*` calls, so the catch block's logs vanish. The user sees a generic failure with no signal.

**How to apply:**
- Before debugging network/captcha/BC issues, grep the failing variant for identifiers used inside `runSearch` and confirm each is imported at the top of the file. V2 had the import; V3/V4/V5/V6 were copy-pasted but missed it.
- When adding new try/catch blocks around search dispatch, also attach the caught error to `window._lastSearchError` (or similar) so post-mortem inspection survives console stripping.
- The visible UI error message is the survivor of last resort — keep `setFinalStatus(\`Search failed: ${msg}\`)` so the actual cause reaches the user.
