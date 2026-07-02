import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { useZipCity, lookupZipCity } from '../pages/admin/zipCity';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

test('lookupZipCity resolves the real data module', async () => {
  expect(await lookupZipCity('92807')).toEqual({ city: 'Anaheim', state: 'CA' });
  expect(await lookupZipCity('77632')).toEqual({ city: 'Orange', state: 'TX' });
  expect(await lookupZipCity('00000')).toBeNull();
  expect(await lookupZipCity(null)).toBeNull();
});

test('useZipCity renders City, ST', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const Probe = ({ zip }) => { const label = useZipCity(zip); return React.createElement('span', null, label || 'pending'); };
  const root = ReactDOM.createRoot(container);
  await act(async () => root.render(React.createElement(Probe, { zip: '92807' })));
  await flush(); await flush();
  expect(container.textContent).toBe('Anaheim, CA');
  await act(async () => root.unmount());
  document.body.removeChild(container);
});
