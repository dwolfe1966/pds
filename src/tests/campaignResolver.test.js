import { resolveCampaign } from '../services/campaignResolver';

// Mock BC ShapeCompiled: getShComp('comp.client.theme') returns the per-shN theme
// JSON (landing/sup/optout/thinmatch), as captured live 2026-06-09.
const shapeWith = (theme) => ({
  getShComp: (key) => (key === 'comp.client.theme' ? JSON.stringify(theme) : undefined),
});

describe('campaignResolver — BC theme drives optOut + zeroState', () => {
  test('thinmatch:yes → zeroState thinMatch; optout:yes → optOut true', () => {
    const c = resolveCampaign('tok-a', null, {
      shape: shapeWith({ landing: '/name/landing/3', sup: 'ver=a', optout: 'yes', thinmatch: 'yes' }),
    });
    expect(c.search.zeroState).toBe('thinMatch');
    expect(c.optOut).toBe(true);
  });

  test('thinmatch:no → zeroState noRecords; optout:no → optOut false', () => {
    const c = resolveCampaign('tok-b', null, {
      shape: shapeWith({ landing: '/x', sup: 'ver=a', optout: 'no', thinmatch: 'no' }),
    });
    expect(c.search.zeroState).toBe('noRecords');
    expect(c.optOut).toBe(false);
  });

  test('parses a raw JSON-string theme (getShComp may not pre-parse)', () => {
    const c = resolveCampaign('tok-c', null, {
      shape: { getShComp: (k) => (k === 'comp.client.theme' ? '{"optout":"yes","thinmatch":"no"}' : undefined) },
    });
    expect(c.optOut).toBe(true);
    expect(c.search.zeroState).toBe('noRecords');
  });

  test('no shape → falls back to local registry default (no crash)', () => {
    const c = resolveCampaign('tok-d', null);
    expect(c.search).toHaveProperty('zeroState');
    expect(typeof c.optOut).toBe('boolean');
  });

  test('no-shn/organic: thinmatch stays strict, but optOut is the compliant default', () => {
    // BC's DEFAULT theme returns thinmatch/optout:'yes'. THINMATCH is guarded for
    // organic (no promo on direct traffic, owner 2026-06-08); OPTOUT is not guarded —
    // show-compliance-UI is the compliant default (registry default true too).
    const c = resolveCampaign(null, null, {
      shape: shapeWith({ landing: '/', sup: 'ver=a', optout: 'yes', thinmatch: 'yes' }),
    });
    expect(c.search.zeroState).not.toBe('thinMatch'); // thinmatch strict for organic
    expect(c.optOut).toBe(true);                       // optout compliant default
  });

  test('real shn with optout:no hides the compliance UI (campaign.optOut false)', () => {
    const c = resolveCampaign('tok-f', null, { shape: shapeWith({ optout: 'no', thinmatch: 'no' }) });
    expect(c.optOut).toBe(false);
  });

  test('shape-aware cache: pre-shape and shape-enriched resolutions do not collide', () => {
    const pre = resolveCampaign('tok-e', null);                    // mount (no shape)
    const post = resolveCampaign('tok-e', null, {                  // enriched
      shape: shapeWith({ optout: 'yes', thinmatch: 'yes' }),
    });
    expect(post.optOut).toBe(true);                                // enrichment applied, not stale pre
    expect(post.search.zeroState).toBe('thinMatch');
    expect(pre).not.toBe(post);
  });
});
