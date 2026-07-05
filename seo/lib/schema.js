// JSON-LD builders (teardown §1.3 — all blocks server-rendered in initial HTML).
// PII policy: full streetAddress goes in Person/PostalAddress schema while the
// visible teaser obfuscates it — the aggressive Spokeo model, owner-validated
// 2026-07-02 (plan §0.2/§4). FAQPage is the anti-thin-content engine (§4).

const SITE = 'https://www.idlookup.ai';

export function orgJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'IDLookup.AI',
    url: SITE,
    logo: `${SITE}/idlookup-logo.png`,
  };
}

export function webPageJsonLd(person, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${person.fullName} in ${person.city}, ${person.state}`,
    description: pageDescription(person),
    url,
  };
}

export function breadcrumbJsonLd(person, paths) {
  const items = [
    { name: 'People Search', item: `${SITE}/people` },
    { name: `${person.firstName} ${person.lastName}`, item: `${SITE}${paths.name}` },
    { name: `${person.fullName}`, item: `${SITE}${paths.person}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  };
}

export function personJsonLd(person, paths) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.fullName,
    additionalName: person.aliases,
    homeLocation: [
      {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          streetAddress: person.streetAddress,
          addressLocality: person.city,
          addressRegion: person.state,
          postalCode: person.postalCode,
        },
      },
      ...person.priorCities.map((c) => ({
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: c.city, addressRegion: c.state },
      })),
    ],
    relatedTo: person.relatives.map((r) => ({
      '@type': 'Person',
      name: r.fullName,
      url: `${SITE}/people/${r.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    })),
    url: `${SITE}${paths.person}`,
  };
}

// Data-driven FAQ — templated but unique per record set (teardown §1.4: this is
// what keeps generated pages out of doorway-penalty territory).
export function buildFaq(person) {
  const n = person.nameStats?.total ?? 1;
  const states = person.nameStats?.states || [person.state];
  const name = `${person.firstName} ${person.lastName}`;
  const faqs = [
    {
      q: `How many people named ${name} are there in the US?`,
      a: `We found ${n} ${n === 1 ? 'person' : 'people'} named ${name} in America, across ${states.length} state${states.length === 1 ? '' : 's'}.${n <= 3 ? ' This is a nearly-unique name in the US.' : ''}`,
    },
    {
      q: `Where does ${name} live?`,
      a: `${person.fullName} lives in ${person.city}, ${person.state}.${person.priorCities.length ? ` Past locations include ${person.priorCities.map((c) => `${c.city}, ${c.state}`).join(' and ')}.` : ''}`,
    },
    {
      q: `How old is ${name}?`,
      a: `${person.fullName} is ${person.age} years old.`,
    },
  ];
  if (person.employers?.length) {
    faqs.push({
      q: `Where does ${name} work?`,
      a: `We found the following companies associated with ${name}'s work history: ${person.employers.join(', ')}.`,
    });
  }
  if (person.relatives?.length) {
    faqs.push({
      q: `Who is ${name} related to?`,
      a: `Known relatives of ${person.fullName} include ${person.relatives.map((r) => r.fullName).join(', ')}.`,
    });
  }
  return faqs;
}

export function faqJsonLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function pageTitle(person) {
  return `${person.fullName} in ${person.city}, ${person.state} — Age, Phone, Address | IDLookup`;
}

export function pageDescription(person) {
  return `${person.fullName}, age ${person.age}, lives in ${person.city}, ${person.state}. Find ${person.firstName}'s phone number, address history, email, and relatives on IDLookup.`;
}

// Visible-teaser obfuscation (Spokeo model): house number → token. When we have no
// street at all (teaser is city-level), show a fully-masked street so the line reads
// as a tease ("•••• ••••••, Simi Valley, CA") rather than a stray leading comma.
export function obfuscateStreet(street) {
  const s = String(street || '').trim();
  if (!s) return '•••• ••••••';
  return s.replace(/^\S+/, '••••');
}

// ── Hub schema (directory levels: name → state → city) ────────────────────────
// Generic breadcrumb from [{name, path}] (path is site-relative or absolute).
export function crumbsJsonLd(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.path.startsWith('http') ? c.path : `${SITE}${c.path}`,
    })),
  };
}

// CollectionPage + ItemList for a hub. `items` = [{name, path}] (people or sub-hubs).
export function collectionJsonLd({ name, description, url, items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: it.path.startsWith('http') ? it.path : `${SITE}${it.path}`,
      })),
    },
  };
}
