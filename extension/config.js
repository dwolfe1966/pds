// Shared config (loaded in the service worker via importScripts, in the popup/bridge via <script>/content).
// The app-key only gates the endpoint against casual scraping — it's the same public key the web app ships.
self.IDL_CONFIG = {
  appKey: 'JQV5HXGO80RIGE9XRSPI',
  historyUrl: 'https://idlookup.me/api/history',
  detectionUrl: 'https://idlookup.me/api/exposure-detection',
  privacyUrl: 'https://idlookup.me/extension-privacy',
  consentVersion: '2026-08-08',
};

// Search-your-listing URL templates for the batch "Re-check all" sweep — the background worker fills
// {first}/{last}/{city}/{state}/{zip} and opens each in a background tab so the content script can scan the
// RESULTS page (opt-out forms don't show your listing; search pages do). Best-effort per broker: a wrong
// template just lands somewhere that yields no match, and app-initiated absence requires the broker's OWN
// "no results" text (see content.js) — so a bad template can never manufacture a false "removed". Only the
// brokers with a reasonably stable name-search URL are here; others fall back to the manual per-row re-check.
self.IDL_SEARCH_URLS = {
  truepeoplesearch: 'https://www.truepeoplesearch.com/results?name={first} {last}&citystatezip={city}, {state}',
  fastpeoplesearch: 'https://www.fastpeoplesearch.com/name/{first}-{last}_{city}-{state}',
  thatsthem: 'https://thatsthem.com/name/{first}-{last}/{city}-{state}',
  usphonebook: 'https://www.usphonebook.com/{first}-{last}/{state}',
  searchpeoplefree: 'https://www.searchpeoplefree.com/find/{first}-{last}/{state}',
  clustrmaps: 'https://clustrmaps.com/persons/{first}-{last}',
  nuwber: 'https://nuwber.com/search?name={first} {last}&state={state}',
};
