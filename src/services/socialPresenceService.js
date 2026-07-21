/**
 * Social-presence lookup — client half. Calls our /api/social-presence on the idlookup.me Vercel server
 * (keys stay server-side), independent of BC. ENRICH a resolved person → their public social profiles.
 * Best-effort: any failure returns empty so the funnel never breaks (self-gating — renders nothing when
 * there's no match, which is common for name+state keys — PDL declines ambiguous/common names).
 *
 * ⚠️ EXPERIMENTAL — PDL's terms bar production people-search DISPLAY; gated behind REACT_APP_SIGNALS_SOCIAL
 * in personSignals. Gravatar-sourced data is display-safe. See seo/lib/socialPresence.mjs for the flags.
 */
function endpointUrl() {
  if (process.env.REACT_APP_SOCIAL_PRESENCE_URL) return process.env.REACT_APP_SOCIAL_PRESENCE_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/social-presence');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/social-presence`;
}

/** @returns {Promise<{matched,name,photoUrl,matchKey,matchLikelihood,profiles:Array,count:number}>} */
export async function fetchSocialPresence({ firstName, lastName, state, city, email } = {}) {
  if (!lastName && !firstName && !email) return { matched: false, profiles: [], count: 0 };
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email || undefined, name: name || undefined, city, state, expectedName: name || undefined }),
    });
    if (!res.ok) return { matched: false, profiles: [], count: 0 };
    const d = await res.json();
    const profiles = Array.isArray(d.profiles) ? d.profiles : [];
    return {
      matched: !!d.matched, name: d.name || null, photoUrl: d.photoUrl || null,
      matchKey: d.matchKey || null, matchLikelihood: d.matchLikelihood ?? null,
      profiles, count: profiles.length,
    };
  } catch { return { matched: false, profiles: [], count: 0 }; }
}
