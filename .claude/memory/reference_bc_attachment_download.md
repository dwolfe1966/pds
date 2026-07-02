---
name: reference_bc_attachment_download
description: BC csrWrapper attachment.download is IIFE-managed (await-only); how CSR message attachments are downloaded
metadata: 
  node_type: memory
  type: reference
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

CSR message attachments (Find User Contact / contactMessage) carry an `attachmentId`; download via `csrWrapper.api.attachment.download({ attachmentId })`. Verified against the DEPLOYED bundle (`dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js`): `api.attachment = { download, remove }` exists.

`download` is **IIFE-managed, side-effect only** (like `idLookup.downloadPdfReport`): it pops its own "Would you like to download?" confirm modal, fetches `GET /attachment/download` with `responseType:"blob"`, reads the filename from `content-disposition`, and triggers an `<a>`+`createObjectURL` download itself. Returns nothing useful — the caller just `await`s it; **do NOT add blob handling**. (Audio + `playAudioFlag` routes to an in-IIFE player instead.)

Wired 2026-06-26 (commit 958acb0): `apiWrapperCsr.csrDownloadAttachment` → `_viaCsr('api.attachment.download', { attachmentId })` (lib-only, no direct-POST fallback) → `apiRouterAdmin` case `admin-download-attachment` → `api.adminDownloadAttachment` → `EmailTicketsPage` clickable attachment button. Admin bundle `admin.78549874.js`.

**Live-verified 2026-06-26 (commit bd3b5e0):** real attachment objects are mostly inbound/outbound **LIVE CALL RECORDINGS** (`audio/aac`, e.g. `liveCall_27.aac`). The download-id field is **`id`** (no `attachmentId` key); our `att.id` resolver is correct (byte-verified: sent id == object id). The **label** field is **`originalname`/`filename`** (NOT `name`/`fileName`) — resolver fixed to prefer those.

**✅ RESOLVED for playback (no BC change) — `playAudioFlag`:** the 404 is **download-only**. `attachment.download({ attachmentId, playAudioFlag:true })` SUCCEEDS and plays live-call recordings via BC's audio control (confirmed live 2026-06-26: promise resolved vs download path's 404). Wired commit `76b8536` — audio attachments (by mimetype) pass `playAudioFlag`, render ▶️ "Play recording". So the investigator's "flag stripped pre-GET → same request" read was WRONG; the playAudioFlag path actually serves audio. Residual (low priority): downloading a recording to disk (no flag) still 404s — only matters if save-vs-listen is needed. ASK D downgraded to ✅ resolved.

**(Historical) download-path 404:** `attachment.download` (no flag) returns "attachment not found" for live-call recordings **even with the correct id** — discriminator is parent-message `brandId:"unknown"` (telephony), brand-scoped lookup excludes them. NOT a bucket issue (same `attachments` bucket). No live-call/recording method exists in csrWrapper. Two fix paths offered BC: (a) server-side retrieval fix, or (b) name an extra GET param — IIFE auto-forwards unknown params (`{playAudioFlag,...o}=e; params:o`), so (b) needs no IIFE change. **Empirically ruled out (live 2026-06-26): forwarding `bucketName=attachments&brandId=unknown` with FRESH auth still returns `404 Not Found`** — so those are NOT the override params; BC must fix server-side (path a now primary) or name the actual discriminator. (`playAudioFlag` stripped pre-GET → not the fix. NOTE: 403 = expired session/auth; 404 = authed but attachment-lookup fails — the real failure.) NO client workaround exists. Normal (real-brand) CSR-created attachments should still download fine. See `docs/BC_CSR_ASKS_PACKAGE.md` (ASK D), [[reference_csr_library_migration]], [[project_csr_lib_live_evidence_2026_06_17]].
