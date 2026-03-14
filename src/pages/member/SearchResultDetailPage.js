import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportDetail, createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext, getSearchContext } from '../../services/searchContext';

/**
 * Shows a detailed report for a selected person.
 * Layout inspired by the branded PDF report format — sections mirror the
 * professional report structure: summary, personal info, addresses, phones,
 * emails, relatives, employment/education, social, family watchdog.
 */
const SearchResultDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const lastTrackedRef = useRef(null);

  // ── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrCreateReport = async () => {
      if (!id || id === 'undefined' || id === 'null') {
        setError('Report ID is required');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        // 1. Session cache (populated right after createReport)
        try {
          const cached = sessionStorage.getItem(`report_cache_${id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.success && parsed.identities?.length > 0) {
              setReport(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (_) { /* cache miss */ }

        // 2. Fetch by commerceContentId
        try {
          const result = await getReportDetail(id);
          if (result.success) { setReport(result); setLoading(false); return; }
        } catch (_) { /* fall through */ }

        // 3. Create from extId
        const identityContext = getIdentityContext();
        if (identityContext && identityContext.extId === id) {
          setCreatingReport(true);
          const r = await createReportForIdentity(id, identityContext);
          if (r.success && r.commerceContentId) {
            setReport(r);
            navigate(`/people/${r.commerceContentId}`, { replace: true });
            return;
          }
        }
        const storedResult = sessionStorage.getItem(`result_${id}`);
        if (storedResult) {
          const personData = JSON.parse(storedResult);
          if (personData.extId) {
            setCreatingReport(true);
            const r = await createReportForIdentity(personData.extId, personData);
            if (r.success && r.commerceContentId) {
              setReport(r);
              navigate(`/people/${r.commerceContentId}`, { replace: true });
              return;
            }
          }
        }
        setError('We could not load this report right now. Please try again later.');
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.warn('Error fetching/creating report:', err);
        setError('We could not load this report right now. Please try again later.');
      } finally {
        setLoading(false);
        setCreatingReport(false);
      }
    };

    if (token) fetchOrCreateReport();
    else { setError('Please log in to view reports'); setLoading(false); }
  }, [id, token, navigate]);

  // Profile-view tracking
  useEffect(() => {
    if (!token || !id || lastTrackedRef.current === id) return;
    lastTrackedRef.current = id;
    const identityContext = getIdentityContext();
    const targetType = identityContext?.extId === id ? 'person' : 'report';
    api.post('/profile-views', { body: { targetId: id, targetType, source: 'member-report' }, token })
      .catch(() => {});
  }, [id, token]);

  // ── PDF download ─────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    const commerceContentId = report?.commerceContentId;
    if (!commerceContentId) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      await api.downloadPdfReport(commerceContentId);
      // BC library opens a native download popup — nothing more to do on success
    } catch (err) {
      setPdfError(err?.message || 'PDF download failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Data extraction ───────────────────────────────────────────────────────
  const data = report ? extractAll(report) : null;

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ color: '#6b7280', marginTop: '1rem' }}>
            {creatingReport ? 'Building your report… this may take a moment.' : 'Loading report…'}
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.main}>
        <div style={styles.errorBox}>
          <p style={{ fontWeight: 600, marginTop: 0 }}>We couldn't load this report.</p>
          <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/people-search')} style={styles.btnSecondary}>Back to Search</button>
            <button onClick={() => navigate('/dashboard')} style={styles.btnPrimary}>Go to Dashboard</button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const commerceContentId = report?.commerceContentId;

  return (
    <main style={styles.main}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <p style={styles.breadcrumb}>
            <button onClick={() => navigate('/people-search')} style={styles.breadcrumbBtn}>Search</button>
            {' › '}
            <span style={{ color: '#374151' }}>Report</span>
          </p>
          <h1 style={styles.personName}>{data.fullName}</h1>
          <div style={styles.headerMeta}>
            {data.age && <span style={styles.metaBadge}>Age {data.age}</span>}
            {data.currentLocation && <span style={styles.metaBadge}>📍 {data.currentLocation}</span>}
            {data.dob && <span style={styles.metaBadge}>DOB: {data.dob}</span>}
          </div>
        </div>
        <div style={styles.headerActions}>
          {commerceContentId && (
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              style={{ ...styles.btnPdf, opacity: pdfLoading ? 0.7 : 1 }}
            >
              {pdfLoading ? '⏳ Preparing PDF…' : '⬇ Download PDF'}
            </button>
          )}
          <button onClick={() => navigate('/people-search')} style={styles.btnSecondary}>
            New Search
          </button>
        </div>
      </div>

      {pdfError && (
        <div style={styles.pdfErrorBanner}>{pdfError}</div>
      )}

      {/* ── Summary bar ── */}
      <SummaryBar data={data} />

      {/* ── Sections ── */}
      <div style={styles.grid}>

        {/* Section 1 — Personal Info */}
        <Section number="1" title="Personal Information" fullWidth>
          <FieldGrid>
            <Field label="Full Name" value={data.fullName} />
            {data.aliases.length > 0 && (
              <Field label="Also Known As" value={data.aliases.join(' · ')} />
            )}
            {data.dob && <Field label="Date of Birth" value={data.dob} />}
            {data.age && <Field label="Age / Range" value={data.age} />}
            {data.gender && <Field label="Gender" value={data.gender} />}
            {data.provider && <Field label="Data Provider" value={data.provider} />}
          </FieldGrid>
        </Section>

        {/* Section 2 — Address History */}
        {data.addresses.length > 0 && (
          <Section number="2" title={`Address History (${data.addresses.length})`} fullWidth>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Address</Th>
                  <Th>City</Th>
                  <Th>State</Th>
                  <Th>ZIP</Th>
                  <Th>Dates</Th>
                </tr>
              </thead>
              <tbody>
                {data.addresses.map((addr, i) => (
                  <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                    <Td>{addr.street || '—'}</Td>
                    <Td>{addr.city || '—'}</Td>
                    <Td>{addr.state || '—'}</Td>
                    <Td>{addr.zip || '—'}</Td>
                    <Td>{formatDateRange(addr.firstSeen, addr.lastSeen)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Section 3 — Phone Numbers */}
        {data.phones.length > 0 && (
          <Section number="3" title={`Phone Numbers (${data.phones.length})`}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Type</Th>
                  <Th>Carrier</Th>
                  <Th>Dates</Th>
                </tr>
              </thead>
              <tbody>
                {data.phones.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                    <Td><strong>{fmtPhone(p.number)}</strong></Td>
                    <Td>{p.type || '—'}</Td>
                    <Td>{p.carrier || '—'}</Td>
                    <Td>{formatDateRange(p.firstSeen, p.lastSeen)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Section 4 — Email Addresses */}
        {data.emails.length > 0 && (
          <Section number="4" title={`Email Addresses (${data.emails.length})`}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Address</Th>
                  <Th>Type</Th>
                  <Th>Dates</Th>
                </tr>
              </thead>
              <tbody>
                {data.emails.map((e, i) => (
                  <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                    <Td><strong>{e.address}</strong></Td>
                    <Td>{e.type || '—'}</Td>
                    <Td>{formatDateRange(e.firstSeen, e.lastSeen)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Section 5 — Relatives & Associates */}
        {data.relatives.length > 0 && (
          <Section number="5" title={`Relatives & Associates (${data.relatives.length})`} fullWidth>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Relationship</Th>
                  <Th>Age</Th>
                  <Th>Location</Th>
                </tr>
              </thead>
              <tbody>
                {data.relatives.map((rel, i) => (
                  <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                    <Td><strong>{rel.name || '—'}</strong></Td>
                    <Td>{rel.relationship || '—'}</Td>
                    <Td>{rel.age || '—'}</Td>
                    <Td>{rel.location || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Section 6 — Employment */}
        {data.jobs.length > 0 && (
          <Section number="6" title={`Employment (${data.jobs.length})`}>
            {data.jobs.map((job, i) => (
              <div key={i} style={styles.listItem}>
                <p style={styles.listItemTitle}>{job.employer || 'Unknown Employer'}</p>
                {job.title && <p style={styles.listItemSub}>{job.title}</p>}
                {(job.city || job.state) && (
                  <p style={styles.listItemMeta}>{[job.city, job.state].filter(Boolean).join(', ')}</p>
                )}
                {(job.start || job.end) && (
                  <p style={styles.listItemMeta}>{formatDateRange(job.start, job.end)}</p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Section 7 — Education */}
        {data.education.length > 0 && (
          <Section number="7" title={`Education (${data.education.length})`}>
            {data.education.map((edu, i) => (
              <div key={i} style={styles.listItem}>
                <p style={styles.listItemTitle}>{edu.school || 'Unknown School'}</p>
                {edu.degree && <p style={styles.listItemSub}>{edu.degree}</p>}
                {(edu.start || edu.end) && (
                  <p style={styles.listItemMeta}>{formatDateRange(edu.start, edu.end)}</p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Section 8 — Social Media */}
        {data.social.length > 0 && (
          <Section number="8" title={`Social Media & Online (${data.social.length})`}>
            {data.social.map((sp, i) => (
              <div key={i} style={styles.listItem}>
                <p style={styles.listItemTitle}>{sp.network || sp.type || 'Unknown'}</p>
                {sp.url && (
                  <a href={sp.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {sp.url}
                  </a>
                )}
                {!sp.url && sp.username && <p style={styles.listItemSub}>@{sp.username}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Section 9 — Family Watchdog */}
        <Section number="9" title="Sex Offender Registry Check" fullWidth>
          <FamilyWatchdogSection offenders={data.offenders} />
        </Section>

        {/* No data catch */}
        {data.phones.length === 0 && data.emails.length === 0 && data.addresses.length <= 1 && (
          <div style={{ ...styles.card, gridColumn: '1 / -1', color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            <p style={{ margin: 0 }}>Limited contact data is available for this person.</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
              This may mean the report is still processing or the person has limited public records.
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

/* ─── Summary bar ──────────────────────────────────────────────────────── */

const SummaryBar = ({ data }) => {
  const stats = [
    { label: 'Phone Numbers', value: data.phones.length, color: '#1d4ed8' },
    { label: 'Email Addresses', value: data.emails.length, color: '#0d5d2f' },
    { label: 'Addresses', value: data.addresses.length, color: '#7e22ce' },
    { label: 'Relatives', value: data.relatives.length, color: '#c2410c' },
    { label: 'Employment Records', value: data.jobs.length, color: '#0e7490' },
    { label: 'Nearby Offenders', value: data.offenders.length, color: data.offenders.length > 0 ? '#b91c1c' : '#15803d' },
  ].filter(s => s.value > 0 || s.label === 'Nearby Offenders');

  return (
    <div style={styles.summaryBar}>
      {stats.map((s, i) => (
        <div key={i} style={styles.statBox}>
          <span style={{ ...styles.statNum, color: s.color }}>{s.value}</span>
          <span style={styles.statLabel}>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Section wrapper ──────────────────────────────────────────────────── */

const Section = ({ number, title, children, fullWidth }) => (
  <div style={{ ...styles.card, gridColumn: fullWidth ? '1 / -1' : undefined }}>
    <div style={styles.sectionHeader}>
      <span style={styles.sectionNum}>{number}</span>
      <h2 style={styles.sectionTitle}>{title}</h2>
    </div>
    {children}
  </div>
);

/* ─── Table helpers ────────────────────────────────────────────────────── */

const Th = ({ children }) => (
  <th style={styles.th}>{children}</th>
);
const Td = ({ children }) => (
  <td style={styles.td}>{children}</td>
);

/* ─── Field grid ───────────────────────────────────────────────────────── */

const FieldGrid = ({ children }) => (
  <div style={styles.fieldGrid}>{children}</div>
);

const Field = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={styles.fieldBox}>
      <p style={styles.fieldLabel}>{label}</p>
      <p style={styles.fieldValue}>{value}</p>
    </div>
  );
};

/* ─── Family Watchdog ──────────────────────────────────────────────────── */

const FamilyWatchdogSection = ({ offenders }) => {
  if (!offenders || offenders.length === 0) {
    return (
      <div style={styles.clearBanner}>
        <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>✓</span>
        <span>No registered sex offenders found near this address.</span>
      </div>
    );
  }
  return (
    <div>
      <div style={styles.warnBanner}>
        <strong>{offenders.length} registered sex offender{offenders.length !== 1 ? 's' : ''} found nearby.</strong>
      </div>
      {offenders.map((o, i) => (
        <div key={i} style={styles.offenderCard}>
          <p style={{ fontWeight: 600, margin: '0 0 0.375rem' }}>{o.name || o.fullName || 'Unknown'}</p>
          {o.distance && <p style={styles.offenderField}>Distance: {o.distance}</p>}
          {o.offenseDescription && <p style={styles.offenderField}>Offense: {o.offenseDescription}</p>}
          {o.address && (
            <p style={styles.offenderField}>
              Address: {[o.address.street, o.address.city, o.address.state, o.address.zip].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── Data extraction helper ───────────────────────────────────────────── */

function extractAll(result) {
  const identities = result.identities || [];
  const fullContact = result.fullContact || null;
  const familyWatchdog = result.familyWatchdog || null;
  const primary = identities[0] || {};

  // Name
  const nameList = primary.nameList || [];
  const fullName = nameList[0]?.data || 'Unknown';
  const aliases = nameList.slice(1).map(n => n.data).filter(Boolean);

  // Age / DOB
  const dobList = primary.dobList || [];
  const dob = dobList[0]?.date?.data && dobList[0].date.data !== 'XX/XX/XXXX'
    ? dobList[0].date.data : '';
  const age = primary.ageRange || dobList[0]?.age || '';

  // Gender
  const gender = primary.gender || '';

  // Provider
  const provider = primary.meta?.provider || '';

  // Addresses — merge identity + fullContact, deduplicate
  const rawAddresses = [
    ...(primary.addressList || []).map(a => ({
      street: a.street || a.address || '',
      city: a.city || '',
      state: a.state || '',
      zip: a.zip || '',
      firstSeen: a.meta?.firstSeen || a.firstSeen || null,
      lastSeen: a.meta?.lastSeen || a.lastSeen || null,
    })),
    ...((fullContact?.addresses || []).map(a => ({
      street: a.street || a.address || '',
      city: a.city || '',
      state: a.state || '',
      zip: a.zip || '',
      firstSeen: a.firstSeen || null,
      lastSeen: a.lastSeen || null,
    }))),
  ];
  const addresses = dedup(rawAddresses, a => `${a.city}|${a.state}|${a.zip}|${a.street}`);
  const currentLocation = addresses.length > 0
    ? [addresses[0].city, addresses[0].state].filter(Boolean).join(', ')
    : '';

  // Phones — merge phoneList + fullContact.phones
  const rawPhones = [
    ...(primary.phoneList || []).map(p => ({
      number: p.number || p.value || (typeof p === 'string' ? p : ''),
      type: p.type || p.phoneType || '',
      carrier: p.carrier || '',
      firstSeen: p.meta?.firstSeen || p.firstSeen || null,
      lastSeen: p.meta?.lastSeen || p.lastSeen || null,
    })),
    ...((fullContact?.phones || fullContact?.phoneNumbers || []).map(p => ({
      number: p.number || p.value || (typeof p === 'string' ? p : ''),
      type: p.type || '',
      carrier: p.carrier || '',
      firstSeen: p.firstSeen || null,
      lastSeen: p.lastSeen || null,
    }))),
  ].filter(p => p.number);
  const phones = dedup(rawPhones, p => p.number.replace(/\D/g, ''));

  // Emails
  const rawEmails = [
    ...(primary.emailList || []).map(e => ({
      address: e.address || e.email || e.value || (typeof e === 'string' ? e : ''),
      type: e.type || '',
      firstSeen: e.meta?.firstSeen || e.firstSeen || null,
      lastSeen: e.meta?.lastSeen || e.lastSeen || null,
    })),
    ...((fullContact?.emails || fullContact?.emailAddresses || []).map(e => ({
      address: e.address || e.email || e.value || (typeof e === 'string' ? e : ''),
      type: e.type || '',
      firstSeen: e.firstSeen || null,
      lastSeen: e.lastSeen || null,
    }))),
  ].filter(e => e.address);
  const emails = dedup(rawEmails, e => e.address.toLowerCase());

  // Relatives
  const rawRelatives = [
    ...(primary.relationList || []).map(r => ({
      name: r.name || r.fullName || r.data || '',
      relationship: r.relation || r.relationship || r.type || '',
      age: r.age || '',
      location: [r.city, r.state].filter(Boolean).join(', '),
    })),
    ...((fullContact?.relatives || fullContact?.associates || []).map(r => ({
      name: r.name || r.fullName || '',
      relationship: r.relationship || r.type || '',
      age: r.age || '',
      location: [r.city, r.state].filter(Boolean).join(', '),
    }))),
  ].filter(r => r.name);
  const relatives = dedup(rawRelatives, r => r.name.toLowerCase());

  // Employment
  const jobs = (primary.jobList || fullContact?.employments || []).map(j => ({
    employer: j.employer || j.company || j.organization || '',
    title: j.title || j.position || '',
    city: j.city || '',
    state: j.state || '',
    start: j.start || j.startDate || null,
    end: j.end || j.endDate || null,
  })).filter(j => j.employer);

  // Education
  const education = (primary.educationList || fullContact?.educations || []).map(e => ({
    school: e.school || e.organization || '',
    degree: e.degree || e.major || '',
    start: e.start || null,
    end: e.end || null,
  })).filter(e => e.school);

  // Social
  const rawSocial = [
    ...(primary.socialList || []),
    ...(fullContact?.socialProfiles || fullContact?.social || []),
  ].map(sp => ({
    network: sp.network || sp.type || sp.platform || '',
    url: sp.url || '',
    username: sp.username || sp.handle || sp.id || '',
  })).filter(sp => sp.network || sp.url);
  const social = dedup(rawSocial, sp => (sp.url || sp.network + sp.username).toLowerCase());

  // Family Watchdog
  const offenders = familyWatchdog?.offenders || (Array.isArray(familyWatchdog) ? familyWatchdog : []);

  return {
    fullName, aliases, dob, age, gender, provider,
    currentLocation, addresses, phones, emails, relatives,
    jobs, education, social, offenders,
  };
}

function dedup(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ─── Formatting helpers ───────────────────────────────────────────────── */

function fmtPhone(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

function formatDateRange(first, last) {
  const fmt = (v) => {
    if (!v) return null;
    const s = String(v);
    if (s.length === 8) return `${s.slice(0, 4)}`;
    if (s.length === 4) return s;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.getFullYear().toString();
    return null;
  };
  const f = fmt(first);
  const l = fmt(last);
  if (f && l && f !== l) return `${f}–${l}`;
  if (f) return `Since ${f}`;
  if (l) return `Until ${l}`;
  return '—';
}

/* ─── Styles ───────────────────────────────────────────────────────────── */

const styles = {
  main: { padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  loadingBox: { textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  spinner: {
    width: '2rem', height: '2rem', borderRadius: '50%',
    border: '3px solid #e5e7eb', borderTopColor: '#0d5d2f',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: { padding: '2rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem' },

  // Header
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexWrap: 'wrap', gap: '1rem',
    marginBottom: '1.5rem', paddingBottom: '1.5rem',
    borderBottom: '2px solid #e5e7eb',
  },
  breadcrumb: { margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#9ca3af' },
  breadcrumbBtn: { background: 'none', border: 'none', color: '#0d5d2f', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' },
  personName: { margin: '0 0 0.75rem', fontSize: '2rem', fontWeight: 700, color: '#0e123b' },
  headerMeta: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  metaBadge: {
    display: 'inline-block', padding: '0.25rem 0.75rem',
    backgroundColor: '#f1f5f9', borderRadius: '99px',
    fontSize: '0.8125rem', color: '#374151',
  },
  headerActions: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  btnPdf: {
    padding: '0.625rem 1.25rem', backgroundColor: '#0d5d2f', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap',
  },
  btnPrimary: {
    padding: '0.5rem 1rem', backgroundColor: '#0e123b', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
  },
  btnSecondary: {
    padding: '0.5rem 1rem', backgroundColor: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
  },
  pdfErrorBanner: {
    margin: '0 0 1rem', padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2', color: '#991b1b',
    borderRadius: '6px', fontSize: '0.875rem',
  },

  // Summary
  summaryBar: {
    display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
    marginBottom: '1.5rem', padding: '1rem 1.25rem',
    backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0',
  },
  statBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px', flex: '1' },
  statNum: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: '0.7rem', color: '#6b7280', textAlign: 'center', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },

  // Grid
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' },

  // Cards / sections
  card: { backgroundColor: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' },
  sectionNum: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.75rem', height: '1.75rem', backgroundColor: '#0d5d2f', color: '#fff', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' },

  // Tables
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', padding: '0.5rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' },
  td: { padding: '0.625rem 1.25rem', color: '#374151', verticalAlign: 'top', borderBottom: '1px solid #f3f4f6' },

  // Field grid
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.25rem', padding: '1rem 1.25rem' },
  fieldBox: { padding: '0.5rem' },
  fieldLabel: { margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  fieldValue: { margin: 0, fontSize: '0.9375rem', color: '#111827', fontWeight: 500 },

  // List items (jobs, education, social)
  listItem: { padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6' },
  listItemTitle: { margin: '0 0 0.25rem', fontWeight: 600, color: '#111827', fontSize: '0.9375rem' },
  listItemSub: { margin: '0 0 0.125rem', color: '#374151', fontSize: '0.875rem' },
  listItemMeta: { margin: 0, color: '#6b7280', fontSize: '0.8125rem' },
  link: { color: '#1d4ed8', fontSize: '0.875rem', wordBreak: 'break-all' },

  // Family Watchdog
  clearBanner: { display: 'flex', alignItems: 'center', margin: '1rem 1.25rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', color: '#15803d', fontWeight: 500 },
  warnBanner: { margin: '1rem 1.25rem 0', padding: '0.75rem 1rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', color: '#c2410c' },
  offenderCard: { margin: '0.75rem 1.25rem', padding: '0.875rem 1rem', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem' },
  offenderField: { margin: '0.25rem 0 0', color: '#6b7280' },
};

export default SearchResultDetailPage;
