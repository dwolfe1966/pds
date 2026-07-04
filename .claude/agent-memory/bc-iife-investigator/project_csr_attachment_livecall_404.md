---
name: csr-attachment-livecall-404
description: BC-side bug — /attachment/download 404s live-call recording attachments (brandId "unknown"); our wiring confirmed correct; BC ask drafted
metadata:
  type: project
---

CSR message "attachments" that are telephony **live-call recordings** (`audio/aac`, e.g. `liveCall_27.aac`) cannot be downloaded: `csrWrapper.api.attachment.download({ attachmentId })` returns "attachment not found" / 404 even though the id is byte-identical to the attachment object's `id` (`6a3d7295d2a2310fd7ef9ed9`).

**Why:** Our client wiring is CONFIRMED CORRECT (sends exact id, `playAudioFlag` stripped). Not fixable by a different method — no recording endpoint exists (see [[csr-attachment-download]]). Best lead: telephony recordings carry parent-message `brandId:"unknown"` (apiId `cli`/clientId `curl`, `liveCallId:27`); `/attachment/download` likely brand-scopes its lookup and excludes them. NOT a bucket issue — recording is `bucketName:"attachments"`, same as normal attachments.

**How to apply:** This is a BC-side fix or a missing-param disclosure, NOT our bug. Drafted a two-path BC ask (verified 2026-06-26) for the asks register / `BC_CSR_ASKS_PACKAGE.md`: (a) BC fixes server-side retrieval for brandId:"unknown"/telephony attachments, or (b) BC tells us the extra param (bucketName/brandId/liveCallId) and we forward it via the existing `params` spread — no IIFE change needed. Next: hand to `bc-asks-register` agent if owner approves.
