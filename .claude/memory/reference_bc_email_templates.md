---
name: reference_bc_email_templates
description: "BC transactional email templates — token syntax, confirmed tokens, the signup-email findings, and our HTML deliverables for BC's upload tool"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

BC sends prod transactional emails and (2026-06-24) has an **admin tool to upload HTML** for them. We author HTML; BC injects values via `${...}` tokens. Owner preference: **figure out tokens ourselves, minimize asking BC.**

**Token syntax** = `${dotted.path}`. From a live BC template (the uncancel/reactivation email):
- CONFIRMED global tokens (reusable on any template): `${comp.brand.name}`, `${comp.brand.customer.phone}` (already 866-204-1902 in BC), `${comp.email.default.footer}`, `${code.baseUrl}${comp.client.paths.dashboard}`.
- Hook tokens use `${code.<event>.hook.<field>}`. Known hooks: **signup/trial = `code.billing.sale.hook`** (fields: firstName, trialStartDate, totalPrice, orderId, trialEndDate, s1Price, s1PeriodQuantity, s1PeriodUnit); reactivation = `code.order.canceled.or.uncanceled.hook` (firstName/orderId/billingDate/billingAmount).
- **CONFIRMED (2026-06-24): BC's engine EVALUATES JS in `${...}` — EJS-style.** Proof: the contact-confirmation email's `${if (cond) {} ... ${} else {} ... ${}}` block rendered correctly (chose the general branch, clean, no literal `${if}` text). So `${expr}` outputs the expression and `${if(){}}`/`${}else{}`/`${}}` is control flow. Therefore inline formatting WORKS and needs no BC ask: dates `new Date(x).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})` → "June 30, 2026"; money `Number(x).toFixed(2)`; period `.toLowerCase()`+pluralize; conditionals available if needed. (The raw ISO dates in the signup email were just the bare token with no formatting — the engine output the raw value.)

**Signup email findings (2026-06-24):**
- The HTML owner first pasted as "signup confirmation" was actually the **uncancel/reactivation** template (wrong content for new signups). Verify which template BC's signup SLOT points at before uploading.
- The REAL sent signup email matches our mockup (`docs/email-previews/signup.html` / `server/templates/email.js` signupEmail) in copy/layout — the template is RIGHT. The "horrible" part is **unformatted token VALUES**: dates render as raw ISO (`2026-06-30T13:30:08.125Z`), period renders `"30 Day"`, first charge `"$1"` not `"$1.00"`, order id is a raw 24-char hex. These are BC hook-data formatting issues (can't be fixed in pure HTML unless BC exposes formatted token variants).

**Our deliverable:** `docs/email-templates/signup-confirmation.html` — corrected signup HTML for BC's tool. Reuses confirmed global tokens; best-guesses the signup hook as `code.order.signup.hook.*` (firstName/orderId/trialPrice/price/period/trialEndDate — VERIFY path against another BC signup/trial email); drops the raw trialStartDate. Don't hardcode price/trial terms — partner (shN) offers vary [[project_shn_framework]].

**Rehabbed set (docs/email-templates/, 2026-06-24):** signup-confirmation, cancel-order, uncancel-order, contact-received-confirmation, reset-password, csr-reply-notification, remarketing-1..4. Each has a token legend + change notes in an HTML comment.

**Recurring bugs found across templates:**
- Hard-coded "IDLookup" in body copy (cancel, reset ×2, uncancel, signup, remarketing) — must be `${comp.brand.name}` (same bundle serves idlookup/peoplesearcher/inmatefinder).
- Raw ISO dates / unformatted money / "30 Day" — fix inline (engine evals JS).
- **`{{mustache}}` tokens** (remarketing-2 subject `{{search_subject}}`) — BC uses `${...}`, so `{{...}}` renders LITERALLY. The remarketing series was authored in a different templating system.
- **ALL 4 remarketing emails were MISSING the CTA button** (the one thing a conversion email needs) — added "Unlock Full Access"/"See Full Reports"/"Claim Your Offer"/"Complete My Membership". remarketing-4 was nearly content-empty (no value prop either). HIGH business impact — these were live sends with no way to convert.

**Hooks discovered:** signup/trial=`code.billing.sale.hook`; cancel/uncancel=`code.order.canceled.or.uncanceled.hook`; contact create=`code.contact.email.hook.input.*`; CSR reply=`code.contact.email.hook.{name,subject,message,url.replyUrl}`; reset=`code.user.resetPassword.hook`; remarketing=`code.campaign` (`code.campaign.to.email`, likely `code.campaign.to.firstName`).

**OPEN for owner to supply/verify:** (1) the upgrade/payment path key — I used `comp.client.paths.payment` on all 4 remarketing CTAs (guess; signup used .dashboard, cancel used .account) — VERIFY or the CTAs break. (2) remarketing offer/expiry/searchSubject/firstName tokens under `code.campaign.*`. (3) reset CTA `url.login` must land on set-new-password page. (4) confirm `${...}` eval via a test send. Next: purchase/receipt template if it exists.
