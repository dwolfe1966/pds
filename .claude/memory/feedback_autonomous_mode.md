---
name: Operate autonomously during the launch sprint
description: User invoked "set automode true" on 2026-05-07. Proceed on agreed work without per-step confirmation; commit to main; only pause for destructive or genuinely ambiguous actions.
type: feedback
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
User explicitly said "set automode true" on 2026-05-07. Combined with prior "commit straight to main right now" feedback during the launch sprint.

**Why:** Launch is in 4-9 days from 2026-05-07 (per `project_launch_timeline.md`). Pace matters more than per-step approvals.

**How to apply:**
- Routine work runs without asking: file edits, builds, manual smoke tests, branch-free commits to main, memory updates.
- After completing the agreed unit of work, report what changed and surface the next logical step. Don't manufacture follow-ups beyond the plan.
- **Still confirm** before:
  - Destructive git operations (force-push, reset --hard, branch deletion)
  - Pushing to remote / opening PRs / posting outside the repo
  - Adding npm dependencies (small ones acknowledged in passing — `transform-remove-console` was fine; bigger ones surface first)
  - Touching admin code while we're focused on consumer (or vice-versa) — the user has a clear consumer-vs-admin split
  - Anything where the spec is genuinely ambiguous and a wrong guess would cost real time
- When the audit / fix loop is wide-open (e.g., "audit and clean up X"), produce a tight report of findings *first*, then start applying. Don't bulk-edit before the user has seen the scope.
- This is sprint-level guidance, not a default for the post-launch project. Revisit after launch.
