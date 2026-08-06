# Broker opt-out automation-feasibility matrix (2026-08-06)

Per-vendor research into whether we can **auto-manage a user's visibility** across data-provider
categories — via (a) an official removal **API**, (b) a **browser emulator** (headless Playwright), (c) an
**email/webform** CCPA request, or (d) **manual** only. Feeds the build-the-head opt-out engine's per-source
`removal_method` and the honest per-source `nature` label. ~50 vendors, verified via web research; low/medium
confidence flagged. **This is the map for what removal automation is actually achievable — and what we must
NOT market as "removal."**

## Executive summary — three hard truths

1. **No public removal APIs. Anywhere.** Not one of ~50 vendors exposes a programmatic opt-out endpoint. The
   automation ceiling is a headless browser or an emailed request — never a clean API integration.
2. **Browser automation is "hard" almost everywhere.** The near-universal blocker is an **out-of-band email
   (or phone) verification link** you must click to complete the opt-out — so any unattended pipeline needs a
   **monitored inbox / IMAP poller**. Stacked on top: CAPTCHA/reCAPTCHA, Cloudflare anti-bot (pages 403 our
   fetches — which is itself the evidence), and a mandatory "find your own listing first" search step.
3. **Most categories are NOT truly removable — labeling matters.** Credit bureaus, FCRA background-check CRAs,
   AI chatbots, search engines, and public-record-backed property/genealogy are *suppression*, *file-access*,
   *account-deletion*, *search-delist*, or *no-opt-out* — NOT record removal. Marketing them as "removed"
   would over-promise. Each source carries an honest `nature` label (below).

## The automation strategy this implies (build-the-head engine)

- **Tier 1 — email-request automation (most scalable, build first):** the entire **B2B tier** and several
  brokers accept an emailed CCPA request to a published privacy address. A reliable email path + a **monitored
  reply mailbox that can click confirmation links** covers them with **no CAPTCHA/anti-bot to defeat**. This is
  the highest-ROI automation and reuses our SendGrid infra. Targets: Apollo, Lusha, Data Axle, Cognism, AtData,
  MyLife, Checkr, Realtor.com, PropertyShark (+ any people-search that accepts email).
- **Tier 2 — browser worker with inbox integration (harder, higher volume):** the people-search tier is
  browser-only and needs Playwright + an IMAP poller to click the verification link + a CAPTCHA-solving
  strategy. **Start with the genuinely automatable ones:** **That'sThem** and **SafeGraph** (single form, no
  CAPTCHA, email-click only). **Consolidation win:** Intelius + TruthFinder + Instant Checkmate + US Search all
  funnel into the **PeopleConnect Suppression Center** — one submission covers four big names.
- **Tier 3 — assisted-manual (don't auto-promise):** Whitepages (phone-call code), face-search (selfie/ID
  upload), credit bureaus, FCRA CRAs, AI chatbots, Google/Bing delist, genealogy account-deletion. Give the
  user a guided link + prefilled details; a human (them) completes it. **Never show these as auto-removed.**

## Nature legend (the honesty label)
`true_removal` = record actually deleted · `suppression` = hidden/opted-out but data retained/re-listable ·
`file_access_only` = FCRA disclosure/dispute, no removal · `account_deletion` = only by deleting your own
account · `search_delist` = removed from search results, not the source · `no_optout` = no per-person removal.

---

## People-search brokers (21) — browser tier, CAPTCHA + email-verify

| Vendor | Opt-out URL | API | Browser | Method | Nature | Re-list | Conf |
|---|---|---|---|---|---|---|---|
| Spokeo | spokeo.com/optout | no | hard (reCAPTCHA+email) | browser | suppression | 90d | high |
| BeenVerified | beenverified.com/app/optout/search | no | hard (CAPTCHA+email) | browser | suppression | — | high |
| PeopleFinders | peoplefinders.com/opt-out | no | hard (CAPTCHA+email) | browser | suppression | — | med |
| Whitepages | whitepages.com/suppression-requests | no | **no (phone-call code)** | manual | suppression | 30d | high |
| Intelius | suppression.peopleconnect.us/login | no | hard (email+DOB) | browser | suppression | — | high |
| Radaris | radaris.com/control/privacy | no | hard (find-listing+email) | browser | suppression | — | med |
| MyLife | *(no deep-link)* membersupport@mylife.com | no | hard (email code) | email | suppression | — | med |
| TruePeopleSearch | truepeoplesearch.com/removal | no | hard (CAPTCHA+email) | browser | suppression | — | high |
| FastPeopleSearch | fastpeoplesearch.com/removal | no | hard (~6 CAPTCHAs+email) | browser | suppression | — | high |
| Instant Checkmate | instantcheckmate.com/opt-out/ | no | hard (PeopleConnect) | browser | suppression | — | high |
| TruthFinder | truthfinder.com/opt-out/ | no | hard (email/SMS code) | browser | suppression | — | high |
| PeekYou | peekyou.com/about/contact/optout/ | no | hard (CAPTCHA+email) | browser | suppression | — | med |
| US Search | ussearch.com/opt-out/ | no | hard (PeopleConnect) | browser | suppression | — | high |
| Nuwber | nuwber.com/removal/link | no | hard (profile-url+email) | browser | suppression | — | med |
| CheckPeople | checkpeople.com/opt-out | no | hard (email link) | browser | suppression | — | high |
| **That'sThem** ⭐ | thatsthem.com/optout | no | **yes (no CAPTCHA, email-click)** | browser | suppression | — | high |
| **ClustrMaps** | clustrmaps.com/bl/opt-out | no | hard (find-listing+email) | browser | suppression | — | high |
| **SearchPeopleFree** | searchpeoplefree.com/opt-out | no | hard (CAPTCHA+email) | browser | suppression | — | high |
| **Advanced Background Checks** | advancedbackgroundchecks.com/removal | no | hard (CAPTCHA+email) | browser | suppression | — | high |
| **Cyber Background Checks** | cyberbackgroundchecks.com/removal | no | hard (2× CAPTCHA+email) | browser | suppression | — | high |
| **USPhoneBook** | usphonebook.com/opt-out | no | hard (CAPTCHA+email) | browser | suppression | — | high |

*PeopleConnect cluster (Intelius/TruthFinder/Instant Checkmate/US Search) → one suppression.peopleconnect.us
submission. Cyber/Advanced/SearchPeopleFree/USPhoneBook share one anti-bot form pattern.*

## Marketing & B2B data brokers (14) — email tier is the win

| Vendor | Opt-out URL / email | API | Browser | Method | Nature | Conf |
|---|---|---|---|---|---|---|
| LexisNexis (consumer) | consumer.risk.lexisnexis.com/optrequest | no | hard (full PII) | form_post | suppression | high |
| Acxiom | acxiom.com/optout/ | no | hard (email-confirm) | form_post | suppression | high |
| Oracle Data Cloud | **defunct — drop / general privacy** | no | no | manual | no_optout | high |
| Epsilon | legal.epsilon.com/dsr/ | no | hard (form+email) | form_post | suppression | med |
| ZoomInfo | privacy.zoominfo.com | no | hard (email 4-digit code) | browser | suppression | high |
| Apollo.io | apollo.io/privacy-policy/remove · privacy@apollo.io | no | hard | email | suppression | high |
| RocketReach | rocketreach.co/claim-profile | no | hard (email verify) | browser | suppression | med |
| Lusha | lusha.com/privacy-center/request-removal · privacy@lusha.com | no | hard | email | suppression | med |
| Clearbit (HubSpot) | preferences.clearbit.com/privacy | no | hard (identity verify) | browser | suppression | high |
| **Data Axle** | data-axle.com/do-not-sell-my-data · privacyteam@data-axle.com | no | hard (Cloudflare) | email | suppression | high |
| **Experian Mktg Services** | experianmarketingservices.digital/OptOut | no | hard | form_post | suppression | high |
| **Seamless.AI** | login.seamless.ai/personalDataRequest | no | hard (anti-bot) | browser | suppression | high |
| **Cognism** | cognism.com/data-opt-out · privacy@cognism.com | no | hard (SayMine+email) | email | suppression | high |
| **AtData (ex-TowerData)** | atdata.com/ccpa-form · privacy@atdata.com | no | hard (CAPTCHA) | email | suppression | med |

## Background-check / credit / property / genealogy (14) — mostly NOT removable

| Vendor | Opt-out URL | Method | Nature | Note | Conf |
|---|---|---|---|---|---|
| GoodHire | *(privacy@goodhire.com)* | manual | file_access_only | FCRA CRA — no consumer opt-out | med |
| Checkr | help.checkr.com (delete PII) · hello@checkr.com | email | file_access_only | FCRA CRA | high |
| HireRight | hireright.com/legal/do-not-sell-my-personal-information | form_post | file_access_only | FCRA CRA | high |
| PeopleLooker | peoplelooker.com/f/optout/search | browser | suppression | real broker (CAPTCHA+email) | med |
| Experian | consumerprivacy.experian.com/request | form_post | suppression | credit file NOT deletable | high |
| Equifax | myprivacy.equifax.com/opt-in-opt-out/personal-info | form_post | suppression | credit file NOT deletable | high |
| TransUnion | transunion.com/consumer-privacy | form_post | suppression | credit file NOT deletable | high |
| **OptOutPrescreen** (shared) | optoutprescreen.com | form_post | suppression | prescreen offers only; 5-yr (relist ~1825d) | high |
| Zillow | zillow.zendesk.com (remove home) | manual | suppression | public record; claim home to hide photos | high |
| Realtor.com | *(privacy team; "Data Deletion Request")* | email | suppression | public record; no dedicated URL | low |
| PropertyShark | propertyshark.com/mason/Help/Privacy | email | suppression | scraped county data, re-appears | med |
| Ancestry | ancestry.com/c/privacy-center | manual | account_deletion | own account only | high |
| MyHeritage | myheritage.com/privacy-policy | manual | account_deletion | own account only | high |
| FamilySearch | familysearch.org (living-person privacy form) | form_post | suppression | proof of relationship req'd | high |

## Location / AI / face-search / search engines (13)

| Vendor | Opt-out URL | Method | Nature | Note | Conf |
|---|---|---|---|---|---|
| SafeGraph ⭐ | safegraph.com/do-not-sell-my-info | browser | suppression | **bare email form, no CAPTCHA — automatable** | high |
| Cuebiq | cuebiq.com/privacy-request | browser | true_removal | needs device ad-ID (IDFA/GAID) | high |
| Foursquare | foursquare.com/legal/privacy-center | browser | true_removal | Jira portal, DOB+FSQ id | high |
| **DAA (WebChoices)** | optout.aboutads.info | browser | suppression | cookie opt-out, per-device | high |
| **NAI** | optout.networkadvertising.org | browser | suppression | cookie opt-out, per-device | high |
| ChatGPT/OpenAI | privacy.openai.com | manual | suppression | no true removal; ID may be req'd | high |
| Google Gemini | myactivity.google.com/product/gemini | manual | suppression | training toggle; likeness form = selfie | high |
| Perplexity | perplexity.ai (self-serve data deletion) | manual | suppression | login/email verify | med |
| PimEyes | pimeyes.com/en/opt-out-request-form | form_post | true_removal | **face photo + gov ID upload** | high |
| Clearview AI | clearview.ai/privacy-and-requests | form_post | true_removal | face photo + state residency | med |
| **FaceCheck.ID** | facecheck.id/en/RemoveMyPhotos | form_post | true_removal | live selfie OR gov ID | high |
| Google (Results about you) | myactivity.google.com/results-about-you | google_rar | search_delist | manual review | high |
| Bing | microsoft.com/en-us/concern/bing | manual | search_delist | manual review | high |

## Confidence caveats to re-verify before shipping user-facing links
- **Medium/low URLs** (vendor pages 403 our fetch — the anti-bot evidence itself): PeopleFinders, PeekYou,
  Nuwber, Radaris, Lusha, RocketReach, AtData ccpa-form, Realtor.com (null — no dedicated URL), PropertyShark,
  PeopleLooker (URL is `/f/optout/search`, differs from the old `/opt-out/`), Perplexity form.
- **Oracle Data Cloud opt-out is dead** (301 → EOL page) — drop it or route to Oracle general privacy.
- **`relistDays` is unknown for almost all** — vendors claim permanent suppression; treat re-listing as an
  empirical monitor-and-measure unknown (this is why a re-scan loop matters).
</content>
