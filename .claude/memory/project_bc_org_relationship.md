---
name: BC (ByteCrtrs) is internal, not a third-party vendor
description: BC and the consumer/admin app teams are part of the same company. Frame BC issues as internal coordination, not external vendor management.
type: project
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
ByteCrtrs (BC) and the consumer/admin app are under the **same organization**. BC is not an external vendor; they're a co-located team that owns the upstream API, IIFE wrappers, hosting, IDI integration, and shape/cascade infrastructure.

**Why this matters when phrasing recommendations or debug write-ups:**
- Don't frame BC issues as "escalate to vendor." Frame them as "open a thread with BC team / file a ticket internally."
- Bug fixes, schema changes, and IIFE adjustments are negotiable, not one-way asks. We can propose specific code changes (e.g. "switch /api/tracking/create from GET-rendered pixels to POST", "remove `password.v0` captcha on `/contactMessage/create` for authed sessions") and expect collaborative resolution, not just policy responses.
- Direction on shared concerns (offer shmName inventory, attribution conventions like shConId/shColId, IDI provisioning) is collaborative. We're allowed to suggest BC-side changes that benefit our funnel.
- Turnaround should be measured in hours/days, not weeks. If a BC-side issue is blocking launch, it's appropriate to escalate within the org rather than wait.

**How to apply when communicating BC findings:**
- Write the debug summary, attach the trace/logs, send it to the BC team directly.
- Recommend specific fixes ("BC: please switch X to POST" instead of "BC may want to consider...").
- For schema decisions (campaign config, offer shmNames, comp.shape.xxx names), treat as joint design work, not waiting on third-party docs.
- When BC has competing priorities, surface impact on consumer launch and let the company prioritize — not us deferring to external SLA.

Tightly related:
- `project_idi_data_whitelist.md` — IDI is a downstream **third-party** data provider that BC integrates with; IDI provisioning IS still external-vendor management.
- `project_bc_hosting_quirks.md` — BC's nginx / cert / hosting decisions are under our company's umbrella.
- `bytecrtrs_api_reference.md` and `bc_admin_api_reference.md` — BC's IIFE surfaces are documented but we can request additions/changes.
