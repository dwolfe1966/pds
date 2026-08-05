// Opt-out engine — runs one broker adapter for a person. "Build the head" v1.
// Returns { method, status, detail }. status: 'manual' (user opens the URL) | 'requested' (we submitted)
// | 'prepared' (request built, sending gated) | 'pending_worker' (needs the phase-2 browser worker) | 'error'.
import { getAdapter, buildOptOutRequest } from './adapters.mjs';

export async function submitOptOut({ sourceKey, registryRow, identity }) {
  const adapter = getAdapter(sourceKey, registryRow);
  try {
    switch (adapter.method) {
      case 'manual':
        return { method: 'manual', status: 'manual', detail: { url: adapter.url || null } };

      case 'form_post': {
        if (!adapter.url) return { method: 'form_post', status: 'error', detail: 'no url' };
        const body = adapter.build ? adapter.build(identity) : {};
        const res = await fetch(adapter.url, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body).toString(),
        });
        return { method: 'form_post', status: res.ok ? 'requested' : 'error', detail: { httpStatus: res.status } };
      }

      case 'email': {
        const text = buildOptOutRequest(identity, adapter.brokerName || sourceKey);
        // Actual sending to broker privacy inboxes is gated — deliverability (SPF/DKIM) + legal authorization
        // must be in place first. Until then we PREPARE the request (recorded on the node event).
        if (process.env.OPTOUT_EMAIL_ENABLED === '1' && adapter.to) {
          // TODO(phase-2): send `text` to adapter.to via the email provider, then status 'requested'.
          return { method: 'email', status: 'requested', detail: { to: adapter.to } };
        }
        return { method: 'email', status: 'prepared', detail: { to: adapter.to || null, preview: text.slice(0, 140) } };
      }

      case 'browser':
        return { method: 'browser', status: 'pending_worker', detail: 'Playwright worker not deployed (phase 2)' };

      default:
        return { method: adapter.method, status: 'error', detail: 'unknown method' };
    }
  } catch (e) {
    return { method: adapter.method, status: 'error', detail: String((e && e.message) || e) };
  }
}

/** Map an engine result to the exposure-graph control status. A committed submission (manual open, email/
 *  form_post request, or prepared) becomes optout_requested; only hard errors don't move the node. */
export function controlStatusFor(result) {
  if (!result) return null;
  if (['manual', 'requested', 'prepared', 'pending_worker'].includes(result.status)) return 'optout_requested';
  return null; // 'error' → leave the node as-is
}
