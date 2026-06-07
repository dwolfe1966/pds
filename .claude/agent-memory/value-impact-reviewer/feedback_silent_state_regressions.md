---
name: Watch for silent-state regressions in this codebase
description: Storage-key drift and BC response-shape mismatches in this repo produce invisible failures, not loud errors. Look harder at "innocuous" changes.
type: feedback
---

In this codebase, the highest-leverage silent regressions cluster around two patterns. Apply extra scrutiny when reviewing changes that touch either.

**Pattern 1 — Storage-key drift across auth states.** The accountThreads bug (pre-2026-05-28) wrote under `user.id || _id || email` because BC's signup response doesn't always populate `user.id`. Writes during signup-session landed under email-keyed; reads after next login landed under id-keyed; threads vanished with no error. The fix standardized on lowercased-email everywhere. Anything that keys local storage by user identity needs the same scrutiny — BC's `user.id` is not reliably populated across all session lifecycles.

**Pattern 2 — BC response-shape extractors.** The `handleComposeSubmit` bug missed BC's documented `{ messageResult: { _id, hash } }` shape and silently wrote nothing to localStorage. The F8 RefundEmailModal bug was the same shape error one layer up. console.* is stripped in production (per `feedback_console_stripped_in_prod`) so these failures don't even leave a footprint.

**Why:** Combined with `babel-plugin-transform-remove-console` and try/catch wrappers around BC calls (per `feedback_silent_referenceerror`), failures here are *invisible* to both the user (state quietly doesn't persist) and the developer (no console trace post-build). The catch-and-swallow pattern is necessary for resilience but makes these regressions only visible through end-to-end QA.

**How to apply:**
- Treat any change touching `(localStorage key derivation, BC response unwrapping, anonymous→authenticated migration)` as high-risk for silent regression.
- When reviewing such a change, ask: "What happens to state written under the prior schema?" Migration story matters.
- Prefer reviews that explicitly verify the BC response shape against `docs/new-api/bc client library - *.csv` rather than inferring from a working call.
