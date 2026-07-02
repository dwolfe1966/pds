---
name: reference_bc_user_status_enum
description: "BC user status enum has NO 'suspended'; CSR suspend must write 'blocked'"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

`POST /user/management/update` (csrWrapper.api.user.update → csrUpdateUser) validates `status` against a fixed enum: **`active, inactive, removed, inProgress, fulfilled, rejected, failed, blocked, banned, error, requested, wrong`**. There is **NO `suspended`** value — writing it 400s with "status must be one of the following values: …".

CSR **suspend** account = write `status: 'blocked'` (reversible lose-access); **unsuspend** = `status: 'active'`. Read side treats `'blocked'` (and legacy `'suspended'`) as Suspended — `isSuspendedStatus()` in UserDetailPage, the UsersPage badge, and the status filter (option value `blocked`). Fixed 2026-06-27 (commit d51cd1d); before this, suspend silently 400'd and never worked (Hana's report).

⚠️ UNVALIDATED: that BC's auth actually DENIES login for `status:'blocked'` users (vs just flagging). Owner to confirm a blocked user can't log in; if not, try `'banned'`. See [[project_csr_auth_state_2026_06_16]], [[reference_bc_user_object_no_zip]].
