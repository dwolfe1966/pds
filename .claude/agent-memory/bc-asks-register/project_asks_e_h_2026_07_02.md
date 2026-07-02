---
name: project-asks-e-h-2026-07-02
description: BC ASKS E–H registered 2026-07-02 from owner's prod bug list (voicemail metadata, sale-406 fraud block, free-member user.update 403, city/state on user object) — staged, NOT sent
metadata:
  type: project
---

**ASKS E–H — registered 2026-07-02 in `docs/BC_CSR_ASKS_PACKAGE.md`, all ❌ open, NOT sent to BC.** Source: owner's CSR/consumer bug list `docs/bugs/CSR_bugs_7_2_2026.csv` (prod screenshots at nimb.ws links). Draft BC notes staged in the package doc under "Draft BC notes for E–H".

- **E — voicemail contactMessages lack caller ID (ANI) + transcription.** Prod Email Tickets: from `dev@mail01.bytecrtrs.com`, subject "Voice Mail", body = only a `stamp:` line, "No Name / Non-member", one `.aac` (`voicemail_19.aac`). Ask: `data.phone`/body ANI + transcription field. Related to [[project-ask-d-attachment-download]] (same telephony pipeline, `brandId:'unknown'`).
- **F — billing.sale 406 velocity/fraud block.** Prod userId `6a45…3c22` (testmc#5): 4× $1.00 `blocked` Jul 1 21:49–21:53; corrected valid info still fails, bare 406 — indistinguishable from the sequenceOption 406. Ask: document trigger/duration/reset, CSR unblock path, distinguishable error body. Consumer friendly message shipped commit `5ed93d9` (`errorType:'payment_blocked'`).
- **G — consumer `user.update` → 403 "Forbidden resource" for never-paid members.** Prod testmc#4, phone save. Our signup is synthetic (BC user created inside billing.sale; failed sale still creates the user). Ask: is it gated on paid status vs session provenance; supported path for free-member firstName/lastName/phone. Owner requirement: free members MUST maintain their profile. Distinct from CSR-context user.update (which works).
- **H — city/state on user object (or order billingAddress echo).** CSR profile shows Zip only (dug from order billingAddress; user object omits address). Ask: real city/state data; we may interim-fix with client-side zip lookup.

**Why:** owner's 2026-07-02 bug-list triage; freemium model audit (F/G) + CSR usability (E/H).
**How to apply:** these are PROD-evidenced — BC live on prod since 2026-06-23, NO mutation probes on prod, so they are NOT in `scripts/demo-bc-csr-asks.js`; evidence = cited prod artifacts (userId, timestamps, screenshots). Register count now 7 open (A/B/C + E/F/G/H) + D-residual + 1 CONFIRM. Lettering: the package doc is canonical; the older `BC_CSR_LIB_ONLY_ASKS.md` has a conflicting internal "ASK E" — package letters win. No duplicates: F ≠ ASK B (B = missing CSR lib method; F = consumer 406 semantics), G ≠ the withdrawn-list CSR user.update note, H extends the user-object-no-zip finding.
