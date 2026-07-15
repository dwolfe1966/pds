/* eslint-disable */
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ProfileView = require('../components/ProfileView').default;

const mock = {
  fullName: 'Jane Q Public', aliases: ['J Public'], dob: '1980-01-01', age: '44', gender: 'Female',
  citizenship: 'US', provider: 'test', currentLocation: 'Los Angeles, CA',
  addresses: [{ id: 'a1', street: '1 Main St', city: 'Los Angeles', state: 'CA', zip: '90001', county: 'LA', firstSeen: '2020-01', lastSeen: '2024-01' }],
  phones: [{ id: 'p1', number: '2125550100', type: 'mobile', carrier: 'Verizon', firstSeen: '2020', lastSeen: '2024' }],
  emails: [{ id: 'e1', address: 'jane@example.com', type: 'personal' }],
  relatives: [{ id: 'r1', name: 'John Public', relationship: 'Brother', age: '46', location: 'LA, CA', phones: [] }],
  secondaryIdentities: [],
  jobs: [{ id: 'j1', employer: 'Acme', title: 'Engineer', city: 'LA', state: 'CA', start: '2018', end: '' }],
  education: [{ id: 'ed1', school: 'State University', degree: 'BS', field: 'CS', year: '2002' }],
  social: [{ id: 's1', platform: 'LinkedIn', url: 'https://x', username: 'jane' }],
  properties: [], professionalLicenses: [], criminalRecords: [], liens: [], judgments: [],
  foreclosures: [], bankruptcies: [], driverLicenses: [], veteranRecords: [], businesses: [],
  sanctions: [], fraudFlags: [], arrests: [], arrestWatch: [], deaths: [], offenders: [],
  counts: {},
};

describe('ProfileView (report-as-profile extraction)', () => {
  test('renders all populated sections without throwing', () => {
    let html = '';
    expect(() => { html = renderToStaticMarkup(React.createElement(ProfileView, { data: mock, viewer: 'paid' })); }).not.toThrow();
    for (const t of ['Personal Information', 'Address History', 'Phone Numbers', 'Email Addresses', 'Relatives', 'Employment', 'Education']) {
      expect(html).toContain(t);
    }
  });
  test('renders nothing for null data', () => {
    expect(renderToStaticMarkup(React.createElement(ProfileView, { data: null }))).toBe('');
  });
});
