# BC ask — Brand-style the hosted opt-out form for `idlookup`

**Raised:** 2026-05-30
**Bug ref:** (no CSV row — surfaced during launch QA after wiring `REACT_APP_USE_NEW_API_OPTOUT=true`)
**Environment:** `https://dev.www.idlookup.ai/`
**Surface:** the page BC serves at `/api/optOut/view/search?clientId=…&apiId=…` (reached via `ApiWrapper.goPage('optOut', { newPage: true })` from our `OptOutLandingPage`).

## Copy-paste summary

> We just enabled the BC-hosted opt-out flow in prod. From our `/opt-out`
> page a user clicks "Open Opt-Out Portal" → new tab → your hosted form.
> Functionally it works. **Visually it doesn't match the IDLookup brand**
> — users see a sharp stylistic break from the idlookup.ai shell into a
> page that looks unbranded.
>
> Could the `idlookup` brand instance of `/api/optOut/view/search` be
> templated to match these brand tokens?
>
> ```
> Primary color       #0d5d2f   (deep green — buttons, headings, links)
> Accent color        #0d5d2f
> Background          #ffffff   (white surface)
> Body text           #374151   (gray-700)
> Muted text          #6b7280   (gray-500)
> Success surface     #f0fdf4 / #bbf7d0 (panel bg / border)
> Border              #e5e7eb   (gray-200)
> Border radius       0.5rem    (form fields, buttons, panels)
> Heading font        system-ui sans-serif, 700 weight
> Body font           system-ui sans-serif, 400 weight, 1.6 line-height
> ```
>
> Logo asset: same `idlookup_icon_transparent.png` we serve on the
> consumer app (we can supply an SVG version if you'd prefer).
>
> If multi-brand templating is heavier than we'd want for v1, even just
> swapping the primary button color + header lockup would close most of
> the visual gap.

## Why we can't do this client-side

- The form is served from BC's host; we can't inject CSS into your
  template from our SPA.
- Wrapping the form in an iframe on our `/opt-out` page would let us
  frame it visually but loses the user's URL context, breaks the
  confirmation deep-link `awqh[type]=confirmationRequestOptOut&…`, and
  introduces a Same-Origin/CSP boundary we don't want for a launch fix.

## Launch posture if BC can't ship in time

Acceptable launch gap — the flow works, just looks off-brand. Our
`OptOutLandingPage` already sets context with "you'll be handed off to
our secure opt-out portal" copy, so the brand jump is at least
forewarned. Revisit post-launch if it surfaces in support tickets.
