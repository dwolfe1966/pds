// Host config for the SEO surface.
//
// SITE = this app's OWN public domain — used for canonical, sitemap, JSON-LD, and
// internal links. Prototype: idlookup.me (dedicated domain, whole domain → Vercel,
// no path-split needed). Production target: idlookup.ai/people/* via the Cloudflare
// path-split — a clean 1:1 path swap when DNS control lands (see DEPLOY.md).
//
// MAIN = the main product app (signup/checkout funnel + legal pages) — always on
// idlookup.ai regardless of where the SEO surface lives. The "Unlock"/"Search" CTAs
// and Remove-my-info / Privacy links point here (cross-domain from idlookup.me).
export const SITE = 'https://idlookup.me';
export const MAIN = 'https://www.idlookup.ai';
