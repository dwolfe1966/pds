---
name: feedback_cta_color
description: CTA buttons use dark green #0d5d2f — NOT light green #16a34a (updated visual style 2026-07-14)
metadata:
  type: feedback
---
**Primary CTA color = `#0d5d2f` (dark green).** Light green `#16a34a` is NO LONGER used for CTAs (owner 2026-07-14). Matches `src/styles/designSystem.js` `colors.primary.main = #0d5d2f` (hover #2d8659).

**Why:** the updated visual style (docs/design/IDLookup_Design_OS_Phase_0_Working_Document.docx): "No visual noise, panic language, or screaming CTAs. Color communicates meaning, never decoration."

**How to apply:** any new CTA button → `#0d5d2f` background, white text. `#16a34a` is OK only as a *status/meaning* color (e.g. a "good/low" indicator), never a button. Brand-header gradients (`linear-gradient(135deg,#0d5d2f,#16a34a)`) are pre-existing decorative headers — prefer solid `#0d5d2f` for new work. I used #16a34a on CTAs earlier this session (EnrichProfileCard/SelfIdentifyCard/AccountPage/teasers) — all swapped to #0d5d2f.
