---
name: Search contextKey/teaserInput changes require extreme caution
description: Two days were spent breaking/fixing search when touching contextKey and teaserInput — make one change at a time and test before proceeding
type: feedback
---

Two days were lost attempting to get ByteCrtrs search working while modifying `contextKey` and `teaserInput` params. Changes to these fields can silently break search results.

**Why:** ByteCrtrs search is sensitive to these parameters. Changes that seem correct from the API docs may cause the API to return empty results, wrong results, or fail the bot challenge gate.

**How to apply:**
- Make ONE change at a time to search params (contextKey, teaserInput, etc.)
- Verify search returns results after each individual change before making the next
- Do NOT batch multiple search parameter changes together
- If a change breaks search, revert immediately rather than trying to fix forward
- The bot challenge (`bcEdgeApiPass`) must be passed for real API calls — this gates all ByteCrtrs search traffic
