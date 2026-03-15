/**
 * Data extraction and formatting helpers for report detail pages.
 * Extracted from SearchResultDetailPage for testability and reuse.
 */

function dedup(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

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
    // YYYYMMDD → Mon YYYY
    if (/^\d{8}$/.test(s)) {
      const yr = s.slice(0, 4);
      const mo = parseInt(s.slice(4, 6), 10);
      if (mo >= 1 && mo <= 12) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[mo - 1]} ${yr}`;
      }
      return yr;
    }
    // YYYY
    if (/^\d{4}$/.test(s)) return s;
    // ISO or other parseable date
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    return null;
  };
  const f = fmt(first);
  const l = fmt(last);
  if (f && l && f !== l) return `${f} – ${l}`;
  if (f) return `Since ${f}`;
  if (l) return `Until ${l}`;
  return '—';
}

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

  // Secondary identities (identities[1+])
  const secondaryIdentities = identities.slice(1);

  return {
    fullName, aliases, dob, age, gender, provider,
    currentLocation, addresses, phones, emails, relatives,
    jobs, education, social, offenders, secondaryIdentities,
  };
}

module.exports = { extractAll, formatDateRange, dedup, fmtPhone };
