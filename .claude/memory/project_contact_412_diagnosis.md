---
name: project_contact_412_diagnosis
description: "Consumer Contact Us 412 = BC anti-abuse RULES (allowed email domains + per-domain daily message cap), enforced via a Cloudflare Turnstile challenge. NOT password captcha, NOT topic."
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**ROOT CAUSE (owner-authoritative, 2026-06-24):** The Contact Us 412 is **BC's anti-abuse rules** — *which email domains are allowed to create messages, and how many per day*. When a submit trips a rule, BC returns a **Cloudflare Turnstile challenge** to gate it.

- NOT the `password.v0` captcha (BC removed that on prod — [[project_bc_removed_prod_captcha]]).
- NOT topic-specific. My earlier "Privacy fails / Other works" inference was a red herring — the failing test used `qa.contact.…@example.com`, and **`example.com` is a domain BC's rule blocks/challenges**; the working "Other" test used a real existing-member email. Topic was coincidental.

**Evidence — the 412 body** (probe `scripts/probe-contact-412.js`, `topic:Privacy`, `email:…@example.com`):
```json
{"type":"turnstile.v0","action":"NO_DESC_IN_RULE","captchaId":"…","step":"0-0","siteKey":"0x4AAAAAADOUar3VJkKkREGv"}
```
`turnstile.v0` + a rule action → BC's rule engine fired Turnstile.

**Two distinct issues:**
1. **BC rules too aggressive / need tuning (BC-side, owner is on it).** Allowed-domain list + per-domain/day cap. Legit users on common domains shouldn't be challenged; the daily cap shouldn't block real volume. BC is internal [[project_bc_org_relationship]] — coordinate the rule config.
2. **Client doesn't render the Turnstile when challenged (our bug).** When BC DOES challenge (turnstile.v0 412), the contact form shows a raw 412 — no widget. Why: `createContactMessage` (apiWrapper.js:1060) tries the IIFE `wrapper.api.message.contact.create` (which auto-handles Turnstile via the IIFE's `makeCaptchaRetryRequest`/`turnstileModal`/`executeTurnstile`), but FALLS BACK to our hand-rolled `_csrPost` (proven: probe body was `{"input":{…}}`, the `_csrPost` shape, and only ONE request fired → the `typeof wrapper.api?.message?.contact?.create` guard was false at runtime). `_csrPost`'s 412 handler only knows `password.v0`, not `turnstile.v0`, so the raw 412 surfaces. NOTE the IIFE wrapper exposes these as instance fields (`this.message`, `this.api` built at iife :1551) — verify the live deployed wrapper's path (`wrapper.api.message...` vs `wrapper.message...`) before changing the guard. Search works because it goes through the IIFE method (renders Turnstile, human solves).

**SHIPPED FIX (commit 7a71905, bundle public.beed53c1.js — NOT yet deployed):** graceful 412 UX. Owner confirmed they see NO captcha issues on prod with real emails (the rule only fires for blocked/disposable domains like example.com, or over the daily cap) — so we deliberately did NOT render a solvable Turnstile (would let abuse through). Both ContactPage forms (EmailCustomerCareModal + BillingQuestionModal) now detect 412/turnstile via `isBlocked412()` and show a friendly message with `brand.supportPhone` instead of raw "HTTP 412".

**Still owner-led (BC-side, NOT a code fix):** tuning BC's allowed-domain list + per-domain daily cap so legit customers/volume aren't blocked. Don't hand-roll Turnstile in _csrPost [[feedback_never_block_bc_captcha_modal]]. Owner debugging live 2026-06-24.
