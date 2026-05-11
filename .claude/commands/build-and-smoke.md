---
description: Build consumer + admin bundles and start the local prod-bundle servers for smoke testing against BC dev.
argument-hint: [consumer|admin|both]
---

Build and run the local prod-bundle test rig. Default to `both` if no argument given.

Steps:

1. Run `npm run build` if `$ARGUMENTS` is `consumer` or `both` (or empty).
2. Run `npm run build:admin` if `$ARGUMENTS` is `admin` or `both` (or empty).
3. After each build, print the bundle hashes:
   ```bash
   shasum -a 256 build/index.html build/*.js 2>/dev/null | head -8
   shasum -a 256 build-admin/index.html build-admin/*.js 2>/dev/null | head -8
   ```
4. Start the local prod servers in the background:
   - Consumer: `node scripts/serve-prod.js` → http://localhost:3000 (proxies `/api` → `dev.www.idlookup.ai`)
   - Admin: `node scripts/serve-admin-prod.js` → http://localhost:3004/csr/ (proxies `/api` + `/libs` → `dev.admin.www.bytecrtrs.com`)
5. Report the URLs and tail the first ~10 lines of each server's stdout to confirm they bound their ports.
6. **Don't** run `npm install` — assume deps are present. If the build fails on missing deps, surface that and stop.
7. **Don't** kill any pre-existing node processes — list them and ask before reaping.

Argument: $ARGUMENTS
