---
name: BC Admin API Reference (csrWrapper)
description: ByteCrtrs admin API endpoints using csrWrapper — for separate Admin App build
type: reference
---

# ByteCrtrs Admin API (csrWrapper)

Admin app uses `csrWrapper` (separate from consumer `window.ApiWrapper`).
All methods are on `csrWrapper.api.*`

## Auth
| Desc | BC call | Path | Notes |
|---|---|---|---|
| Login | `csrWrapper.api.auth.login({ username, password })` | POST /api/auth/login | No creds = session check |
| Logout | `csrWrapper.api.auth.logout()` | POST /api/auth/logout | Returns `{ success: true }` |

## User Management
| Desc | BC call | Path | Params |
|---|---|---|---|
| Create User | `csrWrapper.api.user.create({ email, password, firstName, lastName, roles, shConId?, shColId? })` | POST /api/user/management/create | roles: `['admin']`, `['csr']`, `[]` |
| Update User | `csrWrapper.api.user.update({ userId, email?, password?, firstName?, lastName?, roles?, shConId?, shColId? })` | POST /api/user/management/update | All optional except userId |
| Get User Detail | `csrWrapper.api.user.getUserDetail({ userId })` | POST /api/user/management/detail | |
| Find Users (members) | `csrWrapper.api.user.find({ brandId?, email?, lastId? })` | POST /api/database/search | Paginated via lastId |
| Find Admin Users | `csrWrapper.api.user.findAdmin({ brandId?, email?, lastId? })` | POST /api/database/search | CSR/admin staff only |

## Admin Notes
| Desc | BC call | Path | Params |
|---|---|---|---|
| Create Note | `csrWrapper.api.user.createAdminNote({ userId, message })` | POST /api/message/admin/user/note/create | Admin-only memos |
| Find Notes | `csrWrapper.api.user.findAdminNotes({ userId, lastId? })` | POST /api/database/search | Paginated |
| Update Note | `csrWrapper.api.user.updateAdminNote({ messageId, message })` | POST /api/message/admin/user/note/update | |

## Orders & Commerce
| Desc | BC call | Path | Params |
|---|---|---|---|
| Find User Orders | `csrWrapper.api.user.findOrders({ userId, lastOrderId? })` | POST /api/commerceMgnt/userOrders | Returns orders with `schedule` (next payment), `commercePayments[]`, `orderHistories[]` |
| Get User Order | `csrWrapper.api.user.getOrder({ userId, orderId, lastPaymentId? })` | POST /api/commerceMgnt/getUserOrder | lastPaymentId: fetch payments up to id |
| Find Order Payments | `csrWrapper.api.user.findOrderPayments({ orderId, lastPaymentId? })` | POST /api/commerceMgnt/orderPayments | Pagination of commercePayments |
| Find Order Histories | `csrWrapper.api.user.findOrderHistories({ orderId, lastRevisionId? })` | POST /api/commerceMgnt/orderHistories | lastRevisionId = orderHistories._id |
| Cancel / Uncancel Order | `csrWrapper.api.user.cancelUncancelOrder({ orderId, flag })` | POST /api/commerceMgnt/cancelUncancelOrder | flag: true=cancel, false=reactivate |
| Refund / Void | `csrWrapper.api.user.refundVoidOrder({ commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId, targetCommercePaymentId, targetCommercePaymentRevisionId, amount })` | POST /api/commerceBilling/correct | type: 'refund' or 'void' |
| Update Schedule | `csrWrapper.api.user.updateScheduleDueTimestamp({ scheduleId, dueTimestamp })` | POST /api/commerceMgnt/updateScheduleDueTimestamp | scheduleId = order.schedule._id |

## OptOut
| Desc | BC call | Path | Params |
|---|---|---|---|
| Find OptOuts | `csrWrapper.api.optOut.find({ status?, brandId?, email?, provider?, targetId?, lastId? })` | POST /api/database/search | status: 'requested' or 'active' |

## Contacts
| Desc | BC call | Path | Params |
|---|---|---|---|
| Find Contacts | `csrWrapper.api.contact.find({ status?, brandId?, email?, lastId? })` | POST /api/database/search | status: 'requested' or 'fulfilled' |

## Order Response Shape
Orders from findOrders include:
- `_id`, `status`, `shConId`, `shColId`, `payeeId`, `payerId`
- `commerceTokens[]`, `commerceOffers[]`
- `commerceOfferRevisions[]` — full offer detail with pricing rules
- `schedule` — next payment schedule (use .\_id for updateScheduleDueTimestamp)
- `commercePayments[]` — first N payments (use findOrderPayments for more)
- `orderHistories[]` — first N histories (use findOrderHistories for more)
