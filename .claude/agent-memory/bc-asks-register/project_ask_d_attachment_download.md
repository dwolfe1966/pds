---
name: project-ask-d-attachment-download
description: BC ASK D (2026-06-26) — live-call recording PLAYBACK ✅ resolved via playAudioFlag (no BC change); download-to-disk residual still 404s (brandId:'unknown' telephony attachments)
metadata:
  type: project
---

**ASK D — ✅ RESOLVED for playback (2026-06-26, no BC change): `attachment.download({attachmentId, playAudioFlag:true})` plays the recording via BC's audio control (wired commit `76b8536`). RESIDUAL (low priority): download-to-disk (no flag) still 404s.** Registered 2026-06-26 in `docs/BC_CSR_ASKS_PACKAGE.md` + addendum in `docs/BC_CSR_LIB_METHOD_LIVE_EVIDENCE.md`. The record below documents the download-path investigation (still valid for the residual).

**Why:** CSRs can see the call-recording attachment link (we shipped it — clickable + correct label, commits `958acb0` + `bd3b5e0`) but clicking a live-call recording fails with "attachment not found". Blocks listening to / downloading call recordings from the ticket view. Client wiring confirmed correct and complete.

**Live byte-verified evidence:** sent `attachmentId:'6a3d7295d2a2310fd7ef9ed9'` which **exactly equals** the attachment object's `id` field → "attachment not found". Not a client bug.
- Attachment: `originalname:'liveCall_27.aac'`, `mimetype:'audio/aac'`, `size:157037`, `bucketName:'attachments'` (same bucket as ordinary attachments — NOT a bucket problem), `metadata.compressed:'zstd'`.
- Parent message: `type:'contact'`, `data.type:'outbound'`, `liveCallId:27`, **`brandId:'unknown'`** (the discriminator), `trackingIds.clientId:'curl'`/`apiId:'cli'` (telephony backend).

**Root cause (bc-iife-investigator, deployed csrWrapper bundle):** brand-scoped lookup appears to exclude `brandId:'unknown'` telephony attachments. Deployed csrWrapper has NO live-call/recording method (`liveCall.*`/`recording.*`/`call.*`/`voice.*` all absent); `/attachment/download` is the only file-retrieval path.

**Two paths offered to BC:** (a) fix server-side retrieval to serve telephony/`brandId:'unknown'` attachments; OR (b) name an extra GET param (e.g. `brandId`/`bucketName`) — the IIFE auto-forwards unknown params (`const {playAudioFlag, ...o}=e; params:o`), so path (b) needs NO IIFE change on our side. **`playAudioFlag` is stripped pre-GET → NOT the fix.**

**How to apply:** Treat as the 4th BC ask (A offer / B billing.sale / C commerceOrder / D attachment-download) + the userContact CONFIRM. Distinct from the userContact data-model question and unrelated to A/B/C. Not yet wired into `scripts/demo-bc-csr-asks.js` — byte-verification is the proof for now; add an attachment-download probe to the demo on the next pass. If BC replies with a param name, path (b) is a zero-IIFE-change fix on our side. Relates to [[project_csr_lib_live_evidence_2026_06_17]] (full csrWrapper surface).
