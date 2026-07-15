/**
 * Realistic extractAll-shaped sample data for DEV-ONLY preview of ProfileView / My Profile.
 * Lets us see and tune the report-as-profile layout locally, where the real report needs BC
 * (getReportDetail is forced to the BC API). Never rendered in production (dev-gated at the call site).
 */
const sampleProfileData = {
  fullName: 'Jordan A. Rivera',
  aliases: ['Jordan Rivera', 'J. Rivera'],
  dob: 'Mar 1984',
  age: '41',
  gender: 'Male',
  citizenship: 'United States',
  provider: 'Public Records',
  currentLocation: 'Los Angeles, CA',
  addresses: [
    { id: 'a1', street: '1420 Sunset Blvd, Apt 5', city: 'Los Angeles', state: 'CA', zip: '90026', county: 'Los Angeles', firstSeen: 'Jan 2021', lastSeen: 'Present', lat: 34.078, lng: -118.26 },
    { id: 'a2', street: '88 Marina Way', city: 'San Diego', state: 'CA', zip: '92101', county: 'San Diego', firstSeen: 'Jun 2016', lastSeen: 'Dec 2020' },
    { id: 'a3', street: '3300 Oak St', city: 'Portland', state: 'OR', zip: '97214', county: 'Multnomah', firstSeen: 'Aug 2011', lastSeen: 'May 2016' },
  ],
  phones: [
    { id: 'p1', number: '2135550142', type: 'Mobile', carrier: 'Verizon Wireless', firstSeen: '2019', lastSeen: 'Present' },
    { id: 'p2', number: '6195550188', type: 'Landline', carrier: 'AT&T', firstSeen: '2016', lastSeen: '2020' },
  ],
  emails: [
    { id: 'e1', address: 'jordan.rivera@gmail.com', type: 'Personal' },
    { id: 'e2', address: 'jrivera@acmehealth.com', type: 'Work' },
  ],
  relatives: [
    { id: 'r1', name: 'Maria Rivera', relationship: 'Mother', age: '67', location: 'Los Angeles, CA', phones: [] },
    { id: 'r2', name: 'Daniel Rivera', relationship: 'Brother', age: '38', location: 'San Diego, CA', phones: [] },
    { id: 'r3', name: 'Sofia Rivera', relationship: 'Spouse', age: '39', location: 'Los Angeles, CA', phones: [] },
  ],
  jobs: [
    { id: 'j1', employer: 'Acme Health Systems', title: 'Operations Manager', city: 'Los Angeles', state: 'CA', start: '2019', end: '' },
    { id: 'j2', employer: 'Pacific Logistics', title: 'Analyst', city: 'San Diego', state: 'CA', start: '2015', end: '2019' },
  ],
  education: [
    { id: 'ed1', school: 'UCLA', degree: 'B.A. Economics', field: 'Economics', year: '2006' },
    { id: 'ed2', school: 'Lincoln High School', degree: 'Diploma', field: '', year: '2002' },
  ],
  social: [
    { id: 's1', platform: 'LinkedIn', url: 'https://linkedin.com/in/jordanrivera', username: 'jordanrivera' },
    { id: 's2', platform: 'X', url: 'https://x.com/jrivera', username: 'jrivera' },
  ],
  properties: [
    { id: 'pr1', address: '1420 Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90026', apn: '5401-012-034', assessedValue: '$742,000', owner: 'Jordan A. Rivera', lastSale: 'May 2021 — $815,000', history: [] },
  ],
  professionalLicenses: [
    { id: 'l1', type: 'Real Estate Salesperson', number: 'DRE 02011456', status: 'Active', state: 'CA', issued: '2018', expires: '2026', address: 'Los Angeles, CA' },
  ],
  criminalRecords: [
    { id: 'c1', charge: 'Traffic — Speeding', caseNumber: 'TR-2019-88213', court: 'LA Superior Court', disposition: 'Paid fine', chargesFiledDate: 'Apr 2019' },
  ],
  liens: [],
  judgments: [
    { id: 'fj1', type: 'Civil Judgment', amount: '$3,200', court: 'Small Claims — LA', status: 'Satisfied', filedDate: 'Feb 2018' },
  ],
  foreclosures: [],
  bankruptcies: [],
  driverLicenses: [],
  veteranRecords: [],
  businesses: [],
  sanctions: [],
  fraudFlags: [],
  arrests: [],
  arrestWatch: [],
  deaths: [],
  offenders: [],
  secondaryIdentities: [
    { nameList: [{ data: 'Jordan Rivera' }], ageRange: '40-44', addressList: [{ data: 'San Diego, CA' }], phoneList: [{ number: '6195550188' }] },
  ],
  counts: { address: 3, phone: 2, email: 2, relative: 3, property: 1, criminal: 1 },
};

export default sampleProfileData;
