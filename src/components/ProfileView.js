import React from 'react';
import { formatDateRange, fmtPhone, residenceDuration } from '../utils/reportExtract';

/**
 * ProfileView — the shared, reusable render of a person's full report AS A PROFILE (extractAll output).
 * Pure presentational: takes `data` (extractAll(report)) and renders the summary + all sections. The
 * `viewer` prop is a documented NO-OP seam for later viewer-state projection (anonymous/free/paid/owner);
 * this extraction is byte-identical to the prior inline render on SearchResultDetailPage.
 * See docs/design/profile-concept-model.md.
 */
export default function ProfileView({ data, viewer = 'paid' }) { // eslint-disable-line no-unused-vars
  if (!data) return null;
  return (
    <>
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
                  <Th>County</Th>
                  <Th>Dates</Th>
                </tr>
              </thead>
              <tbody>
                {data.addresses.map((addr, i) => {
                  const dur = residenceDuration(addr.firstSeen, addr.lastSeen);
                  const mapQ = encodeURIComponent(addr.full || [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '));
                  // `street` (from BC's `complete`) often already includes the unit —
                  // only append apt when it isn't already there, to avoid "ST APT 2, APT 2".
                  const showApt = addr.apt && !(addr.street || '').toUpperCase().includes(addr.apt.toUpperCase());
                  return (
                    <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                      <Td>
                        {i === 0 && <span style={styles.currentBadge}>Current</span>}
                        {addr.street || '—'}{showApt ? `, ${addr.apt}` : ''}
                        {mapQ && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`} target="_blank" rel="noopener noreferrer"
                            style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none' }}>map ↗</a>
                        )}
                      </Td>
                      <Td>{addr.city || '—'}</Td>
                      <Td>{addr.state || '—'}</Td>
                      <Td>{addr.zip ? (addr.zip4 ? `${addr.zip}-${addr.zip4}` : addr.zip) : '—'}</Td>
                      <Td>{addr.county || '—'}</Td>
                      <Td>
                        {formatDateRange(addr.firstSeen, addr.lastSeen)}
                        {dur && <span style={{ color: '#6b7280' }}> · {dur}</span>}
                      </Td>
                    </tr>
                  );
                })}
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
                  <Th>Status</Th>
                  <Th>Dates</Th>
                </tr>
              </thead>
              <tbody>
                {data.phones.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? {} : { backgroundColor: '#f9fafb' }}>
                    <Td>
                      {i === 0 && <span style={styles.currentBadge}>Current</span>}
                      <strong>{fmtPhone(p.number)}</strong>
                    </Td>
                    <Td>{p.type || '—'}</Td>
                    <Td>{p.carrier || '—'}</Td>
                    <Td>
                      {[p.business && 'Business', p.disconnected && 'Disconnected'].filter(Boolean).join(' · ') || '—'}
                    </Td>
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

        {/* Section 9 — Property Records */}
        {data.properties && data.properties.length > 0 && (
          <Section number="9" title={`Property Records (${data.properties.length})`} fullWidth>
            {data.properties.map((p) => <PropertyCard key={p.id} property={p} />)}
          </Section>
        )}

        {/* Section 10 — Professional Licences */}
        {data.professionalLicenses && data.professionalLicenses.length > 0 && (
          <Section number="10" title={`Professional Licences (${data.professionalLicenses.length})`}>
            {data.professionalLicenses.map((l) => <LicenseRow key={l.id} license={l} />)}
          </Section>
        )}

        {/* Section 11 — Legal & Court Records (criminal) */}
        {data.criminalRecords && data.criminalRecords.length > 0 && (
          <Section number="11" title={`Legal & Court Records (${data.criminalRecords.length})`} fullWidth>
            {data.criminalRecords.map((c) => <CriminalCard key={c.id} record={c} />)}
          </Section>
        )}

        {/* Section 12 — Arrests & Watchlists (arrests + arrestWatch) */}
        {((data.arrests && data.arrests.length > 0) || (data.arrestWatch && data.arrestWatch.length > 0)) && (
          <Section number="12" title={`Arrests & Watchlist Records (${(data.arrests?.length || 0) + (data.arrestWatch?.length || 0)})`} fullWidth>
            {data.arrests?.map((a) => (
              <div key={a.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>{a.charge || 'Arrest record'}</p>
                <p style={styles.listItemSub}>
                  {[a.date, a.sourceState, a.sourceName].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {data.arrestWatch?.map((a) => (
              <div key={a.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>{a.description || 'Watchlist hit'}</p>
                {a.date && <p style={styles.listItemSub}>{a.date}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Section 13 — Financial Records (liens, judgments, foreclosures, bankruptcies) */}
        {((data.liens?.length || 0) + (data.judgments?.length || 0) + (data.foreclosures?.length || 0) + (data.bankruptcies?.length || 0)) > 0 && (
          <Section
            number="13"
            title={`Financial Records (${(data.liens?.length || 0) + (data.judgments?.length || 0) + (data.foreclosures?.length || 0) + (data.bankruptcies?.length || 0)})`}
            fullWidth
          >
            {[...(data.liens || []), ...(data.judgments || []), ...(data.foreclosures || []), ...(data.bankruptcies || [])].map((rec) => (
              <FinancialRecordCard key={rec.id} record={rec} />
            ))}
          </Section>
        )}

        {/* Section 14 — Other Public Records (driver, veteran, business, death) */}
        {((data.driverLicenses?.length || 0) + (data.veteranRecords?.length || 0) + (data.businesses?.length || 0) + (data.deaths?.length || 0)) > 0 && (
          <Section
            number="14"
            title="Other Public Records"
            fullWidth
          >
            {data.driverLicenses?.map((d) => (
              <div key={d.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>Driver's Licence {d.state ? `(${d.state})` : ''}</p>
                <p style={styles.listItemSub}>
                  {[d.number && `# ${d.number}`, d.issued && `Issued ${d.issued}`, d.expires && `Expires ${d.expires}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {data.veteranRecords?.map((v) => (
              <div key={v.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>Veteran Record</p>
                <p style={styles.listItemSub}>
                  {[v.branch, v.rank, v.serviceDates].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {data.businesses?.map((b) => (
              <div key={b.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>{b.name || 'Business affiliation'}</p>
                <p style={styles.listItemSub}>
                  {[b.role, b.address, b.state].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {data.deaths?.map((d) => (
              <div key={d.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>Death Record</p>
                <p style={styles.listItemSub}>
                  {[d.date, d.state, d.sourceName].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </Section>
        )}

        {/* Section 15 — Watchlist Checks (sanctions, fraud) */}
        {((data.sanctions?.length || 0) + (data.fraudFlags?.length || 0)) > 0 && (
          <Section
            number="15"
            title="Sanctions & Fraud Watchlist Checks"
            fullWidth
          >
            {data.sanctions?.map((s) => (
              <div key={s.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>{s.list || 'Sanctions list match'}</p>
                <p style={styles.listItemSub}>
                  {[s.program, s.date].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {data.fraudFlags?.map((f) => (
              <div key={f.id} style={styles.listItem}>
                <p style={styles.listItemTitle}>{f.flag || 'Fraud flag'}</p>
                <p style={styles.listItemSub}>
                  {[f.source, f.date].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </Section>
        )}

        {/* Section 16 — Sex Offender Registry Check (always shown) */}
        <Section number="16" title="Sex Offender Registry Check" fullWidth>
          <FamilyWatchdogSection offenders={data.offenders} />
        </Section>

        {/* Section 17 — Secondary Identities */}
        {data.secondaryIdentities.length > 0 && (
          <Section number="17" title={`Additional Identities (${data.secondaryIdentities.length})`} fullWidth>
            <p style={{ margin: '0.5rem 1.25rem 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
              Other records associated with this person's identity.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', padding: '0 1.25rem 1.25rem' }}>
              {data.secondaryIdentities.map((ident, i) => (
                <SecondaryIdentityCard key={i} identity={ident} />
              ))}
            </div>
          </Section>
        )}

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
    </>
  );
}

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

const SECTION_ICONS = {
  '1': 'person',
  '2': 'home',
  '3': 'phone',
  '4': 'email',
  '5': 'people',
  '6': 'work',
  '7': 'school',
  '8': 'share',
  '9': 'shield',
  '10': 'badge',
};

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

/* ─── Secondary Identity Card ──────────────────────────────────────────── */

/* ─── PropertyCard ─────────────────────────────────────────────────────── */
const PropertyCard = ({ property }) => {
  const p = property;
  const addressLine = [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
  const usd = (v) => `$${Number(v).toLocaleString()}`;
  // Full transfer history (newest-first). Fall back to the single lastSale for
  // any data path that didn't populate the array.
  const history = Array.isArray(p.history) && p.history.length
    ? p.history
    : (p.lastSale ? [p.lastSale] : []);
  return (
    <div style={{ ...styles.listItem, padding: '0.875rem 1.25rem' }}>
      <p style={styles.listItemTitle}>
        {addressLine || 'Property record'}
        {p.foreclosure && <span style={{ marginLeft: '0.5rem', padding: '0.125rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#fff', background: '#b91c1c', borderRadius: '0.25rem' }}>FORECLOSURE</span>}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem 1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
        {p.owner && <div style={{ gridColumn: 'span 2' }}><strong>Owner:</strong> {p.owner}</div>}
        {p.ownershipStatus && <div><strong>Ownership:</strong> {p.ownershipStatus}</div>}
        {p.useCode && <div><strong>Use:</strong> {p.useCode}</div>}
        {p.assessedValue && <div><strong>Assessed:</strong> {usd(p.assessedValue)} {p.assessedYear && `(${p.assessedYear})`}</div>}
        {p.marketValue && <div><strong>Market:</strong> {usd(p.marketValue)}</div>}
        {p.landValue && <div><strong>Land value:</strong> {usd(p.landValue)}</div>}
        {p.improvementValue && <div><strong>Improvements:</strong> {usd(p.improvementValue)}</div>}
        {p.totalTax && <div><strong>Annual tax:</strong> {usd(p.totalTax)}</div>}
        {p.bedCount && <div><strong>Beds:</strong> {p.bedCount}</div>}
        {p.bathCount && <div><strong>Baths:</strong> {p.bathCount}</div>}
        {p.yearBuilt && <div><strong>Built:</strong> {p.yearBuilt}</div>}
        {p.buildingSqft && <div><strong>Building:</strong> {Number(p.buildingSqft).toLocaleString()} sqft</div>}
        {p.lotSqft && <div><strong>Lot:</strong> {Number(p.lotSqft).toLocaleString()} sqft</div>}
        {p.apn && <div><strong>Parcel #:</strong> {p.apn}</div>}
        {p.county && <div><strong>County:</strong> {p.county}</div>}
        {p.subdivision && <div><strong>Subdivision:</strong> {p.subdivision}</div>}
        {p.propertyDescription && <div style={{ gridColumn: 'span 2' }}><strong>Legal description:</strong> {p.propertyDescription}</div>}
        {p.mailingAddress && <div style={{ gridColumn: 'span 2' }}><strong>Owner mailing:</strong> {p.mailingAddress}</div>}
      </div>
      {history.length > 0 && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.625rem' }}>
          <p style={{ margin: '0 0 0.375rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
            Transfer history{history.length > 1 ? ` (${history.length})` : ''}
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {history.map((h, i) => {
              const extra = [
                h.transferType && h.deedType,
                h.docNumber && `Doc ${h.docNumber}`,
                h.loanValue && `Loan ${usd(h.loanValue)}${h.loanType ? ` (${h.loanType})` : ''}${h.interestRate ? ` @ ${h.interestRate.toFixed(2)}%` : ''}`,
                !h.loanValue && h.loanType,
                h.armsLength && `Arm's-length: ${h.armsLength}`,
                h.quitclaim === 'Yes' && 'Quitclaim',
              ].filter(Boolean);
              return (
                <li key={i} style={{ fontSize: '0.82rem', color: '#4b5563', borderLeft: '2px solid #e5e7eb', paddingLeft: '0.625rem' }}>
                  <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '5.5rem', fontWeight: 600, color: '#111827' }}>{h.date || '—'}</span>
                    {h.salesPrice ? <span style={{ fontWeight: 600, color: '#111827' }}>{usd(h.salesPrice)}</span> : null}
                    <span>{[h.transferType || h.deedType, h.seller && `from ${h.seller}`, h.buyer && `to ${h.buyer}`].filter(Boolean).join(' · ') || 'Transfer'}</span>
                    {h.isCurrentOwner && <span style={{ padding: '0.05rem 0.4rem', fontSize: '0.65rem', fontWeight: 600, color: '#065f46', background: '#d1fae5', borderRadius: '0.25rem' }}>CURRENT OWNER</span>}
                  </div>
                  {extra.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>{extra.join(' · ')}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ─── LicenseRow ──────────────────────────────────────────────────────── */
const LicenseRow = ({ license }) => {
  const l = license;
  return (
    <div style={{ ...styles.listItem, padding: '0.875rem 1.25rem' }}>
      <p style={styles.listItemTitle}>
        {l.profession || 'Professional Licence'} {l.state && `(${l.state})`}
        {l.status && <span style={{ marginLeft: '0.5rem', padding: '0.125rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#fff', background: l.status.toUpperCase() === 'ACTIVE' ? '#15803d' : '#6b7280', borderRadius: '0.25rem' }}>{l.status}</span>}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem 1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
        {l.licenseNumber && <div><strong>License #:</strong> {l.licenseNumber}</div>}
        {l.board && <div style={{ gridColumn: 'span 2' }}><strong>Board:</strong> {l.board}</div>}
        {l.issued && <div><strong>Issued:</strong> {l.issued}</div>}
        {l.registered && <div><strong>Registered:</strong> {l.registered}</div>}
        {l.expires && <div><strong>Expires:</strong> {l.expires}</div>}
        {l.recordDate && <div><strong>Record date:</strong> {l.recordDate}</div>}
        {l.person && <div><strong>Name on record:</strong> {l.person}</div>}
        {l.business && <div style={{ gridColumn: 'span 2' }}><strong>Business:</strong> {l.business}</div>}
        {l.address && <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {l.address}</div>}
        {l.phone && <div><strong>Phone:</strong> {l.phone}</div>}
        {l.email && <div><strong>Email:</strong> {l.email}</div>}
        {l.url && <div style={{ gridColumn: 'span 2' }}><strong>URL:</strong> {l.url}</div>}
      </div>
    </div>
  );
};

/* ─── CriminalCard ────────────────────────────────────────────────────── */
const CriminalCard = ({ record }) => {
  const r = record;
  return (
    <div style={{ ...styles.listItem, padding: '0.875rem 1.25rem', display: 'flex', gap: '1rem' }}>
      {r.photo && (
        <img
          src={r.photo}
          alt={r.name ? `${r.name} booking photo` : 'Booking photo'}
          style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: '0.375rem', flexShrink: 0, background: '#e5e7eb' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={styles.listItemTitle}>
          {r.description || r.caseType || r.category || 'Court record'}
          {r.counts && <span style={{ fontWeight: 400, color: '#6b7280' }}> · count {r.counts}</span>}
        </p>
        {r._firstParty && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '3px 0 5px', alignItems: 'center' }}>
            {r._recordType === 'court'
              ? <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '2px 8px' }}>Court record</span>
              : <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '2px 8px' }}>Incarceration record</span>}
            <span title={r._strength === 'strong' ? 'Age and gender both match this profile' : 'Age matches; gender not confirmed'} style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...(r._strength === 'strong' ? { color: '#166534', background: '#dcfce7' } : { color: '#64748b', background: '#f1f5f9' }) }}>{r._strength === 'strong' ? 'Strong match' : 'Possible match'}</span>
            {r.source && <span style={{ fontSize: 11, color: '#94a3b8' }}>{r.source}</span>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
          {r.name && <div style={{ gridColumn: 'span 2' }}><strong>Name on record:</strong> {r.name}</div>}
          {r.physical && (
            <div style={{ gridColumn: 'span 2' }}>
              <strong>Description:</strong> {[
                r.physical.sex, r.physical.race,
                r.physical.height && `Ht ${r.physical.height}`,
                r.physical.weight && `Wt ${r.physical.weight}`,
                r.physical.hairColor && `Hair ${r.physical.hairColor}`,
                r.physical.eyeColor && `Eyes ${r.physical.eyeColor}`,
                r.physical.skinTone && `Skin ${r.physical.skinTone}`,
                r.physical.birthState && `Born ${r.physical.birthState}`,
              ].filter(Boolean).join(' · ')}
            </div>
          )}
          {r.caseNumber && <div><strong>Case #:</strong> {r.caseNumber}</div>}
          {r.offenseDate && <div><strong>Offense:</strong> {r.offenseDate}</div>}
          {r.chargesFiledDate && <div><strong>Charges filed:</strong> {r.chargesFiledDate}</div>}
          {r.convictionDate && <div><strong>Convicted:</strong> {r.convictionDate}</div>}
          {r.commitmentDate && <div><strong>Committed:</strong> {r.commitmentDate}</div>}
          {r.sentence && <div><strong>Sentence:</strong> {r.sentence}</div>}
          {r.releaseDate && <div><strong>Release:</strong> {r.releaseDate}</div>}
          {r.disposition && (
            <div style={{ gridColumn: 'span 2' }}>
              <strong>Disposition:</strong> {r.disposition}
              {r.dispositionDate && ` (${r.dispositionDate})`}
            </div>
          )}
          {r.amendedDispositionDate && <div><strong>Amended disposition:</strong> {r.amendedDispositionDate}</div>}
          {r.court && <div><strong>Court:</strong> {r.court}</div>}
          {r.county && <div><strong>County / jurisdiction:</strong> {r.county}</div>}
          {r.caseType && <div><strong>Case type:</strong> {r.caseType}</div>}
          {r.category && <div><strong>Category:</strong> {r.category}</div>}
          {r.offenseCode && <div><strong>Statute / code:</strong> {r.offenseCode}</div>}
          {r.plea && <div><strong>Plea:</strong> {r.plea}</div>}
          {r.fines && <div><strong>Fines:</strong> {r.fines}</div>}
          {r.arrestDate && <div><strong>Arrest date:</strong> {r.arrestDate}</div>}
          {r.warrantDate && <div><strong>Warrant date:</strong> {r.warrantDate}</div>}
          {r.supervisionDate && <div><strong>Supervision date:</strong> {r.supervisionDate}</div>}
          {r.marks && r.marks.length > 0 && <div style={{ gridColumn: 'span 2' }}><strong>Marks/scars:</strong> {r.marks.join('; ')}</div>}
          {r.vehicles && r.vehicles.length > 0 && <div style={{ gridColumn: 'span 2' }}><strong>Vehicle:</strong> {r.vehicles.join('; ')}</div>}
          {r.comments && <div style={{ gridColumn: 'span 2' }}>{r.comments}</div>}
          {(r.sourceName || r.sourceState) && <div style={{ gridColumn: 'span 2' }}><strong>Source:</strong> {[r.sourceName, r.sourceState].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
    </div>
  );
};

/* ─── FinancialRecordCard (liens, judgments, foreclosures, bankruptcies) ── */
const FinancialRecordCard = ({ record }) => {
  const r = record;
  const usd = (v) => `$${Number(v).toLocaleString()}`;
  return (
    <div style={{ ...styles.listItem, padding: '0.875rem 1.25rem' }}>
      <p style={styles.listItemTitle}>
        {r.description || r.type}
        <span style={{ marginLeft: '0.5rem', padding: '0.125rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#fff', background: '#6b7280', borderRadius: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {r.type}
        </span>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
        {(r.defaultAmount || r.defaultPrincipalBalance) ? <div><strong>Default amount:</strong> {usd(r.defaultAmount || r.defaultPrincipalBalance)}</div> : null}
        {r.recordingDate && <div><strong>Recorded:</strong> {r.recordingDate}</div>}
        {r.documentNumber && <div><strong>Doc #:</strong> {r.documentNumber}</div>}
        {r.documentType && r.documentType !== r.description && <div><strong>Document type:</strong> {r.documentType}</div>}
        {r.recordType && <div><strong>Record type:</strong> {r.recordType}</div>}
        {r.lienType && <div><strong>Lien type:</strong> {r.lienType}</div>}
        {r.damarType && <div><strong>Type code:</strong> {r.damarType}</div>}
        {r.taxCertificationNumber && <div><strong>Tax cert #:</strong> {r.taxCertificationNumber}</div>}
        {r.courtCaseNumber && <div><strong>Court case #:</strong> {r.courtCaseNumber}</div>}
        {r.taxPeriod && <div><strong>Tax period:</strong> {r.taxPeriod}</div>}
        {r.auctionDate && <div><strong>Auction:</strong> {r.auctionDate}{r.auctionTime ? ` @ ${r.auctionTime}` : ''}</div>}
        {r.trusteeSaleDate && <div><strong>Trustee sale:</strong> {r.trusteeSaleDate}</div>}
        {r.delinquentDate && <div><strong>Delinquent:</strong> {r.delinquentDate}</div>}
        {r.originalLoanDate && <div><strong>Original loan:</strong> {r.originalLoanDate}</div>}
        {r.origRecordingDate && <div><strong>Orig. recorded:</strong> {r.origRecordingDate}</div>}
        {r.documentFilingDate && <div><strong>Filed:</strong> {r.documentFilingDate}</div>}
        {r.abstractIssueDate && <div><strong>Abstract issued:</strong> {r.abstractIssueDate}</div>}
        {r.stayOrderedDate && <div><strong>Stay ordered:</strong> {r.stayOrderedDate}</div>}
        {r.refileExtendLastDate && <div><strong>Refile/extend:</strong> {r.refileExtendLastDate}</div>}
        {r.county && <div><strong>County:</strong> {r.county}{r.state ? `, ${r.state}` : ''}</div>}
        {r.beneficiary && <div><strong>Beneficiary:</strong> {r.beneficiary}</div>}
        {r.trustee && <div><strong>Trustee:</strong> {r.trustee}</div>}
        {r.titleCompany && <div><strong>Title company:</strong> {r.titleCompany}</div>}
        {r.creditor && <div><strong>Creditor:</strong> {r.creditor}</div>}
        {r.plaintiff && <div><strong>Plaintiff:</strong> {r.plaintiff}</div>}
        {r.attorney && <div><strong>Attorney:</strong> {r.attorney}</div>}
        {r.stayOrdered === 'Y' && <div><strong>Stay ordered:</strong> Yes</div>}
        {r.issuingAgency && <div style={{ gridColumn: 'span 2' }}><strong>Issuing agency:</strong> {r.issuingAgency}</div>}
        {r.lienProperty && <div style={{ gridColumn: 'span 2' }}><strong>Property:</strong> {r.lienProperty}</div>}
        {r.hoaAddress && <div style={{ gridColumn: 'span 2' }}><strong>HOA address:</strong> {r.hoaAddress}</div>}
        {r.debtorName && <div style={{ gridColumn: 'span 2' }}><strong>{r.type === 'Foreclosure' ? 'Borrower' : 'Debtor'}:</strong> {r.debtorName}{r.debtorAddress && ` — ${r.debtorAddress}`}</div>}
      </div>
    </div>
  );
};

const SecondaryIdentityCard = ({ identity }) => {
  const name = identity.nameList?.[0]?.data || 'Unknown';
  const aliases = (identity.nameList || []).slice(1).map(n => n.data).filter(Boolean);
  const topAddress = identity.addressList?.[0];
  const location = topAddress
    ? [topAddress.city, topAddress.state].filter(Boolean).join(', ')
    : '';
  const topPhone = identity.phoneList?.[0];
  const phone = topPhone ? fmtPhone(topPhone.number || topPhone.value || '') : '';
  const age = identity.ageRange || '';

  return (
    <div style={styles.secondaryCard}>
      <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>{name}</p>
      {aliases.length > 0 && (
        <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.8125rem' }}>
          aka {aliases.join(', ')}
        </p>
      )}
      {age && <p style={{ margin: '0 0 0.25rem', color: '#6b7280', fontSize: '0.8125rem' }}>Age: {age}</p>}
      {location && <p style={{ margin: '0 0 0.25rem', color: '#374151', fontSize: '0.8125rem' }}>📍 {location}</p>}
      {phone && <p style={{ margin: 0, color: '#374151', fontSize: '0.8125rem' }}>📞 {phone}</p>}
    </div>
  );
};


export const styles = {
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
  personName: { margin: '0 0 0.75rem', fontSize: '2rem', fontWeight: 700, color: '#0d5d2f', letterSpacing: '-0.02em' },
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
    padding: '0.5rem 1rem', backgroundColor: '#0d5d2f', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
  },
  // Teal "discovery" outline — used by "New Search" and the error-state
  // "Back to Search" (both are search-nav, so teal is consistent).
  btnSecondary: {
    padding: '0.5rem 1rem', backgroundColor: '#ffffff', color: '#0d5d2f',
    border: '2px solid #0d5d2f', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
  },
  pdfErrorBanner: {
    margin: '0 0 1rem', padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2', color: '#991b1b',
    borderRadius: '6px', fontSize: '0.875rem',
  },

  // Summary
  summaryBar: {
    display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
    marginBottom: '2rem', padding: '1.25rem 1.5rem',
    backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
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

  // Current badge
  currentBadge: {
    display: 'inline-block', marginRight: '0.4rem',
    padding: '0.125rem 0.4rem', backgroundColor: '#dcfce7',
    color: '#15803d', borderRadius: '4px', fontSize: '0.6875rem',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    verticalAlign: 'middle',
  },

  // Secondary identity card
  secondaryCard: {
    padding: '0.875rem 1rem', border: '1px solid #e5e7eb',
    borderRadius: '0.5rem', backgroundColor: '#fafafa',
  },

  // Family Watchdog
  clearBanner: { display: 'flex', alignItems: 'center', margin: '1rem 1.25rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', color: '#15803d', fontWeight: 500 },
  warnBanner: { margin: '1rem 1.25rem 0', padding: '0.75rem 1rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', color: '#c2410c' },
  offenderCard: { margin: '0.75rem 1.25rem', padding: '0.875rem 1rem', backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem' },
  offenderField: { margin: '0.25rem 0 0', color: '#6b7280' },
};
