---
name: project_marketing_angles
description: Three new acquisition-angle funnels (marriage/divorce, WSFY, check-your-date) + the source-zip export finding
metadata:
  type: project
---

**3 new marketing angles** (owner 2026-07-23, "lets begin getting together"). First-draft brief:
`docs/marketing/2026-07-23-three-new-marketing-angles.md`. Each covers value props / audiences / ads /
budget / landing exp / conversion flow.
- **B.1 Marriage/Divorce** — Enformion divorce (live) + marriage (pending); "is he/she really single?"
- **B.2 Who's-Looking-For-You** — our self-built WSFY reverse-match engine; curiosity hook (highest CTR);
  doubles as the freemium-identity north-star wedge. ⚠️ real reverse-search counts ONLY, never fabricated.
- **B.3 Check-Your-Date** — composite (criminal + NSOPW sex-offender + marriage + identity/catfish); highest
  intent, best showcases full report breadth; recommended FIRST pilot.
Core thesis: these are ASSEMBLY of existing verticals into 3 branded funnels, low build cost. Guardrails:
FCRA (no eligibility framing), no fabricated data, private search, NSOPW display limits. **Open (blocks
firming budget):** owner's real monthly budget, channels/pixels ready, current+target CAC & subscriber LTV,
pilot pick, creative capacity. Next = turn the chosen pilot into a full campaign spec (ad sets, copy
variants, landing wireframe on existing SUP/teaser components, GA4 tracking, kill schedule). See
[[project_life_events_vertical]], [[project_wsfy_self_build]], [[project_freemium_identity_community]].

**⚠️ Security finding (surfaced during the source-zip export 2026-07-23):**
`admin/src/services/csrApiService.js:~98` has HARDCODED fallback credentials
(`admin@admin.admin` / `bcEdgeApiPass123!@#` and `admin@idlookup.ai` / `admin123`) in the admin app source.
Flagged to owner — rotate/remove before any external source handoff. Relates to [[feedback_no_secrets_in_bundle]].

**Source-zip export:** `pds-source.zip` (repo root, untracked, ~2MB) = clean source copy (src/public/server/
tracking-api/admin/scripts/.github/tests + config files) EXCLUDING seo/, docs/, .git, all .env*, node_modules,
build outputs, .claude/, and root scratch (screenshots/logs/scripts-out data). Rebuild recipe if needed:
include-oriented rsync of those dirs, scrub scripts/.smoke.env + scripts/out/.
