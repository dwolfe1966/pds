// GET /api/pdl-usage — PDL usage + estimated spend (calls, billable matches, cost). For monitoring; counts
// only, no PII. Owner 2026-07-21: track PDL spend + control it (cap via PDL_DAILY_CAP env).
import { pdlUsageSummary } from '../../../lib/pdlBudget.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await pdlUsageSummary();
  return new Response(JSON.stringify(s || { error: 'no data' }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
