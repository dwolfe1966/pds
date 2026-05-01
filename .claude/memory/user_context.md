---
name: user setup and machines
description: User identity, dual-machine setup, and primary working email
type: user
originSessionId: 213ac748-b711-4faa-90ba-322a69c9170c
---
David Wolfe (dwolfe66@gmail.com / dwolfe66@hotmail.com on git commits) works on the PDS / idlookup-app project.

He works across two machines:
- **Mac** — `/Users/davidwolfe/Documents/GitHub/pds` (current)
- **Windows** — `C:/Users/dwolf/Downloads/mvp/mvp/front-end/idlookup-app-updated/pds/` (referenced in `.claude/settings.local.json` permission entries)

Both run Claude Code; the source of truth between them is the `main` branch on GitHub (the repo is checked into git and clean working tree was observed). Cross-machine continuity has to flow through git + the per-project memory dir, not through Claude itself — each install has its own isolated `~/.claude/` (or `%USERPROFILE%/.claude/`) on disk.
