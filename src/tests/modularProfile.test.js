/* eslint-disable */
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const MyProfileModular = require('../components/MyProfileModular').default;
const sample = require('../utils/sampleProfileData').default;
const render = (props) => renderToStaticMarkup(React.createElement(MyProfileModular, { data: sample, hero: { name: 'Jordan A. Rivera', age: 41, location: 'Los Angeles, CA' }, ...props }));
const PHONE = '2135550142', CASE = 'TR-2019-88213', APN = '5401-012-034';
describe('MyProfileModular others-mode projection', () => {
  test('others/paid → full detail, no owner controls', () => {
    const html = render({ mode: 'others', viewerTier: 'paid' });
    expect(html).toContain(PHONE); expect(html).toContain(CASE); expect(html).toContain(APN);
    expect(html).not.toContain('Preview as'); expect(html).not.toContain('Recommended actions'); expect(html).not.toContain('Unlock full report');
  });
  test('others/free → paid modules locked, real values NOT in DOM', () => {
    const html = render({ mode: 'others', viewerTier: 'free' });
    expect(html).toContain('Unlock full report'); expect(html).toContain('San Diego');
    expect(html).not.toContain(PHONE); expect(html).not.toContain(CASE); expect(html).not.toContain(APN); expect(html).not.toContain('Preview as');
  });
  test('owner mode unchanged — controls present (regression)', () => {
    const html = render({});
    expect(html).toContain('Preview as'); expect(html).toContain('Recommended actions'); expect(html).toContain(PHONE);
  });
});
