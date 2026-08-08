// Per-broker opt-out adapters — "build the head" (docs/product/build-the-head-optout.md).
// method: 'manual' (give the URL, user submits) | 'email' (authorized-agent request to a privacy inbox)
//         | 'form_post' (direct POST) | 'browser' (Playwright worker — phase 2).
// Only NON-default adapters live here; getAdapter() falls back to 'manual' using the registry opt-out URL,
// so every catalog source is at least assisted, and we upgrade brokers to automation one adapter at a time.

export const ADAPTERS = {
  // Explicit overrides go here (e.g. a form_post recipe, or a browser adapter for the phase-2 worker).
  // Email targets are in EMAIL_TARGETS below; everything else derives from the registry removal_method.
};

// Brokers that accept a CCPA authorized-agent removal request BY EMAIL (verified privacy inboxes — see
// docs/product/broker-optout-automation-matrix.md). These are the phase-2 agent-executed tier: we send the
// request on the member's behalf (reply-to = the member) once the email sender is enabled.
export const EMAIL_TARGETS = {
  apollo:    { to: 'privacy@apollo.io',        brokerName: 'Apollo.io' },
  lusha:     { to: 'privacy@lusha.com',        brokerName: 'Lusha' },
  cognism:   { to: 'privacy@cognism.com',      brokerName: 'Cognism' },
  dataaxle:  { to: 'privacyteam@data-axle.com', brokerName: 'Data Axle' },
  atdata:    { to: 'privacy@atdata.com',       brokerName: 'AtData' },
  hiya:      { to: 'DPO@hiya.com',             brokerName: 'Hiya' },
  checkr:    { to: 'hello@checkr.com',         brokerName: 'Checkr' },
  goodhire:  { to: 'privacy@goodhire.com',     brokerName: 'GoodHire' },
};

/** Resolve the adapter for a source. Precedence: explicit ADAPTERS override → EMAIL_TARGETS (email tier)
 *  → the registry's removal_method (email/browser/form_post/manual) with the opt-out URL → manual. */
export function getAdapter(sourceKey, registryRow) {
  const a = ADAPTERS[sourceKey];
  if (a) return { sourceKey, ...a };
  const url = (registryRow && registryRow.opt_out_url) || null;
  const et = EMAIL_TARGETS[sourceKey];
  if (et) return { sourceKey, method: 'email', url, ...et };
  const method = (registryRow && registryRow.removal_method) || 'manual';
  // Only 'email' can be agent-sent; browser/form_post/manual all resolve to a member-driven action here
  // (the guided experience prepares those). Keep them 'manual' at the engine until their adapter exists.
  return { sourceKey, method: method === 'email' ? 'email' : 'manual', url };
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
    identity.email ? `Email: ${identity.email}` : null,
    loc ? `Location: ${loc}` : null,
    identity.address ? `Current address: ${identity.address}` : null,
    identity.prevAddress ? `Previous addresses: ${identity.prevAddress}` : null,
    identity.dob ? `Date of birth: ${identity.dob}` : (identity.age ? `Approx. age: ${identity.age}` : null),
    '',
    'Please confirm completion to the reply-to address. Signed authorization is available on request.',
  ].filter((l) => l !== null).join('\n');
}
