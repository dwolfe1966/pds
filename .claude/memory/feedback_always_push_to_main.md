---
name: feedback_always_push_to_main
description: "Owner wants every commit pushed to origin/main immediately — don't gate on push"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

**Always push to GitHub after committing.** Owner (2026-07-03): after every commit, run
`git push origin main` — don't pause for confirmation on the push. This OVERRIDES the default
sprint guardrail of pausing before remote pushes ([[feedback_autonomous_mode]]).

**Why:** the owner watches the GitHub/front-end release history; local-only commits make it look
like nothing shipped ("release history empty for today ... weird"). They expect committed work
to be on `origin/main` right away.

**How to apply:** commit → `git push origin main` in the same turn, every time, on this repo.
Still pause for the other destructive/remote actions (force-push, reset --hard, branch deletion,
opening PRs, posting outside the repo) — this exception is specifically for the routine push to
main. Repo: `dwolfe1966/pds`.
