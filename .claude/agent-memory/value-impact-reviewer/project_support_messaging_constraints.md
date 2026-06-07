---
name: Consumer support messaging — BC-bound enumeration constraint
description: BC removed /userContact/list 2026-04-17; consumer is per-thread only via histories(id, hash). Owner ruled out BFF before launch.
type: project
---

Consumer cannot enumerate its own contactMessage threads. `apiWrapper.api.message.contact.histories({contactMessageId, hash})` works per-thread; client must already hold the refs (captured at compose, or via the per-reply email link).

**Why:** BC intentionally removed `POST /api/message/userContact/list` on 2026-04-17 with no consumer replacement. Owner explicitly ruled out building a BFF / cached-CSR-creds enumeration layer before the 2026-05-07 launch window — tracking-api/ exists but is off-limits for this. BC is internal, ask was sent 2026-05-28 (`docs/BC_USERCONTACT_LIST_404.md`).

**How to apply:**
- Three real-world breakage cases for paid users: cross-device, cleared storage, CSR-initiated F8 billing threads. Each silently hides legitimate replies until the user clicks an email link.
- Don't treat the empty-state copy ("replies arrive by email, click the link") as merely cosmetic — it's the user's only signal that threads they can't see may exist. Trust failure mode is *invisible* state, not error state.
- localStorage may store refs (id, hash) but NEVER content; BC stays source of truth per `feedback_bc_is_source_of_truth.md`. The 2026-05-28 rewrite of `AccountPage.fetchMessages` enforces this.
- Anon→signup migration via `pendingContactThreads:<email>` in AuthContext closes one gap; CSR-initiated and cross-device remain open until BC ships enumeration.
- F8 RefundEmailModal is the highest-value broken case for the gap: a paying user being asked about billing has the worst possible "where is the message?" experience.
