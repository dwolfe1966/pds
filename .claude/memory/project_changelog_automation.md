---
name: project_changelog_automation
description: Twice-daily GitHub Action pushes delivered commits to a team Google Sheet
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

A delivery changelog ("bugs + features shipped") auto-syncs to a shared Google Sheet, set up 2026-06-27 (working + populated).

- **Source of truth = git.** `scripts/changelog.js` parses Conventional-Commit messages → rows (Date, Type, Area, Summary, Commit). Delivered types: fix→Bug fix, feat→Feature, perf→Improvement, polish, harden→Security, content. (`docs`/`chore`/`test`/`refactor`/internal excluded unless `--all`.)
- **Automation:** `.github/workflows/changelog.yml` runs cron 01:00 & 13:00 UTC + manual dispatch; checkout `fetch-depth:0` (needed for `git log --since`); posts the 30-day window via `--webhook`.
- **Bridge:** a Google Apps Script web app (`doPost`) appends rows and **de-dupes by commit hash** (column E), so re-posting daily only adds new commits. Token rides in the POST **body** (not the URL — `&%$!` would break a query token).
- **Secrets (GitHub repo → Settings → Secrets → Actions):** `CHANGELOG_SHEET_URL` (bare `…/exec`) + `CHANGELOG_SHEET_TOKEN`. Never commit these. Webhook URL also gitignored at `scripts/.changelog-webhook`.
- Full setup + the Apps Script: `docs/changelog/README.md`. Run manually: Actions tab → "Delivery changelog → Google Sheet" → Run workflow.

DON'T break the commit-message convention (`type(scope): subject`) — the changelog quality depends on it.
