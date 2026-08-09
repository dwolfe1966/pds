// Exposure Graph data layer (Neon) — the spine for digital-footprint management.
// Schema: seo/db/exposure-graph-schema.sql (tables also self-created lazily below). One node =
// (subject × source × url) = a specific listing on a specific provider. Never throws to the caller
// on read paths — degrades to empty. See docs/product/exposure-graph-spine.md.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasExposureDb = !!URL;
const sql = hasExposureDb ? neon(URL) : null;

let _ensured = false;
async function ensureTables() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS exposure_node (
      id BIGSERIAL PRIMARY KEY,
      subject_key TEXT NOT NULL,
      surface_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      found_status TEXT NOT NULL DEFAULT 'unknown',
      data_types TEXT[] NOT NULL DEFAULT '{}',
      exposure_detail JSONB,
      screenshot_url TEXT,
      sentiment TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      severity INT NOT NULL DEFAULT 1,
      control_status TEXT NOT NULL DEFAULT 'none',
      control_method TEXT,
      external_ref TEXT,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_checked TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_changed TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (subject_key, source_key, url)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expnode_subject ON exposure_node(subject_key)`;
    // Bridge to the identity-events feed: sha256(email) of the member who owns this node, captured on the
    // write path when their email is available. Lets the re-check cron address the member (whose events are
    // keyed by email-hash) without storing plaintext email here. Nullable — older/anonymous nodes just miss.
    await sql`ALTER TABLE exposure_node ADD COLUMN IF NOT EXISTS subject_user_key TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expnode_recheck ON exposure_node(control_status, last_changed) WHERE subject_user_key IS NOT NULL`;
    await sql`CREATE TABLE IF NOT EXISTS exposure_event (
      id BIGSERIAL PRIMARY KEY, node_id BIGINT, subject_key TEXT NOT NULL,
      event_type TEXT NOT NULL, method TEXT, detail JSONB, screenshot_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS source_registry (
      source_key TEXT PRIMARY KEY, surface_type TEXT NOT NULL, display_name TEXT NOT NULL,
      category TEXT, opt_out_url TEXT, removal_method TEXT, relist_days INT, weight INT NOT NULL DEFAULT 1,
      nature TEXT
    )`;
    // nature = what the opt-out achieves (true_removal|suppression|file_access_only|account_deletion|search_delist|no_optout).
    await sql`ALTER TABLE source_registry ADD COLUMN IF NOT EXISTS nature TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS owner_annotation (
      id BIGSERIAL PRIMARY KEY, subject_key TEXT NOT NULL, node_id BIGINT, record_key TEXT, label TEXT,
      note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      subject_name_norm TEXT, subject_state TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS record_key TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS label TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS subject_name_norm TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS subject_state TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ann_subject_name ON owner_annotation(subject_name_norm)`;
    _ensured = true;
  } catch { /* leave unensured — reads/writes will just miss/no-op */ }
}

// ── Provider catalog ────────────────────────────────────────────────────────
// Seeded from the brokers already curated in the consumer DigitalFootprint component + Google + our
// own surfaces + the major social nets. removal_method routes an action to the right engine later.
// Fields: k=key t=surface_type n=name c=category u=opt_out_url m=removal_method r=relist_days w=weight
// x=NATURE — what an opt-out actually ACHIEVES here (states the degree; most don't fully erase you):
//   true_removal|suppression|file_access_only|account_deletion|search_delist|no_optout.
// URLs + methods + nature verified per-vendor 2026-08-06 — see docs/product/broker-optout-automation-matrix.md.
// NO vendor offers a removal API; m is the realistic automation path (browser|email|form_post|manual).
const SEED_SOURCES = [
  { k: 'idlookup', t: 'idlookup', n: 'IDLookup', c: 'people_search', u: null, m: 'our_suppression', r: null, w: 3, x: 'suppression' },
  // ── People-search brokers — browser tier (CAPTCHA + find-your-listing + out-of-band email/phone verify) ──
  { k: 'spokeo', t: 'data_broker', n: 'Spokeo', c: 'people_search', u: 'https://www.spokeo.com/optout', m: 'browser', r: 90, w: 2, x: 'suppression' },
  { k: 'beenverified', t: 'data_broker', n: 'BeenVerified', c: 'people_search', u: 'https://www.beenverified.com/app/optout/search', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'peoplefinders', t: 'data_broker', n: 'PeopleFinders', c: 'people_search', u: 'https://www.peoplefinders.com/opt-out', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'whitepages', t: 'data_broker', n: 'Whitepages', c: 'people_search', u: 'https://www.whitepages.com/suppression-requests', m: 'manual', r: 30, w: 2, x: 'suppression' }, // phone-call code verify → not auto
  { k: 'intelius', t: 'data_broker', n: 'Intelius', c: 'people_search', u: 'https://suppression.peopleconnect.us/login', m: 'browser', r: null, w: 2, x: 'suppression' }, // PeopleConnect: also covers TruthFinder/InstantCheckmate/USSearch
  { k: 'radaris', t: 'data_broker', n: 'Radaris', c: 'people_search', u: 'https://radaris.com/control/privacy', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'mylife', t: 'data_broker', n: 'MyLife', c: 'people_search', u: null, m: 'email', r: null, w: 2, x: 'suppression' }, // membersupport@mylife.com (no stable deep-link)
  { k: 'truepeoplesearch', t: 'data_broker', n: 'TruePeopleSearch', c: 'people_search', u: 'https://www.truepeoplesearch.com/removal', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'fastpeoplesearch', t: 'data_broker', n: 'FastPeopleSearch', c: 'people_search', u: 'https://www.fastpeoplesearch.com/removal', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'instantcheckmate', t: 'data_broker', n: 'Instant Checkmate', c: 'people_search', u: 'https://www.instantcheckmate.com/opt-out/', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'truthfinder', t: 'data_broker', n: 'TruthFinder', c: 'people_search', u: 'https://www.truthfinder.com/opt-out/', m: 'browser', r: null, w: 2, x: 'suppression' },
  { k: 'peekyou', t: 'data_broker', n: 'PeekYou', c: 'people_search', u: 'https://www.peekyou.com/about/contact/optout/', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'ussearch', t: 'data_broker', n: 'US Search', c: 'people_search', u: 'https://www.ussearch.com/opt-out/', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'nuwber', t: 'data_broker', n: 'Nuwber', c: 'people_search', u: 'https://nuwber.com/removal/link', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'checkpeople', t: 'data_broker', n: 'CheckPeople', c: 'people_search', u: 'https://checkpeople.com/opt-out', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'thatsthem', t: 'data_broker', n: "That'sThem", c: 'people_search', u: 'https://thatsthem.com/optout', m: 'browser', r: null, w: 1, x: 'suppression' }, // ⭐ cleanly automatable (no CAPTCHA, email-click only)
  { k: 'clustrmaps', t: 'data_broker', n: 'ClustrMaps', c: 'people_search', u: 'https://clustrmaps.com/bl/opt-out', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'searchpeoplefree', t: 'data_broker', n: 'SearchPeopleFree', c: 'people_search', u: 'https://www.searchpeoplefree.com/opt-out', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'advancedbackgroundchecks', t: 'data_broker', n: 'Advanced Background Checks', c: 'people_search', u: 'https://www.advancedbackgroundchecks.com/removal', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'cyberbackgroundchecks', t: 'data_broker', n: 'Cyber Background Checks', c: 'people_search', u: 'https://www.cyberbackgroundchecks.com/removal', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'usphonebook', t: 'data_broker', n: 'USPhoneBook', c: 'people_search', u: 'https://www.usphonebook.com/opt-out', m: 'browser', r: null, w: 1, x: 'suppression' },
  // ── Search engines (our own Google RAR + Bing) — delist from results, not source removal ──
  { k: 'google', t: 'search_result', n: 'Google Search results', c: 'search', u: 'https://myactivity.google.com/results-about-you', m: 'google_rar', r: null, w: 3, x: 'search_delist' },
  { k: 'bing', t: 'search_result', n: 'Bing', c: 'search', u: 'https://www.microsoft.com/en-us/concern/bing', m: 'manual', r: null, w: 1, x: 'search_delist' },
  // ── Social profiles — you control the account ──
  { k: 'linkedin', t: 'social_profile', n: 'LinkedIn', c: 'social', u: null, m: 'owner', r: null, w: 1, x: 'account_deletion' },
  { k: 'facebook', t: 'social_profile', n: 'Facebook', c: 'social', u: null, m: 'owner', r: null, w: 1, x: 'account_deletion' },
  { k: 'instagram', t: 'social_profile', n: 'Instagram', c: 'social', u: null, m: 'owner', r: null, w: 1, x: 'account_deletion' },
  { k: 'twitter', t: 'social_profile', n: 'X / Twitter', c: 'social', u: null, m: 'owner', r: null, w: 1, x: 'account_deletion' },
  { k: 'tiktok', t: 'social_profile', n: 'TikTok', c: 'social', u: null, m: 'owner', r: null, w: 1, x: 'account_deletion' },
  // ── Marketing data brokers — form/email tier ──
  { k: 'lexisnexis', t: 'data_broker', n: 'LexisNexis', c: 'marketing', u: 'https://consumer.risk.lexisnexis.com/optrequest', m: 'form_post', r: null, w: 2, x: 'suppression' },
  { k: 'acxiom', t: 'data_broker', n: 'Acxiom', c: 'marketing', u: 'https://www.acxiom.com/optout/', m: 'form_post', r: null, w: 1, x: 'suppression' },
  { k: 'oracle', t: 'data_broker', n: 'Oracle Data Cloud', c: 'marketing', u: null, m: 'manual', r: null, w: 1, x: 'no_optout' }, // consumer opt-out portal defunct (EOL)
  { k: 'epsilon', t: 'data_broker', n: 'Epsilon', c: 'marketing', u: 'https://legal.epsilon.com/dsr/', m: 'form_post', r: null, w: 1, x: 'suppression' },
  { k: 'dataaxle', t: 'data_broker', n: 'Data Axle', c: 'marketing', u: 'https://www.data-axle.com/do-not-sell-my-data/', m: 'email', r: null, w: 1, x: 'suppression' }, // privacyteam@data-axle.com
  { k: 'experian_marketing', t: 'data_broker', n: 'Experian Marketing Services', c: 'marketing', u: 'https://www.experianmarketingservices.digital/OptOut', m: 'form_post', r: null, w: 1, x: 'suppression' },
  { k: 'atdata', t: 'data_broker', n: 'AtData (ex-TowerData)', c: 'marketing', u: 'https://www.atdata.com/ccpa-form', m: 'email', r: null, w: 1, x: 'suppression' }, // privacy@atdata.com
  // ── Public records — inherently public; reduce/redact via the county, no broker opt-out ──
  { k: 'county_court', t: 'public_record', n: 'County court records', c: 'public_record', u: null, m: 'manual', r: null, w: 1, x: 'no_optout' },
  { k: 'property_records', t: 'public_record', n: 'County property records', c: 'public_record', u: null, m: 'manual', r: null, w: 1, x: 'no_optout' },
  { k: 'voter_records', t: 'public_record', n: 'Voter registration', c: 'public_record', u: null, m: 'manual', r: null, w: 1, x: 'no_optout' },
  // ── Background-check sites — FCRA CRAs: file-access/dispute only, NOT removal (except PeopleLooker) ──
  { k: 'goodhire', t: 'data_broker', n: 'GoodHire', c: 'background_check', u: null, m: 'manual', r: null, w: 2, x: 'file_access_only' }, // privacy@goodhire.com
  { k: 'checkr', t: 'data_broker', n: 'Checkr', c: 'background_check', u: 'https://help.checkr.com/s/article/11280401834903-How-do-I-delete-my-personal-information-from-Checkr', m: 'email', r: null, w: 2, x: 'file_access_only' },
  { k: 'hireright', t: 'data_broker', n: 'HireRight', c: 'background_check', u: 'https://www.hireright.com/legal/do-not-sell-my-personal-information', m: 'form_post', r: null, w: 2, x: 'file_access_only' },
  { k: 'peoplelooker', t: 'data_broker', n: 'PeopleLooker', c: 'background_check', u: 'https://www.peoplelooker.com/f/optout/search', m: 'browser', r: null, w: 2, x: 'suppression' },
  // ── Business & professional data (B2B) — email tier is the automation win; a few need a browser + inbox code ──
  { k: 'zoominfo', t: 'data_broker', n: 'ZoomInfo', c: 'b2b_data', u: 'https://privacy.zoominfo.com', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'apollo', t: 'data_broker', n: 'Apollo.io', c: 'b2b_data', u: 'https://www.apollo.io/privacy-policy/remove', m: 'email', r: null, w: 1, x: 'suppression' }, // privacy@apollo.io
  { k: 'rocketreach', t: 'data_broker', n: 'RocketReach', c: 'b2b_data', u: 'https://rocketreach.co/claim-profile', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'lusha', t: 'data_broker', n: 'Lusha', c: 'b2b_data', u: 'https://www.lusha.com/privacy-center/request-removal/', m: 'email', r: null, w: 1, x: 'suppression' }, // privacy@lusha.com
  { k: 'clearbit', t: 'data_broker', n: 'Clearbit', c: 'b2b_data', u: 'https://preferences.clearbit.com/privacy', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'seamless', t: 'data_broker', n: 'Seamless.AI', c: 'b2b_data', u: 'https://login.seamless.ai/personalDataRequest', m: 'browser', r: null, w: 1, x: 'suppression' },
  { k: 'cognism', t: 'data_broker', n: 'Cognism', c: 'b2b_data', u: 'https://www.cognism.com/data-opt-out', m: 'email', r: null, w: 1, x: 'suppression' }, // privacy@cognism.com
  // ── Genealogy & family history — remove = delete your OWN account; others' trees via privacy request ──
  { k: 'ancestry', t: 'data_broker', n: 'Ancestry', c: 'genealogy', u: 'https://www.ancestry.com/c/privacy-center', m: 'manual', r: null, w: 1, x: 'account_deletion' },
  { k: 'myheritage', t: 'data_broker', n: 'MyHeritage', c: 'genealogy', u: 'https://www.myheritage.com/privacy-policy', m: 'manual', r: null, w: 1, x: 'account_deletion' },
  { k: 'familysearch', t: 'data_broker', n: 'FamilySearch', c: 'genealogy', u: 'https://www.familysearch.org/en/help/helpcenter/article/can-i-request-to-remove-the-name-of-a-living-person-from-historical-records', m: 'form_post', r: null, w: 1, x: 'suppression' },
  // ── Property & real estate — public-record-backed; reduce identifiers, can't erase ──
  { k: 'zillow', t: 'data_broker', n: 'Zillow', c: 'property', u: 'https://zillow.zendesk.com/hc/en-us/articles/213217797-How-do-I-remove-my-home-from-Zillow', m: 'manual', r: null, w: 1, x: 'suppression' },
  { k: 'realtor', t: 'data_broker', n: 'Realtor.com', c: 'property', u: null, m: 'email', r: null, w: 1, x: 'suppression' }, // privacy team, "Data Deletion Request" (no dedicated URL)
  { k: 'propertyshark', t: 'data_broker', n: 'PropertyShark', c: 'property', u: 'https://www.propertyshark.com/mason/Help/Privacy', m: 'email', r: null, w: 1, x: 'suppression' },
  // ── Credit bureaus — regulated file NOT deletable; opt-out = prescreen/marketing suppression only ──
  { k: 'experian', t: 'data_broker', n: 'Experian', c: 'credit', u: 'https://consumerprivacy.experian.com/request', m: 'form_post', r: null, w: 2, x: 'suppression' },
  { k: 'equifax', t: 'data_broker', n: 'Equifax', c: 'credit', u: 'https://myprivacy.equifax.com/opt-in-opt-out/personal-info', m: 'form_post', r: null, w: 2, x: 'suppression' },
  { k: 'transunion', t: 'data_broker', n: 'TransUnion', c: 'credit', u: 'https://www.transunion.com/consumer-privacy', m: 'form_post', r: null, w: 2, x: 'suppression' },
  { k: 'optoutprescreen', t: 'data_broker', n: 'Prescreened offers (OptOutPrescreen)', c: 'credit', u: 'https://www.optoutprescreen.com/', m: 'form_post', r: 1825, w: 1, x: 'suppression' }, // shared bureau prescreen opt-out (5-yr online)
  // ── Location data brokers — device-ad-ID / cookie suppression ──
  { k: 'safegraph', t: 'data_broker', n: 'SafeGraph', c: 'location', u: 'https://www.safegraph.com/do-not-sell-my-info/', m: 'browser', r: null, w: 1, x: 'suppression' }, // ⭐ bare email form, no CAPTCHA
  { k: 'cuebiq', t: 'data_broker', n: 'Cuebiq', c: 'location', u: 'https://cuebiq.com/privacy-request/', m: 'browser', r: null, w: 1, x: 'true_removal' },
  { k: 'foursquare', t: 'data_broker', n: 'Foursquare', c: 'location', u: 'https://foursquare.com/legal/privacy-center/', m: 'browser', r: null, w: 1, x: 'true_removal' },
  { k: 'daa_webchoices', t: 'data_broker', n: 'Ad networks (DAA WebChoices)', c: 'location', u: 'https://optout.aboutads.info/', m: 'browser', r: null, w: 1, x: 'suppression' }, // cookie opt-out, per-device
  { k: 'nai', t: 'data_broker', n: 'Ad networks (NAI)', c: 'location', u: 'https://optout.networkadvertising.org/', m: 'browser', r: null, w: 1, x: 'suppression' }, // cookie opt-out, per-device
  // ── AI & chatbots — NO true per-person removal; training-opt-out / suppression only (never promise deletion) ──
  { k: 'openai', t: 'ai_answer', n: 'ChatGPT (OpenAI)', c: 'ai', u: 'https://privacy.openai.com/', m: 'manual', r: null, w: 1, x: 'suppression' },
  { k: 'gemini', t: 'ai_answer', n: 'Google Gemini', c: 'ai', u: 'https://myactivity.google.com/product/gemini', m: 'manual', r: null, w: 1, x: 'suppression' },
  { k: 'perplexity', t: 'ai_answer', n: 'Perplexity', c: 'ai', u: 'https://www.perplexity.ai/help-center/en/articles/11564562-self-serve-data-deletion', m: 'manual', r: null, w: 1, x: 'suppression' },
  // ── Face & image search — true removal but selfie / gov-ID upload required → human-in-the-loop ──
  { k: 'pimeyes', t: 'image', n: 'PimEyes', c: 'images', u: 'https://pimeyes.com/en/opt-out-request-form', m: 'form_post', r: 90, w: 2, x: 'true_removal' },
  { k: 'clearview', t: 'image', n: 'Clearview AI', c: 'images', u: 'https://www.clearview.ai/privacy-and-requests', m: 'form_post', r: null, w: 2, x: 'true_removal' },
  { k: 'facecheck', t: 'image', n: 'FaceCheck.ID', c: 'images', u: 'https://facecheck.id/en/RemoveMyPhotos', m: 'form_post', r: null, w: 2, x: 'true_removal' },
  // ── Tenant & rental screening — FCRA specialty bureaus (housing decisions): see/dispute your file, not delete ──
  { k: 'transunion_smartmove', t: 'data_broker', n: 'TransUnion SmartMove', c: 'tenant_screening', u: 'https://www.transunion.com/client-support/rental-screening-disputes', m: 'manual', r: null, w: 2, x: 'file_access_only' },
  { k: 'saferent', t: 'data_broker', n: 'SafeRent (ex-CoreLogic)', c: 'tenant_screening', u: 'https://saferentsolutions.com/consumer-support/', m: 'form_post', r: null, w: 2, x: 'file_access_only' },
  { k: 'realpage_leasingdesk', t: 'data_broker', n: 'RealPage LeasingDesk', c: 'tenant_screening', u: 'https://www.realpage.com/support/consumer/', m: 'form_post', r: null, w: 1, x: 'file_access_only' },
  { k: 'experian_rentbureau', t: 'data_broker', n: 'Experian RentBureau', c: 'tenant_screening', u: 'https://www.experian.com/rental-property-solutions/rentbureau/rental-history', m: 'manual', r: null, w: 1, x: 'file_access_only' },
  // ── Employment & income verification — payroll data sold to lenders/landlords; a FREEZE blocks access (strong) ──
  { k: 'the_work_number', t: 'data_broker', n: 'The Work Number (Equifax)', c: 'employment_data', u: 'https://employees.theworknumber.com/employee-data-freeze', m: 'form_post', r: null, w: 3, x: 'freeze' },
  { k: 'truework', t: 'data_broker', n: 'Truework', c: 'employment_data', u: 'https://help.truework.com/hc/en-us/articles/27167920594455-FCRA-Requests-and-Consumer-Rights', m: 'form_post', r: null, w: 1, x: 'freeze' },
  // ── Insurance data bureaus — claims/Rx history driving premiums; FCRA free annual disclosure + dispute, not removal ──
  { k: 'lexisnexis_clue', t: 'data_broker', n: 'LexisNexis C.L.U.E.', c: 'insurance_data', u: 'https://consumer.risk.lexisnexis.com/request', m: 'form_post', r: null, w: 2, x: 'file_access_only' },
  { k: 'mib_group', t: 'data_broker', n: 'MIB Group', c: 'insurance_data', u: 'https://www.mib.com/request_your_record.html', m: 'form_post', r: null, w: 2, x: 'file_access_only' },
  { k: 'verisk_aplus', t: 'data_broker', n: 'Verisk / ISO A-PLUS', c: 'insurance_data', u: 'https://fcra.verisk.com/', m: 'form_post', r: null, w: 1, x: 'file_access_only' },
  { k: 'milliman_intelliscript', t: 'data_broker', n: 'Milliman IntelliScript (Rx)', c: 'insurance_data', u: 'https://www.rxhistories.com/for-consumers/#request', m: 'form_post', r: null, w: 1, x: 'file_access_only' },
  // ── Caller-ID / spam-block apps — publish your name against your number; "unlist" is a genuine removal ──
  { k: 'truecaller', t: 'data_broker', n: 'Truecaller', c: 'caller_id', u: 'https://www.truecaller.com/unlist', m: 'browser', r: null, w: 2, x: 'true_removal' },
  { k: 'hiya', t: 'data_broker', n: 'Hiya', c: 'caller_id', u: 'https://hiyahelp.zendesk.com/hc/en-us/articles/360001093027-Manage-My-Data', m: 'email', r: null, w: 1, x: 'true_removal' }, // DPO@hiya.com + proof of ownership
  { k: 'sync_me', t: 'data_broker', n: 'Sync.me', c: 'caller_id', u: 'https://sync.me/unsubscribe/', m: 'browser', r: null, w: 1, x: 'true_removal' },
  { k: 'callapp', t: 'data_broker', n: 'CallApp', c: 'caller_id', u: 'https://callapp.com/how-to/unlist-phone-number', m: 'browser', r: null, w: 1, x: 'suppression' },
];

let _seeded = false;
export async function seedSourceRegistry() {
  if (!sql || _seeded) return;   // once per process — DO UPDATE refresh runs on cold start, not every request
  await ensureTables();
  for (const s of SEED_SOURCES) {
    try {
      // DO UPDATE (was DO NOTHING) so SEED_SOURCES is authoritative — re-seed refreshes verified URLs /
      // methods / nature onto existing rows (2026-08-06 catalog refresh).
      await sql`INSERT INTO source_registry (source_key, surface_type, display_name, category, opt_out_url, removal_method, relist_days, weight, nature)
        VALUES (${s.k}, ${s.t}, ${s.n}, ${s.c}, ${s.u}, ${s.m}, ${s.r}, ${s.w}, ${s.x || null})
        ON CONFLICT (source_key) DO UPDATE SET
          surface_type = EXCLUDED.surface_type, display_name = EXCLUDED.display_name, category = EXCLUDED.category,
          opt_out_url = EXCLUDED.opt_out_url, removal_method = EXCLUDED.removal_method,
          relist_days = EXCLUDED.relist_days, weight = EXCLUDED.weight, nature = EXCLUDED.nature`;
    } catch { /* ignore */ }
  }
  _seeded = true;
}

export async function getSourceRegistry() {
  if (!sql) return [];
  await ensureTables();
  try { return await sql`SELECT * FROM source_registry ORDER BY weight DESC, display_name`; }
  catch { return []; }
}

// ── Nodes ───────────────────────────────────────────────────────────────────
/** Upsert one node keyed by (subject_key, source_key, url). Merges the passed fields.
 *  By default a re-scan updates found/detail but PRESERVES control_status (never clobber a user's
 *  action). Pass syncControl:true for source-DERIVED control (e.g. the IDLookup node, whose control
 *  state IS the member's suppression flag) so it re-syncs each federation. */
export async function upsertNode(n) {
  if (!sql || !n || !n.subjectKey || !n.sourceKey || !n.surfaceType) return null;
  await ensureTables();
  const url = n.url || '';
  const dataTypes = Array.isArray(n.dataTypes) ? n.dataTypes : [];
  const detail = n.exposureDetail ? JSON.stringify(n.exposureDetail) : null;
  const common = {
    st: n.surfaceType, fs: n.foundStatus || 'unknown', dt: dataTypes, ed: detail, ss: n.screenshotUrl || null,
    se: n.sentiment || null, cf: n.confidence || 'medium', sv: n.severity ?? 1, cs: n.controlStatus || 'none',
    cm: n.controlMethod || null, xr: n.externalRef || null, uk: n.subjectUserKey || null,
  };
  try {
    const rows = n.syncControl
      ? await sql`
        INSERT INTO exposure_node (subject_key, surface_type, source_key, url, found_status, data_types, exposure_detail, screenshot_url, sentiment, confidence, severity, control_status, control_method, external_ref, subject_user_key, last_checked, last_changed)
        VALUES (${n.subjectKey}, ${common.st}, ${n.sourceKey}, ${url}, ${common.fs}, ${common.dt}, ${common.ed}, ${common.ss}, ${common.se}, ${common.cf}, ${common.sv}, ${common.cs}, ${common.cm}, ${common.xr}, ${common.uk}, now(), now())
        ON CONFLICT (subject_key, source_key, url) DO UPDATE SET
          found_status = EXCLUDED.found_status, data_types = EXCLUDED.data_types,
          exposure_detail = COALESCE(EXCLUDED.exposure_detail, exposure_node.exposure_detail),
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, exposure_node.screenshot_url),
          sentiment = COALESCE(EXCLUDED.sentiment, exposure_node.sentiment), confidence = EXCLUDED.confidence, severity = EXCLUDED.severity,
          control_status = EXCLUDED.control_status, control_method = EXCLUDED.control_method,
          subject_user_key = COALESCE(EXCLUDED.subject_user_key, exposure_node.subject_user_key),
          last_checked = now(),
          last_changed = CASE WHEN exposure_node.found_status IS DISTINCT FROM EXCLUDED.found_status OR exposure_node.control_status IS DISTINCT FROM EXCLUDED.control_status THEN now() ELSE exposure_node.last_changed END
        RETURNING id`
      : await sql`
        INSERT INTO exposure_node (subject_key, surface_type, source_key, url, found_status, data_types, exposure_detail, screenshot_url, sentiment, confidence, severity, control_status, control_method, external_ref, subject_user_key, last_checked, last_changed)
        VALUES (${n.subjectKey}, ${common.st}, ${n.sourceKey}, ${url}, ${common.fs}, ${common.dt}, ${common.ed}, ${common.ss}, ${common.se}, ${common.cf}, ${common.sv}, ${common.cs}, ${common.cm}, ${common.xr}, ${common.uk}, now(), now())
        ON CONFLICT (subject_key, source_key, url) DO UPDATE SET
          found_status = EXCLUDED.found_status, data_types = EXCLUDED.data_types,
          exposure_detail = COALESCE(EXCLUDED.exposure_detail, exposure_node.exposure_detail),
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, exposure_node.screenshot_url),
          sentiment = COALESCE(EXCLUDED.sentiment, exposure_node.sentiment), confidence = EXCLUDED.confidence, severity = EXCLUDED.severity,
          subject_user_key = COALESCE(EXCLUDED.subject_user_key, exposure_node.subject_user_key),
          last_checked = now(),
          last_changed = CASE WHEN exposure_node.found_status IS DISTINCT FROM EXCLUDED.found_status THEN now() ELSE exposure_node.last_changed END
        RETURNING id`;
    return rows && rows[0] ? rows[0].id : null;
  } catch { return null; }
}

/** Set the control status/method on a node (routes downstream later) + log the event. */
export async function setNodeControl(nodeId, { subjectKey, controlStatus, controlMethod, externalRef, subjectUserKey, eventType, detail } = {}) {
  if (!sql || !nodeId) return false;
  await ensureTables();
  try {
    await sql`UPDATE exposure_node SET control_status = ${controlStatus}, control_method = ${controlMethod || null},
      external_ref = COALESCE(${externalRef || null}, external_ref),
      subject_user_key = COALESCE(${subjectUserKey || null}, subject_user_key), last_changed = now() WHERE id = ${nodeId}`;
    await sql`INSERT INTO exposure_event (node_id, subject_key, event_type, method, detail)
      VALUES (${nodeId}, ${subjectKey || null}, ${eventType || 'control_changed'}, ${controlMethod || null},
        ${detail ? JSON.stringify(detail) : null})`;
    return true;
  } catch { return false; }
}

/**
 * Removals due for a re-check — the honest monitoring loop's data source. Returns requested/removed nodes
 * whose re-list window (source_registry.relist_days) has fully lapsed since last_changed, that carry a
 * subject_user_key (so we can address the member). `windowN` = how many full relist windows have elapsed;
 * the cron folds it into the dedup key so a member is reminded once PER window (not once ever, not repeatedly).
 * This schedules a re-VERIFY prompt only — it never asserts a listing is back (that needs real detection).
 */
export async function listRemovalsDueForRecheck(limit = 200) {
  if (!sql) return [];
  await ensureTables();
  try {
    return await sql`
      SELECT n.subject_user_key AS user_key, n.source_key, n.control_status, n.last_changed,
             r.display_name, r.opt_out_url, r.relist_days,
             floor(extract(epoch FROM (now() - n.last_changed)) / (r.relist_days * 86400))::int AS window_n
      FROM exposure_node n
      JOIN source_registry r ON r.source_key = n.source_key
      WHERE n.subject_user_key IS NOT NULL
        AND n.control_status IN ('optout_requested', 'removed', 'optout_confirmed')
        AND r.relist_days IS NOT NULL AND r.relist_days > 0
        AND n.last_changed + (r.relist_days || ' days')::interval < now()
      ORDER BY n.last_changed ASC
      LIMIT ${Math.min(1000, Math.max(1, limit))}`;
  } catch { return []; }
}

export async function getNodesForSubject(subjectKey) {
  if (!sql || !subjectKey) return [];
  await ensureTables();
  try { return await sql`SELECT * FROM exposure_node WHERE subject_key = ${subjectKey} ORDER BY severity DESC, surface_type, source_key`; }
  catch { return []; }
}

export async function logExposureEvent(e) {
  if (!sql || !e || !e.subjectKey || !e.eventType) return;
  await ensureTables();
  try {
    await sql`INSERT INTO exposure_event (node_id, subject_key, event_type, method, detail, screenshot_url)
      VALUES (${e.nodeId || null}, ${e.subjectKey}, ${e.eventType}, ${e.method || null},
        ${e.detail ? JSON.stringify(e.detail) : null}, ${e.screenshotUrl || null})`;
  } catch { /* ignore */ }
}

// ── Owner Voice (annotations) ───────────────────────────────────────────────
// The identity owner's context on a record/exposure ("DUI 1996" → "went to rehab in 1997, sober since").
// Confirmed-owner-gated at the route.

// Auto-moderation — the mechanical guardrails from the spec (no links, no third-party contact info, no
// slurs, length bounds). Hard violations are REJECTED (never stored). Clean notes pass to 'approved' so
// the owner can use them now; when we surface notes to VIEWERS we'll add human review on top of this.
const SLURS = /\b(fuck|shit|bitch|cunt|nigger|faggot|retard|whore)\w*\b/i;
export function moderateNote(note) {
  const t = String(note || '').trim();
  if (t.length < 3) return { status: 'rejected', reason: 'Too short.' };
  if (t.length > 1000) return { status: 'rejected', reason: 'Too long — keep it under 1000 characters.' };
  if (/https?:\/\/|\bwww\./i.test(t)) return { status: 'rejected', reason: 'Links aren’t allowed in notes.' };
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(t)) return { status: 'rejected', reason: 'Please don’t include email addresses.' };
  if (/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(t)) return { status: 'rejected', reason: 'Please don’t include phone numbers.' };
  if (SLURS.test(t)) return { status: 'rejected', reason: 'Keep it civil — no slurs or profanity.' };
  return { status: 'approved', reason: null };
}

const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Add an owner note. Auto-moderates first; rejected notes are NOT stored. The owner's own identity
 *  (name/state) is denormalized on the row so a VIEWER can look the note up on the public record.
 *  Returns { id, status, reason }. */
export async function addAnnotation({ subjectKey, nodeId, recordKey, label, note, name, state }) {
  if (!sql || !subjectKey || !note) return { id: null, status: 'rejected', reason: 'Empty note.' };
  const mod = moderateNote(note);
  if (mod.status === 'rejected') return { id: null, status: 'rejected', reason: mod.reason };
  await ensureTables();
  try {
    const rows = await sql`INSERT INTO owner_annotation (subject_key, node_id, record_key, label, note, status, subject_name_norm, subject_state)
      VALUES (${subjectKey}, ${nodeId || null}, ${recordKey || null}, ${label || null}, ${String(note).slice(0, 1000)}, ${mod.status}, ${normName(name) || null}, ${(state || '').toUpperCase().trim() || null})
      RETURNING id`;
    return { id: rows && rows[0] ? rows[0].id : null, status: mod.status, reason: null };
  } catch { return { id: null, status: 'error', reason: 'Could not save. Try again.' }; }
}

/** PUBLIC read: approved owner notes for a subject IDENTITY (name + optional state) — what a VIEWER sees
 *  on the person's record. Small universe: only claimed members who added (auto-approved) UGC appear. */
export async function getApprovedNotesForIdentity({ name, state }) {
  if (!sql || !name) return [];
  await ensureTables();
  const nn = normName(name);
  if (!nn) return [];
  const st = (state || '').toUpperCase().trim();
  try {
    return await sql`SELECT id, record_key, label, note, created_at FROM owner_annotation
      WHERE status = 'approved' AND subject_name_norm = ${nn}
      AND (subject_state IS NULL OR ${st} = '' OR upper(subject_state) = ${st})
      ORDER BY created_at DESC`;
  } catch { return []; }
}

export async function getAnnotationsForSubject(subjectKey) {
  if (!sql || !subjectKey) return [];
  await ensureTables();
  try { return await sql`SELECT id, node_id, record_key, label, note, status, created_at FROM owner_annotation WHERE subject_key = ${subjectKey} ORDER BY created_at DESC`; }
  catch { return []; }
}

export async function deleteAnnotation({ subjectKey, id }) {
  if (!sql || !subjectKey || !id) return false;
  await ensureTables();
  try { await sql`DELETE FROM owner_annotation WHERE id = ${id} AND subject_key = ${subjectKey}`; return true; }
  catch { return false; }
}

// ── Score ─────────────────────────────────────────────────────────────────
const CONTROLLED = new Set(['hidden', 'removed', 'optout_confirmed']);
/** Roll a node set into an exposure summary: counts + a 0-100 score (higher = more exposed). */
export function summarizeNodes(nodes) {
  let exposedW = 0, totalW = 0, found = 0, controlled = 0, inProgress = 0;
  for (const n of nodes || []) {
    const w = n.severity || 1;
    if (n.found_status === 'found') {
      found += 1; totalW += w;
      if (CONTROLLED.has(n.control_status)) controlled += 1;
      else { exposedW += w; if (n.control_status === 'optout_requested' || n.control_status === 'correction_requested') inProgress += 1; }
    }
  }
  const score = totalW ? Math.round((exposedW / totalW) * 100) : 0;
  return { score, found, controlled, inProgress, exposed: found - controlled };
}
