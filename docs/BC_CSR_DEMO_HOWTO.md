# Run the CSR API demo

Calls BC's own API and prints what it returns for each open ask. Read-only.

```
node scripts/demo-bc-csr-asks.js
```

- Uses a shared **dev** test account by default. To run with your own CSR account (recommended):
  ```
  CSR_USER='you@…' CSR_PWD='••••' node scripts/demo-bc-csr-asks.js
  ```
- One-time setup if needed: `npm i -D @playwright/test && npx playwright install chromium`
- If it prints "Login could not be confirmed", just run it again (cold-session hiccup).






 A — Offer lookup in the CSR context  (FIX + ADD)

  - Use-case: show plan name + s0/s1 price on a customer's order; the same lookup CSR sales
  need.
  - Page(s): UserDetailPage (/users/:id) order panel.
  - Not working: returns 403 "No offer." for the CSR role/clientId — every brand
  (idlookup/bytecrtrs/none). The same shmName resolves for consumers.
  - Lib calls made: csrWrapper.api.offer.findByShmName → doesn't exist (no offer namespace) → we
  fall to direct POST /commerce/offer/findByShmName {shmName:'comp.offer.signup.main'} → 403.
  (Consumer ApiWrapper.api.offer.findByShmName → resolves with priceInfo.)

  B — CSR billing.sale (order on behalf of a customer)  (ADD)

  - Use-case: CSR creates a sale/order for an existing customer (retention / comp / downsell).
  - Page(s): UserDetailPage (/users/:id) "create order".
  - Not working: no CSR billing namespace; the consumer method can't target a customer (no
  payerId, needs full card/PCI, charges the session user).
  - Lib calls made: csrWrapper.api.billing.sale → doesn't exist → direct POST 
  /commerceBilling/sale {…saleBody, payerId, billingSeriesId:<hand-built>} (we hand-build
  billingSeriesId or BC 406s). (Consumer ApiWrapper.api.billing.sale exists but no payerId.)

  C — Global order search (commerceOrder)  (OPEN or ADD)

  - Use-case: search/browse all orders across customers.
  - Page(s): OrdersPage (/orders), PurchasesPage (/purchases).
  - Not working: POST /database/search {collectionName:'commerceOrder'} → 403 "Invalid Database 
  Search Role" (every brand).
  - Lib calls made: csrFindOrders → direct /database/search commerceOrder → 403; workaround =
  fan-out via csrWrapper.api.user.find + csrWrapper.api.user.findOrders per recent customer
  (capped, not truly global).

  ? — userContact data model  (CONFIRM — a question, not a defect)

  - Use-case: a customer's CSR-mail / reply thread.
  - Page(s): UserDetailPage Notes & Messages, EmailTicketsPage, MailActivityPage.
  - Open question: csrWrapper.api.user.findUserContacts({userId}) hits GET 
  /contactMessage/admin/find/:userId (the contactMessage collection), and the direct userContact
  collection 403s. Is userContact a separate store, or are member messages all
  contactMessage-by-targetUserId? If the latter, nothing more is needed.
  
  Roadmap consumer-feature asks (currently mock — no lib calls being made)

  WISFY — "Who's Searching For You"
  
  - Use-case: member sees who searched for / viewed them. Page: WhoIsSearchingPage. Not working:
  100% mock (synthetic data; "coming soon"). Lib calls: none — BC has tracking.create (keyed by
  searcher only); no inbound-by-target lookup. Ask: 1 capability — an inbound-activity finder
  (aggregated/anonymized).

  Alerts

  - Use-case: watch an identity + get notified on changes. Pages: AlertsPage, NotificationBell.
  Not working: mock (getAlerts→mock, /notifications→mock). Lib calls:
  managedContact.{create,find,unsubscribe} exists (delivery addresses only). Ask: 4 capabilities
  — watch CRUD · monitoring/change-detection · notification feed · delivery pipeline.

  NOT asks (resolved on our side — don't re-raise)

  - findAdmin — our brandId:'idlookup' bug; staff are in admins/bytecrtrs; fixed.
  - tracking.findUser — works (scopes via query.updaterId).
  - 2.4 visitor contacts → message.contact.find. 2.7 link-to-user →
  message.contact.setTargetUser.
  - optOut / managedContact collections — already readable.

  This matches docs/BC_CSR_ASKS_PACKAGE.md (CSR) and docs/BC_CONSUMER_FEATURE_ASKS.md
  (consumer). Good place to pause — everything's committed; final deployable bundle is
  admin.5613cbd9.js.
