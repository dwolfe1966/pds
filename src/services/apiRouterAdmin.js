/**
 * Admin (CSR) API dispatch.
 *
 * Holds every `admin-*` endpoint case that used to live in apiRouter.js's
 * callNewAPI switch. Imported ONLY by the admin entry (src/admin-index.js),
 * which registers callAdminAPI via setAdminHandler() — so the BC csrWrapper
 * surface (apiWrapperCsr) never reaches the consumer bundle.
 *
 * BC CSR responses typically wrap lists in { raws: [...] } and single items
 * as the root object. We normalise to { data: [...] } or the raw object so
 * admin pages can use a consistent shape.
 */

import apiWrapperCsr from './apiWrapperCsr';
import { dbg } from './_debug';

export async function callAdminAPI(endpoint, params) {
  switch (endpoint) {
    // csrWrapper.api.user.find → POST /database/search
    // Native support for email/phone/zip/panLast4/lastId as of BC update 2026-04-07.
    // The prior commerceOrder-collection fallback is no longer needed.
    case 'admin-users': {
      const qp = params.queryParams || {};
      const raw = await apiWrapperCsr.csrFindUsers(qp);
      const items = raw?.docs ?? raw?.raws ?? raw?.users ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.getUserDetail → POST /user/management/detail
    case 'admin-user-detail': {
      return await apiWrapperCsr.csrGetUserDetail(params.id);
    }

    // csrWrapper.api.attachment.download → GET /api/attachment/download
    case 'admin-download-attachment': {
      return await apiWrapperCsr.csrDownloadAttachment(params.attachmentId, { playAudioFlag: params.playAudioFlag });
    }

    // csrWrapper.api.user.update → POST /user/management/update
    case 'admin-suspend-user': {
      return await apiWrapperCsr.csrUpdateUser(params.id, { status: 'suspended' });
    }

    // csrWrapper.api.user.update → POST /user/management/update (re-activate)
    case 'admin-unsuspend-user': {
      return await apiWrapperCsr.csrUpdateUser(params.id, { status: 'active' });
    }

    // csrWrapper.api.user.findOrders → POST /commerceMgnt/userOrders → { orders: [...] }
    case 'admin-purchases': {
      const raw = await apiWrapperCsr.csrFindUserOrders(params.queryParams || {});
      const items = raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length };
    }

    // Global recent-orders default view.
    //
    // BC's /database/search on commerceOrder may reject unfiltered queries
    // depending on backend config — when it does, we fan out: pull the top N
    // recent customers and merge their per-user findOrders pages. Strictly
    // worse than a real global query (limited to N customers' worth of
    // orders), but produces a meaningful default view instead of an empty page.
    //
    // queryParams:
    //   - limit (default 10) — number of orders to return after merge
    //   - userPoolSize (default 25) — how many recent customers to scan when
    //     falling back. Bump if CSRs report missing recent orders.
    //   - any other filter passes straight through to the global search.
    case 'admin-purchases-global': {
      const qp = params.queryParams || {};
      const limit = Math.max(1, Math.min(100, Number(qp.limit) || 10));
      const userPoolSize = Math.max(5, Math.min(100, Number(qp.userPoolSize) || 50));

      // Diagnostics object always returned alongside data so the UI can show
      // CSRs exactly what BC did with each strategy.
      const diag = {
        triedGlobal: false, globalCount: 0, globalError: null,
        triedFanout: false, usersScanned: 0, usersWithOrders: 0,
        fanoutOrderCount: 0, fanoutError: null,
      };

      // 1. Fast path — try BC's global commerceOrder search first.
      let globalErr = null;
      try {
        diag.triedGlobal = true;
        const raw = await apiWrapperCsr.csrFindOrders(qp);
        const items = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
        diag.globalCount = items.length;
        if (items.length > 0) {
          return {
            data: items.slice(0, limit),
            total: raw?.total ?? items.length,
            noMoreDocs: raw?.noMoreDocs,
            source: 'global',
            diagnostics: diag,
          };
        }
      } catch (err) {
        globalErr = err;
        diag.globalError = err?.message || 'failed';
        dbg('[admin-purchases-global] global search failed:', err?.message);
      }

      // 2. Fan-out — pull recent customers, merge their orders.
      let recentUsers = [];
      try {
        diag.triedFanout = true;
        const usersRes = await apiWrapperCsr.csrFindUsers({ brandId: 'idlookup' });
        const users = usersRes?.docs ?? usersRes?.users ?? usersRes?.data ?? (Array.isArray(usersRes) ? usersRes : []);
        recentUsers = users;
        const userIds = users.slice(0, userPoolSize)
          .map((u) => u?._id || u?.id)
          .filter(Boolean);
        diag.usersScanned = userIds.length;

        if (userIds.length === 0) {
          return {
            data: [],
            total: 0,
            noMoreDocs: true,
            source: 'fanout-empty',
            diagnostics: diag,
            recentUsers: [],
          };
        }

        const settle = (p) => p.then((v) => v).catch(() => null);
        const orderPages = await Promise.all(
          userIds.map((uid) => settle(apiWrapperCsr.csrFindUserOrders({ userId: uid })))
        );

        const merged = [];
        orderPages.forEach((page, i) => {
          const arr = page?.orders ?? page?.docs ?? page?.data ?? (Array.isArray(page) ? page : []);
          if (arr.length > 0) diag.usersWithOrders += 1;
          arr.forEach((o) => {
            merged.push({ ...o, _resolvedUserId: o.payerId || userIds[i] });
          });
        });

        diag.fanoutOrderCount = merged.length;
        merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        dbg('[admin-purchases-global] diagnostics:', diag);

        return {
          data: merged.slice(0, limit),
          total: merged.length,
          noMoreDocs: merged.length <= limit,
          source: merged.length > 0 ? 'fanout' : 'fanout-empty',
          userPoolSize: userIds.length,
          diagnostics: diag,
          // Pass the recent-users list back so the UI can render a "lobby"
          // when no orders surface.
          recentUsers: recentUsers.slice(0, userPoolSize).map((u) => ({
            _id: u._id || u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            createdAt: u.createdAt,
          })),
        };
      } catch (fanoutErr) {
        diag.fanoutError = fanoutErr?.message || 'failed';
        dbg('[admin-purchases-global] fan-out failed:', fanoutErr?.message, diag);
        throw globalErr || fanoutErr;
      }
    }

    // csrWrapper.api.user.getOrder → POST /commerceMgnt/getUserOrder → { orders: [order] }
    case 'admin-purchase-detail': {
      const raw = await apiWrapperCsr.csrGetUserOrder({ userId: params.userId, orderId: params.id });
      const order = raw?.orders?.[0] ?? raw?.order ?? raw;
      return order;
    }

    // csrWrapper.api.user.refundVoidOrder → POST /commerceBilling/correct
    // params must include: commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
    //                      targetCommercePaymentId, targetCommercePaymentRevisionId, amount
    case 'admin-refund': {
      return await apiWrapperCsr.csrRefundVoidOrder(params.body || params);
    }

    // csrWrapper.api.optOut.find → POST /database/search
    case 'admin-data-removal': {
      const raw = await apiWrapperCsr.csrFindOptOuts(params.queryParams || {});
      const items = raw?.docs ?? raw?.raws ?? raw?.optOuts ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.findAdmin → POST /database/search (admin/csr role filter)
    // BC's findAdmin may use isAdmin flag or internal filtering.
    // Client-side filter as safety net: only return users with admin/csr roles.
    case 'admin-cs-reps': {
      const raw = await apiWrapperCsr.csrFindCsReps(params.queryParams || {});
      const allItems = raw?.docs ?? raw?.raws ?? raw?.users ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      const items = allItems.filter(u => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        return roles.includes('admin') || roles.includes('csr');
      });
      return { data: items, total: items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.create → POST /user/management/create
    case 'admin-create-cs-rep': {
      return await apiWrapperCsr.csrCreateUser(params.body || params);
    }

    // csrWrapper.api.user.update → POST /user/management/update
    case 'admin-update-cs-rep': {
      return await apiWrapperCsr.csrUpdateUser(params.id, params.body || {});
    }

    // csrWrapper.api.user.update → POST /user/management/update
    // Same endpoint as admin-update-cs-rep, but reserved for editing customer
    // (member) accounts so callers can be wired without semantic confusion.
    case 'admin-update-user': {
      return await apiWrapperCsr.csrUpdateUser(params.id, params.body || {});
    }

    // CSR: locate a user's managedContact record by type + contactAddress.
    case 'admin-find-managed-contact': {
      const raw = await apiWrapperCsr.csrFindManagedContacts(params.queryParams || params.body || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // CSR: unsubscribe a managedContact record by _id.
    case 'admin-unsubscribe-managed-contact': {
      return await apiWrapperCsr.csrUnsubscribeManagedContact(params.id || params.body?.managedContactId);
    }

    // CSR: look up an offer by shm name (real plan name + price).
    case 'admin-find-offer': {
      return await apiWrapperCsr.csrFindOfferByShmName(params.body || params.queryParams || {});
    }

    // csrWrapper.api.user.cancelUncancelOrder → POST /commerceMgnt/cancelUncancelOrder
    case 'admin-cancel-order': {
      return await apiWrapperCsr.csrCancelUncancelOrder(params.orderId, params.flag);
    }

    // Unsubscribed email contacts — managedContact.find({ type: 'email' })
    case 'admin-unsubscribe': {
      const raw = await apiWrapperCsr.csrFindManagedContacts({ type: 'email', ...(params.queryParams || {}) });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // Unsubscribe a managed contact — managedContact.unsubscribe
    case 'admin-unsubscribe-delete': {
      return await apiWrapperCsr.csrUnsubscribeManagedContact(params.id);
    }

    // Phone opt-out contacts — managedContact.find({ type: 'phone' })
    case 'admin-phone-optout': {
      const raw = await apiWrapperCsr.csrFindManagedContacts({ type: 'phone', ...(params.queryParams || {}) });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // Unsubscribe a phone managed contact
    case 'admin-phone-optout-delete': {
      return await apiWrapperCsr.csrUnsubscribeManagedContact(params.id);
    }

    // User contacts (notes + csr mail) — findUserContacts({ userId, lastId? })
    case 'admin-user-contacts': {
      const raw = await apiWrapperCsr.csrFindUserContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // BC's dedicated read endpoint for admin notes (GET /message/admin/findNotes).
    case 'admin-find-user-notes': {
      const raw = await apiWrapperCsr.csrFindUserAdminNotes(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // ALL userContact docs (across all users) for the unified admin inbox.
    case 'admin-find-all-user-contacts': {
      const raw = await apiWrapperCsr.csrFindAllUserContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // Create admin note on a user — message.note.createUserAdminNote({ userId, message, contentType, attachments })
    case 'admin-create-note': {
      return await apiWrapperCsr.csrCreateAdminNote(params.body || {});
    }

    // Create admin note on a contact message — message.note.createContactAdminNote({ contactMessageId, message, contentType, attachments })
    case 'admin-create-contact-note': {
      return await apiWrapperCsr.csrCreateContactAdminNote(params.body || {});
    }

    // Update admin note — message.note.updateAdminNote({ messageId, message })
    case 'admin-update-note': {
      return await apiWrapperCsr.csrUpdateAdminNote(params.body || {});
    }

    // Send CSR mail to a user — createCsrMail({ targetUserId, subject, message })
    case 'admin-create-csr-mail': {
      return await apiWrapperCsr.csrCreateCsrMail(params.body || {});
    }

    // csrWrapper.api.user.findOrderPayments → POST /commerceMgnt/orderPayments
    case 'admin-order-payments': {
      const raw = await apiWrapperCsr.csrFindOrderPayments(params.orderId, params.lastPaymentId);
      const payments = raw?.payments ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: payments };
    }

    // csrWrapper.api.user.findOrderHistories → POST /commerceMgnt/orderHistories
    case 'admin-order-histories': {
      const raw = await apiWrapperCsr.csrFindOrderHistories(params.orderId, params.lastRevisionId);
      const histories = raw?.orderHistories ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: histories, perPage: raw?.perPage ?? 5 };
    }

    // csrWrapper.api.user.getOrder → POST /commerceMgnt/getUserOrder (single order)
    case 'admin-order-detail': {
      const raw = await apiWrapperCsr.csrGetUserOrder({ userId: params.userId, orderId: params.orderId, lastPaymentId: params.lastPaymentId });
      const order = raw?.orders?.[0] ?? raw?.order ?? raw;
      return order;
    }

    // csrWrapper.api.user.updateSchedule → POST /commerceMgmt/updateSchedule
    case 'admin-update-schedule': {
      return await apiWrapperCsr.csrUpdateScheduleDueTimestamp(params.scheduleId, params.dueTimestamp, params.amount);
    }

    // Tracking — database/search on 'tracking' collection
    // CSR-initiated billing sale (agent order on behalf of user)
    case 'admin-create-order': {
      return await apiWrapperCsr.csrCreateOrder(params.body || {});
    }

    case 'admin-user-tracking': {
      const raw = await apiWrapperCsr.csrFindUserTracking(params);
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // CSR: find visitor contact messages
    case 'admin-find-contacts': {
      const raw = await apiWrapperCsr.csrFindContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // CSR: link visitor contact to a user account
    case 'admin-change-contact-to-user': {
      return await apiWrapperCsr.csrChangeContactToUserContact(params.body || {});
    }

    // CSR: find all contact messages (member + non-member)
    // csrWrapper.api.message.contact.find → GET /contactMessage/admin/find
    case 'admin-find-contact-messages': {
      const raw = await apiWrapperCsr.csrFindContactMessages(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: find contact messages linked to a specific user — by targetUserId
    // when set, or by sender email as fallback. Email is essential because BC
    // doesn't auto-populate targetUserId on member-submitted contactMessages.
    case 'admin-find-user-contact-messages': {
      const raw = await apiWrapperCsr.csrFindUserContactMessages({
        userId: params.userId || params.id,
        userEmail: params.userEmail,
        lastId: params.lastId,
      });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: get full history of a single contact message thread
    // csrWrapper.api.message.contact.histories → GET /contactMessage/admin/histories
    case 'admin-contact-histories': {
      const raw = await apiWrapperCsr.csrFindContactHistories(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: reply to a contact message thread
    // csrWrapper.api.message.contact.createCsrReply → POST /message/admin/user/csrMail/create
    case 'admin-create-csr-reply': {
      return await apiWrapperCsr.csrCreateCsrReply(params.body || {});
    }

    // CSR: assign contact message to self / another CSR
    case 'admin-set-contact-actor': {
      return await apiWrapperCsr.csrSetContactActor(params.body || {});
    }

    // CSR: link contact message to a user
    case 'admin-set-contact-target-user': {
      return await apiWrapperCsr.csrSetContactTargetUser(params.body || {});
    }

    // CSR: replace tags on a contact message
    case 'admin-set-contact-tags': {
      return await apiWrapperCsr.csrSetContactTags(params.body || {});
    }

    default:
      throw new Error(`Unknown admin endpoint: ${endpoint}`);
  }
}
