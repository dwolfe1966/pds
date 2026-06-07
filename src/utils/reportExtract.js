/**
 * Data extraction and formatting helpers for report detail pages.
 *
 * BC returns a single primary identity (raws[0].transient.identities[0])
 * with ~40 sibling lists covering name, address, phone, email, relationships,
 * criminal history, liens, properties, professional licences, and so on.
 * Most of these lists were previously ignored in the consumer report view
 * while the BC-generated PDF rendered them in full. This extractor walks the
 * lists we have schemas for and surfaces them as a flat, render-ready shape.
 *
 * Defensive shape: every section returns an array (possibly empty), so
 * SearchResultDetailPage can conditionally render without null-checking.
 * Empty arrays let new BC data appear automatically when populated for a
 * given record without further client changes.
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
    if (/^\d{8}$/.test(s)) {
      const yr = s.slice(0, 4);
      const mo = parseInt(s.slice(4, 6), 10);
      if (mo >= 1 && mo <= 12) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[mo - 1]} ${yr}`;
      }
      return yr;
    }
    if (/^\d{4}$/.test(s)) return s;
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

/**
 * BC date object: { data: "MM/DD/YYYY", sortable: YYYYMMDD } — return the
 * display string if present, falling back to a derived MM/DD/YYYY from the
 * sortable form. Returns empty string when neither is meaningful.
 */
function formatBcDate(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const data = obj.data;
  if (data && data !== '' && data !== 'XX/XX/XXXX') return data;
  const sortable = obj.sortable;
  if (sortable && typeof sortable === 'number' && sortable > 0) {
    const s = String(sortable);
    if (s.length === 8) return `${s.slice(4, 6)}/${s.slice(6, 8)}/${s.slice(0, 4)}`;
  }
  return '';
}

/** Return the first non-empty BC date from a list of candidates. */
function pickBcDate(...candidates) {
  for (const c of candidates) {
    const v = formatBcDate(c);
    if (v) return v;
  }
  return '';
}

function safeStr(v) {
  return (v == null ? '' : String(v)).trim();
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

  // Gender / citizenship
  const gender = primary.gender || '';
  const citizenship = primary.citizenship || '';

  // Provider
  const provider = primary.meta?.provider || '';

  // Addresses
  const rawAddresses = [
    ...(primary.addressList || []).map(a => ({
      street: a.complete || a.street || a.address || '',
      city: a.city || '',
      state: a.state || '',
      zip: a.zip || '',
      zip4: a.zip4 || '',
      county: a.county || '',
      // NOTE: BC also sends a single-char `ownership` code (e.g. 'P'/'C') per address,
      // but its legend is undocumented — we surface clear ownership via property records
      // (detail.ownershipStatus) instead of guessing a label here.
      firstSeen: a.meta?.firstSeen || a.firstSeen || null,
      lastSeen: a.meta?.lastSeen || a.lastSeen || null,
      dateRange: a.dateRange || '',
      latitude: a.latitude || null,
      longitude: a.longitude || null,
      full: a.data || '',
    })),
    ...((fullContact?.addresses || []).map(a => ({
      street: a.street || a.address || '',
      city: a.city || '',
      state: a.state || '',
      zip: a.zip || '',
      county: a.county || '',
      firstSeen: a.firstSeen || null,
      lastSeen: a.lastSeen || null,
      full: '',
    }))),
  ];
  const addresses = dedup(rawAddresses, a => `${a.city}|${a.state}|${a.zip}|${a.street}`);
  const currentLocation = addresses.length > 0
    ? [addresses[0].city, addresses[0].state].filter(Boolean).join(', ')
    : '';

  // Phones — note BC uses both `phone` and `number` keys depending on list
  const rawPhones = [
    ...(primary.phoneList || []).map(p => ({
      number: p.phone || p.number || p.value || (typeof p === 'string' ? p : ''),
      type: p.type || p.phoneType || '',
      carrier: p.providerName || p.carrier || '',
      firstSeen: p.meta?.firstSeen || p.firstSeen || null,
      lastSeen: p.meta?.lastSeen || p.lastSeen || null,
      disconnected: !!p.disconnected,
      business: !!p.business,
    })),
    ...((fullContact?.phones || fullContact?.phoneNumbers || []).map(p => ({
      number: p.number || p.value || (typeof p === 'string' ? p : ''),
      type: p.type || '',
      carrier: p.carrier || '',
      firstSeen: p.firstSeen || null,
      lastSeen: p.lastSeen || null,
    }))),
  ].filter(p => p.number);
  const phones = dedup(rawPhones, p => String(p.number).replace(/\D/g, ''));

  // Emails
  const rawEmails = [
    ...(primary.emailList || []).map(e => ({
      address: e.email || e.address || e.value || (typeof e === 'string' ? e : ''),
      type: e.type || '',
      firstSeen: e.meta?.firstSeen || e.firstSeen || null,
      lastSeen: e.meta?.lastSeen || e.lastSeen || null,
      inactive: !!e.meta?.inactiveEmailDomain,
    })),
    ...((fullContact?.emails || fullContact?.emailAddresses || []).map(e => ({
      address: e.address || e.email || e.value || (typeof e === 'string' ? e : ''),
      type: e.type || '',
      firstSeen: e.firstSeen || null,
      lastSeen: e.lastSeen || null,
    }))),
  ].filter(e => e.address);
  const emails = dedup(rawEmails, e => e.address.toLowerCase());

  // Relatives + associates. BC's actual response (per docs/BC_REPORT_RESPONSE_STRUCTURE.md)
  // uses `relationList` with a flat shape: { name, relationship, age, city, state }.
  // Earlier code read `relationshipList` and never matched real data — all relatives
  // were silently empty on consumer reports until this was caught by reportExtract.test.
  // The other paths (relationshipList nested, relativesList, associatesList, fullContact)
  // remain as defensive fallbacks for legacy / alternate BC shapes.
  const locOf = (r) => [r.city, r.state].filter(Boolean).join(', ');
  const rawRelatives = [
    ...(primary.relationList || []).map(r => ({
      name: r.name || '',
      relationship: r.relationship || r.relation || r.type || '',
      age: r.age || '',
      location: locOf(r),
      phones: [],
    })),
    ...(primary.relationshipList || []).map(r => ({
      name: r.name?.data || r.name?.fullName || [r.name?.first, r.name?.middle, r.name?.last].filter(Boolean).join(' ') || '',
      relationship: r.relationshipName || r.relation || r.relationship || r.type || '',
      relationshipType: r.type || '',
      relationshipSubType: r.subType || '',
      age: r.dob?.age || r.age || '',
      location: locOf(r),
      phones: Array.isArray(r.phone) ? r.phone.map(p => ({
        number: p.number || p.phone || '',
        type: p.type || '',
        carrier: p.providerName || p.carrier || '',
      })).filter(p => p.number) : [],
    })),
    ...((primary.relativesList || []).map(r => ({
      name: r.name || r.fullName || r.data || '',
      relationship: r.relation || r.relationship || r.type || 'Relative',
      age: r.age || '',
      location: locOf(r),
      phones: [],
    }))),
    ...((primary.associatesList || []).map(r => ({
      name: r.name || r.fullName || r.data || '',
      relationship: r.relation || r.relationship || r.type || 'Associate',
      age: r.age || '',
      location: locOf(r),
      phones: [],
    }))),
    ...((fullContact?.relatives || fullContact?.associates || []).map(r => ({
      name: r.name || r.fullName || '',
      relationship: r.relationship || r.type || '',
      age: r.age || '',
      location: locOf(r),
      phones: [],
    }))),
  ].filter(r => r.name);
  const relatives = dedup(rawRelatives, r => r.name.toLowerCase());

  // Employment
  const jobs = (primary.employmentList || primary.jobList || fullContact?.employments || []).map(j => ({
    employer: j.employer || j.company || j.organization || j.companyName || '',
    title: j.title || j.position || j.jobTitle || '',
    city: j.city || '',
    state: j.state || '',
    start: j.start || j.startDate || j.meta?.firstSeen || null,
    end: j.end || j.endDate || j.meta?.lastSeen || null,
  })).filter(j => j.employer);

  // Education (BC schema unconfirmed — try common shapes)
  const education = (primary.educationList || fullContact?.educations || []).map(e => ({
    school: e.school || e.organization || e.institution || '',
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

  // Criminal records — most complex schema. BC's criminalList[i] has two
  // parallel structures: offense[] (flat) and crime[] (nested). Flatten
  // both into a single row per case for rendering.
  const criminalRecords = [];
  (primary.criminalList || []).forEach((c, ci) => {
    const offenses = Array.isArray(c.offense) ? c.offense : [];
    const crimes = Array.isArray(c.crime) ? c.crime : [];
    // Prefer offense[] (richer); fall back to crime[] if offense is empty
    const source = offenses.length ? offenses : crimes;
    // Per-record (person-level) detail shared across this record's offenses.
    // High-value for an inmate-search product: mugshot, physical marks, vehicle.
    const nm = Array.isArray(c.name) ? c.name[0] : null;
    const offenderName = nm ? safeStr(nm.data || [nm.first, nm.middle, nm.last].filter(Boolean).join(' ')) : '';
    const photo = c.photo;
    const photoUrl = typeof photo === 'string' ? photo
      : (photo?.url || photo?.data
        || (Array.isArray(photo) ? (typeof photo[0] === 'string' ? photo[0] : (photo[0]?.url || photo[0]?.data || '')) : '')) || '';
    const marks = Array.isArray(c.bodyMark)
      ? c.bodyMark.map(m => safeStr(typeof m === 'string' ? m : (m?.description || m?.type || m?.data || ''))).filter(Boolean)
      : [];
    const vehicles = Array.isArray(c.vehicle)
      ? c.vehicle.map(v => safeStr(typeof v === 'string' ? v : (v?.description || [v?.year, v?.make, v?.model].filter(Boolean).join(' ') || v?.data || ''))).filter(Boolean)
      : [];
    source.forEach((o, oi) => {
      const offense = o.offense || o;
      const courtCase = o.courtCase || o;
      criminalRecords.push({
        id: `${ci}-${oi}`,
        name: offenderName,
        photo: /^(https?:|data:)/i.test(photoUrl) ? photoUrl : '',
        marks,
        vehicles,
        caseNumber: safeStr(o.caseNumber || courtCase.caseNumber || ''),
        offenseDate: pickBcDate(offense.date, o.date),
        chargesFiledDate: pickBcDate(courtCase.chargesFiledDate, o.chargesFiledDate),
        offenseCode: safeStr(offense.code || o.code),
        description: safeStr(offense.description || o.description || (Array.isArray(offense.description) ? offense.description.join('; ') : '')),
        counts: safeStr(courtCase.counts || o.counts),
        disposition: safeStr((courtCase.disposition || o.disposition)?.data),
        dispositionDate: pickBcDate((courtCase.disposition || o.disposition)?.date),
        // Incarceration lifecycle — populated for actual inmate records.
        commitmentDate: pickBcDate(offense.commitment?.date),
        convictionDate: pickBcDate(offense.conviction?.date),
        sentence: safeStr(offense.sentence?.data || offense.sentence?.term || (typeof offense.sentence === 'string' ? offense.sentence : '')),
        releaseDate: pickBcDate(offense.releaseDate),
        comments: safeStr(offense.comments),
        sourceState: safeStr(o.sourceState || c.sourceState),
        sourceName: safeStr(o.sourceName || c.sourceName),
        category: safeStr(offense.category || o.category),
      });
    });
  });

  // Liens / judgments / foreclosures / bankruptcies — same pattern.
  const extractFinancialRecords = (list, defaultType) => {
    return (list || []).map((rec, idx) => {
      const records = Array.isArray(rec.record) ? rec.record : [];
      const info = Array.isArray(rec.info) ? rec.info[0] : (rec.info || {});
      const r0 = records[0] || {};
      const debtor0 = Array.isArray(rec.debtor) ? rec.debtor[0] : null;
      const debtorName = debtor0 && Array.isArray(debtor0.name) && debtor0.name[0]
        ? [debtor0.name[0].first, debtor0.name[0].middle, debtor0.name[0].last].filter(Boolean).join(' ')
        : '';
      const debtorAddress = debtor0 && Array.isArray(debtor0.address) && debtor0.address[0]
        ? [debtor0.address[0].complete, debtor0.address[0].city, debtor0.address[0].state].filter(Boolean).join(', ')
        : '';
      return {
        id: `${defaultType}-${idx}`,
        type: defaultType,
        description: safeStr(r0.caseDescription || rec.caseDescription),
        county: safeStr(info.caseCounty || rec.caseCounty),
        state: safeStr(info.caseState || rec.caseState),
        recordingDate: pickBcDate(r0.recordingDate, rec.recordingDate),
        documentNumber: safeStr(r0.documentLocation?.docNumber || rec.documentNumber),
        issuingAgency: Array.isArray(rec.issuingAgency) ? rec.issuingAgency.filter(Boolean).join(', ') : safeStr(rec.issuingAgency),
        creditor: Array.isArray(rec.creditor) ? rec.creditor.map(c => c?.name?.[0]?.first ? [c.name[0].first, c.name[0].last].filter(Boolean).join(' ') : '').filter(Boolean).join(', ') : '',
        debtorName,
        debtorAddress,
        lienType: Array.isArray(rec.lienType) ? rec.lienType.filter(Boolean).join(', ') : safeStr(rec.lienType),
        courtCaseNumber: Array.isArray(rec.courtCaseNumber) ? rec.courtCaseNumber.filter(Boolean).join(', ') : safeStr(rec.courtCaseNumber),
        taxPeriod: [pickBcDate(r0.taxPeriodMin), pickBcDate(r0.taxPeriodMax)].filter(Boolean).join(' – '),
      };
    });
  };
  const liens = extractFinancialRecords(primary.lienList, 'Lien');
  const judgments = extractFinancialRecords(primary.judgmentList, 'Judgment');
  const foreclosures = extractFinancialRecords(primary.foreclosureList, 'Foreclosure');
  const bankruptcies = extractFinancialRecords(primary.bankruptcyList, 'Bankruptcy');

  // Properties — BC's propertyList[i] is NESTED: { address{}, assessment{},
  // detail{}, owner[], history[], foreclosure{} }. (Earlier flat-key extract read
  // p.apn/p.assessedValue etc. that don't exist → card rendered nothing.)
  const ownerName = (oArr) => {
    const o0 = Array.isArray(oArr) ? oArr[0] : null;
    if (!o0) return '';
    if (o0.name) return safeStr(o0.name);
    const pn = Array.isArray(o0.personName) ? o0.personName[0] : null;
    return pn ? safeStr([pn.first, pn.middle, pn.last].filter(Boolean).join(' ')) : '';
  };
  const properties = (primary.propertyList || []).map((p, i) => {
    const det = p.detail || {};
    const ass = p.assessment || {};
    const addr = p.address || {};
    const lastSale = (Array.isArray(p.history) ? p.history : [])
      .map(h => ({
        date: pickBcDate(h.detail?.transferDate, h.detail?.receiptDate),
        deedType: safeStr(h.detail?.deedType),
        buyer: ownerName(h.buyer),
        seller: ownerName(h.seller),
      }))
      .filter(s => s.date || s.deedType)[0] || null;
    return {
      id: `prop-${i}`,
      address: safeStr(addr.data || addr.complete || [addr.streetNumber, addr.predir, addr.street, addr.streetSuffix].filter(Boolean).join(' ')),
      city: safeStr(addr.city), state: safeStr(addr.state), zip: safeStr(addr.zip),
      apn: safeStr(det.parcelNumber),
      county: safeStr(det.county),
      useCode: safeStr(det.useCode),
      ownershipStatus: safeStr(det.ownershipStatus),       // clear text: "TRUST", "JOINT TENANTS"…
      bedCount: det.bedrooms || null,
      bathCount: det.bathrooms || null,
      yearBuilt: safeStr(det.yearBuilt),
      buildingSqft: det.buildingSqft || null,
      lotSqft: det.lotSqft || null,
      assessedValue: ass.assessedValue || null,
      marketValue: ass.marketValue || null,
      assessedYear: safeStr(ass.taxYear || ass.assessorYear),
      totalTax: ass.totalTax || null,
      owner: ownerName(p.owner),
      lastSale,
      foreclosure: !!(p.foreclosure && Object.keys(p.foreclosure).length),
    };
  });

  // Professional licences
  const professionalLicenses = (primary.professionalList || []).map((p, i) => ({
    id: `lic-${i}`,
    profession: safeStr(p.profession || p.type || p.description),
    licenseNumber: safeStr(p.licenseNumber || p.number),
    state: safeStr(p.state),
    issued: pickBcDate(p.issuedDate, p.issued),
    expires: pickBcDate(p.expirationDate, p.expires),
    status: safeStr(p.status),
  }));

  // Other public records — driver licence, veteran status, businesses, etc.
  const driverLicenses = (primary.driverLicenseList || []).map((d, i) => ({
    id: `dl-${i}`,
    state: safeStr(d.state),
    number: safeStr(d.number || d.licenseNumber),
    issued: pickBcDate(d.issuedDate, d.issued),
    expires: pickBcDate(d.expirationDate, d.expires),
  }));
  const veteranRecords = (primary.veteranList || []).map((v, i) => ({
    id: `vet-${i}`,
    branch: safeStr(v.branch),
    rank: safeStr(v.rank),
    serviceDates: safeStr(v.serviceDates),
  }));
  const businesses = (primary.businessList || []).concat(primary.companyList || []).map((b, i) => ({
    id: `biz-${i}`,
    name: safeStr(b.name || b.companyName || b.businessName),
    role: safeStr(b.role || b.title),
    address: safeStr(b.address || b.fullAddress),
    state: safeStr(b.state),
  }));

  // Watchlists
  const sanctions = (primary.sanctionsList || []).map((s, i) => ({
    id: `sanc-${i}`,
    list: safeStr(s.list || s.source),
    program: safeStr(s.program),
    date: pickBcDate(s.date),
  }));
  const fraudFlags = (primary.fraudList || []).map((f, i) => ({
    id: `fraud-${i}`,
    flag: safeStr(f.flag || f.type),
    source: safeStr(f.source),
    date: pickBcDate(f.date),
  }));
  const arrests = (primary.arrestsList || []).map((a, i) => ({
    id: `arr-${i}`,
    charge: safeStr(a.charge || a.description),
    date: pickBcDate(a.arrestDate, a.date),
    sourceState: safeStr(a.sourceState),
    sourceName: safeStr(a.sourceName),
  }));
  const arrestWatch = (primary.arrestWatchList || []).map((a, i) => ({
    id: `aw-${i}`,
    description: safeStr(a.description),
    date: pickBcDate(a.date),
  }));
  const deaths = (primary.deathList || []).map((d, i) => ({
    id: `death-${i}`,
    date: pickBcDate(d.date, d.deathDate),
    state: safeStr(d.state),
    sourceName: safeStr(d.sourceName),
  }));

  // Family Watchdog (sex offender registry — separate data class)
  const offenders = familyWatchdog?.offenders || (Array.isArray(familyWatchdog) ? familyWatchdog : []);

  // Secondary identities (identities[1+])
  const secondaryIdentities = identities.slice(1);

  // Summary counts — BC provides these as direct fields on primary, fall
  // back to derived counts from the lists we extracted above.
  const counts = {
    address: primary.addressCount ?? addresses.length,
    phone: primary.phoneCount ?? phones.length,
    mobilePhone: primary.mobilePhoneCount ?? phones.filter(p => /mobile/i.test(p.type)).length,
    residentialPhone: primary.residentialPhoneCount ?? phones.filter(p => /residential/i.test(p.type)).length,
    email: primary.emailCount ?? emails.length,
    relative: primary.relativeCount ?? relatives.length,
    employment: primary.employmentCount ?? jobs.length,
    associatedBusiness: primary.associatedBusinessCount ?? businesses.length,
    property: primary.propertyCount ?? properties.length,
    bankruptcy: primary.bankruptcyCount ?? bankruptcies.length,
    lien: primary.lienCount ?? liens.length,
    judgment: primary.judgmentCount ?? judgments.length,
    foreclosure: primary.foreclosureCount ?? foreclosures.length,
    criminal: primary.criminalCount ?? criminalRecords.length,
    aircraft: primary.aircraftCount ?? 0,
    professionalLicense: primary.professionalLicenseCount ?? professionalLicenses.length,
    ip: primary.ipCount ?? 0,
  };

  return {
    // Existing
    fullName, aliases, dob, age, gender, citizenship, provider,
    currentLocation, addresses, phones, emails, relatives,
    jobs, education, social, offenders, secondaryIdentities,
    // New
    counts,
    criminalRecords,
    liens, judgments, foreclosures, bankruptcies,
    properties,
    professionalLicenses,
    driverLicenses, veteranRecords, businesses,
    sanctions, fraudFlags, arrests, arrestWatch, deaths,
  };
}

module.exports = { extractAll, formatDateRange, formatBcDate, dedup, fmtPhone };
