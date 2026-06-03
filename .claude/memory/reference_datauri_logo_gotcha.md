---
name: parcel-png-import-resolves-to-use-the-inlined-data-uri-logo
description: "Importing a .png in this app yields an empty object at runtime (broken <img src=\"[object Object]\">); the brand logo is inlined as a base64 data URI instead."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

In this Parcel build, `import x from './foo.png'` resolves to an **empty object
`{}`** at runtime (NOT a URL string). Rendering it gives `<img src="[object Object]">`
— a broken image. This caused the consumer header bug (#67) AND the admin header
bug; both manifested as "broken logo + the alt text appearing beside the wordmark."

**Diagnosis tell:** a broken `<img>` whose `src` is literally `/[object Object]`.
Confirmed via `import.evaluateAll → Object.keys(asset) === []`.

**Fix:** the IDLookup logo is inlined as a base64 data URI in
`src/assets/idlookupLogo.js` (`export default "data:image/png;base64,..."`). Import
THAT, not the .png:
```js
import logoSrc from '../assets/idlookupLogo';   // string data URI — works everywhere
```
`BrandLogo` (consumer) also coerces `logoAsset` to a string and falls back to an
SVG monogram if it's ever an object. AdminNav imports the data URI directly.

Root cause history: commit `3799043` swapped `new URL('../assets/x.png',
import.meta.url).href` (a real URL string) for the plain `.png` import to satisfy
Jest — which broke the Parcel runtime value. The data URI satisfies dev, prod,
Jest, and any host with no asset-resolution dependency. See [[reference_jest_static_asset_imports]].

If you add a new image: don't `import x from './x.png'` — inline it as a data URI
module or you'll ship a broken `<img>`.
