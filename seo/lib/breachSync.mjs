// Breach sync + diff — the shared core for BOTH the on-demand check (member opens My Identity) and the
// weekly cron. Fetches the member's exposure (cache-first), diffs against the last-known set to find NEW
// breaches, writes identity_events for material findings (idempotent via dedup keys), and updates the
// monitor state. Auto-enrolls on first sync (enabled=true) so the cron picks the member up.
import { getEmailExposure } from './emailExposure.mjs';
import { getMonitorState, upsertMonitorState } from './breachMonitorDb.mjs';
import { addIdentityEvent } from './identityEventsDb.mjs';

const fmtClasses = (classes) => (Array.isArray(classes) && classes.length ? `Exposed: ${classes.slice(0, 4).join(', ')}` : undefined);

/**
 * @param {{email:string, forceRefresh?:boolean, nowIso?:string}} p
 *   forceRefresh — the cron passes true to bypass the cache-reuse TTL and catch NEW breaches.
 * @returns {Promise<{available:boolean, exposure:object, newBreaches:string[], firstScan:boolean, lastChecked:string|null}>}
 */
export async function syncBreachExposure({ email, forceRefresh = false, nowIso = null } = {}) {
  const exposure = await getEmailExposure({ email, forceRefresh });
  if (!exposure || !exposure.available) {
    return { available: false, exposure: exposure || null, newBreaches: [], firstScan: false, lastChecked: null };
  }
  const prev = await getMonitorState(email);
  const firstScan = !prev;
  const prevNames = new Set((prev && prev.lastNames) || []);
  const curNames = (exposure.breaches || []).map((b) => b.name).filter(Boolean);
  const newBreaches = curNames.filter((n) => !prevNames.has(n));

  if (firstScan && exposure.breached) {
    // First time we ever scan this member and they're already breached → one summary event.
    await addIdentityEvent(email, {
      type: 'breach_found',
      title: `Your email was found in ${exposure.count} data breach${exposure.count === 1 ? '' : 'es'}`,
      detail: fmtClasses(exposure.topDataClasses),
      data: { count: exposure.count, classes: exposure.topDataClasses, mostRecent: exposure.mostRecent },
      dedupKey: 'breach-initial',
      nowIso,
    });
  } else if (!firstScan) {
    // Established member → one event per genuinely NEW breach (dedup keeps re-scans from repeating).
    for (const name of newBreaches) {
      const b = (exposure.breaches || []).find((x) => x.name === name) || {};
      await addIdentityEvent(email, {
        type: 'breach_new',
        title: `New breach detected: ${name}`,
        detail: fmtClasses(b.classes),
        data: { name, date: b.date, classes: b.classes },
        dedupKey: `breach-${name}`,
        nowIso,
      });
    }
  }

  await upsertMonitorState(email, { names: curNames, count: exposure.count, enabled: true, nowIso });
  return { available: true, exposure, newBreaches, firstScan, lastChecked: nowIso };
}
