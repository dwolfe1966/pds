# Google Ads analysis — 7 days (Jun 23–29, 2026)

**Source:** `Campaign report.csv` + `Search terms report.csv` (this dir).
**Data caveats (read first):**
- **Ads recorded 0 conversions all week** — tracking was broken (gclid/trigger/campaign-goal issues, fixed ~06-29). So Ads ROAS/CPA/conv-rate for this window are **invalid**; use BC canonical M0 for real conversions.
- **No CTR** — the campaign export lacked an Impressions column. Re-export with Impressions + CTR next time.
- Search-terms numeric *totals* are unreliable (commas inside some query strings shift columns); used qualitatively. **Campaign-level totals are authoritative.**

---

## 1) Portfolio assessment — ~97% dormant
6 campaigns, Upper/Lower pairs across 3 verticals (Inmates / Death / Divorce):

| Campaign | Daily budget | State |
|---|---|---|
| Inmates - Lower | **$2,600** | ⛔ Paused/pending — **ads disapproved** |
| Death - Lower | **$1,000** | ⛔ Paused, pending |
| Divorce - Upper | **$500** | ⛔ Paused, pending |
| Divorce - Lower | $75 | ⛔ Paused |
| Inmates - Upper | $77 | ✅ Active (Learning) |
| Death - Upper | $50 | ✅ Active (Learning), started 06-28 |

Intended daily budget ≈ **$4,302**; allocated to active ≈ **$127 (3%)**. All three highest-value
campaigns are locked behind **ad disapprovals + pending review**; no Divorce vertical and no
"Lower" tier is live. **The portfolio isn't underperforming — it's barely deployed.**

## 2) Active campaign assessment
**Inmates-Upper — workhorse (76% of spend)**
- $344.24 · 188 clicks · **$1.83 avg CPC** · 5 active days (06-25→29).
- Daily clicks 34/33/42/50/**29**; **06-29 CPC spiked to $2.95** (from $1.30–1.94) → clicks fell while spend rose. Efficiency degraded on the last day.
- Best efficiency 06-26 ($42.92 / 33 clicks / $1.30 CPC) — likely drove the 9-M0 day.

**Death-Upper — just launched (24%)**
- $107.49 · 59 clicks · **$1.82 avg CPC** · live since **06-28** only; CPC improving ($2.06→$1.64).
- Flag: "some ads limited by policy" — partial throttle.

Both stuck in **"Learning"**, and both learned against **0 recorded conversions** all week.

## 3) Trend — CPC/efficiency + conversion context (CTR unavailable)
- **CPC:** drifting **up**; Inmates-Upper $1.30 → **$2.95**. The 06-29 spike (CPC↑, clicks↓) is the one real warning in the data.
- **Daily account spend:** $0 / $0 / $54 / $43 / $82 / **$133 / $140**.
- **Conversions:** Ads 0% (broken). BC M0 = **9 (06-26)**, 1 (06-28), 3 (06-29); funnel CVR ≈ **0.6%** visitor→paid. **06-26 was the standout.** No reliable trend yet — the clean one starts now that tracking works.

## 4) Recommendations (priority order)
1. **Unlock the budget (top priority).** Fix **Inmates-Lower ad disapprovals**; decide which paused campaigns to activate (staged, not all $4.3k/day at once). 97% of the plan isn't running.
2. **Let bidding re-learn** now that conversions track — ~1–2 weeks to stabilize; don't cut/judge on this week.
3. **Watch the Inmates-Upper CPC spike** ($2.95). If it persists, $1-trial economics break — consider a bid cap / shift budget to better-efficiency terms once conversion data accrues.
4. **Fix the post-click funnel leak** (SUP Attempt ~15%, card submission). At $1.83 CPC, profitability is decided after the click — as high-leverage as the spend.
5. **Align Divorce intent** — divorce/marriage search terms run under Death-Upper while the Divorce funnel is paused; mis-routed.
6. **Re-pull next week** with Impressions + CTR + (now-working) Conversions for the first clean read.

**One-liner:** can't judge performance yet (blind tracking + only 2 small campaigns ran). The real levers are **unblocking the paused/disapproved budget** and **fixing the card-submission leak**, then re-reading with working conversions in ~1–2 weeks.
