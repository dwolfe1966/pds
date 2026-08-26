---
name: project-ask-d-attachment-download
description: BC ASK D — SPLIT status: CSR-uploaded audio plays ✅ via playAudioFlag; telephony/live-call recordings ❌ 404 on BOTH play AND download (re-verified 2026-07-27 vs develop_20260722)
metadata:
  type: project
---

**ASK D — ⚠️ SPLIT (re-verified 2026-07-27 vs deployed `csrWrapper:develop_20260722`):**
- **CSR-uploaded audio** → ✅ plays via `attachment.download({attachmentId, playAudioFlag:true})` (wired `76b8536`, 2026-06-26).
- **Telephony / live-call recordings (`liveCall_*.aac`, `brandId:'unknown'`)** → ❌ **404 on BOTH play AND download.** `playAudioFlag` CANNOT rescue a 404: verified the `develop_20260722` download handler STRIPS the flag from the server GET (`const {playAudioFlag:n, ...o}=e; params:o`) but RETAINS it only for a CLIENT branch after the blob returns (`if(n && isAudio) getAudioByBlob else <a download>`) — so play and download hit the IDENTICAL server request. Original 2026-06-26 "playback ✅" resolution therefore applies to CSR-uploaded audio ONLY, NOT telephony.

Registered in `docs/BC_CSR_ASKS_PACKAGE.md` (ASK D) + `docs/BC_CSR_LIB_METHOD_LIVE_EVIDENCE.md`.

**Not-our-bug proof is now a PURE CODE-TRACE (not the error string):** `EmailTicketsPage` forwards `att.id` UNMODIFIED → `api.adminDownloadAttachment(attId,{playAudioFlag:true})` → apiRouterAdmin `admin-download-attachment` → `apiWrapperCsr.csrDownloadAttachment` → `_viaCsr('api.attachment.download',{attachmentId,playAudioFlag:true})` → **BC's OWN IIFE** issued `GET admin.www.bytecrtrs.com/api/attachment/download?attachmentId=6a6796c78fc146711b114553&clientId=…&apiId=…` → 404 "Attachment file not found." The sent id EXACTLY equals what BC's find-response handed us. 2026-07-27 repro ids: contactMessageId `6a6796cd8fc146711b11455c`, attachmentId `6a6796c78fc146711b114553`.

**⚠️ "Attachment FILE not found" is NOT a record-vs-blob discriminator** — the SAME telephony recording returned "attachment not found" (no "file") on 2026-06-26; BC merely reworded it.

**Why:** CSRs can see the call-recording attachment link (we shipped it — clickable + correct label, commits `958acb0` + `bd3b5e0`) but clicking a live-call recording fails with "attachment not found". Blocks listening to / downloading call recordings from the ticket view. Client wiring confirmed correct and complete.

**Live byte-verified evidence:** sent `attachmentId:'6a3d7295d2a2310fd7ef9ed9'` which **exactly equals** the attachment object's `id` field → "attachment not found". Not a client bug.
- Attachment: `originalname:'liveCall_27.aac'`, `mimetype:'audio/aac'`, `size:157037`, `bucketName:'attachments'` (same bucket as ordinary attachments — NOT a bucket problem), `metadata.compressed:'zstd'`.
- Parent message: `type:'contact'`, `data.type:'outbound'`, `liveCallId:27`, **`brandId:'unknown'`** (the discriminator), `trackingIds.clientId:'curl'`/`apiId:'cli'` (telephony backend).

**Root cause (bc-iife-investigator, deployed csrWrapper bundle):** brand-scoped lookup appears to exclude `brandId:'unknown'` telephony attachments. Deployed csrWrapper has NO live-call/recording method (`liveCall.*`/`recording.*`/`call.*`/`voice.*` all absent); `/attachment/download` is the only file-retrieval path.

**THREE paths offered to BC (as of 2026-07-27):** **(0) NEW — retention:** confirm whether live-call recordings are persisted at all and for how long (retention window/purge) — a 404 may mean "never stored"/"purged", not a lookup bug, and we can't tell read-only. **(a)** fix server-side retrieval to serve telephony/`brandId:'unknown'` attachments; **(b)** name the ACTUAL discriminating GET param — **`bucketName` + `brandId` were empirically tried and BOTH still 404, that path is DEAD**; IIFE auto-forwards unknown params so (b) needs no IIFE change on our side.

**Orthogonal:** the userContact `/database/search` 403 (CONFIRM item) does NOT block ASK D — we already have the attachmentId from `findUserContactMessages`/histories; failure is purely in BC's download-by-id retrieval.

**How to apply:** Treat as the 4th BC ask (A offer / B billing.sale / C commerceOrder / D attachment-download) + the userContact CONFIRM. Distinct from the userContact data-model question and unrelated to A/B/C. Not yet wired into `scripts/demo-bc-csr-asks.js` — byte-verification is the proof for now; add an attachment-download probe to the demo on the next pass. If BC replies with a param name, path (b) is a zero-IIFE-change fix on our side. Relates to [[project_csr_lib_live_evidence_2026_06_17]] (full csrWrapper surface).
