/* eslint-disable */
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ProfileView = require('../components/ProfileView').default;
const sample = require('../utils/sampleProfileData').default;

describe('ProfileView (report-as-profile)', () => {
  test('renders the dev sample — every section, no throw', () => {
    let html = '';
    expect(() => { html = renderToStaticMarkup(React.createElement(ProfileView, { data: sample, viewer: 'owner' })); }).not.toThrow();
    for (const t of [
      'Personal Information', 'Address History', 'Phone Numbers', 'Email Addresses',
      'Relatives', 'Employment', 'Education', 'Social Media', 'Property Records',
      'Professional Licences', 'Court Records', 'Additional Identities',
    ]) {
      expect(html).toContain(t);
    }
  });
  test('null-safe', () => {
    expect(renderToStaticMarkup(React.createElement(ProfileView, { data: null }))).toBe('');
  });
});
