---
name: BC Admin API Reference (csrWrapper)
description: ByteCrtrs admin API endpoints using csrWrapper — for separate Admin App build
type: reference
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
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
| Find Contact Messages | `csrWrapper.api.message.contact.find({ lastId? })` | GET /api/contactMessage/admin/find | Sorted by latest reply; each doc may include `latestReply` |
| Find User Contacts | `csrWrapper.api.user.findUserContacts({ userId, lastId? })` | POST /contactMessage/admin/find/:targetUserId | Contacts assigned via `setTargetUser` |
| Contact Histories | `csrWrapper.api.message.contact.histories({ contactMessageId, lastId? })` | GET /api/contactMessage/admin/histories | Full thread (contact, userReply, csrReply) |
| Reply Link URL | `csrWrapper.api.message.contact.replyLinkUrl({ messageId })` | GET /api/contactMessage/admin/replyUrl | |
| Create Contact (CSR-composed) | `csrWrapper.api.message.contact.create({ topic, name, email, phone, description, orderId, zip?, last4?, actorId?, attachments? })` | POST /api/contactMessage/admin/create | |
| Create CSR Reply | `csrWrapper.api.message.contact.createCsrReply({ contactMessageId, subject, message, contentType, attachments? })` | POST /api/message/admin/user/csrMail/create | |
| Set Actor | `csrWrapper.api.message.contact.setActor({ contactMessageId, currentRevisionId, actorId? })` | POST /api/contactMessage/admin/setActor | Defaults to logged-in CSR if no actorId |
| Set Target User | `csrWrapper.api.message.contact.setTargetUser({ contactMessageId, currentRevisionId, targetUserId })` | POST /api/contactMessage/admin/setTargetUserId | |
| Set Tags | `csrWrapper.api.message.contact.setTags({ contactMessageId, tags })` | POST /api/contactMessage/admin/setTags | Replaces existing tags |
| Change Contact → UserContact | `csrWrapper.api.contact.changeContactToUserContact({ messageId, targetUserId })` | POST /api/message/admin/user/changeContactToUserContact | |

## Admin Notes (current API as of 2026-04-20)
| Desc | BC call | Path | Params |
|---|---|---|---|
| Create User Admin Note | `csrWrapper.api.message.note.createUserAdminNote({ userId, message, contentType, attachments? })` | POST /api/message/admin/createNote | Replaces older `user.createAdminNote` (removed 2026-04-17) |
| Create Contact Admin Note | `csrWrapper.api.message.note.createContactAdminNote({ contactMessageId, message, contentType, attachments? })` | POST /api/message/admin/createNote | |
| Update Admin Note | `csrWrapper.api.message.note.updateAdminNote({ messageId, message })` | POST /api/message/admin/updateNote | Replaces older `user.updateAdminNote` |
| Find User Admin Notes | `csrWrapper.api.user.findUserAdminNotes({ userId, lastId? })` | GET /api/message/admin/findNotes | |

## ManagedContact (alerts opt-in)
| Desc | BC call | Path | Params |
|---|---|---|---|
| Find ManagedContacts | `csrWrapper.api.managedContact.find({ brandId?, type, contactAddress?, lastId? })` | POST /api/database/search | type: 'email' or 'phone' |
| Unsubscribe | `csrWrapper.api.managedContact.unsubscribe({ managedContactId })` | POST /api/managedContact/management/unsubscribe | |

## Tracking (CSR — for searches/logins/reports per user)
**This is how the CSR profile gets a user's searches and logins.**
| Desc | BC call | Path | Params |
|---|---|---|---|
| Find User Tracking | `csrWrapper.api.tracking.findUser({ type, lastId? })` | POST /api/database/search | type can be `\|`-separated, e.g. `USER:nameSearchTeaser\|USER:phoneSearchTeaser` |

Tracking `type` values:
- `USER:nameSearchTeaser` — name teaser search
- `USER:phoneSearchTeaser` — phone teaser search
- `USER:nameSearchTeaserOptOut` — teaser optout (name)
- `USER:phoneSearchTeaserOptOut` — teaser optout (phone)
- `USER:nameSearch` — name report creation
- `USER:phoneSearch` — phone report creation
- `USER:login` — user login (added 2026-04-13)

CSR profile mapping:
- **Orders** → `user.findOrders({ userId })`
- **Searches** → `tracking.findUser({ type: 'USER:nameSearchTeaser|USER:phoneSearchTeaser' })`
- **Logins** → `tracking.findUser({ type: 'USER:login' })`
- **Reports** → `tracking.findUser({ type: 'USER:nameSearch|USER:phoneSearch' })`

## Attachments
| Desc | BC call | Path |
|---|---|---|
| Download | `csrWrapper.api.attachment.download({ attachmentId })` | GET /api/attachment/download |
| Remove | `csrWrapper.api.attachment.remove({ attachmentId })` | POST /api/attachment/remove |

## Order Response Shape
Orders from findOrders include:
- `_id`, `status`, `shConId`, `shColId`, `payeeId`, `payerId`
- `commerceTokens[]`, `commerceOffers[]`
- `commerceOfferRevisions[]` — full offer detail with pricing rules
- `schedule` — next payment schedule (use .\_id for updateScheduleDueTimestamp)
- `commercePayments[]` — first N payments (use findOrderPayments for more)
- `orderHistories[]` — first N histories (use findOrderHistories for more)
