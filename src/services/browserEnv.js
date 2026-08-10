// Which browser is the member on — so the Browser Assistant tab offers the RIGHT install path (or an honest
// "not yet / use manual removals" fallback) instead of always saying "Add to Chrome." The extension is a
// Chromium MV3 add-on; everything it does has a no-extension fallback (guided manual removals + the re-check
// cron), so non-supported browsers still get the full core product.

export function detectBrowser() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (/Edg\//.test(ua)) return { family: 'chromium', name: 'Edge', isMobile };
  if (/OPR\//.test(ua) || /Opera/i.test(ua)) return { family: 'chromium', name: 'Opera', isMobile };
  if (/Firefox\//.test(ua)) return { family: 'firefox', name: 'Firefox', isMobile };
  // Chrome must be checked before Safari (Chrome UA also contains "Safari").
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua) || /CriOS\//.test(ua)) return { family: 'chromium', name: 'Chrome', isMobile };
  if (/Safari\//.test(ua)) return { family: 'safari', name: 'Safari', isMobile };
  return { family: 'other', name: 'your browser', isMobile };
}

// What to show for adding the assistant on this browser.
//   supported:true  → a working "Add to <browser>" CTA (url).
//   supported:false → an honest status + a fallback to the manual removals flow.
export function extensionInstall(url) {
  const b = detectBrowser();
  if (b.isMobile) {
    return { supported: false, browser: b.name, statusLabel: 'Desktop only', cta: null,
      note: 'The browser assistant runs on desktop browsers. On mobile, use the guided removals in Digital Footprint — they work everywhere.' };
  }
  if (b.family === 'chromium') {
    const verb = b.name === 'Edge' ? 'Add to Edge' : b.name === 'Chrome' ? 'Add to Chrome' : `Add to ${b.name}`;
    return { supported: true, browser: b.name, statusLabel: 'Not installed', cta: { label: `${verb} →`, url } };
  }
  if (b.family === 'firefox') {
    return { supported: false, browser: 'Firefox', statusLabel: 'Firefox coming soon', cta: { label: 'Notify me →', url },
      note: 'A Firefox version is on the way. For now, use the guided removals in Digital Footprint — they work in any browser.' };
  }
  if (b.family === 'safari') {
    return { supported: false, browser: 'Safari', statusLabel: 'Not on Safari yet', cta: null,
      note: 'The assistant isn’t available on Safari yet. Use the guided removals in Digital Footprint — they work in any browser.' };
  }
  return { supported: false, browser: b.name, statusLabel: 'Not supported here', cta: null,
    note: 'The assistant runs on Chrome and other Chromium browsers. Use the guided removals in Digital Footprint — they work everywhere.' };
}
