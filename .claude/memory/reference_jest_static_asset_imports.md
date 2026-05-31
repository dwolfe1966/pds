---
name: jest-static-asset-imports
description: "Project pattern for handling source files that import .png/.jpg/.svg under Jest — use moduleNameMapper + a static asset import, not babel plugins for import.meta."
metadata: 
  node_type: memory
  type: reference
  originSessionId: beff305e-e28e-465c-90af-417c852b951d
---

Parcel resolves `new URL('../assets/foo.png', import.meta.url).href` and emits a hashed asset URL. The same expression fails in Jest with `SyntaxError: Cannot use 'import.meta' outside a module` — Jest treats files as CJS at runtime, and that's a *parse* error (try/catch cannot catch it). Adding a syntax plugin (`@babel/plugin-syntax-import-meta`) only enables parsing — the `import.meta` token still ships to Node and throws.

**Project pattern (working, ships in production):**

```js
// In source — Parcel handles asset hashing, Jest reads through fileMock:
import idlookupLogo from '../assets/idlookup_icon_transparent.png';
```

```jsonc
// package.json jest config:
"moduleNameMapper": {
  "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
  "\\.(png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.js"
}
```

```js
// src/__mocks__/fileMock.js
module.exports = 'test-file-stub';
```

**Why this beats the alternatives:**
- No new babel deps. `babel-plugin-transform-import-meta` works but is one more thing to keep current.
- Parcel emits the same hashed asset URL either way — diff in built bundle is zero apart from the hash that always changes when source changes.
- It's the well-trodden Jest pattern (most React docs reference it).

**When you hit this again:** if a test that worked yesterday starts failing with `SyntaxError: Cannot use 'import.meta'`, someone added `import.meta.url` to a non-test file. Either switch that file to the static-import pattern above, or — if the file genuinely needs `import.meta` for some Parcel-only feature — `jest.mock('../path/to/that/file')` in every test that transitively imports it.

Related: [[reference_authcontext_test_pattern]] for the other "tests touch a module that wasn't easy to mock" gotcha this codebase has.
