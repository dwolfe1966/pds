# BC ask — Welcome email on signup

**Raised:** 2026-05-29
**Bug ref:** #21 in `docs/qa/bc client library - Bugs.csv`
**Environment:** `https://dev.www.idlookup.ai/`

## Copy-paste summary

> When a member completes `apiWrapper.api.billing.signup` (free or paid),
> they currently receive no email at all. Standard transactional email
> expectation — every SaaS sends a welcome / account-created mail.
>
> You already have `smtp01Mailer` working end-to-end — we see
> `mailResult.success: true` on every `contactMessage.create` we fire.
> Please add a welcome email trigger on the successful signup path,
> using the same mailer.
>
> Suggested content (you can wordsmith):
> - Subject: `Your IDLookup.AI account is ready`
> - Body: brief welcome, link to `/dashboard`, support contact
>
> No client-side change needed — we just need BC to wire it.

## Why we can't do this client-side

- Production ships as a pure React SPA. We have no backend service that
  could hold SMTP credentials.
- Browser-side email services (EmailJS etc.) require exposing public
  keys, have rate limits, and add a 3rd-party dependency we don't need
  if BC's existing `smtp01Mailer` can do this.

## Launch posture if BC can't ship in time

Acceptable launch gap. Member experience confirmation already lives on
`/payment` success screen + `/dashboard` first-load. Not worth blocking
launch for.
