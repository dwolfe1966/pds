// Public privacy policy for the "IDLookup Remove" browser extension. Required for Chrome Web Store
// (Limited Use) since the extension can handle browsing history. Kept accurate to what the code actually
// does — see extension/ + seo/app/api/history. Public + indexable so store review can reach it.
export const revalidate = 86400;

export const metadata = {
  title: 'IDLookup Remove — Extension Privacy Policy',
  description: 'What the IDLookup Remove browser extension collects, how it is used, and how to delete it.',
  robots: { index: true, follow: true },
};

const EFFECTIVE = 'August 8, 2026';

const wrap = { maxWidth: 760, margin: '0 auto', padding: '40px 22px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1f2937', lineHeight: 1.6 };
const h1 = { fontSize: 30, fontWeight: 800, color: '#0d5d2f', marginBottom: 4 };
const h2 = { fontSize: 19, fontWeight: 800, color: '#111827', margin: '28px 0 8px' };
const p = { fontSize: 15, margin: '0 0 12px' };
const li = { fontSize: 15, margin: '0 0 8px' };
const muted = { fontSize: 13, color: '#6b7280' };

export default function ExtensionPrivacy() {
  return (
    <main style={wrap}>
      <h1 style={h1}>IDLookup Remove — Privacy Policy</h1>
      <p style={muted}>Browser extension · Effective {EFFECTIVE}</p>

      <p style={{ ...p, marginTop: 20 }}>
        IDLookup Remove helps you find and remove your personal information from data-broker and people-search
        sites, and understand your exposure across the web. This policy explains exactly what the extension
        accesses, why, where it goes, and how to delete it. We built it to hold your data <strong>only</strong> for
        the features you turn on — and to make deleting it a one-click action.
      </p>

      <h2 style={h2}>What the extension accesses</h2>
      <ul>
        <li style={li}><strong>Your identity details</strong> (name, email, address history, date of birth, phone) —
          synced from the identity you mapped in your IDLookup account. Used to auto-fill opt-out forms so you
          don’t retype them. You control these in your IDLookup account; we never ask you to enter your SSN or a
          government ID, and we do not store those.</li>
        <li style={li}><strong>The page you’re viewing</strong> — on a site, the extension reads the page’s form
          fields locally to offer autofill and to show a relevant tip (e.g. “this is a known data broker”). This
          on-page reading happens in your browser and is <strong>not transmitted to us</strong>.</li>
        <li style={li}><strong>Your browsing history — only if you turn on “History insights.”</strong> This feature
          is <strong>off by default</strong>. It is enabled only when you explicitly click to turn it on and grant
          the browsing-history permission. When on, the extension syncs the sites you visit to your IDLookup
          account so we can map where your data may have spread. You can turn it off and delete all of it at any
          time (see “Your controls”).</li>
      </ul>

      <h2 style={h2}>How we use it</h2>
      <ul>
        <li style={li}>To auto-fill and guide you through opt-out / removal requests on data-broker sites.</li>
        <li style={li}>To show identity-safety tips on the page you’re viewing.</li>
        <li style={li}>With History insights on: to build your “digital footprint” — where your information appears
          and where it may be collected — so you can act on it.</li>
      </ul>
      <p style={p}><strong>We do not sell your data. We do not share it with third parties for their own use. We do
        not use it for advertising.</strong> Your information is used only to provide the features above.</p>

      <h2 style={h2}>Where it’s stored</h2>
      <p style={p}>Identity details and (if enabled) browsing history are stored on IDLookup’s servers, associated
        with your IDLookup account, and encrypted in transit and at rest. On-page form reading and the current-page
        tips are processed locally in your browser and are not sent anywhere.</p>

      <h2 style={h2}>Your controls</h2>
      <ul>
        <li style={li}><strong>Delete your history anytime</strong> — the extension’s “Delete my history &amp; turn
          off” button erases every synced visit from our servers, stops collection, and revokes the browsing-history
          permission.</li>
        <li style={li}><strong>Keep History insights off</strong> — it never collects browsing history unless you
          turn it on.</li>
        <li style={li}><strong>Manage your identity</strong> — edit or remove your identity details in your IDLookup
          account.</li>
        <li style={li}><strong>Limit site access</strong> — restrict the extension to specific sites or “on click”
          via Chrome’s extension site-access settings.</li>
        <li style={li}><strong>Uninstall</strong> — removing the extension stops all local processing immediately.</li>
      </ul>

      <h2 style={h2}>Permissions, and why</h2>
      <ul>
        <li style={li}><code>storage</code> — remember your settings + synced identity locally.</li>
        <li style={li}><code>activeTab</code> / <code>scripting</code> — read the current page’s form fields to
          offer autofill and tips.</li>
        <li style={li}>Site access — show the assistant and autofill opt-out forms on the sites you visit.</li>
        <li style={li}><code>history</code> — <strong>optional</strong>, requested only when you enable History
          insights; used solely for that feature.</li>
      </ul>

      <h2 style={h2}>Limited Use</h2>
      <p style={p}>Our use of information received from the extension adheres to the Chrome Web Store User Data
        policy, including the Limited Use requirements. We use the data only to provide and improve the
        user-facing features described here, do not transfer it except as needed to provide those features (or as
        required by law), and do not use it for advertising or sell it.</p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>Questions or requests: <a href="mailto:privacy@idlookup.ai" style={{ color: '#0d5d2f' }}>privacy@idlookup.ai</a>.</p>
      <p style={muted}>We may update this policy; material changes will be reflected by a new effective date above.</p>
    </main>
  );
}
