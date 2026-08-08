// Opt-out PLAYBOOK — turns a raw opt-out link into a prepared experience. For any provider it answers:
// what this actually achieves, what info you'll need to have ready, the steps + the verification hurdle
// you'll hit, how long it takes, and a PRE-WRITTEN request composed from the member's identity. Generic
// defaults (keyed on nature + method) cover every one of the ~85 catalog sources; SPECIFIC overrides add
// exact detail for the highest-value providers. Source of truth for per-vendor facts:
// docs/product/broker-optout-automation-matrix.md.
//
// Deliberately states DEGREE, never over-promises: a file-access bureau says "see & dispute, not delete";
// a CAPTCHA/OTP step is called out so the member expects it. See [[feedback_honest_approach_flag]].

// Canonical info items the member may need (label + whether we can pre-fill it from the claimed identity).
export const INFO = {
  name:        'Full legal name',
  email:       'Email address',
  address:     'Current street address',
  prevAddress: 'Any previous addresses',
  dob:         'Date of birth',
  phone:       'Phone number',
  ssn:         'SSN (or last 4)',
  govId:       'Photo of a government ID',
  listingUrl:  'The link to your listing on the site',
  facePhoto:   'A clear photo of your face',
  account:     'Your account login for the site',
};

// Which items we already hold from the member's claimed identity + removal profile. Drives the have/need
// checklist so the member knows what to gather (and what we can pre-fill for them).
export function haveInfo(identity) {
  const id = identity || {};
  return {
    name: !!id.name, email: !!id.email, address: !!id.address, dob: !!id.dob,
    phone: !!id.phone, prevAddress: !!id.prevAddress,
  };
}

// Items the member can enter once and we store on the identity to pre-fill every future request. We
// DELIBERATELY never store SSN or ID/face photos (needed at the provider, but not held by us).
export const CAPTURABLE = { address: 'text', prevAddress: 'text', dob: 'date', phone: 'tel' };

const DAYS = (s) => s; // readability

// Generic playbook by (nature, method). Every source resolves to one of these even without a SPECIFIC entry.
function generic({ nature, method }) {
  if (nature === 'freeze') return {
    achieves: 'Freeze your file so new requesters (lenders, landlords, employers) can’t pull it. Your data isn’t deleted — access is locked.',
    needs: ['name', 'ssn', 'dob', 'address'],
    steps: ['Open the freeze form', 'Verify your identity (SSN/DOB required)', 'Submit — you can unfreeze later when you need a check run'],
    verification: 'Identity verification with SSN + DOB',
    timeline: 'Usually effective within ~3 days',
    prefill: 'form_values',
  };
  if (nature === 'file_access_only') return {
    achieves: 'See exactly what they hold on you and dispute anything wrong. This is a regulated consumer file — it can’t be deleted, only corrected.',
    needs: ['name', 'dob', 'ssn', 'address', 'govId'],
    steps: ['Request your file disclosure', 'Review what they report', 'Dispute any inaccurate item in writing'],
    verification: 'Identity verification (SSN/DOB, sometimes a photo ID)',
    timeline: 'Disclosure ~15 days; disputes ~30 days',
    prefill: 'form_values',
  };
  if (nature === 'account_deletion') return {
    achieves: 'Remove your data by deleting your own account. Records others created about you generally aren’t covered.',
    needs: ['account', 'email'],
    steps: ['Log in to your account', 'Open account/privacy settings', 'Request account deletion (usually irreversible)'],
    verification: 'Account login',
    timeline: 'Up to ~30 days',
    prefill: 'account',
  };
  if (nature === 'search_delist') return {
    achieves: 'Remove the result from search listings. The underlying page on the source site stays up — remove it at the source too.',
    needs: ['name', 'listingUrl'],
    steps: ['Gather the exact URLs of the results about you', 'Submit them for removal', 'They review each against policy (manual)'],
    verification: 'Manual review; you supply the exact result URLs',
    timeline: '~days to a few weeks',
    prefill: 'form_values',
  };
  if (nature === 'no_optout') return {
    achieves: 'No direct opt-out here. Reduce exposure by removing the upstream sources that feed it, and by limiting what’s public at the origin.',
    needs: [],
    steps: ['Remove yourself from the upstream data brokers that feed this', 'Where it’s a public record, ask the issuing office about redaction'],
    verification: null,
    timeline: 'Indirect',
    prefill: 'none',
  };
  if (method === 'email') return {
    achieves: 'Opt out / request deletion by an emailed request. Data may be re-listed later if re-sourced, so it’s worth re-checking.',
    needs: ['name', 'email', 'address'],
    steps: ['We pre-write your deletion request', 'Send it from your email to their privacy address', 'Reply to any confirmation they send back'],
    verification: 'They usually email back to confirm — reply to complete',
    timeline: '~15–45 days',
    prefill: 'ccpa_email',
  };
  // default: browser / form_post opt-out (suppression / true_removal)
  return {
    achieves: nature === 'true_removal'
      ? 'Delete your listing at this site. It can be re-added later if re-sourced.'
      : 'Suppress (hide) your listing. Your data may be re-listed later if re-sourced.',
    needs: ['name', 'email', 'listingUrl'],
    steps: ['Find your listing on the site', 'Submit the opt-out form (have the fields ready)', 'Click the confirmation link they email you'],
    verification: 'Email confirmation link — and often a CAPTCHA',
    timeline: '~1–6 weeks',
    prefill: 'form_values',
  };
}

// Exact overrides for the highest-value / most-used providers (facts from the automation matrix research).
// Only fields that differ from generic need to be set; the rest fall through.
const SPECIFIC = {
  spokeo:            { verification: 'reCAPTCHA + click the email confirmation link', timeline: 'Re-lists ~every 90 days — re-check quarterly' },
  whitepages:        { verification: 'An automated PHONE CALL reads you a 4-digit code to enter', steps: ['Find your listing', 'Start the suppression wizard', 'Enter the 4-digit code from the automated call'], timeline: 'Re-lists ~every 30 days' },
  intelius:          { note: 'One PeopleConnect request also covers TruthFinder, Instant Checkmate & US Search.', verification: 'Email link + your date of birth' },
  truthfinder:       { note: 'Shares the PeopleConnect Suppression Center with Intelius/Instant Checkmate/US Search.' },
  fastpeoplesearch:  { verification: 'Several CAPTCHAs in a row + email confirmation link' },
  thatsthem:         { verification: 'Just an email confirmation click — no CAPTCHA (one of the easiest)', timeline: '~a few days' },
  mylife:            { note: 'No direct link — email membersupport@mylife.com or use the site’s “Do Not Sell” footer link.' },
  the_work_number:   { note: 'The strongest control here: a FREE freeze that blocks employment/income pulls.' },
  truecaller:        { needs: ['phone', 'email'], steps: ['If you ever used the app, deactivate your account first', 'Submit your number on the unlist page', 'Confirm via the SMS code or email link'], verification: 'SMS code or email link (+ CAPTCHA)' },
  hiya:              { contactEmail: 'DPO@hiya.com', needs: ['name', 'phone', 'email'], steps: ['Email DPO@hiya.com (subject “Advanced Data Management”)', 'Attach proof the number is yours (a bill/contract showing name + number)'], verification: 'Proof-of-ownership document; manual review', prefill: 'ccpa_email' },
  apollo:            { contactEmail: 'privacy@apollo.io' },
  lusha:             { contactEmail: 'privacy@lusha.com' },
  cognism:           { contactEmail: 'privacy@cognism.com' },
  dataaxle:          { contactEmail: 'privacyteam@data-axle.com' },
  atdata:            { contactEmail: 'privacy@atdata.com' },
  pimeyes:           { needs: ['facePhoto', 'govId', 'email'], verification: 'Upload a face photo + an anonymized government ID', timeline: 'Re-check ~every 90 days' },
  clearview:         { needs: ['facePhoto', 'email'], verification: 'Face photo upload + state-residency affirmation' },
  facecheck:         { needs: ['facePhoto', 'govId'], verification: 'Live selfie OR an anonymized government ID' },
  optoutprescreen:   { note: 'Covers all 3 credit bureaus at once (prescreened offers).', timeline: '5-year opt-out online; permanent needs a mailed form' },
  lexisnexis_clue:   { note: 'Free annual disclosure. Same portal covers LexisNexis Current Carrier.' },
  // ── People-search — verification/timeline specifics ──
  beenverified:      { verification: 'CAPTCHA + click the email verification link' },
  peoplefinders:     { verification: 'CAPTCHA + email confirmation (link expires ~24h)' },
  radaris:           { steps: ['Find & select your profile', 'Submit the privacy/removal request', 'Click the email confirmation link'], verification: 'Email confirmation link' },
  truepeoplesearch:  { verification: '“I am human” CAPTCHA + email verification link' },
  ussearch:          { note: 'Part of PeopleConnect — one request also covers Intelius/TruthFinder/Instant Checkmate.', verification: 'Email confirmation link' },
  instantcheckmate:  { note: 'PeopleConnect Suppression Center — one request covers the whole family.' },
  nuwber:            { needs: ['listingUrl', 'email'], verification: 'Email confirmation link (needs your profile URL)' },
  checkpeople:       { verification: 'Email confirmation link' },
  peekyou:           { needs: ['name', 'listingUrl', 'email'], verification: 'CAPTCHA + email confirmation link' },
  clustrmaps:        { verification: 'Find your listing URL first, then email confirmation' },
  searchpeoplefree:  { verification: 'CAPTCHA + email verification link, then confirm the listing' },
  advancedbackgroundchecks: { verification: 'CAPTCHA + email verification link' },
  cyberbackgroundchecks:    { verification: 'CAPTCHA + email link (24h) + a second suppression form' },
  usphonebook:       { verification: 'CAPTCHA + email verification link (24h); phone option available' },
  // ── Marketing / B2B ──
  lexisnexis:        { note: 'Marketing/prescreen opt-out needs only your identifying info (no ID upload).' },
  acxiom:            { verification: 'Submit your email, then click the confirmation link (double opt-in)' },
  epsilon:           { verification: 'DSR webform (may include a CAPTCHA / email confirmation)' },
  zoominfo:          { verification: 'A 4-digit code emailed to your matched work email' },
  rocketreach:       { verification: 'Email verification link when your email matches a profile' },
  clearbit:          { verification: 'Identity verification (name + email) on the privacy form' },
  seamless:          { verification: 'Email verification (~30-day processing)' },
  // ── Credit bureaus (regulated file can’t be deleted) ──
  experian:          { note: 'Your credit FILE isn’t deletable; this suppresses marketing-data sale + prescreen offers.' },
  equifax:           { note: 'Suppresses sale/sharing of marketing data (~15 days); the credit file itself can’t be deleted.' },
  transunion:        { note: 'Applies to marketing data; the regulated credit file can’t be deleted.' },
  // ── Background-check (FCRA — file access/dispute, not removal) ──
  checkr:            { contactEmail: 'hello@checkr.com', prefill: 'ccpa_email', note: 'FCRA agency — you can request deletion only if you were the subject of a check.' },
  hireright:         { note: 'FCRA CRA — the report isn’t “opt-out-able”; you have file-disclosure + dispute rights.' },
  goodhire:          { contactEmail: 'privacy@goodhire.com', prefill: 'ccpa_email', note: 'FCRA CRA — no standing listing; file-access + dispute only.' },
  peoplelooker:      { verification: 'CAPTCHA + email verification click' },
  // ── Tenant / employment / insurance ──
  saferent:          { verification: 'Government-ID + proof of current address (emailed PDF form)' },
  realpage_leasingdesk: { verification: 'State ID or last-4 SSN + DOB + last 3 addresses' },
  transunion_smartmove: { note: 'Dispute via TransUnion Rental Screening; an adverse-action letter gets you a free copy.' },
  truework:          { note: 'Freeze/unfreeze by form or phone (1-833-878-3967).' },
  mib_group:         { note: 'Free file only if MIB holds a record on you; dispute is a separate written process.' },
  verisk_aplus:      { note: 'Auto vs property disclosure; disputes via the Consumer Inquiry Center.' },
  // ── Location / search / AI ──
  safegraph:         { verification: 'Just an email in a simple form — no CAPTCHA (one of the easiest)' },
  google:            { needs: ['name', 'listingUrl'], note: '“Results about you” needs a Google login; the detailed removal form works without one.' },
  openai:            { note: 'No per-person deletion — this is a training-data opt-out / removal request, reviewed case-by-case.' },
};

// Resolve the full playbook for a catalog item ({ sourceKey, name, url, nature, method }).
export function getPlaybook(item = {}) {
  const base = generic({ nature: item.nature, method: item.method });
  const over = SPECIFIC[item.sourceKey] || {};
  return { ...base, ...over, needs: over.needs || base.needs };
}

// Compose an emailed CCPA/data-deletion request from the member's identity + the provider.
export function buildRequestEmail(identity, item, playbook) {
  const id = identity || {};
  const name = id.name || '[your full legal name]';
  const email = id.email || '[your email]';
  const loc = [id.city, id.state].filter(Boolean).join(', ');
  const to = playbook.contactEmail || '';
  const subject = `Data deletion / opt-out request — ${name}`;
  const addr = id.address || '[add your street address]';
  const prev = id.prevAddress || '[add if any]';
  const dobLine = id.dob ? `- Date of birth: ${id.dob}\n` : '';
  const body =
`To the ${item.name || 'Privacy'} Privacy Team,

Under the CCPA and other applicable U.S. state privacy laws, I request that you delete, and stop selling or sharing, all personal information you hold about me, and suppress any public listing of my information.

Identifying details:
- Full name: ${name}
- Email: ${email}
${loc ? `- Location: ${loc}\n` : ''}- Current street address: ${addr}
- Previous addresses: ${prev}
${dobLine}
I am the consumer (or their authorized agent). Please confirm in writing once this is complete, and tell me if you need anything else to locate my record.

Thank you,
${name}`;
  return { to, subject, body };
}
