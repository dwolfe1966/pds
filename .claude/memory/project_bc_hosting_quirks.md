---
name: BC hosting cert + URL quirks
description: ByteCrtrs serves multiple hostnames from one nginx backend but the TLS cert only covers some — pin app→API URLs to relative /api or to a hostname that's actually in the cert SAN.
type: project
originSessionId: ed6a1fb6-9daf-4f36-a40e-b2ed117467bc
---
ByteCrtrs's nginx serves the same backend on both `dev.www.bytecrtrs.com` and `dev.admin.www.bytecrtrs.com`, but the **TLS cert presented at both endpoints** only covers:

```
CN:  dev.admin.www.bytecrtrs.com
SAN: dev.admin.www.bytecrtrs.com, dev.gwhubadmin.www.bytecrtrs.com
```

Pointing a browser at `https://dev.www.bytecrtrs.com/...` produces `ERR_CERT_COMMON_NAME_INVALID` even though the underlying API works (curl -k succeeds). Login on the admin app at `dev.admin.www.bytecrtrs.com/csr` was broken until we repointed the API URL (commit `716ffdb`, 2026-05-05).

**Why:** BC apparently hasn't extended the cert SAN to cover the older `dev.www.bytecrtrs.com` hostname even though they still route traffic there.

**How to apply:**
- In `.env.production` and `.env.admin`, prefer **relative `/api`** over absolute hostnames. The build then works on whatever host it's deployed to and never hits a cert mismatch.
- If an absolute URL is unavoidable, only use `dev.admin.www.bytecrtrs.com` (or `dev.gwhubadmin.www.bytecrtrs.com`) — those are in the cert SAN.
- **Trap pending cleanup:** `src/services/apiWrapper.js` `CSR_IIFE_CANDIDATES` still hardcodes `https://dev1.dev.www.bytecrtrs.com/...` and `https://dev.www.bytecrtrs.com/...` as runtime fallbacks. Both were broken in May 2026 (`dev1.dev.www` returns 502; `dev.www` has the cert mismatch). Not normally hit because admin.html loads the wrapper via a static `<script>` tag from `/libs/csr-wrapper/`, but worth pruning if those URLs come up again.
- **Verify cert SAN before adding any new BC absolute URL:** `echo | openssl s_client -servername <host> -connect <host>:443 2>/dev/null | openssl x509 -text -noout | grep -A1 'Subject Alternative Name'`
