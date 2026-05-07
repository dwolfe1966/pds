import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup, validatePassword } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant E — SOCIAL PROOF (Trust/Authority)
 *
 * Resembles a professional report cover page / document. Conveys authority
 * and trustworthiness. Table of contents with section counts, testimonials,
 * statistics, and prominent trust badges. The message: this is a serious,
 * professional service with real results.
 *
 * Aesthetic: Legal document meets modern SaaS. Cream/warm-white paper feel,
 * serif headings, structured layout with horizontal rules. Clean and credible.
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

const TESTIMONIALS = [
  {
    text: 'Found my birth family after 20 years of searching. The report was incredibly detailed and accurate.',
    name: 'Rebecca M.',
    location: 'Austin, TX',
    rating: 5,
  },
  {
    text: 'Used this to verify a contractor before hiring. Saved me from a bad situation. Worth every penny.',
    name: 'David K.',
    location: 'Portland, OR',
    rating: 5,
  },
  {
    text: 'The depth of information is remarkable. Found addresses and connections I had no idea existed.',
    name: 'Sarah L.',
    location: 'Miami, FL',
    rating: 5,
  },
];

const TOC_SECTIONS = [
  { title: 'Personal Information', pages: '2-3', icon: '\u2460' },
  { title: 'Contact Details', pages: '4-6', icon: '\u2461' },
  { title: 'Address History', pages: '7-10', icon: '\u2462' },
  { title: 'Phone Numbers', pages: '11-12', icon: '\u2463' },
  { title: 'Email Addresses', pages: '13', icon: '\u2464' },
  { title: 'Relatives & Associates', pages: '14-17', icon: '\u2465' },
  { title: 'Employment History', pages: '18-19', icon: '\u2466' },
  { title: 'Education Records', pages: '20', icon: '\u2467' },
  { title: 'Criminal & Court Records', pages: '21-24', icon: '\u2468' },
  { title: 'Social Media Profiles', pages: '25-26', icon: '\u2469' },
  { title: 'Property & Assets', pages: '27-28', icon: '\u246A' },
  { title: 'Sex Offender Registry Check', pages: '29', icon: '\u246B' },
];

const SearchDetailPreviewVariantE = ({ person, id }) => {
  const brand = useBrand();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, setError, success } = useSignup();

  const hash = simpleHash(String(person?.id || id || 'x'));
  const reportId = `IDL-${String(hash).slice(0, 4)}-${String(hash).slice(4, 8) || '0000'}-${String(hash).slice(8, 12) || '0000'}`;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const pwError = validatePassword(signupPassword);
    if (pwError) { setError(pwError); return; }
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  const scrollToSignup = (e) => {
    e.preventDefault();
    document.getElementById('ve-signup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Shared inline styles
  const hr = {
    border: 'none', borderTop: '1px solid #d6d3cd', margin: '0',
  };
  const paperCard = {
    background: '#fffef9', border: '1px solid #d6d3cd', borderRadius: '0.5rem',
    margin: '0 1rem 1rem', overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <main className={styles.main} data-no-nav="true" style={{ background: '#f0ede6' }}>
      {/* Mini header */}
      <div className={styles.miniHeader} style={{
        background: '#fffef9', borderBottom: '1px solid #d6d3cd',
      }}>
        <Link to="/name/search-result" className={styles.miniHeaderBack} style={{ color: '#0d5d2f' }}>
          &larr; Back to Results
        </Link>
        <span style={{
          fontSize: '0.78rem', fontWeight: 700, color: '#0d5d2f', letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {brand.name}.ai
        </span>
      </div>

      {/* Report cover page */}
      <div style={{
        ...paperCard,
        marginTop: '1rem',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        borderTop: '4px solid #0d5d2f',
      }}>
        {/* Document header */}
        <div style={{
          fontSize: '0.65rem', color: '#8a8578', letterSpacing: '0.25em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem',
          fontFamily: '"Courier Prime", "Courier New", monospace',
        }}>
          Confidential
        </div>
        <h2 style={{
          fontSize: '0.82rem', color: '#8a8578', letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 600, margin: '0 0 1.5rem',
          fontFamily: '"Courier Prime", "Courier New", monospace',
        }}>
          Background Report
        </h2>

        <hr style={hr} />

        <h1 style={{
          fontSize: 'clamp(1.6rem, 5.5vw, 2.4rem)', fontWeight: 700, color: '#1a1917',
          margin: '1.5rem 0 0.5rem', letterSpacing: '-0.03em', lineHeight: 1.15,
          fontFamily: '"Playfair Display", "Georgia", serif',
        }}>
          {person.fullName}
        </h1>

        {(person.ageRange || person.location) && (
          <p style={{
            fontSize: '0.95rem', color: '#6b6860', margin: '0 0 1.5rem',
            fontFamily: '"Courier Prime", "Courier New", monospace',
          }}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}
            {person.ageRange && person.location ? ' \u2014 ' : ''}
            {person.location || ''}
          </p>
        )}

        <hr style={hr} />

        {/* Report metadata */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.25rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontSize: '0.6rem', color: '#8a8578', textTransform: 'uppercase',
              letterSpacing: '0.15em', fontWeight: 600, marginBottom: '0.2rem',
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>Report ID</div>
            <div style={{
              fontSize: '0.82rem', color: '#1a1917', fontWeight: 600,
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>{reportId}</div>
          </div>
          <div>
            <div style={{
              fontSize: '0.6rem', color: '#8a8578', textTransform: 'uppercase',
              letterSpacing: '0.15em', fontWeight: 600, marginBottom: '0.2rem',
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>Generated</div>
            <div style={{
              fontSize: '0.82rem', color: '#1a1917', fontWeight: 600,
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>{generatedDate}</div>
          </div>
          <div>
            <div style={{
              fontSize: '0.6rem', color: '#8a8578', textTransform: 'uppercase',
              letterSpacing: '0.15em', fontWeight: 600, marginBottom: '0.2rem',
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>Pages</div>
            <div style={{
              fontSize: '0.82rem', color: '#1a1917', fontWeight: 600,
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>29</div>
          </div>
        </div>
      </div>

      {/* Statistics bar */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0', margin: '0 1rem 1rem',
        background: '#0d5d2f', borderRadius: '0.5rem', overflow: 'hidden',
      }}>
        {[
          { val: '12B+', label: 'Public Records' },
          { val: '500M+', label: 'Searches Run' },
          { val: '99.2%', label: 'Accuracy Rate' },
        ].map(({ val, label }, i) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', padding: '0.875rem 0.5rem',
            borderRight: i < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none',
          }}>
            <div style={{
              fontSize: '1.1rem', fontWeight: 800, color: '#ffffff',
              fontFamily: '"Playfair Display", "Georgia", serif',
            }}>{val}</div>
            <div style={{
              fontSize: '0.58rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, marginTop: '0.15rem',
            }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table of Contents */}
      <div style={paperCard}>
        <div style={{
          padding: '0.85rem 1.125rem', borderBottom: '1px solid #d6d3cd',
          background: '#f7f5f0',
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1a1917',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            fontFamily: '"Courier Prime", "Courier New", monospace',
          }}>
            Table of Contents
          </h3>
        </div>
        {TOC_SECTIONS.map((sec, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.65rem 1.125rem',
            borderBottom: i < TOC_SECTIONS.length - 1 ? '1px solid #ece9e1' : 'none',
            fontSize: '0.88rem',
          }}>
            <span style={{
              color: '#0d5d2f', fontSize: '0.95rem', flexShrink: 0, width: '1.25rem',
              textAlign: 'center', fontWeight: 600,
            }}>{sec.icon}</span>
            <span style={{ flex: 1, color: '#3d3b36' }}>{sec.title}</span>
            <span style={{
              fontSize: '0.72rem', color: '#8a8578',
              fontFamily: '"Courier Prime", "Courier New", monospace',
            }}>p. {sec.pages}</span>
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, color: '#b45309', background: '#fef3c7',
              borderRadius: '3px', padding: '0.1rem 0.4rem',
            }}>LOCKED</span>
          </div>
        ))}
        <div style={{
          padding: '0.85rem 1.125rem', borderTop: '1px solid #d6d3cd',
          background: '#f7f5f0', textAlign: 'center',
        }}>
          <button type="button" onClick={scrollToSignup} style={{
            background: 'none', border: 'none', color: '#0d5d2f',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
            padding: '0.4rem 1rem',
          }}>
            Unlock All 12 Sections &rarr;
          </button>
        </div>
      </div>

      {/* Trust badges */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0.75rem',
        margin: '0 1rem 1rem', flexWrap: 'wrap',
      }}>
        {[
          { icon: '\uD83D\uDD12', label: '256-bit SSL\nEncrypted', bg: '#dcfce7', border: '#86efac', color: '#166534' },
          { icon: '\u2605', label: 'A+ Rated\nService', bg: '#fef3c7', border: '#fde68a', color: '#92400e' },
        ].map(({ icon, label, bg, border, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: '90px', textAlign: 'center',
            background: bg, border: `1px solid ${border}`, borderRadius: '0.5rem',
            padding: '0.75rem 0.5rem',
          }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{icon}</div>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, color, lineHeight: 1.3,
              whiteSpace: 'pre-line',
            }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Testimonials */}
      <div style={paperCard}>
        <div style={{
          padding: '0.85rem 1.125rem', borderBottom: '1px solid #d6d3cd',
          background: '#f7f5f0',
        }}>
          <h3 style={{
            margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#1a1917',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            fontFamily: '"Courier Prime", "Courier New", monospace',
          }}>
            Verified Reviews
          </h3>
        </div>
        {TESTIMONIALS.map((t, i) => (
          <div key={i} style={{
            padding: '1rem 1.125rem',
            borderBottom: i < TESTIMONIALS.length - 1 ? '1px solid #ece9e1' : 'none',
          }}>
            <div style={{ display: 'flex', gap: '0.15rem', marginBottom: '0.5rem' }}>
              {Array.from({ length: t.rating }, (_, j) => (
                <span key={j} style={{ color: '#f59e0b', fontSize: '0.85rem' }}>\u2605</span>
              ))}
            </div>
            <p style={{
              fontSize: '0.88rem', color: '#3d3b36', margin: '0 0 0.5rem',
              lineHeight: 1.55, fontStyle: 'italic',
            }}>
              &ldquo;{t.text}&rdquo;
            </p>
            <div style={{ fontSize: '0.78rem', color: '#8a8578', fontWeight: 600 }}>
              {t.name} &middot; {t.location}
            </div>
          </div>
        ))}
      </div>

      {/* Signup form — styled as "Access Your Report" */}
      <div
        id="ve-signup"
        style={{
          ...paperCard,
          marginBottom: '1.5rem',
          borderTop: '4px solid #0d5d2f',
          scrollMarginTop: '4rem',
        }}
      >
        <div style={{ padding: '1.75rem 1.25rem' }}>
          <div style={{
            fontSize: '0.65rem', color: '#8a8578', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem',
            fontFamily: '"Courier Prime", "Courier New", monospace',
          }}>
            Account Required
          </div>
          <h2 style={{
            fontSize: '1.35rem', fontWeight: 700, color: '#1a1917',
            margin: '0 0 0.3rem', textAlign: 'center',
            fontFamily: '"Playfair Display", "Georgia", serif',
            letterSpacing: '-0.02em',
          }}>
            Access Your Report
          </h2>
          <p style={{
            fontSize: '0.85rem', color: '#6b6860', textAlign: 'center',
            margin: '0 0 1.5rem', lineHeight: 1.5,
          }}>
            Create a free account to view the full 29-page report for {person.fullName}.
          </p>

          {success ? (
            <div style={{
              background: '#dcfce7', color: '#166534', padding: '1rem',
              borderRadius: '0.375rem', textAlign: 'center', fontWeight: 600,
              fontSize: '0.95rem',
            }}>
              Account created. Accessing your report&hellip;
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{
                  display: 'block', fontSize: '0.82rem', fontWeight: 600,
                  color: '#3d3b36', marginBottom: '0.35rem',
                }} htmlFor="ve-email">Email Address</label>
                <input
                  id="ve-email"
                  type="email"
                  name="email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 0.875rem', fontSize: '0.95rem',
                    border: '1px solid #d6d3cd', borderRadius: '0.375rem', boxSizing: 'border-box',
                    fontFamily: 'inherit', outline: 'none', background: '#fffef9',
                  }}
                  placeholder="you@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{
                  display: 'block', fontSize: '0.82rem', fontWeight: 600,
                  color: '#3d3b36', marginBottom: '0.35rem',
                }} htmlFor="ve-password">Create Password</label>
                <input
                  id="ve-password"
                  type="password"
                  name="password"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 0.875rem', fontSize: '0.95rem',
                    border: '1px solid #d6d3cd', borderRadius: '0.375rem', boxSizing: 'border-box',
                    fontFamily: 'inherit', outline: 'none', background: '#fffef9',
                  }}
                  placeholder="Uppercase, lowercase, number & special char"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div style={{
                  padding: '0.7rem 0.875rem', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: '0.375rem',
                  marginBottom: '0.875rem', fontSize: '0.85rem', color: '#991b1b',
                }}>
                  {error === 'already_exists' ? (
                    <>Account exists. <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Sign in</Link></>
                  ) : error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '0.85rem 1.5rem',
                  background: loading ? '#6b7280' : '#0d5d2f',
                  color: '#ffffff', border: 'none', borderRadius: '0.375rem',
                  fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                  transition: 'background 0.15s ease',
                  boxShadow: '0 2px 8px rgba(13,93,47,0.2)',
                }}
              >
                {loading ? 'Creating account\u2026' : 'Access Report \u2192'}
              </button>
              <p style={{
                textAlign: 'center', fontSize: '0.78rem', color: '#8a8578', margin: '0.6rem 0 0',
              }}>
                No credit card required
              </p>
              <p style={{
                textAlign: 'center', fontSize: '0.78rem', color: '#8a8578', margin: '0.4rem 0 0',
              }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </form>
          )}

          {/* Inline trust */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem',
            flexWrap: 'wrap', fontSize: '0.72rem', color: '#8a8578', fontWeight: 500,
          }}>
            <span>\uD83D\uDD12 SSL Encrypted</span>
            <span>\u2605 A+ Rated</span>
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className={styles.stickyMobileCta}>
        <a href="#ve-signup" className={styles.stickyMobileCtaLink} onClick={scrollToSignup}>
          Access Report &mdash; Create Free Account
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantE;
