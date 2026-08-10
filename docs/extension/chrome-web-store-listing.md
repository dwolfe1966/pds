# Chrome Web Store submission — IDLookup Remove (v1.0.0)

Everything below is copy-paste ready for the Web Store dashboard. Target visibility: **UNLISTED**
(link-only early access) — hand the link out, gather feedback, flip to Public later.

**Package to upload:** `docs/extension/idlookup-remove-1.0.0.zip`

---

## Before you start (one-time)
1. Go to https://chrome.google.com/webstore/devconsole and sign in with the account that should own the item.
2. Pay the **$5 one-time** developer registration fee and complete identity verification.
3. (If asked) verify the `idlookup.me` / `idlookup.ai` domains so listed URLs are trusted.

## Upload + fill the listing
1. **New item** → upload `idlookup-remove-1.0.0.zip`.
2. Paste the fields below.
3. **Visibility → Unlisted.**
4. Submit for review. (Expect a longer review — this item uses broad host access + optional history; that's normal.)

---

## Store listing fields

**Item name**
IDLookup Remove — opt-out assistant

**Summary** (max 132 chars)
Autofills data-broker opt-out forms, tracks each removal, and flags privacy risks as you browse.

**Category:** Productivity
**Language:** English (United States)

**Description**
```
IDLookup Remove takes the busywork out of removing yourself from data-broker and people-search sites — and flags privacy risks on the pages you visit.

WHAT IT DOES
• Autofills opt-out forms on data-broker sites with your details, so you don't retype them on every site.
• Guides each removal — tells you the exact verification step (CAPTCHA, email link, phone code) you'll hit.
• Flags the page you're on — "this is a known data broker," "account form — use a unique password."
• Tracks your removals and, for sites you've opted out of, helps you re-check whether your listing is back.
• Optional browsing insights (OFF by default) — see where your data spreads and delete it anytime.

HOW YOUR DATA IS USED
• Your opt-out details are synced from your signed-in IDLookup account and used to fill your own forms.
• Monitoring signals (only for sites you're actively managing) and optional browsing history are sent to
  IDLookup only with your explicit consent, to provide these features — never sold, never used for ads.
• You can turn monitoring off and delete your data at any time.

Requires a free IDLookup account. Full privacy policy: https://idlookup.me/extension-privacy
```

**Privacy policy URL:** https://idlookup.me/extension-privacy
**Homepage / support URL:** https://idlookup.me/extension  ·  support: privacy@idlookup.ai

---

## Single purpose (required)
```
IDLookup Remove helps users remove their personal information from data-broker and people-search
websites: it autofills those sites' opt-out forms with the user's own details, tracks each removal, and
flags privacy risks on the page the user is viewing.
```

## Permission justifications (paste one per permission)

**storage**
```
Stores the user's own opt-out details (synced from their signed-in IDLookup account) and preferences
locally, so opt-out forms can be autofilled without re-typing, and stores the short list of brokers the
user is actively managing so monitoring stays scoped to those sites.
```

**activeTab**
```
Used to act on the current tab only when the user invokes the extension — to fill the opt-out form on the
page they are actively viewing.
```

**scripting**
```
Injects the autofill/assist helper into the active data-broker page to complete the user's own opt-out
form and show page-specific privacy guidance.
```

**Host permissions — https://www.idlookup.ai/* and https://idlookup.me/***
```
Reads the signed-in user's already-claimed identity and opt-out profile from IDLookup's own site to sync
it into the extension (one-way, local) and sends the user's consented monitoring signals to the IDLookup
API. No other sites are contacted by the background service.
```

**Content-script host access (a fixed list of ~30 data-broker + social sites)**
```
The content script runs ONLY on a specified list of known data-broker / people-search sites (Spokeo,
Whitepages, TruePeopleSearch, etc.) plus the major social networks — never on all sites. On a broker site it
recognizes the broker, offers to autofill that site's own opt-out form, and (only for brokers the user has
opted out of) flags if their listing has re-appeared; on a social site it offers a public-visibility tip.
The full list is enumerated in the manifest's content_scripts matches.
```

**history (optional — requested at runtime, not on install)**
```
Only after the user explicitly opts in from the extension: builds privacy insights across the sites they
visit (which are known data brokers or had known breaches) and syncs raw history to their IDLookup account
so it can be reviewed and DELETED at any time. Off by default; the extension never requests it on install.
```

---

## Privacy practices tab / data disclosures

**What user data do you collect?** (check these)
- Personally identifiable information — name, address, email, phone (the user's own, to fill their forms)
- Web history — ONLY if the user turns on optional monitoring
- User activity — the opt-out actions the user takes (to track removals)

**How is it used / handled?** (paste)
```
Collected data is used solely to provide the extension's single purpose: autofilling the user's own
opt-out forms, tracking their removals, and (with explicit consent) monitoring where their information
appears. Data is synced from and to the user's own IDLookup account. It is not sold, not used for
advertising, and not shared beyond providing these features. Users can disable monitoring and delete
their data at any time.
```

**Certifications** (all three should be TRUE / checkable):
- ☑ I do not sell or transfer user data to third parties, apart from the approved use cases.
- ☑ I do not use or transfer user data for purposes unrelated to the item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Graphics still needed (add in the dashboard)
- **Screenshots:** at least 1 (1280×800 or 640×400). Suggested: (1) the assist panel on a broker page,
  (2) the "Your Digital Footprint" view, (3) the popup with the history toggle off.
- **Store icon:** 128×128 (already in the package).
- *(Optional)* Small promo tile 440×280.

## After it's approved
- Update `seo/app/extension/page.js` — replace "Coming to the Chrome Web Store" with the real (unlisted)
  store link, and point the opt-out guide's `EXT_INSTALL_URL` there if you want deep-linking.

## Notes
- The `appKey` shipped in `config.js` is the public, gate-only app key (same one the web app ships) — safe
  to include; it is not a secret.
- Edge Add-ons accepts the same zip if you want a second channel later. Firefox is a separate port.
