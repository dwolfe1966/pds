// Inline SVG line icons for HomeFacts module headers + nav. Monochrome, currentColor, stroke-based — zero
// external requests (SEO/perf-safe), scale crisply, and inherit the module accent. One <HfIcon name=... /> per
// module. Keep the visual language consistent: 1.6 stroke, round caps/joins, 20px default.
import React from 'react';

const P = {
  // Overview — layered document
  summary: <><path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M14 4v5h5" /><path d="M7 13h8M7 16h6" /></>,
  // Demographics — people
  demographics: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6.5a3 3 0 0 1 0 5.5M17 20a5.5 5.5 0 0 0-3-4.9" /></>,
  // Property — house
  property: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  // Schools — graduation cap
  schools: <><path d="M12 4 2 9l10 5 8-4v6" /><path d="M6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5" /></>,
  // Crime — shield
  crime: <><path d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z" /></>,
  // Environment — leaf
  environment: <><path d="M5 20c0-8 6-13 15-13 0 9-5 15-13 15-2 0-2-2-2-2Z" /><path d="M9 16c2-3 4.5-5 8-6" /></>,
  // Disasters — alert triangle
  disasters: <><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5v.5" /></>,
  // Neighborhood — map pin
  neighborhood: <><path d="M12 21c4.5-4.5 7-8 7-11a7 7 0 1 0-14 0c0 3 2.5 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  // Sex offenders — shield alert
  offenders: <><path d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z" /><path d="M12 8.5v4M12 15.5v.5" /></>,
  // Incarceration — bars
  incarceration: <><path d="M4 4h16M4 20h16" /><path d="M6 4v16M10 4v16M14 4v16M18 4v16" /></>,
  // FAQ — question in a circle
  faq: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a2.8 2.8 0 0 1 5.3 1c0 1.8-2.5 2-2.5 3.5" /><path d="M12 17.3v.4" /></>,
  // Location / map (generic)
  location: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  // People search / names — magnifier over person
  names: <><circle cx="10" cy="9" r="3" /><path d="M4.5 19a5.5 5.5 0 0 1 9-4.3" /><circle cx="16.5" cy="15.5" r="3" /><path d="m19 18 2 2" /></>,
};

export function HfIcon({ name, size = 20, color = 'currentColor', style }) {
  const paths = P[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flex: 'none', display: 'block', ...style }}>
      {paths}
    </svg>
  );
}
