# IDL General Intent Google Ads Test Plan

Source data: legacy Google Ads exports for July 17, 2026 to July 30, 2026 in `docs/ads/compet/`.

Goal: test whether IDLookup.ai can convert non-inmate demand, specifically general people-search and background-check/public-records search intent.

## Campaign 1: IDL - People Search Free

Purpose: test pure people-search demand without inmate/criminal framing.

Recommended launch settings:

- Network: Google Search only
- Initial status: Paused for review
- Daily budget: $50
- Bid strategy: Maximize conversions after conversion tracking is confirmed; otherwise start with Maximize clicks and a CPC cap
- Primary landing page: `https://idlookup.ai/name/landing/v11?shns=1`
- Secondary landing page to A/B test later: `https://idlookup.ai/name/landing/v11?shns=1`

Why this campaign:

- Legacy source: `PS Free - Orig (PS123)`
- 14-day result: $87.08 spend, 92 clicks, 7.5 conversions, $11.61 CPA
- Best ad group: `Find Free`, with $42.24 spend, 5.5 conversions, $7.68 CPA

### Ad Group: People Search Free

Use this for direct category queries.

Keywords:

- `[people search free]`
- `[free people search]`
- `"people search free"`
- `"free people search"`
- `[people lookup free]`
- `"people lookup free"`
- `[look up people for free]`
- `[people search free public records]`

Ad Unit A:

- Headlines:
  - Free People Search
  - Search By Name
  - Find Contact Info
  - People Lookup Online
  - Fast Name Search
  - IDLookup.ai
- Descriptions:
  - Search by name and view available public record details in one place.
  - Start with a name to find possible addresses, phone numbers, and more.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `people-search`, `name`

Ad Unit B:

- Headlines:
  - People Search By Name
  - Find Someone Online
  - Search Public Records
  - Lookup Contact Info
  - Simple Name Search
  - IDLookup.ai
- Descriptions:
  - Use IDLookup.ai to search available people data by name.
  - Find possible contact details and public records from a simple name search.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `people-search`, `lookup`

### Ad Group: Find People Free

Use this for "find someone/find people" wording.

Keywords:

- `"find people for free"`
- `"find people free"`
- `[find people for free]`
- `[free people finder]`
- `[people finder free]`
- `[how to find someone for free]`
- `"free search for people"`
- `[peoplefinders free]`

Ad Unit A:

- Headlines:
  - Find People Online
  - Search By Full Name
  - Find Someone Fast
  - People Finder Search
  - View Available Records
  - IDLookup.ai
- Descriptions:
  - Enter a name to search for possible addresses, phone numbers, and records.
  - Find people online with a simple search experience from IDLookup.ai.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `find-people`, `name`

Ad Unit B:

- Headlines:
  - Find Someone By Name
  - People Finder Online
  - Search Public Data
  - Lookup People Fast
  - Start With A Name
  - IDLookup.ai
- Descriptions:
  - Search available public data and possible contact details by name.
  - Try a people search for possible addresses, phone numbers, and more.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `find-people`, `lookup`

## Campaign 2: IDL - Public Records and Background Checks

Purpose: test broader background-check and public-records intent while keeping it separate from pure people-search demand.

Recommended launch settings:

- Network: Google Search only
- Initial status: Paused for review
- Daily budget: $50
- Bid strategy: Maximize conversions after conversion tracking is confirmed; otherwise start with Maximize clicks and a CPC cap
- Primary landing page: `https://idlookup.ai/name/landing/v11?shns=1`
- Secondary landing page to A/B test later: `https://idlookup.ai/name/landing/v11?shns=1`

Why this campaign:

- Legacy source 1: `Pub Rec - Pub Rec`, with $239.45 spend, 169 clicks, 20 conversions, $11.97 CPA
- Legacy source 2: direct background-check campaigns had low volume but relevant positive signal
- Legacy source 3: `Crim Rec - Court, Crim (BC)` had $153.42 spend, 120 clicks, 9 conversions, $17.05 CPA

### Ad Group: Public Records

Use this for the best non-inmate, non-SSN legacy public-records demand.

Keywords:

- `free public records`
- `public records free`
- `[free public records]`
- `public records`
- `[public records]`
- `public records search`
- `[public records search]`
- `public records websites`
- `public records name`
- `public record finder`

Ad Unit A:

- Headlines:
  - Public Records Search
  - Search By Name
  - Find Public Info
  - View Available Records
  - IDLookup.ai
  - Fast Record Lookup
- Descriptions:
  - Search by name to find available public record and contact details.
  - Use IDLookup.ai to look up possible addresses, phone numbers, and records.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `public-records`, `search`

Ad Unit B:

- Headlines:
  - Search Public Records
  - Name Lookup Online
  - Find Public Data
  - People Record Search
  - Start With A Name
  - IDLookup.ai
- Descriptions:
  - Start with a name and search available records from public data sources.
  - Find possible contact details and public records in a simple lookup flow.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `records`, `lookup`

### Ad Group: Background Check

Use this for direct background-check intent. Keep budget controlled until volume and CPA are proven.

Keywords:

- `[free background check]`
- `[background check free]`
- `[cheap background check]`
- `+order +background +check`
- `+background +check +price`
- `[$1 background check]`
- `"background check"`
- `[background check]`

Ad Unit A:

- Headlines:
  - Background Check Search
  - Search By Name
  - Lookup Public Records
  - Find Available Info
  - IDLookup.ai
  - Fast Name Lookup
- Descriptions:
  - Search by name for available public records and possible contact details.
  - Use IDLookup.ai to start a background-check style public records search.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `background`, `search`

Ad Unit B:

- Headlines:
  - Name Background Search
  - Public Records Lookup
  - Search Someone Online
  - Find Contact Details
  - Simple Name Search
  - IDLookup.ai
- Descriptions:
  - Enter a name to search available public data and possible records.
  - Find possible addresses, phone numbers, and public record details.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `background`, `lookup`

### Ad Group: Criminal Records

Use this as a controlled background-check-adjacent test. It had more signal than generic background-check terms, but it is more specific and may behave differently.

Keywords:

- `+criminal +records`
- `+criminal +reports`
- `[criminal records search]`
- `[criminal background check]`
- `[free public criminal record check]`
- `[free criminal records]`
- `[public criminal record lookup]`
- `[criminal record search]`
- `"criminal records"`

Ad Unit A:

- Headlines:
  - Criminal Records Search
  - Search By Name
  - Public Record Lookup
  - Find Available Records
  - IDLookup.ai
  - Name Lookup Online
- Descriptions:
  - Search by name for available public record details from online sources.
  - Start a public records lookup to find possible record and contact details.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `criminal`, `search`

Ad Unit B:

- Headlines:
  - Search Criminal Records
  - Public Records Online
  - Lookup By Name
  - Find Public Info
  - Start With A Name
  - IDLookup.ai
- Descriptions:
  - Use IDLookup.ai to search available public data by name.
  - Look up possible records, addresses, phone numbers, and public details.
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1`
- Paths: `records`, `criminal`

## Recommended Negative Keywords

Add these at the campaign level to keep this test away from the inmate-heavy demand already tested elsewhere:

- inmate
- inmates
- jail
- prison
- prisoner
- incarceration
- incarcerated
- mugshot
- mugshots
- offender
- sex offender
- arrest warrant
- warrant
- commissary
- visitation
- bop
- doc inmate

For Campaign 1 only, also consider excluding:

- criminal
- court
- police
- arrest
- background check

That keeps the people-search test cleaner and prevents it from collapsing into the same criminal/inmate intent bucket.

## Import File

The companion Google Ads Editor-style import file is:

`docs/ads/idl-general-intent-google-ads-import.csv`

Notes:

- Rows are set to `Paused` for review before launch.
- Replace or append tracking parameters if the new account requires them.
- Confirm conversion tracking before using `Maximize conversions`.
- Google may require small column-name adjustments depending on whether this is imported through Google Ads Editor or the browser bulk upload UI.
