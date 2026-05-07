---
name: BC IIFE request body shapes (consumer)
description: How the deployed dev BC IIFE (https://dev.www.idlookup.ai/libs/api-wrapper/index.iife.js) shapes request bodies — needed when bypassing the IIFE with a direct POST. Different endpoints use different shapes; getting it wrong returns an opaque 500.
type: reference
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
When the IIFE method is missing from the deployed bundle and we fall back to a direct POST (via `_csrPost`), we have to match the IIFE's body shape exactly or BC returns 500 with no detail. The shape is **per endpoint** — there is no universal envelope.

## Inspecting the deployed IIFE

```bash
curl -sS https://dev.www.idlookup.ai/libs/api-wrapper/index.iife.js > /tmp/bc-iife.js
grep -nE "url: '/[a-zA-Z/-]+'" /tmp/bc-iife.js          # all endpoint paths
grep -nE "data:\s*\{\s*input:" /tmp/bc-iife.js          # endpoints that wrap in { input }
sed -n '<line>,<line+30>p' /tmp/bc-iife.js              # read a specific method
```

The IIFE is single-file and readable. Always grep here before guessing — the consumer-side BC docs the team has don't document body shapes.

## Confirmed shapes (2026-05-06)

| Endpoint | Body shape | Empty handling |
|---|---|---|
| POST `/user/update` | `{ firstName, lastName, phone }` (flat) | IIFE drops keys with empty values before posting |
| POST `/contactMessage/create` | `{ input: { category, topic, name, email, phone, description, orderId, ... } }` | IIFE strips empty values inside `input` |
| POST `/contactMessage/userReply` | `FormData` (NOT JSON), with `contactMessageId` and `hash` also as querystring | n/a |

## Captcha gotcha

BC's contactMessage endpoints (and likely others) return **412 with a `captchaId`** when called without a session AND without an `x-captcha-id` header. The IIFE handles captcha through its `this.request` axios wrapper (look for `captchaIdHeaderKey = 'x-captcha-id'`). Logged-in users *may* be exempt — needs verification per endpoint.

## Where this lives in our code

- `src/services/apiWrapper.js` — `createContactMessage`, `userUpdate`, etc., each tries the IIFE first then falls back to `_csrPost`.
- `_csrPost(path, body)` is our direct-POST helper. It adds `clientId/apiId` query params and `credentials: 'include'`, but does NOT add captcha headers — that's our problem to solve if we hit a captcha-protected endpoint.
