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
      apt: [a.aptName, a.aptNum].map(safeStr).filter(Boolean).join(' ').trim(),
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

  // Criminal records — BC's criminalList[i] carries TWO parallel structures:
  // offense[] (flat) and crime[] (nested under offense{}/courtCase{}). They are
  // parallel SETS but NOT index-aligned (BC orders them differently — verified on
  // a live packet: offense[5]="BURGLARY"/crime[5]="BATTERY", swapped at [6]). So we
  // build each charge row WHOLLY from one source (never mix charge↔disposition across
  // the two) and dedupe by charge+case. This fixes blank charge names: COURT-category
  // rows have an empty offense.description while the charge lives in
  // crime[].offense.description. Per feedback_expose_all_report_data we surface every
  // offense/courtCase field BC sends, not a curated subset.
  const criminalRecords = [];
  const normKey = (s) => safeStr(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const joinDesc = (d) => (Array.isArray(d) ? d.filter(Boolean).join('; ') : safeStr(d));
  (primary.criminalList || []).forEach((c, ci) => {
    const offenses = Array.isArray(c.offense) ? c.offense : [];
    const crimes = Array.isArray(c.crime) ? c.crime : [];
    // Per-record (person-level) detail shared across this record's charges.
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
    // Physical descriptors. NOTE: we deliberately do NOT derive a per-record "sex
    // offender" flag from c.sexOffender — present-but-empty on non-offenders; the
    // dedicated Sex Offender Registry section (familyWatchdog) is authoritative.
    const physical = {
      sex: safeStr(c.sex),
      race: safeStr(c.race),
      // Provider sometimes appends a dangling " OR" artifact (e.g. "212 LBS OR").
      height: safeStr(c.height).replace(/\s+OR\s*$/i, '').trim(),
      weight: safeStr(c.weight).replace(/\s+OR\s*$/i, '').trim(),
      hairColor: safeStr(c.hairColor),
      eyeColor: safeStr(c.eyeColor),
      skinTone: safeStr(c.skinTone),
      age: safeStr(c.age),
      birthState: safeStr(c.birthState),
    };
    const hasPhysical = Object.values(physical).some(Boolean);

    // Map one offense[] element -> a self-consistent charge row.
    const fromOffense = (o) => ({
      charge: joinDesc(o.description),
      caseNumber: safeStr(o.caseNumber),
      offenseCode: safeStr(o.code),
      counts: safeStr(o.counts),
      category: safeStr(o.category),
      caseType: safeStr(o.caseType),
      court: safeStr(o.court),
      county: safeStr(o.countyOrJurisdiction),
      plea: safeStr(o.plea),
      fines: safeStr(o.fines),
      disposition: safeStr(o.disposition?.data),
      dispositionDate: pickBcDate(o.disposition?.date),
      amendedDispositionDate: pickBcDate(o.amendedDisposition?.date),
      offenseDate: pickBcDate(o.date),
      chargesFiledDate: pickBcDate(o.chargesFiledDate),
      convictionDate: pickBcDate(o.conviction?.date),
      commitmentDate: pickBcDate(o.commitment?.date),
      releaseDate: pickBcDate(o.releaseDate),
      warrantDate: pickBcDate(o.warrant?.date),
      arrestDate: pickBcDate(o.arrest?.date),
      supervisionDate: pickBcDate(o.supervision?.date),
      sentence: safeStr(o.sentence?.data || o.sentence?.term || (typeof o.sentence === 'string' ? o.sentence : '')),
      comments: joinDesc(o.comments),
      sourceState: safeStr(o.sourceState || c.sourceState),
      sourceName: safeStr(o.sourceName || c.sourceName),
    });
    // Map one crime[] element (nested offense{}/courtCase{}) -> a charge row.
    const fromCrime = (cr) => {
      const off = cr.offense || {};
      const cc = cr.courtCase || {};
      return {
        charge: joinDesc(off.description),
        caseNumber: safeStr(cr.caseNumber || cc.caseNumber),
        offenseCode: safeStr(off.code),
        counts: safeStr(cc.counts),
        category: safeStr(off.category),
        caseType: safeStr(cc.caseType),
        court: safeStr(cc.court),
        county: safeStr(cc.countyOrJurisdiction),
        plea: safeStr(cc.plea),
        fines: safeStr(cc.fines),
        disposition: safeStr(cc.disposition?.data),
        dispositionDate: pickBcDate(cc.disposition?.date),
        amendedDispositionDate: pickBcDate(cc.amendedDispositionDate),
        offenseDate: pickBcDate(off.date),
        chargesFiledDate: pickBcDate(cc.chargesFiledDate),
        convictionDate: pickBcDate(cc.conviction?.date),
        commitmentDate: pickBcDate(cc.commitment?.date),
        releaseDate: pickBcDate(cr.releaseDate),
        warrantDate: pickBcDate(cr.warrant?.date),
        arrestDate: pickBcDate(cr.arrest?.date),
        supervisionDate: '',
        sentence: safeStr(cr.sentence?.data || cr.sentence?.term || (typeof cr.sentence === 'string' ? cr.sentence : '')),
        comments: joinDesc(cr.comments),
        sourceState: safeStr(cr.sourceState || c.sourceState),
        sourceName: safeStr(cr.sourceName || c.sourceName),
      };
    };

    const rows = [...offenses.map(fromOffense), ...crimes.map(fromCrime)];
    // Dedupe identical charge+case rows surfaced by BOTH arrays (keep the richer one).
    // Bare court-docket rows are KEPT (not dropped) — their charge name is backfilled
    // globally below from any same-case named charge.
    const seen = new Map();
    rows.forEach((r) => {
      const key = `${normKey(r.charge)}|${normKey(r.caseNumber)}`;
      const prev = seen.get(key);
      if (prev) {
        const score = (x) => Object.values(x).filter(Boolean).length;
        if (score(r) > score(prev)) seen.set(key, r);
        return;
      }
      seen.set(key, r);
    });
    // If a record yielded no charge rows, still surface the person-level detail.
    const finalRows = seen.size ? [...seen.values()] : [{}];
    finalRows.forEach((r, oi) => {
      criminalRecords.push({
        id: `${ci}-${oi}`,
        name: offenderName,
        photo: /^(https?:|data:)/i.test(photoUrl) ? photoUrl : '',
        marks,
        vehicles,
        physical: hasPhysical ? physical : null,
        // `description` retained as the charge label for back-compat (render/PDF/tests).
        description: r.charge || '',
        ...r,
      });
    });
  });
  // Global charge-name backfill: a bare court-docket row inherits the charge from any
  // OTHER criminal row on the same case — within OR across records (BC often files the
  // same case under multiple sources/number formats: 097211 / BA097211 / LACBA097211-01).
  // Only the charge label is borrowed; each row keeps its own disposition/dates/source.
  const caseDigits = (s) => safeStr(s).replace(/\D/g, '');
  const namedCrimRows = criminalRecords.filter(r => r.description && normKey(r.caseNumber).length >= 5);
  criminalRecords.forEach((r) => {
    if (r.description || !r.caseNumber) return;
    const k = normKey(r.caseNumber);
    if (k.length < 5) return;
    const kd = caseDigits(r.caseNumber);
    const hits = new Set();
    namedCrimRows.forEach((nr) => {
      const nk = normKey(nr.caseNumber);
      const nd = caseDigits(nr.caseNumber);
      // Match on full normalized case OR on a shared digit-core (>=6 digits) — same case
      // is often filed under different court prefixes (XCNBA097211-01 vs LACBA097211-01).
      if (nk === k || nk.includes(k) || k.includes(nk)
        || (kd.length >= 6 && nd.length >= 6 && (nd.includes(kd) || kd.includes(nd)))) hits.add(nr.description);
    });
    if (hits.size) r.description = [...hits].join('; ');
  });

  // Shared helpers (used by financial + property extractors). Join every party on an
  // owner/buyer/seller/creditor array — BC can list multiple, person OR business.
  const partyNames = (arr) => (Array.isArray(arr) ? arr : [])
    .map((o) => {
      if (!o) return '';
      if (typeof o === 'string') return safeStr(o);
      if (typeof o.name === 'string') return safeStr(o.name);
      if (o.name && typeof o.name === 'object' && !Array.isArray(o.name)) {
        const v = safeStr(o.name.data || [o.name.first, o.name.middle, o.name.last].filter(Boolean).join(' '));
        if (v) return v;
      }
      const nm = Array.isArray(o.name) && o.name[0] ? o.name[0] : null;
      if (nm) return safeStr(nm.data || [nm.first, nm.middle, nm.last].filter(Boolean).join(' '));
      const pn = Array.isArray(o.personName) && o.personName[0] ? o.personName[0] : null;
      const person = pn ? safeStr([pn.first, pn.middle, pn.last].filter(Boolean).join(' ')) : '';
      const biz = Array.isArray(o.businessName) ? o.businessName.filter(Boolean).join(', ') : '';
      return person || biz || safeStr(o.data);
    })
    .filter(Boolean)
    .join(' & ');
  const fmtAddr = (a) => {
    a = a || {};
    if (a.data) return safeStr(a.data);
    if (a.complete) return safeStr(a.complete);
    const line = safeStr([a.streetNumber, a.predir, a.street, a.streetSuffix, a.aptName, a.aptNum].filter(Boolean).join(' '));
    const cityState = [safeStr(a.city), [safeStr(a.state), safeStr(a.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [line, cityState].filter(Boolean).join(', ');
  };
  const num = (v) => (typeof v === 'number' ? v : (v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : null));
  // creditor/plaintiff/attorney can arrive as a plain STRING or an array of party objects.
  const partyOrStr = (v) => (typeof v === 'string' ? safeStr(v) : partyNames(v));

  // Liens / judgments / bankruptcies share BC's record[]/info[] shape, but the PARTY keys
  // differ: liens use debtor[]; judgments use defendant[]/plaintiff[]/attorney. Per
  // feedback_expose_all_report_data we surface every record[0] + top-level field.
  const extractFinancialRecords = (list, defaultType) => {
    return (list || []).map((rec, idx) => {
      const records = Array.isArray(rec.record) ? rec.record : [];
      const info = Array.isArray(rec.info) ? rec.info[0] : (rec.info || {});
      const r0 = records[0] || {};
      // Liens carry debtor[]; judgments carry defendant[] (the judgment debtor).
      const debtor0 = (Array.isArray(rec.debtor) && rec.debtor[0]) ? rec.debtor[0]
        : ((Array.isArray(rec.defendant) && rec.defendant[0]) ? rec.defendant[0] : null);
      const debtorName = debtor0 && Array.isArray(debtor0.name) && debtor0.name[0]
        ? [debtor0.name[0].first, debtor0.name[0].middle, debtor0.name[0].last].filter(Boolean).join(' ')
        : '';
      const debtorAddress = debtor0 && Array.isArray(debtor0.address) && debtor0.address[0]
        ? fmtAddr(debtor0.address[0])
        : '';
      return {
        id: `${defaultType}-${idx}`,
        type: defaultType,
        description: safeStr(r0.caseDescription || rec.caseDescription),
        county: safeStr(info.caseCounty || rec.caseCounty),
        state: safeStr(info.caseState || rec.caseState),
        recordingDate: pickBcDate(r0.recordingDate, rec.recordingDate),
        documentNumber: safeStr(r0.documentLocation?.docNumber || rec.documentNumber),
        damarType: safeStr(r0.damarType),
        origRecordingDate: pickBcDate(r0.origRecordingDate),
        documentFilingDate: pickBcDate(r0.documentFilingDate),
        origDocumentDate: pickBcDate(r0.origDocumentDate),
        abstractIssueDate: pickBcDate(r0.abstractIssueDate),
        stayOrderedDate: pickBcDate(r0.stayOrderedDate),
        refileExtendLastDate: pickBcDate(r0.refileExtendLastDate),
        issuingAgency: Array.isArray(rec.issuingAgency) ? rec.issuingAgency.filter(Boolean).join(', ') : safeStr(rec.issuingAgency),
        creditor: partyOrStr(rec.creditor),
        plaintiff: partyOrStr(rec.plaintiff),
        defendant: partyNames(rec.defendant),
        attorney: partyOrStr(rec.attorney),
        stayOrdered: safeStr(r0.stayOrdered),
        debtorName,
        debtorAddress,
        lienType: Array.isArray(rec.lienType) ? rec.lienType.filter(Boolean).join(', ') : safeStr(rec.lienType),
        taxCertificationNumber: Array.isArray(rec.taxCertificationNumber) ? rec.taxCertificationNumber.filter(Boolean).join(', ') : safeStr(rec.taxCertificationNumber),
        courtCaseNumber: Array.isArray(rec.courtCaseNumber) ? rec.courtCaseNumber.filter(Boolean).join(', ') : safeStr(rec.courtCaseNumber),
        hoaAddress: Array.isArray(rec.hoaAddress) && rec.hoaAddress[0] ? fmtAddr(rec.hoaAddress[0]) : '',
        lienProperty: Array.isArray(rec.property) && rec.property[0] ? fmtAddr(rec.property[0].address || rec.property[0]) : '',
        taxPeriod: [pickBcDate(r0.taxPeriodMin), pickBcDate(r0.taxPeriodMax)].filter(Boolean).join(' – '),
      };
    });
  };
  // Foreclosures use a DIFFERENT BC shape: detail[] (auction/trustee/beneficiary/amounts)
  // + trustor[] (the borrower). The old record[]/info[]/debtor[] extractor rendered these
  // nearly blank — handle their real shape and expose every field.
  const personOrData = (o) => safeStr(o?.data || (o && [o.first, o.middle, o.last].filter(Boolean).join(' ')) || '');
  const extractForeclosures = (list) => {
    return (list || []).map((rec, idx) => {
      const d = (Array.isArray(rec.detail) ? rec.detail[0] : rec.detail) || {};
      return {
        id: `Foreclosure-${idx}`,
        type: 'Foreclosure',
        description: safeStr(d.documentType || d.recordType || 'Foreclosure'),
        recordType: safeStr(d.recordType),
        documentType: safeStr(d.documentType),
        documentNumber: safeStr(d.documentNumber),
        recordingDate: pickBcDate(d.documentDate),
        auctionDate: pickBcDate(d.auctionDate),
        auctionTime: safeStr(d.auctionTime),
        trusteeSaleDate: pickBcDate(d.trusteeSaleDate),
        delinquentDate: pickBcDate(d.delinquentDate),
        originalLoanDate: pickBcDate(d.originalLoanDate),
        defaultAmount: num(d.defaultAmount),
        defaultPrincipalBalance: num(d.defaultPrincipalBalance),
        beneficiary: personOrData(d.beneficiary),
        trustee: personOrData(d.trustee),
        titleCompany: safeStr(d.titleCompanyName),
        debtorName: partyNames(rec.trustor),
        lienProperty: d.address ? fmtAddr(d.address) : '',
        county: safeStr(d.address?.county),
        state: safeStr(d.address?.state),
      };
    });
  };
  const liens = extractFinancialRecords(primary.lienList, 'Lien');
  const judgments = extractFinancialRecords(primary.judgmentList, 'Judgment');
  const foreclosures = extractForeclosures(primary.foreclosureList);
  const bankruptcies = extractFinancialRecords(primary.bankruptcyList, 'Bankruptcy');

  // Properties — BC's propertyList[i] is NESTED: { address{}, assessment{},
  // detail{}, owner[], history[], foreclosure{} }. (Earlier flat-key extract read
  // p.apn/p.assessedValue etc. that don't exist → card rendered nothing.)
  // partyNames / fmtAddr / num are defined once above (shared with the financial extractor).
  const properties = (primary.propertyList || []).map((p, i) => {
    const det = p.detail || {};
    const ass = p.assessment || {};
    const addr = p.address || {};
    // Full transfer history (BC's history[] is newest-first). Per
    // feedback_expose_all_report_data we now surface every confirmed field:
    // salesPrice, transferType, docNumber, quitclaim/arms-length flags, and the
    // attached loan (loanValue/loanType/rate — rate is x100, 370 => 3.70%).
    const history = (Array.isArray(p.history) ? p.history : [])
      .map((h) => {
        const hd = h.detail || {};
        const loan0 = Array.isArray(h.loan) ? h.loan[0] : (h.loan || null);
        const rate = loan0 && typeof loan0.estimatedInterestRate === 'number' ? loan0.estimatedInterestRate / 100 : null;
        return {
          date: pickBcDate(hd.transferDate, hd.receiptDate),
          transferDate: pickBcDate(hd.transferDate),
          recordingDate: pickBcDate(hd.receiptDate),
          deedType: safeStr(hd.deedType),
          transferType: safeStr(hd.transferType),
          salesPrice: num(hd.salesPrice),
          docNumber: safeStr(hd.docNumber),
          quitclaim: safeStr(hd.quitclaimFlag),
          armsLength: safeStr(hd.armsLengthFlag),
          buyer: partyNames(h.buyer),
          seller: partyNames(h.seller),
          isCurrentOwner: !!h.isCurrentOwner,
          loanValue: num(loan0 && loan0.loanValue),
          loanType: safeStr(loan0 && loan0.loanType),
          interestRate: rate,
        };
      })
      .filter(s => s.date || s.deedType || s.buyer || s.seller || s.salesPrice || s.docNumber || s.loanValue);
    const lastSale = history[0] || null;
    return {
      id: `prop-${i}`,
      address: safeStr(addr.data || addr.complete || [addr.streetNumber, addr.predir, addr.street, addr.streetSuffix].filter(Boolean).join(' ')),
      city: safeStr(addr.city), state: safeStr(addr.state), zip: safeStr(addr.zip),
      mailingAddress: fmtAddr(p.mailingAddress),
      apn: safeStr(det.parcelNumber),
      county: safeStr(det.county),
      useCode: safeStr(det.useCode),
      propertyDescription: safeStr(det.propertyDescription),
      subdivision: safeStr(det.subdivision),
      ownershipStatus: safeStr(det.ownershipStatus),       // clear text: "TRUST", "JOINT TENANTS"…
      bedCount: det.bedrooms || null,
      bathCount: det.bathrooms || null,
      yearBuilt: safeStr(det.yearBuilt),
      buildingSqft: det.buildingSqft || null,
      lotSqft: det.lotSqft || null,
      assessedValue: num(ass.assessedValue),
      marketValue: num(ass.marketValue),
      landValue: num(ass.landValue),
      improvementValue: num(ass.improvementValue),
      assessedYear: safeStr(ass.taxYear || ass.assessorYear),
      totalTax: num(ass.totalTax),
      owner: partyNames(p.owner),
      lastSale,
      history,
      foreclosure: !!(p.foreclosure && Object.keys(p.foreclosure).length),
    };
  });

  // Professional licences — BC's real shape is { info{ license{}, ...dates }, person[],
  // business[], address[], phone[], email[], url[] }, NOT the flat profession/licenseNumber
  // keys the old extractor assumed (so it rendered blank). Expose every field.
  const professionalLicenses = (primary.professionalList || []).map((p, i) => {
    const info = p.info || {};
    const lic = info.license || {};
    const person = (Array.isArray(p.person) && p.person[0]) ? p.person[0] : null;
    const personName = person && Array.isArray(person.name) && person.name[0]
      ? safeStr([person.name[0].first, person.name[0].middle, person.name[0].last].filter(Boolean).join(' ')) : '';
    const biz = (Array.isArray(p.business) && p.business[0] && Array.isArray(p.business[0].businessName))
      ? p.business[0].businessName.filter(Boolean).join(', ') : '';
    return {
      id: `lic-${i}`,
      profession: safeStr(lic.desc || p.profession || p.type || p.description),
      licenseNumber: safeStr(lic.number || p.licenseNumber || p.number),
      state: safeStr(lic.state || p.state),
      board: safeStr(lic.board),
      status: safeStr(info.status || info.statusCode || p.status),
      issued: pickBcDate(info.originalIssueDate, p.issuedDate, p.issued),
      registered: pickBcDate(info.registeredDate),
      expires: pickBcDate(info.expirationDate, p.expirationDate, p.expires),
      recordDate: pickBcDate(info.recordDate),
      person: personName,
      business: biz,
      address: (Array.isArray(p.address) && p.address[0]) ? fmtAddr(p.address[0]) : '',
      phone: Array.isArray(p.phone) ? p.phone.filter(Boolean).join(', ') : safeStr(p.phone),
      email: Array.isArray(p.email) ? p.email.filter(Boolean).join(', ') : safeStr(p.email),
      url: Array.isArray(p.url) ? p.url.filter(Boolean).join(', ') : safeStr(p.url),
    };
  });

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
  // IDI deathList (DMF/vital-records derived). Shape is unconfirmed against a real deceased record, so extract
  // defensively across the common DMF field names (per feedback_expose_all_report_data). Obituary/burial come
  // from the death teaser vendor, not IDI — this section confirms the passing (dates + last residence).
  const deaths = (primary.deathList || []).map((d, i) => ({
    id: `death-${i}`,
    date: pickBcDate(d.date, d.deathDate, d.dateOfDeath, d.death?.date),
    dob: pickBcDate(d.dob, d.birthDate, d.dateOfBirth, d.dob?.date),
    age: safeStr(d.age || d.ageAtDeath),
    city: safeStr(d.city || d.lastResidenceCity),
    state: safeStr(d.state || d.lastResidenceState),
    zip: safeStr(d.zip || d.zipCode || d.lastResidenceZip),
    birthState: safeStr(d.birthState || d.ssnIssueState || d.ssnState),
    sourceName: safeStr(d.sourceName || d.source),
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

/**
 * Approximate how long someone lived at an address, from first/last-seen
 * (YYYYMMDD ints or date-ish strings). Returns e.g. "~2.7 yrs", "~8 mo", or ''.
 */
function residenceDuration(first, last) {
  const toDate = (v) => {
    if (!v) return null;
    const s = String(v);
    if (/^\d{8}$/.test(s)) {
      const dt = new Date(+s.slice(0, 4), (+s.slice(4, 6) || 1) - 1, +s.slice(6, 8) || 1);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const f = toDate(first);
  const l = toDate(last);
  if (!f || !l) return '';
  const yrs = (l - f) / (365.25 * 24 * 3600 * 1000);
  if (yrs < 0) return '';
  if (yrs < 1) {
    const mo = Math.round(yrs * 12);
    return mo <= 0 ? '' : `~${mo} mo`;
  }
  return `~${yrs < 10 ? yrs.toFixed(1) : Math.round(yrs)} yrs`;
}

module.exports = { extractAll, formatDateRange, formatBcDate, dedup, fmtPhone, residenceDuration };
