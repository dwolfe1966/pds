# One Campaign Starter: IDL - People Search Free

Source data: legacy Google Ads exports for July 17, 2026 to July 30, 2026 in `docs/ads/compet/`.

Recommended first campaign: `IDL - People Search Free`

Why this one:

- It is the cleanest test of general people-search demand.
- Legacy source campaign: `PS Free - Orig (PS123)`
- 14-day legacy result: $87.08 spend, 92 clicks, 7.5 conversions, $11.61 CPA
- Best legacy ad group: `Find Free`, with $42.24 spend, 5.5 conversions, $7.68 CPA
- It avoids starting with criminal, inmate, SSN, or hard background-check intent.

## Campaign Settings

- Campaign name: `IDL - People Search Free`
- Network: Google Search only
- Status: Paused for review
- Daily budget: $50
- Bid strategy: Maximize conversions after conversion tracking is confirmed
- Conservative fallback: Maximize clicks with CPC cap if conversion tracking is not ready
- Landing page: `https://idlookup.ai/name/landing/v11?shns=1&intent=people_search`

## Ad Group 1: People Search Free

Use this ad group for direct category searches like "people search free" and "people lookup free."

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
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1&intent=people_search&adgroup=people_search_free`
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
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1&intent=people_search&adgroup=people_search_free`
- Paths: `people-search`, `lookup`

## Ad Group 2: Find People Free

Use this ad group for "find people" and "find someone" wording.

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
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1&intent=people_search&adgroup=find_people_free`
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
- Final URL: `https://idlookup.ai/name/landing/v11?shns=1&intent=people_search&adgroup=find_people_free`
- Paths: `find-people`, `lookup`

## Campaign-Level Negatives

Add these to keep the test focused on general people-search intent:

- inmate
- inmates
- jail
- prison
- prisoner
- incarceration
- incarcerated
- mugshot
- mugshots
- arrest
- warrant
- sex offender
- offender
- court
- police
- criminal
- background check
- employment
- tenant
- fingerprint
- fbi
- government
- official
- county clerk
- courthouse

## Measurement

Track these events separately:

- Landing page view
- Name search submitted
- Loader completed
- Results preview viewed
- Payment page reached
- Purchase

Primary decision metric: paid conversion CPA by ad group.

Secondary diagnostic metrics:

- Search submit rate
- Results-preview rate
- Payment-page rate
- Purchase rate from payment page

## Import File

The companion import file is:

`docs/ads/1-campaign/people-search-free-google-ads-import.csv`

Rows are paused for review before launch.
