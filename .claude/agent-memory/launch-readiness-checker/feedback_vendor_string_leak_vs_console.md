---
name: vendor-string-leak-vs-console
description: Vendor strings in the consumer bundle are a finding even when dbg() is a prod no-op — static leak ≠ console leak
metadata:
  type: feedback
---

When auditing the consumer `build/` for vendor/endpoint leakage, do NOT wave away a `CsrWrapper`/`ByteCrtrs`/`[CsrWrapper]` hit just because the logger is a no-op in prod. Two separate checks:

- Console-output stripping (does it log at runtime?) — handled by `transform-remove-console` + the `dbg/dbgWarn/dbgError` no-ops in `src/services/_debug.js`.
- Static-string leakage (can someone read it in View-Source/DevTools?) — the string is physically in the shipped minified JS regardless of whether the call executes.

**Why:** The owner's rule is "no internal/dev/endpoint info should leak into the consumer bundle," and the checklist says "Any hit in consumer `build/` is a finding." The rule targets static inspection, not just console output. Prior commit `34f18a0` was a dedicated consumer endpoint/vendor strip — a hit means a regression of that work.

**How to apply:** Any `CsrWrapper|ByteCrtrs|csrWrapper` hit in `build/public.*.js` → report it (at least HIGH/Should-fix; Blocker only if a real secret leaks). The no-op `dbg()` is necessary but not sufficient. See [[shared-apiwrapper-bundles-csr-into-consumer]].
