// Per-broker opt-out recipes for the content script. The AUTOFILL engine is heuristic (content.js matches
// common form fields by attribute patterns), so a recipe only needs to add: the display name, the exact
// verification hurdle the user will hit, step guidance, and — where the heuristic isn't enough — explicit
// field selector overrides (`fields`) or a `findListing` hint. This keeps the maintenance surface small:
// most forms work from the heuristic; recipes tune the messy ones.
//
// Facts mirror docs/product/broker-optout-automation-matrix.md. Matched by host substring.
window.IDL_RECIPES = {
  'thatsthem.com':        { name: "That'sThem", verification: 'Click the confirmation email — no CAPTCHA', autofillable: 'high' },
  'safegraph.com':        { name: 'SafeGraph', verification: 'Just submit the email form — no CAPTCHA', autofillable: 'high' },
  'spokeo.com':           { name: 'Spokeo', verification: 'reCAPTCHA + click the email confirmation link', note: 'Paste your Spokeo profile URL, solve the CAPTCHA, then confirm via email.', autofillable: 'partial' },
  'whitepages.com':       { name: 'Whitepages', verification: 'An automated PHONE CALL reads you a 4-digit code', note: 'Whitepages verifies by phone — keep your phone handy for the code.', autofillable: 'partial' },
  'beenverified.com':     { name: 'BeenVerified', verification: 'CAPTCHA + email verification link', autofillable: 'partial' },
  'peoplefinders.com':    { name: 'PeopleFinders', verification: 'CAPTCHA + email confirmation (expires ~24h)', autofillable: 'partial' },
  'radaris.com':          { name: 'Radaris', verification: 'Find your profile, then email confirmation link', autofillable: 'partial' },
  'truepeoplesearch.com': { name: 'TruePeopleSearch', verification: '"I am human" CAPTCHA + email link', autofillable: 'partial' },
  'fastpeoplesearch.com': { name: 'FastPeopleSearch', verification: 'Several CAPTCHAs + email confirmation', autofillable: 'partial' },
  'instantcheckmate.com': { name: 'Instant Checkmate', verification: 'CAPTCHA + email link (PeopleConnect)', note: 'One PeopleConnect request also covers Intelius, TruthFinder & US Search.', autofillable: 'partial' },
  'truthfinder.com':      { name: 'TruthFinder', verification: 'Email or SMS code (PeopleConnect)', note: 'Shares the PeopleConnect Suppression Center.', autofillable: 'partial' },
  'peekyou.com':          { name: 'PeekYou', verification: 'CAPTCHA + email confirmation link', autofillable: 'partial' },
  'ussearch.com':         { name: 'US Search', verification: 'Email confirmation link (PeopleConnect)', autofillable: 'partial' },
  'nuwber.com':           { name: 'Nuwber', verification: 'Email confirmation link (needs your profile URL)', autofillable: 'partial' },
  'checkpeople.com':      { name: 'CheckPeople', verification: 'Email confirmation link', autofillable: 'partial' },
  'clustrmaps.com':       { name: 'ClustrMaps', verification: 'Find your listing URL, then email confirmation', autofillable: 'partial' },
  'searchpeoplefree.com': { name: 'SearchPeopleFree', verification: 'CAPTCHA + email verification link', autofillable: 'partial' },
  'advancedbackgroundchecks.com': { name: 'Advanced Background Checks', verification: 'CAPTCHA + email verification link', autofillable: 'partial' },
  'cyberbackgroundchecks.com':    { name: 'Cyber Background Checks', verification: 'CAPTCHA + email link + a 2nd suppression form', autofillable: 'partial' },
  'usphonebook.com':      { name: 'USPhoneBook', verification: 'CAPTCHA + email verification link (24h)', autofillable: 'partial' },
  'intelius.com':         { name: 'Intelius', verification: 'Email link + date of birth (PeopleConnect)', autofillable: 'partial' },
  'peopleconnect.us':     { name: 'PeopleConnect Suppression', verification: 'Email link + DOB — covers Intelius/TruthFinder/Instant Checkmate/US Search', autofillable: 'partial' },
  'mylife.com':           { name: 'MyLife', verification: 'Email verification code (or email membersupport@mylife.com)', autofillable: 'partial' },
};

// Resolve the recipe for the current host (longest matching key wins).
window.IDL_matchRecipe = function matchRecipe(host) {
  const h = String(host || '').toLowerCase();
  let best = null, bestLen = 0;
  for (const key of Object.keys(window.IDL_RECIPES)) {
    if (h.indexOf(key) !== -1 && key.length > bestLen) { best = { key, ...window.IDL_RECIPES[key] }; bestLen = key.length; }
  }
  return best;
};
