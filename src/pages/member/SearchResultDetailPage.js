import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportDetail, createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext, getSearchContext } from '../../services/searchContext';
import { extractAll, formatDateRange, fmtPhone, residenceDuration } from '../../utils/reportExtract';
import ProfileView, { styles } from '../../components/ProfileView';
import MyProfileModular from '../../components/MyProfileModular';
import { fetchBookings, corroboratePerson, cleanReleaseStatus } from '../../services/incarcerationService';
import MarriageDivorceSection from '../../components/MarriageDivorceSection';
import { fetchLifeEvents } from '../../services/lifeEventsService';
import { enrichFromReport } from '../../services/memberEnrichment';
import { captureProfileView } from '../../services/searchActivity';
import { track } from '../../services/trackingService';

/**
 * Shows a detailed report for a selected person.
 * Layout inspired by the branded PDF report format — sections mirror the
 * professional report structure: summary, personal info, addresses, phones,
 * emails, relatives, employment/education, social, family watchdog.
 */
const SearchResultDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfErrorDetails, setPdfErrorDetails] = useState(null);
  const lastTrackedRef = useRef(null);
  const enrichedRef = useRef(false);

  // WSFY self-report enrichment: if this report is confidently about the member themselves
  // (name AND state match — strict, to avoid enriching from a same-name stranger's report),
  // extract occupation/relatives and store them. One-shot, best-effort.
  useEffect(() => {
    if (enrichedRef.current || !report || !user) return;
    let data;
    try { data = extractAll(report); } catch { return; }
    const nrm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const memberName = nrm(`${user.firstName || ''} ${user.lastName || ''}`);
    const memberState = String(user.state || '').trim().toUpperCase();
    if (!memberName || nrm(data.fullName) !== memberName) return;
    const stateMatch = memberState && (data.addresses || []).some((a) => String(a.state || '').toUpperCase() === memberState);
    if (!stateMatch) return; // require a location signal to be confident it's really them
    enrichedRef.current = true;
    enrichFromReport(report);
  }, [report, user]);

  useEffect(() => {
    if (id && id !== 'undefined' && id !== 'null') {
      track('report_view', { commerceContentId: id });
    }
  }, [id]);

  // Capture a PROFILE VIEW (feeds "who viewed my profile"). One-shot per report. Skip self-views
  // (viewing your OWN profile isn't a signal about you). Fire-and-forget, server-side only.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || !report) return;
    let data;
    try { data = extractAll(report); } catch { return; }
    if (!data.fullName) return;
    const nrm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const memberName = user ? nrm(`${user.firstName || ''} ${user.lastName || ''}`) : '';
    if (memberName && nrm(data.fullName) === memberName) return; // own profile — not signal
    viewedRef.current = true;
    const parts = String(data.fullName).trim().split(/\s+/);
    const subjState = (Array.isArray(data.addresses) && data.addresses[0] && data.addresses[0].state) || '';
    captureProfileView({
      subject: {
        name: data.fullName,
        first: parts[0] || null,
        last: parts.length > 1 ? parts[parts.length - 1] : null,
        state: subjState || null,
        profileId: id || null,
      },
      source: 'app',
    });
  }, [report, user, id]);

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
        const isAuthError = err?.message?.includes('403') || err?.httpStatus === 403 || err?.status === 403;
        // Capture diagnostic info: console.* is stripped in production, so
        // surface the upstream response on window and (collapsed) in the UI
        // so QA/BC can see what BC actually returned without dev console access.
        const details = {
          when: new Date().toISOString(),
          requestId: id,
          message: err?.message || String(err),
          httpStatus: err?.httpStatus ?? err?.status ?? null,
          upstreamResponse: err?.upstreamResponse ?? null,
          originalError: err?.originalError?.message || null,
        };
        try {
          if (typeof window !== 'undefined') {
            window._lastReportError = { ...details, errorObject: err };
          }
        } catch {}
        setErrorDetails(details);
        setError(
          isAuthError
            ? 'Your session has expired or needs to be refreshed. Please log out and log back in to view reports.'
            : 'We could not load this report right now. Please try again later.'
        );
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
    setPdfErrorDetails(null);
    try {
      await api.downloadPdfReport(commerceContentId);
      // BC library opens a native download popup — nothing more to do on success
    } catch (err) {
      // Same diagnostic pattern as report-detail load — console.* is stripped
      // in prod, so surface the upstream response on window and (collapsed) in
      // the UI so QA can see what BC returned.
      const details = {
        when: new Date().toISOString(),
        commerceContentId,
        message: err?.message || String(err),
        httpStatus: err?.httpStatus ?? err?.status ?? null,
        isCorsError: !!err?.isCorsError,
        upstreamResponse: err?.upstreamResponse ?? null,
        originalError: err?.originalError?.message || null,
      };
      try {
        if (typeof window !== 'undefined') {
          window._lastPdfError = { ...details, errorObject: err };
        }
      } catch {}
      setPdfErrorDetails(details);
      setPdfError(err?.message || 'PDF download failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Data extraction ───────────────────────────────────────────────────────
  const data = report ? extractAll(report) : null;
  // Report renders as the modular Profile (others mode, paid tier → full detail, no data loss). The
  // exhaustive grid stays available via a "Full details" toggle.
  const [reportView, setReportView] = useState('profile'); // 'profile' | 'details'

  // First-party incarceration/court records → MERGED into the report's "Legal & Court Records" section (owner
  // 2026-07-19), not a separate block. TIGHT match (age±1 + gender when known) so a same-name stranger isn't
  // attributed. Mapped to the CriminalCard shape (photo/description/disposition/physical) + first-party markers.
  const [incRows, setIncRows] = useState([]);
  useEffect(() => {
    let alive = true;
    const nm = data && data.fullName;
    const parts = String(nm || '').trim().split(/\s+/).filter(Boolean);
    const st = (data && Array.isArray(data.addresses) && data.addresses[0] && data.addresses[0].state)
      || (String((data && data.currentLocation) || '').match(/,\s*([A-Za-z]{2})\b/) || [])[1] || '';
    if (parts.length < 2 || !st) { setIncRows([]); return undefined; }
    fetchBookings({ firstName: parts[0], lastName: parts[parts.length - 1], state: st, age: data.age })
      .then((r) => {
        if (!alive) return;
        setIncRows((r.records || [])
          .map((rec) => { const m = corroboratePerson(rec, { age: data.age, gender: data.gender }); return m ? { rec, strength: m.strength } : null; })
          .filter(Boolean)
          .map(({ rec, strength }) => {
            const isCourt = rec.recordType === 'court';
            return {
              id: `inc-${rec.source || ''}-${rec.inmateId || rec.name}`,
              _firstParty: true, _recordType: rec.recordType, _strength: strength, source: rec.sourceName || rec.source,
              photo: rec.mugshotUrl || null,
              description: isCourt ? 'Court record' : ((rec.charges && rec.charges.length) ? rec.charges.join('; ') : 'Incarceration record'),
              name: rec.name, physical: { sex: rec.gender, race: rec.race },
              disposition: [cleanReleaseStatus(rec.releaseStatus, rec.recordType), rec.facility].filter(Boolean).join(' · ') || null,
            };
          }));
      })
      .catch(() => { if (alive) setIncRows([]); });
    return () => { alive = false; };
  }, [data && data.fullName, data && data.age, data && data.gender]);
  // Life-events (divorce/marriage + sex-offender) for this report subject — ONE fetch feeds three uses: the
  // Marriage & Divorce section, the Sex-Offender section (tight-corroborated), and the relatives enrichment.
  const [lifeEvents, setLifeEvents] = useState([]);
  useEffect(() => {
    let alive = true;
    const parts = String((data && data.fullName) || '').trim().split(/\s+/).filter(Boolean);
    const st = (data && Array.isArray(data.addresses) && data.addresses[0] && data.addresses[0].state)
      || (String((data && data.currentLocation) || '').match(/,\s*([A-Za-z]{2})\b/) || [])[1] || '';
    if (parts.length < 2 || !st) { setLifeEvents([]); return undefined; }
    // sexOffender NOT requested on the report (owner 2026-07-19): name-attributing a fuzzy alias match to a
    // searched person is the weak/risky use. Sex-offender is repurposed to a LOCATION-based "near you" safety
    // feature on the member's OWN profile (NSOPW zip/GPS) — see docs/design/life-events-data-mapping.md.
    fetchLifeEvents({ firstName: parts[0], lastName: parts[parts.length - 1], state: st, age: data.age, gender: data.gender })
      .then((r) => { if (alive) setLifeEvents(r.records || []); })
      .catch(() => { if (alive) setLifeEvents([]); });
    return () => { alive = false; };
  }, [data && data.fullName, data && data.age, data && data.gender]);

  const marriageDivorceRecords = lifeEvents.filter((r) => r.recordType === 'divorce' || r.recordType === 'marriage');
  // Relationship enrichment: fold ex-spouse (divorce) / spouse (marriage) into the relatives list.
  const _relNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const spouseRelatives = marriageDivorceRecords
    .map((r) => { const nm = r.recordType === 'divorce' ? r.exSpouseName : r.spouseName; return nm ? { name: nm, relationship: r.recordType === 'divorce' ? 'Ex-spouse' : 'Spouse', state: r.state } : null; })
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex((x) => _relNorm(x.name) === _relNorm(s.name)) === i);

  const mergedData = data ? {
    ...data,
    criminalRecords: [...(data.criminalRecords || []), ...incRows],
    relatives: [...(data.relatives || []), ...spouseRelatives.filter((s) => !(data.relatives || []).some((rel) => _relNorm(rel.name) === _relNorm(s.name)))],
  } : data;

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
          {errorDetails && (
            <details style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: '#475569' }}>
              <summary style={{ cursor: 'pointer', color: '#0d5d2f' }}>Show technical details</summary>
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <div><strong>When:</strong> {errorDetails.when}</div>
                <div><strong>Report ID:</strong> {errorDetails.requestId}</div>
                <div><strong>HTTP status:</strong> {errorDetails.httpStatus ?? 'n/a'}</div>
                <div><strong>Message:</strong> {errorDetails.message}</div>
                {errorDetails.originalError && (
                  <div><strong>Original error:</strong> {errorDetails.originalError}</div>
                )}
                <div style={{ marginTop: '0.5rem' }}><strong>Upstream response:</strong></div>
                <pre style={{
                  margin: '0.25rem 0 0',
                  padding: '0.5rem',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  maxHeight: 240,
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {(() => {
                    try {
                      const s = JSON.stringify(errorDetails.upstreamResponse, null, 2);
                      return s && s.length > 4000 ? s.slice(0, 4000) + '\n…(truncated)' : (s || 'No upstream payload captured.');
                    } catch {
                      return String(errorDetails.upstreamResponse);
                    }
                  })()}
                </pre>
                <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
                  This panel surfaces what BC returned for this request. In DevTools console, <code>window._lastReportError</code> has the full error object.
                </p>
              </div>
            </details>
          )}
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
          {/* Profile (modular) vs Full details (exhaustive grid) — profile is the default presentation. */}
          <div style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {[{ k: 'profile', label: 'Profile' }, { k: 'details', label: 'Full details' }].map((t) => (
              <button key={t.k} type="button" onClick={() => setReportView(t.k)}
                style={{ border: 'none', background: reportView === t.k ? '#0d5d2f' : '#fff', color: reportView === t.k ? '#fff' : '#374151', fontSize: 13, fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
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
        <div style={styles.pdfErrorBanner}>
          <div>{pdfError}</div>
          {pdfErrorDetails && (
            <details style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
              <summary style={{ cursor: 'pointer', color: '#0d5d2f' }}>Show technical details</summary>
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', color: '#111827' }}>
                <div><strong>When:</strong> {pdfErrorDetails.when}</div>
                <div><strong>Report ID:</strong> {pdfErrorDetails.commerceContentId}</div>
                <div><strong>HTTP status:</strong> {pdfErrorDetails.httpStatus ?? 'n/a'}</div>
                <div><strong>CORS error:</strong> {pdfErrorDetails.isCorsError ? 'yes' : 'no'}</div>
                <div><strong>Message:</strong> {pdfErrorDetails.message}</div>
                {pdfErrorDetails.originalError && (
                  <div><strong>Original error:</strong> {pdfErrorDetails.originalError}</div>
                )}
                <div style={{ marginTop: '0.5rem' }}><strong>Upstream response:</strong></div>
                <pre style={{
                  margin: '0.25rem 0 0',
                  padding: '0.5rem',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {(() => {
                    try {
                      const s = JSON.stringify(pdfErrorDetails.upstreamResponse, null, 2);
                      return s && s.length > 4000 ? s.slice(0, 4000) + '\n…(truncated)' : (s || 'No upstream payload captured.');
                    } catch {
                      return String(pdfErrorDetails.upstreamResponse);
                    }
                  })()}
                </pre>
                <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
                  <code>window._lastPdfError</code> in DevTools console has the full error object.
                </p>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Incarceration/court records are MERGED into the report body's "Legal & Court Records" section
          (via mergedData.criminalRecords) — no separate top block. */}
      {reportView === 'profile' ? (
        <MyProfileModular
          data={mergedData}
          hero={{ name: data.fullName, age: data.age, location: data.currentLocation }}
          mode="others"
          viewerTier="paid"
        />
      ) : (
        <ProfileView data={mergedData} viewer="paid" />
      )}

      {/* Marriage & Divorce (relationship data) from the life-events fetch; ex-spouse also folded into Relatives
          above. Sex-offender is NOT here — repurposed to a location-based "near you" feature on the member's profile. */}
      <MarriageDivorceSection records={marriageDivorceRecords} />
    </main>
  );
};

export default SearchResultDetailPage;
