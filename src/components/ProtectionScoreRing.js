import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, fetchSuppression, computeProtectionScore } from '../services/memberEnrichment';

/**
 * Protection Score ring — the dashboard's "Me" center of gravity. A single glanceable 0-100 score for how
 * protected the member's identity is (see computeProtectionScore), with the highest-leverage next steps.
 * Pairs with search above the fold: search = explore others, this = manage me.
 * Composited from real signals only (verification tier, exposed-details hidden, activity suppression).
 */

const GREEN = '#0d5d2f';
const R = 52;
const C = 2 * Math.PI * R;

function colorFor(level) {
  if (level === 'Strong' || level === 'Fair') return GREEN;
  if (level === 'Building') return '#f59e0b';
  return '#dc2626'; // At risk
}

function Ring({ score, color, muted }) {
  return (
    <svg width={124} height={124} viewBox="0 0 124 124" style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx={62} cy={62} r={R} fill="none" stroke="#eef2f0" strokeWidth={11} />
      {!muted && (
        <circle cx={62} cy={62} r={R} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 62 62)"
          style={{ transition: 'stroke-dashoffset .5s ease' }} />
      )}
      <text x={62} y={60} textAnchor="middle" fontSize={30} fontWeight={800} fill={muted ? '#9ca3af' : color}>
        {muted ? '—' : score}
      </text>
      <text x={62} y={80} textAnchor="middle" fontSize={11} fontWeight={600} fill="#9ca3af">/ 100</text>
    </svg>
  );
}

export default function ProtectionScoreRing() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [suppressed, setSuppressed] = useState(false);
  const [hiddenFields, setHiddenFields] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    fetchSuppression().then((s) => { if (alive) { setSuppressed(!!(s && s.activityHidden)); setHiddenFields((s && s.hiddenFields) || []); } });
    return () => { alive = false; };
  }, []);

  const result = computeProtectionScore(identity, { suppressed, hiddenFields });
  const claimed = !!result;
  const color = claimed ? colorFor(result.level) : '#9ca3af';

  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(17,24,39,0.06)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ring score={claimed ? result.score : 0} color={color} muted={!claimed} />
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color }}>
          {claimed ? result.level : ''}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>Identity Protection Score</div>
        {claimed ? (
          <>
            <p style={{ margin: '4px 0 12px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
              {result.actions.length === 0
                ? "✓ You've completed every step — your identity is fully protected."
                : 'How protected your identity is right now — complete the steps to raise it.'}
            </p>
            {/* Connected 3-step protection plan: verify → hide exposed → control activity. */}
            <div style={{ position: 'relative' }}>
              {result.steps.map((s, i) => {
                const last = i === result.steps.length - 1;
                return (
                  <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: last ? 0 : 12, position: 'relative' }}>
                    {!last && <div aria-hidden="true" style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: s.done ? '#bbf7d0' : '#e5e7eb' }} />}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, zIndex: 1, background: s.done ? GREEN : '#fff', color: s.done ? '#fff' : '#6b7280', border: `2px solid ${s.done ? GREEN : '#d1d5db'}` }}>
                      {s.done ? '✓' : s.num}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: s.done ? '#9ca3af' : '#111827' }}>{s.label}</div>
                      {!s.done && (
                        <button type="button" onClick={() => navigate('/my-identity')}
                          style={{ marginTop: 2, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 700, color: GREEN, textDecoration: 'underline', cursor: 'pointer' }}>
                          Do it →
                        </button>
                      )}
                    </div>
                    {!s.done && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: GREEN, paddingTop: 5 }}>+{s.points}</span>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '4px 0 10px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
              Claim your identity to see how protected you are — and get a personalized plan to raise it.
            </p>
            <button type="button" onClick={() => navigate('/my-identity')}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Get my Identity Protection Score →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
