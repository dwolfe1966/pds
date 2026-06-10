# BC ask — consumer (public) text/SMS unsubscribe endpoint

**Raised:** 2026-06-10 · **From:** PDS / idlookup consumer · **Status:** OPEN

> **Context:** Our Director of CS & Compliance wants non-registered users and members to
> unsubscribe from **emails *and* texts** from a web page (CAN-SPAM / TCPA). We shipped the
> email side and a member tab, but there's no consumer text-unsubscribe.

## What we built (email — done)
- Public `/unsubscribe` page + footer link, and an Account → Communications tab.
- Both call the consumer IIFE `apiWrapper.api.managedContact.unsubscribeMail({ value: email })`
  → `POST /managedContact/unsubscribe/mail`. (Consumer bundle `9f408f9d`.)

## The gap
The consumer IIFE exposes **only `unsubscribeMail`** (`/managedContact/unsubscribe/mail`).
There is no consumer-callable method/endpoint to unsubscribe a **phone/SMS** managed contact.
The CSR side has a generic `managedContact.unsubscribe({ managedContactId })` but it requires
CSR auth, so a public/member page can't use it. Interim: per TCPA both surfaces tell users to
reply **STOP** to a text.

## Ask (any one closes it)
1. **A consumer `unsubscribeText` / `unsubscribeSms`** method (mirror `unsubscribeMail`):
   `POST /managedContact/unsubscribe/text { value: <phone> }`, no CSR auth required.
2. **OR** a generic consumer `unsubscribe({ type:'email'|'phone', value })`.
3. Confirm whether `unsubscribeMail({ value: email })` works **unauthenticated** (a non-registered
   user typing their email on the public page) or needs a token/signed param — so we know the
   public page actually unsubscribes vs silently no-ops.

Once available we wire it into `apiWrapper.unsubscribeManagedContactMail`'s sibling and the
`/unsubscribe` page + Communications tab text section.
