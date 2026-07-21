#!/bin/bash
# HAMMER THE STATES (owner #2, 2026-07-20) — crawl EVERY state adapter into `inmates`. Adapters already
# exist for ~51 jurisdictions (lib/stateInmates.mjs STATE_ADAPTERS); most just were never crawled. This is
# breadth-first: top-50-surname seed per state (crawl-state-inmates auto-does first×last for NEEDS_FIRST
# TX/MD/OR/VA). Direct/VINE states first (fast), browser-tier last (TX/MO/MI/CO/AZ/OK/KS/WI via the browser
# service — slower). Sequential = polite (one gov host at a time). FL is bulk (fl_inmates), not here.
cd "$(dirname "$0")"
run() { echo "=== $(date '+%H:%M:%S') $* ==="; node --env-file=.env.local scripts/crawl-state-inmates.mjs "$@" 2>&1 | tail -1; echo; }

# FAST TIER ONLY — direct DOC + VINE adapters (free, residential IP, surname-only; script cross-products
# MD/OR/VA). The browser/captcha tier (TX/MI/AZ/OK/KS/WI/CO) is handled by the GitHub Action (cloud, has the
# Browserless/2Captcha secrets) so we don't tie up the local machine on 9-120s/query states.
FAST="CA PA IL NY WA OH NC GA MN NJ KY CT TN WV NH ME MD IN AL SC LA OR UT NV AR MS NE ID HI MA IA RI SD AK ND VT WY DC VA NM DE"
for st in $FAST; do run --state=$st --delay=800; done

echo "=== $(date '+%H:%M:%S') FAST-TIER ALL-STATES CRAWL DONE ==="
