# HomeFacts entry-experience A/B test — setup & operations

_Last updated 2026-08-21. Source of truth for the HomeFacts landing A/B: the arms, how traffic is split,
how it's tracked (BC + our own log), and how to read/operate it. Companion: `entry-experience-permutations.md`
(the design exploration) and `../../.claude/memory/project_homefacts_traffic.md` (running history)._

---

## 1. The problem this solves

HomeFacts sends us traffic from **registered-sex-offender detail pages** (e.g.
`homefacts.com/offender-detail/CA…/Abel-Ulloa-Garcia.html`) via a **"VIEW CRIMINAL RECORD"** button, with
`firstName, lastName, city, state, type` (+ `shn`) in the link. Historically it converted ~0 because:

1. The old page (**v3**) **auto-fired the BC search on arrival**, so a cold visitor's first impression was a
   Cloudflare Turnstile "verify you are human" modal over a greyed page → **first-page abandonment**.
2. Even past that, we showed **less** than HomeFacts already did (address, DOB, physique, aliases), all
   locked, with no map and no "criminal record" payoff.

The A/B tests redesigned entry experiences that (a) never show a captcha on arrival, (b) pay off the
"criminal record" intent, and (c) show something HomeFacts couldn't (a **map**, and a **real mugshot +
facility** when we have the record).

---

## 2. The arms in rotation

**Live rotation: `v5`, `v6`, `v9` — even 33 / 33 / 34.** (Control note: v3 ≈ 0 baseline is already
established, so v3/v4 are NOT in rotation. v7/v8/v10 are built but held.)

| Arm | Route | Idea | Resolve timing |
|-----|-------|------|----------------|
| **v5** | `/name/landing/homefacts-v5` | **Criminal-Record File** — criminal-led, map, "more than HomeFacts" | shell → tap resolves → resolved view → unlock |
| **v6** | `/name/landing/homefacts-v6` | **Instant Map** — no search on landing, zero friction | resolve on the unlock tap → straight to payment |
| **v9** | `/name/landing/homefacts-v9` | **Mirror HomeFacts** — registration-details look + blue "VIEW CRIMINAL RECORD" button | shell → tap resolves → resolved view → unlock |

All arms: **no captcha on arrival** (shell-first or no-search), a **map** of the area (geocoded from
city/state), and a **booking signal** (see §5). Built on the shared foundation `src/pages/sales/homefactsShared.js`
+ `src/components/AreaMap.js`.

Other built experiences (not in rotation): **v7** Full Dossier, **v8** Proximity/Safety, **v10** Record Document.

---

## 3. How traffic is split (we self-assign, not BC)

Owner decision: **we do the arm assignment ourselves**, not BC's shape.

- **Where:** `resolveHomefactsAbRoute()` in `src/services/funnelSplit.js`, called from `HomePageRedirect`
  in `src/App.js` — the same override placement as the paid v3/v11 split.
- **Mechanism:** the campaign registry still resolves the HomeFacts shn (`6a7a2af6d8e615c6c6562e8b`) to
  `/name/landing/homefacts-v3`; we **override** that with a sticky `pickWeighted` across v5/v6/v9. Doesn't
  await the BC theme.
- **Sticky:** per **session** (`sessionStorage['split.homefacts_ab']`) — a visitor always gets the same arm
  within a session (and on reload). A new session may reassign. (To make it cross-session, back it with
  localStorage.)
- **Result:** real shn traffic goes **only** to v5/v6/v9. v3 is reachable only by typing its URL directly.

**To change the rotation** — edit `HOMEFACTS_AB` in `funnelSplit.js`:
```js
const HOMEFACTS_AB = [
  ['/name/landing/homefacts-v5', 1 / 3],
  ['/name/landing/homefacts-v6', 1 / 3],
  ['/name/landing/homefacts-v9', 1 / 3],
];
```
Adding **v3** back later = add `['/name/landing/homefacts-v3', 0.25]` and rebalance the others to sum to 1.

---

## 4. Tracking — the arm reaches TWO systems

### BC tracking (their system)
The arm reaches BC **two ways**, so self-assigning loses nothing:
- **Event-level:** `variant` (`homefacts-v5/6/9`) rides **every** `_sendToBC(...)` call — landing → teaser →
  unlock → purchase. Set at landing by `useLandingTrack('name', CFG.variant)` → `sessionStorage['funnel.variant']`
  → included in `funnelContext()` on every `track()`.
- **Attribution / order-level:** we stamp the arm into BC's **native A/B slot `refer_abc`** at assignment
  (in `resolveHomefactsAbRoute`). `buildRefer()` forwards `refer_abc` onto every event's `refer` **and the
  sale/order record**, so BC gets arm-level revenue attribution.
- **Partner payout is unchanged** — keyed on `shn` / `refer_partnerId` (partner-level, correct).

### Our own log — `web_events` (idlookup.me Neon)
Independent of BC and of GA4 (whose service-account access is org-blocked). Every client event is pushed
**asynchronously, non-blocking** (`navigator.sendBeacon`, never awaited) to `POST /api/web-events`.

- **Client:** `src/services/webEvents.js` (`logWebEvent`), hooked once inside `trackingService.track()`.
- **Endpoint:** `seo/app/api/web-events/route.js` → `seo/lib/web-events-db.mjs` → Neon.
- **Table `web_events`:** `ts, client_ts, event, user_id (null when anon), user_state (visitor|member|paid),
  anon_id, session_id, variant, shn, partner, page, page_data jsonb, referrer, user_agent, ip_hash, country`.
  Schema: `seo/db/web-events-schema.sql`. `anon_id` is shared with search-activity for cross-log stitching.
  No PII (email/phone/zip) is sent.

---

## 5. The booking signal (mugshot + facility)

Owner: the generic "possible offender record" box was tall, non-personalized, and duplicated the rows below —
**removed** from all arms. Replaced with the **specific** treatment: a real **mugshot + facility name +
charges** from our first-party incarceration data.

- Component: `BookingSignal` in `homefactsShared.js` → `SignalTeaser flow="inmate"` (the proven inmate teaser,
  ~7.15% CVR). Non-strict so the facility name shows. Pre-pay, no Turnstile.
- **Safe-by-default:** renders **nothing** when there's no matching record — never an empty/generic box.
- **Coverage:** our incarceration DB is FL-heaviest today (`fl_inmates`, `inmates` on Neon) and grows as we
  expand it. Lights up for a subset now; zero downside where absent.
- Verified: `Noel Melendez / FL` → mugshot + charge ("L/L MOLEST V<12") + "LIBERTY C.I."; `Abel Ulloa Garcia`
  (no record) → nothing.

---

## 6. Reading the results

**Quick rollup (app-key gated, aggregate only):**
```
GET https://idlookup.me/api/web-events?days=14      (header: X-App-Key: <WSFY_APP_KEY>)
```

**Direct SQL** (from `seo/`, using `DATABASE_URL` in `.env.local`):
```bash
node --env-file=.env.local --input-type=module -e "
import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL);
const r = await sql\`SELECT variant, event, count(*)::int n, count(DISTINCT session_id)::int sessions
                     FROM web_events WHERE variant IS NOT NULL GROUP BY variant,event ORDER BY variant,n DESC\`;
r.forEach(x=>console.log(x.variant, x.event, x.n, x.sessions));"
```

**Funnel steps** (per arm): `landing_view → search_step → search_submit → results_view → loader_complete →
teaser_view → serp_result_onboarding → payment_start → purchase`. Conversion-rate-by-arm = `purchase`
sessions ÷ `landing_view` sessions per `variant`.

BC-side, the same arm is queryable via the tracking `variant` field and the order `refer_abc`.

---

## 7. Status & go-live

- **All code committed to `main`.** Consumer bundle **not yet deployed** (owner deploys): latest is
  `public.0830ea8e.js`.
- **web_events pipeline is LIVE** — table created on Neon, endpoint deployed (Vercel auto-deploy), verified
  end-to-end; table **cleared** to a clean baseline 2026-08-21.
- **Go-live** = deploy the consumer bundle. Then real HomeFacts shn traffic flows into the 33/33/34 split and
  both BC + `web_events` record by arm from the first event.

### Open items / caveats
- **Maps in production:** OSM tiles + Nominatim geocoding need CSP allowance on the serving host (tiles
  already needed by AddressMap; add `nominatim.openstreetmap.org`). At scale, move geocoding server-side +
  cache. `AreaMap` degrades to a location banner if blocked — no broken UI.
- **Compliance:** v9 mirrors the registry look — keep the verify framing (we don't re-assert offender status
  as fact). v10 (not in rotation) has placeholder redacted values — must be real-post-pay or generic before
  any live use.
- **Stickiness** is per-session; revisit if cross-session consistency matters.
