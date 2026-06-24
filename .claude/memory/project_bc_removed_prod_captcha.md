---
name: project_bc_removed_prod_captcha
description: BC removed the password.v0 captcha on PRODUCTION (2026-06-24) — 412s on prod are no longer captcha challenges
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**BC has REMOVED the captcha on production** (owner confirmed 2026-06-24).

Implications:
- A **412 on prod is NO LONGER a captcha challenge.** The old assumption (apiWrapper.js:788 "BC returns 412 with {captchaId} on captcha-protected endpoints") no longer applies to prod. Diagnose prod 412s as genuine **Precondition Failed** (missing/invalid required field, category/topic rule, etc.) — read the response body.
- The `_csrPost` 412→captcha auto-retry and the IIFE `executePasswordCaptcha` modal are now effectively inert on prod for captcha purposes.
- Still keep `REACT_APP_NEW_API_CAPTCHA` empty in the prod bundle ([[feedback_no_secrets_in_bundle]]) — defensive, and dev/staging may still have captcha. Don't bake the password regardless.
- Related guidance about not suppressing the captcha modal ([[feedback_never_block_bc_captcha_modal]]) is now lower-stakes on prod but keep the IIFE untouched.

First consequence found: the Contact Us [[project_contact_412_diagnosis]] 412 is topic-specific ("Privacy" fails / "Other" works), a real precondition — not captcha.
