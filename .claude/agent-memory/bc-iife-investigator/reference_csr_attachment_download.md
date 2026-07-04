---
name: csr-attachment-download
description: csrWrapper attachment.download surface — only file-retrieval path, no recording method, playAudioFlag stripped, params spread lever, brandId:"unknown" 404
metadata:
  type: reference
---

Deployed `csrWrapper` (`https://dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js`) attachment retrieval facts (verified 2026-06-26 against deployed bundle + `docs/new-api/bc client library - csrApi v3.csv:2336`):

- **Only file-retrieval path is `GET /attachment/download`.** There is NO live-call / recording / voice / call / telephony method in the deployed api tree. Full url-path list for files = `/attachment/download` + `/attachment/remove` only. Do not look for `liveCall.*` / `recording.*` — they don't exist.
- **Handler:** `downloadAttachment = e => { const {playAudioFlag, ...o} = e; request({url:'/attachment/download', method:'get', params:o, responseType:'blob'}) }`.
  - `playAudioFlag` is **stripped before the GET** → it ONLY controls client play-vs-download, cannot affect a server 404.
  - **`...o` spread = client passthrough lever:** any extra field the caller passes is forwarded as a GET query param. So "BC needs an extra param" is fixable client-side without an IIFE change — just pass it in the `download({...})` arg.
  - Client forwards ONLY `{ attachmentId }` by default; no bucket/brand param passed or assumed.
- Documented params (csrApi v3 row 2344) are just `{ attachmentId, playAudioFlag }`.

See [[csr-attachment-livecall-404]] for the telephony-recording 404 bug.
