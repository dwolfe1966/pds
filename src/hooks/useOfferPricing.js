import { useEffect, useState } from 'react';
import api from '../api';

/**
 * BC-driven offer pricing. Resolves an offer's real prices from BC via
 * `findByShmName` (transient.priceInfo: s0 = trial, s1 = recurring) so a
 * partner's offer displays its actual price with no manual sync.
 *
 * Returns `{ trialPrice, recurringPrice, recurringPeriod }` once loaded, or
 * `null` while loading / on error / when no `shmName` is given — callers fall
 * back to brand defaults. The DEFAULT signup offer intentionally keeps the
 * brand marketing display (TRX-approved override), so PaymentPage only calls
 * this when a partner offer (`campaign.offer.shmName`) is configured.
 *
 * @param {string|null|undefined} shmName  comp.* offer name (per-partner)
 */
export function useOfferPricing(shmName) {
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    if (!shmName) { setPricing(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const offer = await api.findOfferByShmName({ shmName });
        const pi = offer?.transient?.priceInfo;
        if (cancelled || !pi) return;
        const next = {
          trialPrice: typeof pi.s0?.amount === 'number' ? pi.s0.amount : undefined,
          recurringPrice: typeof pi.s1?.amount === 'number' ? pi.s1.amount : undefined,
          recurringPeriod: pi.s1Period?.period,
        };
        if (next.trialPrice != null || next.recurringPrice != null) setPricing(next);
      } catch {
        /* non-fatal — caller falls back to brand defaults */
      }
    })();
    return () => { cancelled = true; };
  }, [shmName]);

  return pricing;
}

export default useOfferPricing;
