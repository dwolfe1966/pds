---
name: Member search result limit — ByteCrtrs API caution
description: Testing >5 results per member search call; ByteCrtrs may not support it
type: project
---

The team should test pulling back more than 5 results per member search call.

**Why:** Current limit of 5 may be artificially low; more results = better UX. However ByteCrtrs API may have hard limits or break on larger page sizes.

**How to apply:** If ByteCrtrs returns errors or malformed data when limit > 5, revert to 5 and document the cap. Do not block the sprint on this — it is a test/discovery task, not a hard requirement. If it fails, stay at 5 and note the API constraint in MEMORY.md.
