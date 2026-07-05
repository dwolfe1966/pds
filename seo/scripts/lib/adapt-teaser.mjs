// Adapt a BC name-teaser response into SEO profile records (the shape the app's
// leaf + hub templates expect — see seo/lib/fixtures.js). Built to the live prod
// payload shape: commerceContent.raws[0].transient.{identities[], total}. Each
// identity carries name/dob/address/relationship lists + per-identity counts+flags
// (confirmed 2026-07-04, "david wexler ca"). Teaser is CITY-LEVEL — no street/
// phone/email VALUES (those are paid-report tier), so streetAddress stays null.
import { mintPublicId, titleCase, toInt } from './mint.mjs';

// commerceContent → { identities: [...profiles], total }
export function adaptTeaserResponse(payload, query = {}) {
  const cc = payload?.commerceContent || payload || {};
  const raws = cc.raws || payload?.raws || [];
  const transient = raws.find((r) => r?.transient?.identities)?.transient || {};
  const identities = transient.identities || [];
  const total = toInt(transient.total) || identities.length;

  const states = [...new Set(identities
    .map((id) => (id.addressList?.[0]?.state || '').toUpperCase())
    .filter(Boolean))];
  const nameStats = { total, states };

  return {
    total,
    query,
    profiles: identities.map((id) => adaptIdentity(id, nameStats)).filter(Boolean),
  };
}

function earliestYear(nameList) {
  const years = (nameList || [])
    .map((n) => n?.meta?.firstSeen)
    .filter(Boolean)
    .map((d) => Math.floor(d / 10000))
    .filter((y) => y > 1900 && y <= new Date().getFullYear());
  return years.length ? Math.min(...years) : null;
}

export function adaptIdentity(identity, nameStats) {
  const nameList = identity.nameList || [];
  const primary = nameList[0];
  if (!primary) return null; // extId is ephemeral + unused → not required

  const firstName = titleCase(primary.first);
  const lastName = titleCase(primary.last);
  const fullName = titleCase(primary.data || `${primary.first} ${primary.middle || ''} ${primary.last}`);
  const aliases = [...new Set(nameList.slice(1)
    .map((n) => titleCase(n.data || `${n.first} ${n.last}`))
    .filter((a) => a && a.toLowerCase() !== fullName.toLowerCase()))];

  const addrs = (identity.addressList || []).map((a) => ({ city: titleCase(a.city), state: (a.state || '').toUpperCase() }))
    .filter((a) => a.city && a.state);
  const current = addrs[0];
  if (!current) return null; // no location → no URL → skip

  const relatives = (identity.relationshipList || []).map((r) => ({
    // Relatives lack a location in the teaser → mint from name only (best-effort;
    // they link to a name hub, not a specific profile).
    id: r.name?.first ? mintPublicId([titleCase(r.name.first), titleCase(r.name.last)]) : null,
    fullName: titleCase([r.name?.first, r.name?.last].filter(Boolean).join(' ')),
    relation: r.relationshipName || null,
  })).filter((r) => r.fullName);

  const onRecordSince = earliestYear(nameList);

  return {
    // STABLE id from natural attributes (name+city+state+first-seen). NOT the
    // ephemeral extId. This survives re-fetches AND lets the SUP re-find the person.
    id: mintPublicId([firstName, lastName, current.city, current.state, onRecordSince]),
    firstName,
    lastName,
    fullName,
    aliases,
    age: toInt(identity.dobList?.[0]?.age) || null,
    city: current.city,
    state: current.state,
    priorCities: addrs.slice(1),
    streetAddress: null,   // city-level teaser — no street value
    postalCode: null,
    counts: {
      addresses: toInt(identity.addressCount),
      phones: toInt(identity.phoneCount),
      emails: toInt(identity.emailCount),
    },
    relatives,
    employers: [],
    onRecordSince: earliestYear(nameList),
    // Honest per-category presence, straight from the teaser (for chips/FAQ).
    found: {
      criminal: !!identity.isCriminal || toInt(identity.criminalCount) > 0,
      property: !!identity.isPropertyOwner || toInt(identity.propertyCount) > 0,
      relatives: toInt(identity.relativeCount),
      employment: !!identity.hasEmployment,
      vehicle: !!identity.hasVehicle,
    },
    nameStats,
  };
}
