---
name: project_p0_openai_key_rotate
description: "P0 — live OpenAI key + credentials in seo/docs/*.rtf (untracked, no repo leak) need rotation + gitignore"
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

Found 2026-08-25. `seo/docs/openai-key.rtf` holds a live `sk-proj-…` OpenAI key; `seo/docs/credentials.rtf` holds other secrets.

**Status:** both are **UNTRACKED — never committed, not in git history** (`git ls-files` empty, no log). So **no repo/history leak** — no history surgery needed.

**Actions (owner):**
1. **Rotate/revoke the OpenAI key** anyway — it's existed in plaintext on disk (and was surfaced in a Claude transcript). Rotation is the real fix; file removal is secondary.
2. **gitignore `seo/docs/*.rtf`** (mirror the `docs/admin/*.rtf` gitignored pattern) so a stray `git add` can't commit them — `seo/docs/` is currently NOT ignored.

I did not delete the files (owner's). Offered to gitignore the path on request. Related: hardcoded creds in csrApiService.js already flagged ([[project_marketing_angles]]).
