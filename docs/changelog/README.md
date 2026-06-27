# Delivery changelog → Google Sheet

A daily, shareable log of **bugs + features delivered**, derived from git (the source of
truth — our commit messages are Conventional Commits). The repo holds the generator + a
versioned snapshot; a Google Sheet is the team-facing view.

## How it works
- `scripts/changelog.js` parses `git log` → structured rows (Date, Type, Area, Summary, Commit).
- "Delivered" types: `fix`→Bug fix, `feat`→Feature, `perf`→Improvement, `polish`, `harden`→Security, `content`. (`docs`/`chore`/`test`/`refactor`/internal excluded unless `--all`.)
- A Google Apps Script web app receives rows and appends them, **de-duping by commit hash** — so re-posting the full 6-month window daily only ever adds new commits (idempotent).

## Commands
```bash
node scripts/changelog.js                          # CSV, last 6 months, delivered types
node scripts/changelog.js --format=md              # markdown table
node scripts/changelog.js --since="2026-05-01"     # custom window
node scripts/changelog.js --all                    # include internal commits
node scripts/changelog.js --format=json --webhook="$CHANGELOG_SHEET_URL"   # push to the Sheet
```

## One-time Sheet setup (≈5 min, no Google Cloud)
1. Create a Google Sheet. Add a tab named **`Changelog`**.
2. **Extensions → Apps Script**. Paste the script below; set your own `TOKEN`. Save.
3. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone**. Deploy, authorize, copy the bare **`…/exec` Web app URL** (the token is NOT in the URL).
4. Add the URL + token to **GitHub Secrets** (see "Daily automation" below) — never commit them.

```javascript
const TOKEN = 'PASTE_YOUR_TOKEN_HERE';  // any characters OK — read from the JSON body
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  if (body.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Changelog') || ss.getSheets()[0];
  const rows = body.rows || [];
  if (sheet.getLastRow() === 0) sheet.appendRow(['Date','Type','Area','Summary','Commit']);
  const last = sheet.getLastRow();
  const existing = last > 1 ? sheet.getRange(2,5,last-1,1).getValues().flat().map(String) : [];
  const seen = new Set(existing);
  let added = 0;
  rows.forEach(function(r){
    if (seen.has(String(r.commit))) return;
    sheet.appendRow([r.date, r.type, r.area, r.summary, r.commit]);
    seen.add(String(r.commit)); added++;
  });
  // Keep the whole sheet in reverse-chronological order (newest first). ISO
  // YYYY-MM-DD in column A (Date) sorts correctly as strings.
  var n = sheet.getLastRow();
  if (n > 2) sheet.getRange(2, 1, n - 1, 5).sort({ column: 1, ascending: false });
  return ContentService.createTextOutput(JSON.stringify({ ok:true, added }))
    .setMimeType(ContentService.MimeType.JSON);
}
```
> ⚠️ The token rides in the **POST body**, never the URL — so special chars (`& % $ !`) are safe. Use the bare `…/exec` URL. **Never commit the token or the live URL** (use GitHub Secrets, below).

4. **Test it once locally:**
   ```bash
   node scripts/changelog.js --format=json --webhook="<exec URL>" --token="<your token>"
   # → "webhook ok: {"ok":true,"added":N}"  and the Sheet fills in
   ```

## Daily automation — GitHub Action (twice a day)
`.github/workflows/changelog.yml` runs at **01:00 & 13:00 UTC** (plus on-demand via *Actions → Run workflow*). It re-posts the 6-month window each run; the Apps Script de-dupes by commit hash, so only new commits land.

**Add two repo secrets** — GitHub → repo → *Settings → Secrets and variables → Actions → New repository secret*:
- `CHANGELOG_SHEET_URL` = the bare `…/exec` web-app URL
- `CHANGELOG_SHEET_TOKEN` = your token (any chars; rides in the POST body)

(Local fallback: `CHANGELOG_SHEET_TOKEN=… node scripts/changelog.js --format=json --webhook="$URL"`.)
