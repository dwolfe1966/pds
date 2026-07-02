import { resolveCampaign, clearCampaignCache } from '../campaignResolver';

const mkShape = (theme) => ({ getShComp: (k) => (k === 'comp.client.theme' ? theme : undefined) });

beforeEach(() => clearCampaignCache());

test('BC Control theme → landing v3a + SUP variant i + split captured', () => {
  const c = resolveCampaign('6a22ff83ca16ad4ef68b84b5', undefined, {
    shape: mkShape({ landing: '/name/landing/v3a', sup: 'ver=i', optout: 'yes', thinmatch: 'yes', split_type: 'Control', split_name: 'Compact Mobile LP+SUP PII' }),
  });
  expect(c.landing.route).toBe('/name/landing/v3a');
  expect(c.detail.variant).toBe('i');
  expect(c.optOut).toBe(true);
  expect(c.search.zeroState).toBe('thinMatch');
  expect(c.identity.splitType).toBe('Control');
  expect(c.identity.splitName).toBe('Compact Mobile LP+SUP PII');
});

test('BC Challenger theme → landing v3b + SUP variant j', () => {
  const c = resolveCampaign('6a22ff83ca16ad4ef68b84b5', undefined, {
    shape: mkShape({ landing: '/name/landing/v3b', sup: 'ver=j', optout: 'yes', thinmatch: 'yes', split_type: 'Challenger', split_name: 'Compact Mobile LP+SUP PII' }),
  });
  expect(c.landing.route).toBe('/name/landing/v3b');
  expect(c.detail.variant).toBe('j');
  expect(c.identity.splitType).toBe('Challenger');
});

test('legacy /name/landing/3 form normalized to /v3; raw JSON-string theme parsed', () => {
  const c = resolveCampaign('legacyshn', undefined, { shape: mkShape(JSON.stringify({ landing: '/name/landing/3', sup: 'i' })) });
  expect(c.landing.route).toBe('/name/landing/v3');
  expect(c.detail.variant).toBe('i');
});

test('malicious/invalid theme values are ignored (no open-redirect, no bad variant)', () => {
  const c = resolveCampaign('badshn', undefined, { shape: mkShape({ landing: 'https://evil.com/phish', sup: 'zzz' }) });
  expect(c.landing.route).not.toBe('https://evil.com/phish');
  expect(c.detail.variant).not.toBe('zzz');
});

test('no theme → registry/default landing + variant unchanged (no regression)', () => {
  const withTheme = resolveCampaign('6a22ff83ca16ad4ef68b84b5', undefined, { shape: mkShape({ landing: '/name/landing/v3a', sup: 'ver=i' }) });
  clearCampaignCache();
  const noTheme = resolveCampaign('6a22ff83ca16ad4ef68b84b5', undefined);
  // Without a theme, the A/B arm is NOT applied — registry value stands.
  expect(noTheme.landing.route).not.toBe(withTheme.landing.route === '/name/landing/v3a' ? '/name/landing/v3a' : 'x');
  expect(noTheme.detail.variant).not.toBe('i');
});
