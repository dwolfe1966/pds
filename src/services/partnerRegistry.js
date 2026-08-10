// Partner registry — the primitive that turns the HomeFacts one-off into a repeatable partner CHANNEL.
// A partner links traffic to a landing (with a `shn` token + the person pre-filled); we co-brand the funnel
// and attribute the traffic. Adding a partner = an entry here + a landing cfg whose `partnerBrand` = the key.
//
// The funnel persists the partner key (sessionStorage `idlPartnerBrand`, set from the landing cfg), and the
// results page reads it here to co-brand its header + ribbon. Brand colors are the PARTNER's accent (used on
// the ribbon), not our green.
export const PARTNERS = {
  homefacts: {
    key: 'homefacts',
    name: 'HomeFacts',
    icon: '🏠',
    color: '#1f3a5f', colorSoft: '#eef2f7', colorLine: '#dbe4ef', // navy accent
    ribbon: 'Continuing your search from HomeFacts',                 // short (always shown)
    ribbonDetail: ' — full people & neighborhood-safety records, powered by IDLookup.AI', // desktop tail
  },
};

/** Resolve a partner config by key, or null. */
export function getPartner(key) {
  return (key && PARTNERS[key]) || null;
}

/** Map a free-text attribution string (shn name / partner) to a partner key, or null. */
export function partnerKeyFromAttribution(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  for (const p of Object.values(PARTNERS)) {
    if (t.includes(p.key) || t.includes(p.name.toLowerCase())) return p.key;
  }
  return null;
}
