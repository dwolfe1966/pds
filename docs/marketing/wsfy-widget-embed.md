# WSFY Embeddable Widget — partner embed guide

The "Who's searching for you?" acquisition widget (roadmap **a.3**). A partner drops it onto their page
as an iframe; a click breaks out of the frame and sends the visitor to our free-tier funnel (`/my-exposure`),
credited to the partner.

## Embed snippet

```html
<iframe
  src="https://www.idlookup.ai/widget/wsfy?partner=homefacts&shn=6a7a2af6d8e615c6c6562e8b"
  title="Who's searching for you? — IDLookup.AI"
  style="width:100%; max-width:460px; height:270px; border:0; overflow:hidden;"
  loading="lazy"
  scrolling="no">
</iframe>
```

## Parameters (on the iframe `src`)

| Param | Purpose |
|---|---|
| `partner` | Attribution source (e.g. `homefacts`). Becomes `utm_source` on the funnel URL. |
| `shn` | Optional BC partner token — forwarded to the funnel so it drives the shape/attribution. |
| `utm_source` | Used as the attribution source if `partner` is absent. |

## How it works

- The widget page is **bare** (no site header/footer — chrome suppressed via `SELF_CHROME_PREFIXES`), so it
  drops cleanly into any layout.
- The CTA is a `target="_top"` link, so the click navigates the **parent tab** (not the iframe) to
  `https://www.idlookup.ai/my-exposure?utm_source=<partner>&utm_medium=widget&utm_campaign=wsfy[&shn=…]`.
  A user click is required, which also satisfies cross-origin top-navigation.
- The funnel it lands on is the free-tier "check your exposure" front door (b.5) — so the widget seeds the
  free-tier funnel, exactly the a.3 → b.5 loop.

## Sizing

Responsive; fills the iframe width up to `max-width:460px`. Recommended iframe: `width:100%; max-width:460px;
height:~270px`. No scrollbars needed at that height.

## Notes

- First-party curiosity hook only — no data claims, no PII collected in the widget itself.
- Route: `src/pages/sales/WsfyWidget.js`, registered at `/widget/wsfy` in `src/App.js`.
- To point the widget at a different funnel later, change `funnelUrl` in `WsfyWidget.js`.
