// Thin-match state bridging between BC teaser response and billing sale.
//
// BC's searchTeaser and commerceBilling.sale both accept a `sequenceOption`
// block with thinMatch flags. When a search returns zero or sparse results,
// BC surfaces the reason via this block so the UI can react and the billing
// flow can later persist the correct flag on the order.

const KEY = 'thinMatchState';

const EMPTY_FLAGS = {
  thinMatch: false,
  thinMatchDataProviderDown: false,
  thinMatchTooManyResults: false,
  thinMatchNoResults: false,
  thinMatchGeographic: false,
};

/**
 * Derive thin-match flags from a BC teaser response (identities + sequenceOption).
 * Falls back to computing `thinMatchNoResults` from the identities array when
 * BC hasn't populated sequenceOption. Returns a plain flag object.
 */
export function deriveThinMatchFlags(rawResponse, { identityCount } = {}) {
  const fromApi =
    rawResponse?.raws?.[0]?.transient?.sequenceOption ||
    rawResponse?.sequenceOption ||
    rawResponse?.raws?.[0]?.sequenceOption ||
    null;
  const count = typeof identityCount === 'number'
    ? identityCount
    : (rawResponse?.raws?.[0]?.transient?.identities?.length ?? 0);
  const failedCode = rawResponse?.failedCode || rawResponse?.getFailedCode?.();
  const noResults = count === 0;
  const tooMany = failedCode === 'TooManyMatches';
  const flags = {
    ...EMPTY_FLAGS,
    ...(fromApi || {}),
  };
  if (!fromApi) {
    if (noResults) {
      flags.thinMatch = true;
      flags.thinMatchNoResults = true;
    }
    if (tooMany) {
      flags.thinMatch = true;
      flags.thinMatchTooManyResults = true;
    }
  }
  return flags;
}

export function persistThinMatch(flags) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flags || EMPTY_FLAGS));
  } catch {}
}

export function readThinMatch() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_FLAGS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_FLAGS, ...parsed };
  } catch {
    return { ...EMPTY_FLAGS };
  }
}

export function clearThinMatch() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

/** True if any thin-match condition is set (UI should show preview + signup). */
export function isThinMatch(flags) {
  if (!flags) return false;
  return Boolean(
    flags.thinMatch ||
    flags.thinMatchNoResults ||
    flags.thinMatchGeographic ||
    flags.thinMatchTooManyResults ||
    flags.thinMatchDataProviderDown
  );
}

/** Human-readable variant label — useful for UX copy decisions. */
export function thinMatchVariant(flags) {
  if (!flags) return null;
  if (flags.thinMatchDataProviderDown) return 'providerDown';
  if (flags.thinMatchTooManyResults) return 'tooMany';
  if (flags.thinMatchGeographic) return 'geographic';
  if (flags.thinMatchNoResults) return 'noResults';
  if (flags.thinMatch) return 'thinMatch';
  return null;
}
