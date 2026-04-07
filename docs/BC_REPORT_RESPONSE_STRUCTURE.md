# ByteCrtrs Report Response Structure

This document maps the BC API report response (`report/create` and `report/detail`)
so we can identify what data is available for display.

## Response Envelope

```
{
  commerceContent: {
    _id: "commerceContentId",   // unique report ID
    raws: [ ... ]               // array of data sections (see below)
  }
}
```

The `raws` array contains multiple objects, each with a `transient` property holding
a different category of data. Sections are identified by their transient key, not
array position.

---

## Currently Extracted (in reportExtract.js)

### raws[?].transient.identities (primary identity data)

```json
{
  "transient": {
    "identities": [
      {
        "extId": "unique-person-id",
        "nameList": [
          { "data": "Full Name" },
          { "data": "Alias Name" }
        ],
        "dobList": [
          {
            "date": { "data": "MM/DD/YYYY" },
            "age": "XX-XX"
          }
        ],
        "ageRange": "30-35",
        "gender": "M",
        "addressList": [
          {
            "street": "123 Main St",
            "city": "Los Angeles",
            "state": "CA",
            "zip": "90001",
            "meta": {
              "firstSeen": "20180101",
              "lastSeen": "20240601"
            }
          }
        ],
        "phoneList": [
          {
            "number": "2135551234",
            "type": "Mobile",
            "carrier": "Verizon",
            "meta": { "firstSeen": "...", "lastSeen": "..." }
          }
        ],
        "emailList": [
          {
            "address": "user@gmail.com",
            "type": "Personal",
            "meta": { "firstSeen": "...", "lastSeen": "..." }
          }
        ],
        "relationList": [
          {
            "name": "Jane Smith",
            "relationship": "Spouse",
            "age": "32",
            "city": "Los Angeles",
            "state": "CA"
          }
        ],
        "jobList": [
          {
            "employer": "Acme Corp",
            "title": "Software Engineer",
            "city": "LA",
            "state": "CA",
            "start": "20200101",
            "end": "20240101"
          }
        ],
        "educationList": [
          {
            "school": "UCLA",
            "degree": "B.S. Computer Science",
            "start": "20120901",
            "end": "20160601"
          }
        ],
        "socialList": [
          {
            "network": "LinkedIn",
            "url": "https://linkedin.com/in/...",
            "username": "jsmith"
          }
        ],
        "meta": {
          "provider": "DataSourceName"
        }
      }
    ]
  }
}
```

### raws[?].transient.fullContact (enrichment data)

```json
{
  "transient": {
    "fullContact": {
      "addresses": [ ... ],
      "phones": [ ... ],
      "phoneNumbers": [ ... ],
      "emails": [ ... ],
      "emailAddresses": [ ... ],
      "relatives": [ ... ],
      "associates": [ ... ],
      "employments": [ ... ],
      "educations": [ ... ],
      "socialProfiles": [ ... ],
      "social": [ ... ]
    }
  }
}
```

### raws[?].transient.familyWatchdog (sex offender registry)

```json
{
  "transient": {
    "familyWatchdog": {
      "offenders": [
        {
          "name": "Offender Name",
          "distance": "0.5 miles",
          "offenseDescription": "...",
          "address": {
            "street": "...",
            "city": "...",
            "state": "...",
            "zip": "..."
          }
        }
      ]
    }
  }
}
```

---

## Potentially Available (NOT yet extracted)

These are common data categories in people-search APIs that may exist
in additional `raws[?].transient.*` objects. **We need to inspect a real
BC API response to confirm which of these are present.**

### Possible: Criminal Records
```
raws[?].transient.criminalRecords OR raws[?].transient.criminal
  - offenses[]: { type, description, date, court, caseNumber, disposition, severity }
  - arrests[]: { date, agency, charges[], booking }
```

### Possible: Court Records
```
raws[?].transient.courtRecords OR raws[?].transient.courts
  - cases[]: { caseNumber, court, type (civil/criminal/traffic), filingDate, parties[], status }
```

### Possible: Bankruptcy Records
```
raws[?].transient.bankruptcy OR raws[?].transient.bankruptcies
  - filings[]: { chapter, caseNumber, filingDate, dischargeDate, court, status }
```

### Possible: Liens & Judgments
```
raws[?].transient.liens OR raws[?].transient.judgments
  - items[]: { type, amount, filingDate, releaseDate, court, creditor }
```

### Possible: Property Records
```
raws[?].transient.properties OR raws[?].transient.propertyRecords
  - properties[]: { address, purchaseDate, purchasePrice, currentValue, propertyType, ownerNames }
```

### Possible: Vehicle Records
```
raws[?].transient.vehicles
  - vehicles[]: { make, model, year, vin, registrationState, registrationDate }
```

### Possible: Professional Licenses
```
raws[?].transient.licenses OR raws[?].transient.professionalLicenses
  - licenses[]: { type, licenseNumber, state, issueDate, expirationDate, status }
```

### Possible: Eviction Records
```
raws[?].transient.evictions
  - evictions[]: { date, court, plaintiff, address, caseNumber }
```

### Possible: UCC Filings
```
raws[?].transient.uccFilings
  - filings[]: { filingNumber, date, securedParty, debtor, collateral }
```

---

## How to Capture the Real Response

A `console.log` has been added to `reportService.js` to dump all
transient keys from the raw `raws` array when viewing a report in development.

To capture:
1. Run `npm run dev` locally
2. Log in as a paid member
3. View any report detail page (/people/{commerceContentId})
4. Open browser console
5. Look for `[Report Raw] All transient keys:` — this will list every
   data category BC returns
6. Look for `[Report Raw] Full raws dump:` — this is the complete raw data

Paste the console output into this document to complete the mapping.

---

## Currently Displayed Sections (SearchResultDetailPage.js)

1. Personal Information (name, aliases, DOB, age, gender, provider)
2. Address History (street, city, state, zip, date range)
3. Phone Numbers (number, type, carrier, date range)
4. Email Addresses (address, type, date range)
5. Relatives & Associates (name, relationship, age, location)
6. Employment (employer, title, city, state, date range)
7. Education (school, degree, date range)
8. Social Media & Online (network, URL, username)
9. Sex Offender Registry Check (offender name, distance, offense, address)
10. Additional Identities (secondary records from identities[1+])
