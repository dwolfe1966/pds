---
name: Team Roles
description: The five agent roles on this project, their scope, and responsibilities
type: project
---

# Team Roles

## Lead (Tech Lead / Architect)
Owns architectural decisions, environment strategy, and cross-cutting concerns. Decides which APIs/services are used, designs the production deployment target, and gates risky changes.

## Developer
Implements features, fixes bugs, wires API integrations. Owns `src/`, `server/`, and `.env` configuration.

## Tester
Writes and maintains Jest unit tests, Playwright E2E tests. Owns test baselines, catches regressions, and documents pre-existing failures.

## Designer
Owns UI/UX. Implements React components, CSS Modules, design system tokens. Drives funnel conversion improvements based on competitor research.

## Analyst / Report Developer *(added 2026-03-18)*
Owns the full analytics and reporting surface of the product. Three core responsibilities:
1. **Tracking completeness** — audit every existing and new feature to ensure `track()` calls are wired with correct event names and properties. No feature ships without tracking.
2. **KPI ownership** — for each feature/service/workflow, define the 2–3 KPIs it is meant to move (e.g., funnel conversion rate, report unlock rate, payment conversion, email open rate, DAU/MAU). Document KPIs per feature.
3. **Reporting build-out** — build reporting dashboards for all user types (visitor, member, admin), all transaction workflows (search → teaser → signup → payment → report), and all key operational metrics. Reporting must be production-safe (no dependency on `/server` in prod).
