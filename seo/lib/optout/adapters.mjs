// Per-broker opt-out adapters — "build the head" (docs/product/build-the-head-optout.md).
// method: 'manual' (give the URL, user submits) | 'email' (authorized-agent request to a privacy inbox)
//         | 'form_post' (direct POST) | 'browser' (Playwright worker — phase 2).
// Only NON-default adapters live here; getAdapter() falls back to 'manual' using the registry opt-out URL,
// so every catalog source is at least assisted, and we upgrade brokers to automation one adapter at a time.

export const ADAPTERS = {
  // ── Examples (disabled until verified per broker) ──
  // A broker whose opt-out is a simple non-JS POST:
  //   radaris: { method: 'form_post', url: 'https://…', build: (id) => ({ name: id.name, state: id.state }) },
  // A broker that accepts a CCPA authorized-agent request by email (verify the address + that they accept email):
  //   acxiom:  { method: 'email', to: 'privacy@acxiom.com', brokerName: 'Acxiom' },
  // A JS/CAPTCHA form (needs the phase-2 Playwright worker):
  //   spokeo:  { method: 'browser', url: 'https://www.spokeo.com/optout' },
};

/** Resolve the adapter for a source; default to manual (link-out) using the registry opt-out URL. */
export function getAdapter(sourceKey, registryRow) {
  const a = ADAPTERS[sourceKey];
  if (a) return { sourceKey, ...a };
  return { sourceKey, method: 'manual', url: (registryRow && registryRow.opt_out_url) || null };
}

/** The authorized-agent request text (email body / PDF) for a broker, built from the user's identity. */
export function buildOptOutRequest(identity = {}, brokerName) {
  const name = [identity.firstName, identity.middleName, identity.lastName].filter(Boolean).join(' ') || identity.name || '';
  const loc = [identity.city, identity.state].filter(Boolean).join(', ');
  return [
    `To ${brokerName || 'Privacy Team'}:`,
    '',
    'I am submitting this request as the authorized agent of the individual named below, who requests that you '
      + '(1) delete their personal information and (2) opt them out of any sale or sharing of it, under the '
      + 'CCPA/CPRA and applicable U.S. state privacy laws.',
    '',
    `Name: ${name}`,
    loc ? `Location: ${loc}` : null,
    identity.age ? `Approx. age: ${identity.age}` : null,
    '',
    'Please confirm completion. Signed authorization is available on request.',
  ].filter((l) => l !== null).join('\n');
}
