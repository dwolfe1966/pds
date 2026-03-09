# CommerceBilling & User Creation Review

**Date:** January 26, 2025  
**API Doc:** [Google Sheets](https://docs.google.com/spreadsheets/d/1R7fE5Jp4TNt14BlwsbTqpxpUwNh1BxihGhfXqn0qNpQ/edit?gid=0#gid=0)

---

## 1. commerceBilling/sale API Structure (from API docs)

The API expects a structured request body with `userInfo`, `billings`, `commerceOfferKeys`, and optional `sequenceOption` / `queryString`.

### 1.1 Example from API Documentation

```javascript
apiWrapper.api.billing.sale({
  userInfo: {
    email: 'user@email.com',
    firstName: 'firstName',
    lastName: 'lastName',
    optin: true,
  },
  billings: [
    {
      billingType: 'creditCard',
      creditCard: {
        pan: '4111111111111111',
        expYear: '30',
        expMonth: '12',
        cvv: '123',
      },
      billingAddress: {
        firstName: 'billingFirstName',
        lastName: 'billingLastName',
        street1: '123 main',
        zip: '10001',
        bogusFields: {
          firstName: false,
          lastName: false,
          street1: true,
          street2: true,
          city: true,
          state: true,
          zip: false,
          country: true,
        },
      },
    },
  ],
  commerceOfferKeys: [
    {
      key: 'comp.offer.signup.main',
      target: 'main',
      options: {},
    },
  ],
  sequenceOption: {
    thinMatch: false,
    thinMatchDataProviderDown: false,
    thinMatchTooManyResults: false,
    thinMatchNoResults: false,
    thinMatchGeographic: false,
  },
  queryString: 'refer_partnerId=p1&refer_afid=af1&refer_abc=bcd',
});
```

### 1.2 Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **userInfo** | object | Yes | Identifies user on backend (user created at signup) |
| userInfo.email | string | Yes | User email |
| userInfo.firstName | string | Yes | First name |
| userInfo.lastName | string | Yes | Last name |
| userInfo.optin | boolean | Yes | Marketing opt-in |
| **billings** | array | Yes | Payment methods |
| billings[].billingType | string | Yes | e.g. `'creditCard'` |
| billings[].creditCard | object | Yes | pan, expYear, expMonth, cvv |
| billings[].billingAddress | object | Yes | firstName, lastName, street1, zip, bogusFields |
| **commerceOfferKeys** | array | Yes | Offer(s) to purchase |
| commerceOfferKeys[].key | string | Yes | e.g. `'comp.offer.signup.main'` |
| commerceOfferKeys[].target | string | Yes | e.g. `'main'` |
| commerceOfferKeys[].options | object | Yes | `{}` |
| **sequenceOption** | object | No | thinMatch flags |
| **queryString** | string | No | Referral/partner params |

### 1.3 Library Behavior

The library adds `billingSeriesId` automatically. The full params object is sent as the request body. `queryString` is also appended to the URL (with `clientId`/`apiId` excluded).

---

## 2. Previous vs Correct Implementation

### 2.1 What We Were Sending (Incorrect)

```javascript
// OLD - does not match API spec
const saleParams = {
  queryString: `?plan=basic&amount=29.99`,
  plan: 'basic',
  amount: 29.99,
  paymentToken: 'tok_demo',
};
```

### 2.2 Correct Structure

```javascript
// NEW - matches API spec
const saleParams = {
  userInfo: {
    email: form.email,
    firstName: form.firstName,
    lastName: form.lastName,
    optin: form.optin ?? true,
  },
  billings: [{
    billingType: 'creditCard',
    creditCard: {
      pan: form.cardNumber.replace(/\s/g, ''),
      expYear: form.expYear,   // e.g. '30' from MM/YY
      expMonth: form.expMonth,  // e.g. '12'
      cvv: form.cvv,
    },
    billingAddress: {
      firstName: form.billingFirstName,
      lastName: form.billingLastName,
      street1: form.street1,
      zip: form.billingZip,
      bogusFields: {
        firstName: false,
        lastName: false,
        street1: true,
        street2: true,
        city: true,
        state: true,
        zip: false,
        country: true,
      },
    },
  }],
  commerceOfferKeys: [
    { key: 'comp.offer.signup.main', target: 'main', options: {} },
  ],
  sequenceOption: {
    thinMatch: false,
    thinMatchDataProviderDown: false,
    thinMatchTooManyResults: false,
    thinMatchNoResults: false,
    thinMatchGeographic: false,
  },
  queryString: searchParams.toString() || undefined,
};
```

---

## 3. Form Fields Required

| Section | Field | Form name | Notes |
|---------|-------|-----------|-------|
| User | email | email | Required |
| User | firstName | firstName | Required |
| User | lastName | lastName | Required |
| User | optin | optin | Checkbox, default true |
| Card | pan | cardNumber | Full card number |
| Card | expYear | expYear | 2-digit year from MM/YY |
| Card | expMonth | expMonth | 2-digit month from MM/YY |
| Card | cvv | cvv | 3–4 digits |
| Billing | firstName | billingFirstName | |
| Billing | lastName | billingLastName | |
| Billing | street1 | street1 | Street address |
| Billing | zip | billingZip | |

---

## 4. Response Handling

Check success and optionally handle auth tokens if the API returns them:

```javascript
const data = result?.params?.response?.data ?? result?.data;
if (data?.success) {
  if (data.accessToken) {
    setToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
  }
}
```

---

## 5. Flow: Payment-First (Single Step)

1. User lands on Payment page (optionally from search result).
2. Form collects: userInfo (email, firstName, lastName, optin) + billing (card, address).
3. Submit → `api.billingSale(saleParams)` with full structure.
4. API creates user + processes payment.
5. On success: store tokens if returned, redirect to report/dashboard.

**SignupPage** can be skipped or simplified to redirect directly to Payment.

---

**Document Version:** 2.0  
**Last Updated:** January 26, 2025
