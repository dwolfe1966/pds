---
name: reference_browser_agent
description: "Playwright MCP browser-control setup — how Claude drives a real browser for E2E tests / online tasks, plus the hard guardrails"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**Playwright MCP server** is configured so Claude can drive a real browser interactively (navigate/click/type/fill/snapshot/screenshot) and run E2E tests + online tasks without per-step human involvement. Added 2026-06-24.

- Config: `claude mcp add playwright --scope local -- npx -y @playwright/mcp@latest --isolated` (local scope = this project, in `~/.claude.json`; promote to `--scope user` if wanted for all-project/general web research). `--isolated` = in-memory profile, **nothing persisted to disk** (enforces the no-persisted-creds rule).
- Tools load at SESSION START. After adding/changing the server, **restart Claude Code** for `browser_*` tools to appear. Health: `claude mcp list`.
- Playwright 1.58.2 + Chromium (Chrome for Testing v1208) already installed; e2e harness in package.json (`npm run test:e2e*`). Existing scripted pattern: `scripts/funnel-*.js`, `scripts/smoke-consumer-*.js` (run via Bash, read /tmp screenshots).

**Capabilities**: full adaptive browsing — research, dev-environment E2E (search→signup→pay on dev.www.idlookup.ai), reading/QA, navigation, GTM/GA4 DebugView checks.

**Hard limits / guardrails (honor — from prod-golive memory)**:
- **Prod search is gated by Cloudflare Turnstile** → needs a human for that one step (see scripts/funnel-prod-headed.js). Everything else on prod (read/navigate/non-captcha flows) is automatable.
- **NEVER persist prod creds** (isolated mode helps; never save to a file either). Owner provides creds per session.
- **NO mutation/payment/PII writes on prod without owner present** (real money/real customers). Dev env is the safe sandbox for full write E2E.
- Default to dev environment for anything with side effects; prod is read-only unless owner is present and approves.

Related: [[project_bc_production_golive_2026_06_23.md]], [[reference_live_uat_playwright]], [[project_tracking_architecture]] (GA4 DebugView QA is a natural first browser-agent task).
