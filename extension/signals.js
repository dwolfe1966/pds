// Per-page identity SIGNALS — classify the current site + page into HONEST, catalog-backed insight. We only
// say what we actually know (this host is a known broker / social / the page has an account form), never
// "your data is on this page" (that would be the detection we don't have without a scan). Local-only.
window.IDL_SOCIAL = {
  'linkedin.com': 'LinkedIn', 'facebook.com': 'Facebook', 'instagram.com': 'Instagram',
  'twitter.com': 'X / Twitter', 'x.com': 'X / Twitter', 'tiktok.com': 'TikTok', 'reddit.com': 'Reddit',
};

// Classify a host → { kind, name }. Brokers come from the shared recipes catalog; socials from above.
window.IDL_classify = function classify(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  const broker = (window.IDL_matchRecipe && window.IDL_matchRecipe(h)) || null;
  if (broker) return { kind: 'broker', name: broker.name, verification: broker.verification, key: broker.key };
  for (const k of Object.keys(window.IDL_SOCIAL)) if (h.indexOf(k) !== -1) return { kind: 'social', name: window.IDL_SOCIAL[k] };
  return { kind: 'other', name: h };
};

// Build the insight for the current page from its classification + the injected page analysis
// (hasPassword / hasEmailField / formCount). Returns { tone, title, body, action? }.
window.IDL_pageInsight = function pageInsight(cls, page) {
  if (cls.kind === 'broker') {
    return {
      tone: 'warn',
      title: `${cls.name} is a known data broker`,
      body: `Your info may be listed here. ${cls.verification ? 'Removal: ' + cls.verification + '.' : ''} Open the opt-out and IDLookup will autofill your details.`,
      action: 'broker',
    };
  }
  if (cls.kind === 'social') {
    return {
      tone: 'info',
      title: `${cls.name} profile`,
      body: 'Review who can see your profile and what’s public — data here often feeds people-search sites. Lock down public visibility.',
    };
  }
  if (page && page.hasPassword) {
    return {
      tone: 'warn',
      title: 'Account form on this page',
      body: 'You’re about to share credentials here. Use a UNIQUE password (reuse is the top cause of account takeover) and a masked/alias email to limit where your address spreads.',
    };
  }
  if (page && page.hasEmailField) {
    return {
      tone: 'info',
      title: 'This page asks for your email',
      body: 'Consider a masked/alias email so this address can’t be linked across sites or sold on.',
    };
  }
  return { tone: 'muted', title: 'No specific identity flags here', body: 'IDLookup didn’t detect a known broker, social profile, or account form on this page.' };
};
