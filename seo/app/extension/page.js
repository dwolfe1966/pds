// Landing for the IDLookup Remove browser extension (the "Get the extension" target from the opt-out guide).
// Honest about status: not yet on the Chrome Web Store, so today it's load-unpacked for testers.
export const revalidate = 86400;
export const metadata = {
  title: 'IDLookup Remove — browser extension',
  description: 'The IDLookup browser assistant autofills data-broker opt-out forms and flags your exposure as you browse.',
  robots: { index: true, follow: true },
};

const wrap = { maxWidth: 640, margin: '0 auto', padding: '48px 22px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1f2937', lineHeight: 1.6 };
const h1 = { fontSize: 32, fontWeight: 800, color: '#0d5d2f', margin: '0 0 6px' };
const lead = { fontSize: 16, color: '#374151', margin: '0 0 24px' };
const h2 = { fontSize: 18, fontWeight: 800, color: '#111827', margin: '26px 0 8px' };
const li = { fontSize: 15, margin: '0 0 8px' };
const box = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 18px', margin: '20px 0' };

export default function ExtensionLanding() {
  return (
    <main style={wrap}>
      <h1 style={h1}>IDLookup Remove</h1>
      <p style={lead}>The browser assistant that takes the busywork out of removing yourself from data brokers — and flags your exposure as you browse. Everything runs in your own browser.</p>

      <h2 style={h2}>What it does</h2>
      <ul>
        <li style={li}><strong>Autofills opt-out forms</strong> on data-broker sites with your details, so you don’t retype them.</li>
        <li style={li}><strong>Guides each removal</strong> — tells you the exact verification step (CAPTCHA, email link) you’ll hit.</li>
        <li style={li}><strong>Flags risks on the page you’re viewing</strong> — “this is a known data broker,” “account form — use a unique password.”</li>
        <li style={li}><strong>Optional history insights</strong> (off by default) — map where your data spreads, delete it anytime.</li>
      </ul>

      <div style={box}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#166534', marginBottom: 4 }}>Coming to the Chrome Web Store</div>
        <div style={{ fontSize: 14, color: '#374151' }}>We’re finishing review. Want early access? Email <a href="mailto:privacy@idlookup.ai" style={{ color: '#0d5d2f' }}>privacy@idlookup.ai</a> and we’ll get you set up.</div>
      </div>

      <p style={{ fontSize: 13, color: '#6b7280' }}>Privacy-first by design — your details stay in your browser and are used only to fill your own forms. <a href="/extension-privacy" style={{ color: '#0d5d2f' }}>Read the privacy policy</a>.</p>
    </main>
  );
}
