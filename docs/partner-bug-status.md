# PDS Partner Bug — Status Summary

Generated from session work through 2026-04-23.
Source list: `docs/new-api/bc client library - Bugs.csv` (25 IDs, ~28 distinct items, several duplicate IDs disambiguated with letters).

## Resolved

| # | Area | What the partner flagged | How it was addressed |
|---|---|---|---|
| 1 | Name Landing v1 | No validation; cramped single-name placeholder | Inline red-border errors on first/last/state; split placeholders to "First (ex. John)" / "Last (ex. Smith)" |
| 2 | Name Landing v1 | State allowed to be blank | State now required, validated before submit |
| 3 | SRP | Load More button did nothing | Button now hides once pagination returns empty; root cause is BC default page size — pagination continues via `getMore()` |
| 4 | SRP | Buttons overlaid content on S5 | ResultCard row flips to stacked layout at ≤520px so the View Full Report button doesn't collide |
| 5 | SRP | Hard 5-result cap | Surfaced real `raws.0.transient.total` count; ≤30 shows full count, >30 shows "More than 30 results — refine your search" |
| 6 | Name Landing v2 | Placeholders cramped | Placeholders updated to partner-spec format |
| 7 | Name Landing v2 | Middle name asked twice (Step 1 + Step 3) | Removed duplicate field from Step 3 |
| 8 | Name Landing v3 | "FCRA Compliant" trust badge + placeholders | Swept 22 trust-badge sites across all variants; "FCRA compliant/safe" claims removed. Legal disclaimers ("not for FCRA purposes") intentionally kept since they're protective |
| 9 | Name Landing v4 | "FCRA Safe" + placeholders | Same sweep as #8 |
| 10 | SRP | Optional city/age didn't actually filter | City/middleName/age now forwarded to BC (speculative) AND applied as client-side narrow; fallback to unfiltered if narrowing would empty results |
| 11 | SRP | No sort option | Sort dropdown added: relevance / age asc / age desc / name A-Z. Most-likely badge only shown when sort = relevance |
| 12 | Name Landing v5 | State optional | State required at location step |
| 13 | Name Landing v6 | All-red scheme blurred error-red | Swapped red palette to brand green across all V6 CSS hits (#e11d48 → #0d5d2f, etc.) |
| 14 | Phone Landing | Empty submit no error + box too low | Inline red error on empty/invalid submit; hero/form padding tightened on ≤480px so the box is above the fold on S5 |
| 15a | Phone SRP | Showed unobscured owner details | Cards now blurred-name / masked-location / "🔒 Sign up to unlock" pill |
| 15b | Phone SRP | Clicking routed to "signup free" preview | Click now goes directly to `/signup?selected=X&source=phone` with identity context preserved |
| 16 | Signup | Password rules not visible until failure; email disclosure too short | Live 5-item password checklist on SignupPage; expanded email disclosure copy |
| 17 | Payment | FCRA callout; past expiry accepted; "address on file" lie; no billing collection | FCRA removed (#8 sweep); expiry rejects past MM/YY with "This date is in the past" message; billing section auto-expanded with required ZIP; hardcoded "10001" fallback removed |
| 18 | Membersite | Paid user showed "Free Account" after refresh | Subscription now persists to localStorage with `syntheticAt` timestamp; 2-min BC-provisioning grace window; delayed reconcile 15s post-sale to swap synthetic for real BC order |
| 19 | Dashboard | Recent activity overflowed S5 width | Dashboard responsive block at ≤400px: tighter padding, wrapping text, full-width tiles |
| 20 | Membersite | Selected pre-signup report lost after payment | PaymentPage stashes `pendingReport` on createReport failure; DashboardHome auto-retries on mount and surfaces a resume banner on failure |
| 22 | Confirmation page | Missing real confirmation after paid signup | Full confirmation screen with primary CTA "View {FullName}'s report →" (when report creation succeeded) or amber "We're finishing up X's report" (when provisioning); no auto-redirect |
| 23a | Member search | Horizontal/vertical scroll on S5 | Responsive rules at ≤400px: overflow-x hidden, tighter padding, min-width: 0 on inputs |
| 23b | Member search | State/city optional | State now required with matching validation copy |
| 23c | Member search | City field needed typeahead | `<datalist>` with ~75 top US cities; users can still type any city |
| 24 | Opt Out | New BC-hosted opt-out flow | `apiWrapper.goToOptOutPage()` calls `ApiWrapper.goPage('optOut', { newPage })` per new docs; "Open opt-out portal" CTA added to `/opt-out` landing. Our custom form still works |
| 25 | Footer | Fold Refund + California Privacy into Terms/Privacy | Removed separate footer links; Refund section appended to TermsPage (`#refund-policy` anchor); California Privacy section appended to PrivacyPage (`#california-privacy` anchor). Legacy `/refund` and `/cpcc` routes still resolve for inbound links |

## Not yet addressed

| # | Area | Why it's still open |
|---|---|---|
| 21 | Signup email | BC has no transactional email endpoint. Confirmed BC will use SendGrid for outbound. Work intentionally deferred until BC's SendGrid integration lands |

## Cross-cuts addressed alongside the individual items

- **Mobile responsiveness pass** at 360–480px: landings, SRP, Dashboard, member search, ResultCard, FCRA gates (bugs 4, 14, 15b, 19, 23a)
- **FCRA language sweep** across 22 trust-badge sites in all landing + preview variants (bugs 8, 9, 17)
- **State-required validator** consolidated across landings v1/v2/v5 + member search (bugs 2, 12, 23b)
- **Split-name + placeholder format** standardized across v1–v4 (bugs 1, 6, 8, 9)

## Related partner-adjacent work also delivered in these sessions

Not on the original partner list, but tightly connected and shipped:

- Consumer tracking events wired across DashboardHome and WhoIsSearchingPage (page view + CTA clicks + tab changes + CSV export)
- BC API migrations: admin notes (`message.note.createUserAdminNote` with legacy fallback), CSR user search native zip/phone/panLast4, consumer contact flow (`message.contact.create/reply/histories`), `tracking.create` for compliance agreements
- `getUserContacts` safely stubbed after BC removed the endpoint 2026-04-17
- Admin list pages default to 10 most-recent items sorted descending (orders, data-removal, unsubscribe, notes, tickets, mail-log)
- Real-data on DashboardHome: watchlist from `getReportList`, records feed merges real `getAlerts`, exposure score computed from real report content when user has pulled reports; preview-data banner remains for widgets without a real BC source (Who's Watching, broker tracker)
- Simpler visitor preview (`/search/:id` default variant): removed 5 fake masked sections and seeded placeholder counts; replaced with honest "What's in the full report" list. Variants A–E still reachable via `?v=X` for marketing tests
