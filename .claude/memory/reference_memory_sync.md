---
name: cross-machine memory sync
description: How memory is shared between Mac and Windows Claude Code installs for this repo
type: reference
originSessionId: 213ac748-b711-4faa-90ba-322a69c9170c
---
The per-project memory dir is shared between machines via the repo:

- **Canonical store:** `<repo-root>/.claude/memory/` — committed to git
- **Mac symlink:** `~/.claude/projects/-Users-davidwolfe-Documents-GitHub-pds/memory` → `<repo>/.claude/memory`
- **Windows junction (set up the same way on the Windows install):**
  `mklink /J "%USERPROFILE%\.claude\projects\<windows-slug>\memory" "<repo>\.claude\memory"`
  where `<windows-slug>` is whatever Claude Code slugified the Windows working dir to (look in `%USERPROFILE%\.claude\projects\`).

When either Claude install writes a memory, it goes into the repo. Commit + push to share with the other machine. Pull before starting a session if you want the latest memories.

Do not write secrets / personal-feedback memories here — anything in `.claude/memory/` ships with the repo.
