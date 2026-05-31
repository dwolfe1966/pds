---
name: authcontext-test-pattern
description: "How to test AuthContext side effects (refreshSubscription, etc.) — AuthContext object is NOT exported; use useAuth() inside a CaptureContext component + flushAsync."
metadata: 
  node_type: memory
  type: reference
  originSessionId: beff305e-e28e-465c-90af-417c852b951d
---

`src/context/AuthContext.js` exports `AuthProvider` and `useAuth` but NOT the `AuthContext` object itself (line 10: `const AuthContext = createContext()` — local). So `useContext(AuthContext)` from a test file fails with "AuthContext is undefined." Use `useAuth()` instead.

**Working test pattern (used by `src/tests/refreshSubscription.test.js`):**

```js
import React, { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// AuthProvider also calls setTokenGetter + setLogoutHandler from '../api' on mount.
jest.mock('../api', () => ({
  __esModule: true,
  default: mockApi,
  setTokenGetter: jest.fn(),
  setLogoutHandler: jest.fn(),
}));
jest.mock('../services/gtmContext', () => ({ setUser: jest.fn(), clearUser: jest.fn(), setTransaction: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

let AuthProvider, useAuth;
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ AuthProvider, useAuth } = require('../context/AuthContext'));
});

let ctxValue;
function CaptureContext() {
  const ctx = useAuth();
  ctxValue = ctx;
  // Seed a token so refreshSubscription's `if (!t) return null` doesn't short-circuit.
  useEffect(() => { if (!ctx.token) ctx.setToken?.('tok-test'); }, []);
  return null;
}

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(AuthProvider, null, React.createElement(CaptureContext)));
  });
}

// AuthProvider fires refreshSubscription in a useEffect on token change.
// TWO ticks needed: one for the token setState to commit, one for the
// effect-fired getUserOrders promise to settle. Single tick fails silently.
async function flushAsync() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}
```

**Gotchas:**
- Don't import `AuthContext` directly — it isn't exported. Mistake costs ~5 min the first time.
- `setTokenGetter`/`setLogoutHandler` are named exports from `../api` AuthProvider calls on mount. The default-export mock for `../api` must include them, or the provider throws during render.
- `flushAsync` with one tick passes the initial render but misses the post-token-change subscription fetch. Two ticks is the right count for AuthProvider as of 2026-05-31.

Related: [[reference_jest_static_asset_imports]] for the other infra gotcha in this codebase.
