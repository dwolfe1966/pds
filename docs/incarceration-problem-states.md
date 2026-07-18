# Incarceration — Problem States Tracker

States whose DOC locator does NOT work from Vercel yet. Each self-gates (the adapter returns `[]` / isn't
wired), so nothing fake ever ships — this is the backlog of fixes, not broken production. Updated 2026-07-18.

Fix categories:
- **captcha** → needs a vision/solver service (image number/shape) or reCAPTCHA bypass. Hardest.
- **browser-tier** → needs Browserless (real browser) ± residential proxy (WAF/JS challenge).
- **proxy** → works from a residential IP; blocked from Vercel's datacenter IP. Needs `STATE_PROXY_URL` or browser tier.
- **tls** → server ships an incomplete cert chain; Node/undici rejects. Needs a scoped CA-bundle fix.
- **session** → server-side session + load-balancer affinity; flaky over serverless.

| State | Issue | Category | Fix needed | Notes |
|---|---|---|---|---|
| **NY** | F5 BIG-IP WAF; drops even Browserless+residential (ERR_EMPTY_RESPONSE) | browser-tier | route Browserless through Decodo residential, or an F5-specific unblocker | JSON API clean behind the WAF; hardest |
| **AZ** | Cloudflare managed-challenge + ASP.NET WebForms | browser-tier | Browserless + CF clearance + WebForms flow (VIEWSTATE) + gender-split | needs first-initial too |
| **CT** | WAF blocks curl | browser-tier | Browserless; re-recon exact endpoint | mugshots absent anyway |
| **KY** | endpoint returns 0 from Vercel datacenter IP (works residential) | proxy | STATE_PROXY_URL residential, or browser tier | KY DOC (KOOL); plain-URL mugshots; adapter is correct |
| **MI** | F5 session affinity splits socket on Vercel → 0 | session / proxy | browser tier (keeps affinity) or pinned residential session | OTIS; pinned undici Agent insufficient on serverless |
| **MN** | incomplete TLS chain (UNABLE_TO_VERIFY_LEAF_SIGNATURE) | tls | ship the missing intermediate cert / NODE_EXTRA_CA_CERTS; scoped rejectUnauthorized didn't clear on Vercel | adapter + request shape correct; works via curl |
| **MO** | numeric-image captcha (session-based) | captcha | vision solver | mugshots; flow/parser preserved |
| **CO** | shape-count captcha | captcha | vision solver | mugshots |
| **KS** | captcha (KASPER) | captcha | vision solver | mugshots |
| **NM** | reCAPTCHA **Enterprise** | captcha | hardest — enterprise reCAPTCHA | mugshots |
| **WV** | captcha | captcha | vision solver | mugshots |
| **OK** | captcha | captcha | vision solver | mugshots |

## Fix waves (when we come back to these)
1. **proxy wave** — KY, MI: point them at a residential proxy egress (or the browser tier). Cheapest unlock.
2. **tls wave** — MN: one-off cert-chain fix.
3. **browser wave** — NY, AZ, CT (+ MI fallback): the Browserless+residential path, hardened for F5/CF.
4. **captcha wave** — MO, CO, KS, NM, WV, OK: integrate a captcha-solver (image), NM last (reCAPTCHA Enterprise). These 6 all have mugshots, so worth it once a solver exists.

## Also note (not "problem" but caveats on LIVE states)
- **LA** (live) — VINE guest session: `inmateId` is an obscured, unstable `contextRefId` (bad for dedup); mugshot URLs are signed + expire. Don't rely on LA rows persisting cleanly in the `inmates` table.
- **AR** (pending integration) — has an official paid bulk download via INA (~$0.10/record) if we want the full roster without scraping.
