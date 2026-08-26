---
name: project_metrics_harness
description: scripts/metrics.mjs — no-dep GA4 + Search Console puller so Claude can analyze real funnel/conversion data in-session; blocked on owner provisioning a service-account key + GA4 property id
metadata: 
  node_type: memory
  type: project
  originSessionId: a30cdc08-f0c0-401c-a086-f4170eba2f74
---

**"Plug me into the data" (owner picked 2026-08, built 2026-08-20).** `scripts/metrics.mjs` — ZERO-dependency harness that pulls REAL performance data into the terminal so analysis happens in-session, not via screenshots. Mints the service-account JWT with Node's `crypto`, exchanges for an OAuth2 token, calls the **GA4 Data API** (`analyticsdata` runReport) + **Search Console** REST API with global `fetch`. `npm run metrics` (commit 2b5267f, on main).

**Reports:** events overview (eventCount·users), channels (sessionSource/Medium sessions+conversions), landing pages, optional single-event breakdown (`EVENT=purchase`), optional GSC top pages/queries. `JSON=1` for agent-readable output. `DAYS=` lookback (default 28).

**Auth path VERIFIED** (throwaway RSA key → Google returned expected fake-SA rejection); guards give clear setup instructions when property id / key missing. **Report calls UNEXERCISED** until real creds.

**⚠️ BLOCKED ON OWNER provisioning (the only missing piece):**
1. Google Cloud → create Service Account → JSON key → save to `./secrets/ga-service-account.json` (folder is **gitignored**, never commit; never paste the key into chat).
2. Enable "Google Analytics Data API" (+ "Search Console API" for GSC) on that project.
3. GA4 Admin → Property Access Management → add the SA `client_email` as **Viewer**; grab the numeric **Property ID** (GA4 fires via GTM `GTM-WV7N6WWP` — no G-XXXX measurement id in repo, so the numeric property id must come from GA4 Admin).
4. (Optional GSC) add the same email to Search Console for `https://www.idlookup.ai/`.

Then: `GA4_PROPERTY_ID=<id> node scripts/metrics.mjs`. Google Ads is `AW-18044069648` (separate OAuth, not covered — GA4 conversions cover purchases). Ties [[project_conversion_tracking_live]], [[project_tracking_architecture]], [[project_growth_plan_2026_07_11]].

**GA4 property id = 542993529** (owner-provided 2026-08-20).

**⚠️ AUTH BLOCKED by Workspace org policy (state at 2026-08-20 pause):**
- gcloud INSTALLED (`/opt/homebrew/bin/gcloud`; brew cask). Script now supports gcloud ADC (`authorized_user` refresh-token flow) in addition to SA-key JWT — commit 1646147.
- SA keys blocked org-wide (`iam.disableServiceAccountKeyCreation`) → pivoted to ADC user login.
- ADC login with gcloud's DEFAULT client (`764086051850-…`) is **blocked** by the org's app-access-control AND Google is deprecating the default client for the `analytics.readonly` sensitive scope ("scopes will be blocked soon for the default client ID… provide your own client ID").
- Owner IS the Workspace super-admin (confirmed). Allowlisting the default client is NOT durable (deprecation).
- **RESUME HERE → the fix is our OWN Internal OAuth client:** Console → https://console.cloud.google.com/auth/overview (project e.g. `idlookup-metrics`) → consent screen **Audience: Internal** → https://console.cloud.google.com/auth/clients → Create client → **Desktop app** → Download JSON → save to `secrets/oauth-client.json` (gitignored). Then: `gcloud auth application-default login --client-id-file=secrets/oauth-client.json --scopes=…analytics.readonly,…cloud-platform` → `gcloud auth application-default set-quota-project <PROJECT_ID>` (project needs Analytics Data API enabled). Internal app = trusted for org users → not blocked, and avoids the default-client deprecation. Then `GA4_PROPERTY_ID=542993529 npm run metrics`.
- Alt if OAuth-client path stalls: SA impersonation (needs a SA + Token Creator, no key) — messier; try Internal client first.
