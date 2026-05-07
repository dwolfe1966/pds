import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup, validatePassword } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant D — HIGH TEASE (Partial Reveal)
 *
 * Shows real partial data extracted from the person object to create
 * specific, personal hooks. City/state visible but street blurred,
 * area codes shown with masked numbers, relative first names visible.
 * The viewer sees just enough to know this is REAL data about the person.
 *
 * Aesthetic: Clean data-dashboard meets investigative report. Slate/zinc
 * tones with green accent. Data-forward layout, dense but organized.
 *
 * Props: person (object), id (string)
 *
 * IMPORTANT: form inputs are inline JSX — NOT sub-components.
 */

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededItem(id, salt, arr) {
  const h = simpleHash((id || 'x') + salt);
  return arr[h % arr.length];
}

function seededCount(id, salt, min, max) {
  const h = simpleHash((id || 'x') + salt);
  return min + (h % (max - min + 1));
}

// Generate partial-reveal mock data seeded from person
function generatePartialData(person, id) {
  const pid = String(person?.id || id || 'x');
  const location = person?.location || '';
  const parts = location.split(',').map(s => s.trim());
  const city = parts[0] || seededItem(pid, 'city', ['Los Angeles', 'Houston', 'Phoenix', 'Chicago', 'Denver']);
  const state = parts[1] || seededItem(pid, 'state', ['CA', 'TX', 'AZ', 'IL', 'CO']);

  const areaCode = seededItem(pid, 'area', ['312', '213', '602', '713', '303', '415', '512', '818']);
  const phoneCount = seededCount(pid, 'phones', 2, 5);
  const emailCount = seededCount(pid, 'emails', 1, 4);
  const addressCount = seededCount(pid, 'addrs', 3, 8);
  const relativeCount = seededCount(pid, 'rels', 3, 9);

  const firstName = (person?.fullName || 'J').split(/\s+/)[0];
  const firstInitial = firstName[0]?.toLowerCase() || 'j';
  const emailDomain = seededItem(pid, 'dom', ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com']);

  const relFirstNames = [
    seededItem(pid, 'rel1', ['Michael', 'Jennifer', 'Robert', 'Maria', 'David']),
    seededItem(pid, 'rel2', ['Sarah', 'James', 'Lisa', 'Thomas', 'Patricia']),
    seededItem(pid, 'rel3', ['Daniel', 'Ashley', 'Chris', 'Amanda', 'Brian']),
    seededItem(pid, 'rel4', ['Jessica', 'Kevin', 'Emily', 'Mark', 'Nicole']),
  ];

  const streets = [
    `**** ${seededItem(pid, 'st1', ['Oak', 'Maple', 'Pine', 'Cedar', 'Elm'])} ${seededItem(pid, 'stype', ['St', 'Ave', 'Dr', 'Blvd', 'Ln'])}`,
    `**** ${seededItem(pid, 'st2', ['Main', 'Park', 'Lake', 'Hill', 'Valley'])} ${seededItem(pid, 'stype2', ['Rd', 'Way', 'Ct', 'Pl'])}`,
  ];

  return {
    city, state, areaCode, phoneCount, emailCount, addressCount,
    relativeCount, firstInitial, emailDomain, relFirstNames, streets, firstName,
  };
}

const SearchDetailPreviewVariantD = ({ person, id }) => {
  const brand = useBrand();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, setError, success } = useSignup();

  const data = generatePartialData(person, id);

  const handleSubmit = (e) => {
    e.preventDefault();
    const pwError = validatePassword(signupPassword);
    if (pwError) { setError(pwError); return; }
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  const scrollToSignup = (e) => {
    e.preventDefault();
    document.getElementById('vd-signup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Shared styles
  const sectionCard = {
    background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '0.75rem',
    overflow: 'hidden', margin: '0 0.875rem 0.875rem',
  };
  const sectionHeader = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1rem', borderBottom: '1px solid #f4f4f5', background: '#fafafa',
  };
  const sectionTitle = {
    fontSize: '0.82rem', fontWeight: 700, color: '#27272a', letterSpacing: '0.01em',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  };
  const countBadge = {
    fontSize: '0.68rem', fontWeight: 700, color: '#0d5d2f', background: '#dcfce7',
    borderRadius: '999px', padding: '0.15rem 0.55rem',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  };
  const dataRow = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.6rem 1rem', borderBottom: '1px solid #f4f4f5',
    fontSize: '0.88rem',
  };
  const visibleText = { color: '#18181b', fontWeight: 500 };
  const maskedText = {
    color: '#a1a1aa', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: '0.82rem', letterSpacing: '0.03em',
  };
  const unlockRowBtn = {
    width: '100%', padding: '0.6rem', background: 'none', border: 'none',
    color: '#0d5d2f', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    transition: 'background 0.15s ease',
  };

  return (
    <main className={styles.main} data-no-nav="true" style={{ background: '#f4f4f5' }}>
      {/* Mini header */}
      <div className={styles.miniHeader} style={{ background: '#ffffff', borderColor: '#e4e4e7' }}>
        <Link to="/name/search-result" className={styles.miniHeaderBack} style={{ color: '#0d5d2f' }}>
          &larr; Results
        </Link>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0d5d2f', letterSpacing: '-0.01em' }}>
          {brand.name}.ai
        </span>
      </div>

      {/* Preview-only notice — VariantD shows illustrative counts/labels, not the
          underlying real record. Keeps visitors from interpreting seeded data as fact. */}
      <div style={{
        margin: '0.875rem 0.875rem 0',
        padding: '0.5rem 0.75rem',
        fontSize: '0.72rem',
        color: '#78350f',
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '0.5rem',
        lineHeight: 1.35,
      }}>
        Preview — counts and initials shown below illustrate the shape of the full report. Sign up to view the actual records for this person.
      </div>

      {/* Person header card */}
      <div style={{
        background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '0.75rem',
        padding: '1.25rem', margin: '0.875rem 0.875rem 0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0d5d2f 0%, #16a34a 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.15rem', fontWeight: 700,
          }}>
            {(person.fullName || '?').split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#18181b',
              letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {person.fullName}
            </h1>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem',
              fontSize: '0.78rem', color: '#71717a',
            }}>
              {person.ageRange && <span>Age {person.ageRange}</span>}
              {person.ageRange && person.location && <span>&middot;</span>}
              {person.location && <span>{person.location}</span>}
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap',
        }}>
          {[
            { n: data.phoneCount, l: 'Phones' },
            { n: data.emailCount, l: 'Emails' },
            { n: data.addressCount, l: 'Addresses' },
            { n: data.relativeCount, l: 'Relatives' },
          ].map(({ n, l }) => (
            <div key={l} style={{
              flex: 1, minWidth: '60px', textAlign: 'center',
              background: '#f4f4f5', borderRadius: '0.5rem', padding: '0.5rem 0.25rem',
            }}>
              <div style={{
                fontSize: '1.15rem', fontWeight: 800, color: '#0d5d2f',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              }}>{n}</div>
              <div style={{ fontSize: '0.62rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partial data notice */}
      <div style={{
        margin: '0 0.875rem 0.875rem', padding: '0.6rem 0.875rem',
        background: '#fefce8', border: '1px solid #fde68a', borderRadius: '0.5rem',
        fontSize: '0.76rem', color: '#854d0e', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: '0.4rem',
      }}>
        <span style={{ flexShrink: 0 }}>&#9432;</span>
        Showing partial preview. Create a free account to unlock all data.
      </div>

      {/* Section: Phone Numbers */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Phone Numbers</span>
          <span style={countBadge}>{data.phoneCount} found</span>
        </div>
        <div style={dataRow}>
          <span style={visibleText}>({data.areaCode}) ***-****</span>
          <span style={{ ...maskedText, fontSize: '0.72rem', color: '#0d5d2f' }}>Mobile</span>
        </div>
        <div style={{ ...dataRow, borderBottom: 'none' }}>
          <span style={maskedText}>(***) ***-****</span>
          <span style={{ ...maskedText, fontSize: '0.72rem' }}>Landline</span>
        </div>
        {data.phoneCount > 2 && (
          <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#a1a1aa', fontStyle: 'italic' }}>
            +{data.phoneCount - 2} more number{data.phoneCount - 2 > 1 ? 's' : ''} hidden
          </div>
        )}
        <button type="button" onClick={scrollToSignup} style={unlockRowBtn}>
          See All Phone Numbers &rarr;
        </button>
      </div>

      {/* Section: Email Addresses */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Email Addresses</span>
          <span style={countBadge}>{data.emailCount} found</span>
        </div>
        <div style={dataRow}>
          <span>
            <span style={visibleText}>{data.firstInitial}{data.firstInitial}</span>
            <span style={maskedText}>****@</span>
            <span style={visibleText}>{data.emailDomain}</span>
          </span>
        </div>
        {data.emailCount > 1 && (
          <div style={{ ...dataRow, borderBottom: 'none' }}>
            <span style={maskedText}>****@****.com</span>
          </div>
        )}
        <button type="button" onClick={scrollToSignup} style={unlockRowBtn}>
          See All Emails &rarr;
        </button>
      </div>

      {/* Section: Address History */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Address History</span>
          <span style={countBadge}>{data.addressCount} found</span>
        </div>
        <div style={dataRow}>
          <div>
            <div style={maskedText}>{data.streets[0]}</div>
            <div style={{ ...visibleText, fontSize: '0.82rem', marginTop: '0.15rem' }}>
              {data.city}, {data.state}
            </div>
          </div>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#0d5d2f', background: '#dcfce7',
            borderRadius: '4px', padding: '0.15rem 0.45rem',
          }}>Current</span>
        </div>
        <div style={{ ...dataRow, borderBottom: 'none' }}>
          <div>
            <div style={maskedText}>{data.streets[1]}</div>
            <div style={maskedText}>****, **</div>
          </div>
        </div>
        {data.addressCount > 2 && (
          <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#a1a1aa', fontStyle: 'italic' }}>
            +{data.addressCount - 2} more address{data.addressCount - 2 > 1 ? 'es' : ''} hidden
          </div>
        )}
        <button type="button" onClick={scrollToSignup} style={unlockRowBtn}>
          See Full Address History &rarr;
        </button>
      </div>

      {/* Section: Relatives & Associates */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Relatives &amp; Associates</span>
          <span style={countBadge}>{data.relativeCount} found</span>
        </div>
        {data.relFirstNames.slice(0, Math.min(3, data.relativeCount)).map((name, i) => (
          <div key={i} style={{ ...dataRow, borderBottom: i < 2 ? '1px solid #f4f4f5' : 'none' }}>
            <span>
              <span style={visibleText}>{name}</span>{' '}
              <span style={maskedText}>*****</span>
            </span>
            <span style={{ ...maskedText, fontSize: '0.72rem' }}>
              {seededItem(String(id) + name, 'reltype', ['Sibling', 'Parent', 'Spouse', 'Associate'])}
            </span>
          </div>
        ))}
        {data.relativeCount > 3 && (
          <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#a1a1aa', fontStyle: 'italic' }}>
            +{data.relativeCount - 3} more connections hidden
          </div>
        )}
        <button type="button" onClick={scrollToSignup} style={unlockRowBtn}>
          See All Relatives &rarr;
        </button>
      </div>

      {/* Section: Criminal & Court (fully locked) */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Criminal &amp; Court Records</span>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, color: '#b45309', background: '#fef3c7',
            borderRadius: '999px', padding: '0.15rem 0.55rem',
          }}>
            Requires Account
          </span>
        </div>
        <div style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>&#128274;</div>
          <p style={{ fontSize: '0.85rem', color: '#71717a', margin: '0 0 0.75rem' }}>
            Criminal and court records require account verification.
          </p>
          <button type="button" onClick={scrollToSignup} style={{
            padding: '0.6rem 1.5rem', background: '#0d5d2f', color: '#fff',
            border: 'none', borderRadius: '0.375rem', fontSize: '0.82rem',
            fontWeight: 700, cursor: 'pointer',
          }}>
            Unlock Records
          </button>
        </div>
      </div>

      {/* Comparison table: Free vs Pro */}
      <div style={{
        margin: '0 0.875rem 0.875rem', background: '#ffffff',
        border: '1px solid #e4e4e7', borderRadius: '0.75rem', overflow: 'hidden',
      }}>
        <div style={{
          padding: '0.85rem 1rem', borderBottom: '1px solid #e4e4e7',
          fontSize: '0.82rem', fontWeight: 700, color: '#27272a', background: '#fafafa',
        }}>
          Free Preview vs Full Report
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f4f4f5' }}>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#52525b' }}>Data</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#52525b', width: '70px' }}>Preview</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#0d5d2f', width: '70px' }}>Full</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Name & Age', free: true },
              { label: 'City & State', free: true },
              { label: 'Phone (area code)', free: true },
              { label: 'Full Phone Numbers', free: false },
              { label: 'Full Email Addresses', free: false },
              { label: 'Street Addresses', free: false },
              { label: 'Relative Full Names', free: false },
              { label: 'Criminal Records', free: false },
              { label: 'Court Records', free: false },
              { label: 'Employment History', free: false },
              { label: 'Social Media', free: false },
            ].map(({ label, free }, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '0.5rem 1rem', color: '#3f3f46' }}>{label}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                  {free
                    ? <span style={{ color: '#16a34a', fontWeight: 700 }}>&#10003;</span>
                    : <span style={{ color: '#d4d4d8' }}>&mdash;</span>
                  }
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>&#10003;</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Signup form */}
      <div
        id="vd-signup"
        style={{
          margin: '0.5rem 0.875rem 1.5rem', padding: '1.75rem 1.25rem',
          background: '#0d5d2f', borderRadius: '0.75rem',
          boxShadow: '0 4px 20px rgba(13,93,47,0.22)',
          scrollMarginTop: '4rem',
        }}
      >
        <h2 style={{
          fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.35rem',
          textAlign: 'center', letterSpacing: '-0.02em',
        }}>
          Unlock {person.fullName}&rsquo;s Full Report
        </h2>
        <p style={{
          fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center',
          margin: '0 0 1.25rem',
        }}>
          See all {data.phoneCount} phone numbers, {data.emailCount} emails, {data.addressCount} addresses, and more.
        </p>

        {success ? (
          <div className={styles.signupSuccessMsg}>
            Account created! Redirecting&hellip;
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vd-email">Email</label>
              <input
                id="vd-email"
                type="email"
                name="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                className={styles.signupFormInput}
                placeholder="you@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vd-password">Password</label>
              <input
                id="vd-password"
                type="password"
                name="password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                className={styles.signupFormInput}
                placeholder="Uppercase, lowercase, number & special char"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className={styles.formError}>
                {error === 'already_exists' ? (
                  <>Account exists. <Link to="/login" className={styles.loginLink}>Sign in</Link></>
                ) : error}
              </div>
            )}

            <button type="submit" className={styles.signupSubmitBtn} disabled={loading}>
              {loading ? 'Creating account\u2026' : 'Create Free Account & Unlock'}
            </button>
            <p className={styles.noCardNote}>No credit card required</p>
            <p className={styles.loginLinkWrap}>
              Have an account?{' '}
              <Link to="/login" className={styles.loginLink}>Sign in</Link>
            </p>
          </form>
        )}

        <div className={styles.trustRow}>
          <span>256-bit SSL</span>
          <span>No spam</span>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className={styles.stickyMobileCta}>
        <a href="#vd-signup" className={styles.stickyMobileCtaLink} onClick={scrollToSignup}>
          Unlock Full Report &mdash; Free Account
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantD;
