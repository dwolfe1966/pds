// Single source of truth for the /guides authority cluster (SEO WS4). The hub page renders this list;
// the sitemap emits these URLs. Add a guide here + its page.js route, and it appears in both.
export const GUIDES = [
  {
    path: '/guides/how-to-find-an-inmate',
    title: 'How to Find an Inmate',
    blurb: 'Federal, state, and county — the free official locators and how to search by name.',
  },
  {
    path: '/guides/how-to-find-a-federal-inmate',
    title: 'How to Find a Federal Inmate',
    blurb: 'The Federal Bureau of Prisons locator, register numbers, and contacting federal inmates.',
  },
  {
    path: '/guides/county-jail-roster',
    title: 'How to Find Someone in County Jail',
    blurb: 'Why jail detainees aren’t in the prison locators, and how to search a county jail roster.',
  },
  {
    path: '/guides/find-inmate-by-name',
    title: 'How to Find an Inmate by Name',
    blurb: 'Locate someone in custody when all you have is a name — across every system.',
  },
  {
    path: '/guides/are-mugshots-public',
    title: 'Are Mugshots Public Record?',
    blurb: 'What a mugshot is, when it’s public, how to find one, and how removal works.',
  },
];
