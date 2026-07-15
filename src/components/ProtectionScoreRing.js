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
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>Protection Score</div>
        {claimed ? (
          <>
            <p style={{ margin: '4px 0 10px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
              How protected your identity is right now. Raise it by taking the steps below.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {result.actions.slice(0, 3).map((a) => (
                <button key={a.key} type="button" onClick={() => navigate('/my-identity')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                  {a.label} <span style={{ color: '#16a34a', fontWeight: 800 }}>+{a.points}</span>
                </button>
              ))}
              {result.actions.length === 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ You're fully protected — nice work.</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '4px 0 10px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
              Claim your identity to see how protected you are — and get a personalized plan to raise it.
            </p>
            <button type="button" onClick={() => navigate('/my-identity')}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Get my Protection Score →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
