---
name: NEVER suppress, intercept, or alter BC's password.v0 captcha modal
description: BC tracks captchaId state across calls — any override of executePasswordCaptcha or makeCaptchaRetryRequest unravels downstream functionality
type: feedback
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
**Rule:** Do NOT override, suppress, intercept, or alter BC's `password.v0` captcha modal. Leave the IIFE's default `executePasswordCaptcha`, `makeCaptchaRetryRequest`, and surrounding captcha flow intact in production.

**Why:** Confirmed empirically on 2026-05-21. The IIFE's captcha modal is the entry point for a server-side state machine: BC issues a `captchaId`, the user types the password into the modal, the IIFE calls `/captcha/verify`, BC marks that captchaId as verified, the IIFE retries the original request with `x-captcha-id: <captchaId>`, and BC accepts. If we intercept any link in that chain (suppress the modal, return empty token, kill the retry, etc.), **every downstream BC call that hits the captcha middleware breaks** — including contactMessage, search, report endpoints. Empty/wrong tokens cause `/captcha/verify` to 400; the retry then 401s with `verifyCaptchaFailed`. There is no clean way to bypass this from a public bundle because the password cannot be in the bundle (postbuild secret scan refuses it) and BC's middleware actually validates the token.

**How to apply:**
- `_installCaptchaHandler` (apiWrapper.js) must remain the dev-only autofill — if `REACT_APP_NEW_API_CAPTCHA` is set, install autofill; otherwise return immediately and leave the IIFE's default behavior alone.
- Do NOT override `wrapper.captcha.makeCaptchaRetryRequest`, `wrapper.captcha.executePasswordCaptcha`, or `wrapper.captcha.executeCaptcha`.
- The visible password modal during pre-launch is INTENTIONAL — internal testers type the dev password to validate flows. At production launch, BC removes the `password.v0` rule and no modal appears.
- If a 412 is showing up and the modal isn't appearing, the cause is almost certainly that the IIFE doesn't expose the method we're calling (e.g., May-4 IIFE lacks `message.contact.create` and the code falls through to `_csrPost`, which has no UI). Restore the newer IIFE that has the method — don't try to handle captcha in `_csrPost`.

**What "looked broken" but isn't:**
- The `[DOM] Password field is not contained in a form` warning — this is BC's modal doing its job. Leave it.
- 412 → modal → /captcha/verify → 201 — this is the working flow, not a bug.

**Cost of this lesson:** ~3 hours of debugging across the 2026-05-21 session before the rule was fully internalized. Multiple revert cycles. Worth NOT repeating.
