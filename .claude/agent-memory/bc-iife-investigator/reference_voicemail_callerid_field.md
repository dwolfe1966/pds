---
name: reference-voicemail-callerid-field
description: Caller ID (ANI) for BC live-call/voicemail contactMessages lives at data.calleridnum (raw ANI) + content.input.phone (parsed dup); no transcription field exists in any BC CSV
metadata:
  type: reference
---

**Caller phone for BC telephony contactMessages** — from BC's own `docs/new-api/bc client library - Api v3.csv:686-730`, a real `type:'contact'` live-call sample (`liveCallId:3`, `brandId:'idlookup'`, topic `"Live Call"`, attachment `liveCall_3.aac`):
- **`data.calleridnum`** = `"9546087693"` — the raw telephony ANI (Asterisk `CALLERID(num)` convention). **THE authoritative field.**
- **`content.input.phone`** = same value — parsed contact-input duplicate.
- No `calleridname`, no transcription anywhere: `grep -i transcri docs/new-api/*.csv` = 0 hits; body/`description` is empty. Transcription is genuinely NOT in the BC response (matches ASK E asking for it).

**Reader status (`src/pages/admin/EmailTicketsPage.js` `contactMessageCallerPhone`, ~line 65):** already catches `content.input.phone` (candidate `c?.input?.phone`) but MISSES `data.calleridnum`. Recommend ADD `data.calleridnum`, KEEP `content.input.phone` fallback — do NOT tighten to one path.

**Big caveat:** this sample is `brandId:'idlookup'` (properly-onboarded call). The blank-on-prod bug (ASK E voicemail_19 / prior ASK D liveCall_27) is `brandId:'unknown'`, subject `"Voice Mail"`, `data.type:'outbound'`, and showed caller ID ABSENT — a DIFFERENT, still-unconfirmed shape (needs a live CSR fetch; no creds in agent sessions). So `data.calleridnum` explains the documented happy path, NOT why prod voicemails render blank. Related: [[project-asks-e-h-2026-07-02]], [[project-ask-d-attachment-download]], [[project_csr_attachment_livecall_404]].
