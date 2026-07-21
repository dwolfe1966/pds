/**
 * CSR (admin) API Wrapper Service
 *
 * Holds the BC csrWrapper API surface (admin/CSR endpoints) so it stays OUT of
 * the consumer bundle. Imported ONLY by the admin entry (src/admin-index.js)
 * via apiRouterAdmin.js → the consumer entry never references it, so it is
 * absent from build/ by construction.
 *
 * The low-level transport helpers (_csrPost/_csrGet/_csrPostFormData/
 * _verifyCaptcha/_generateRandomId/_makeBillingSeriesId) and _unwrapBcResponse
 * stay on the shared apiWrapper singleton — these methods delegate to them.
 */

import apiWrapper, { _unwrapBcResponse } from './apiWrapper';
import { dbg, dbgWarn } from './_debug';

// CSR IIFE is loaded by admin.html via a static <script> tag at runtime.
// loadCsrIife() is normally a no-op (window.CsrWrapper is already defined).
// This list is the runtime fallback if the static tag fails to load.
// Same-origin only — absolute upstream URLs are stripped to keep them out
// of the production bundle (they were broken anyway: cert mismatch on
// dev.www.bytecrtrs.com, 502 on dev1.dev.www.bytecrtrs.com).
const CSR_IIFE_CANDIDATES = [
  '/libs/csr-wrapper/index.iife.js',
];

let _csrIifePromise = null;

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadCsrIife() {
  if (_csrIifePromise) return _csrIifePromise;
  _csrIifePromise = (async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (window.CsrWrapper) {
      dbg('[CsrWrapper] already loaded');
      return window.CsrWrapper;
    }
    for (const url of CSR_IIFE_CANDIDATES) {
      try {
        await _loadScript(url);
        if (window.CsrWrapper) {
          dbg(`[CsrWrapper] loaded from ${url}`);
          return window.CsrWrapper;
        }
        dbg(`[CsrWrapper] script at ${url} loaded but did not expose window.CsrWrapper`);
      } catch (e) {
        // 404 or other load error — silent, try next candidate.
      }
    }
    dbg('[CsrWrapper] none of the candidate URLs returned a CSR IIFE — ask ByteCrtrs for the correct path');
    return null;
  })();
  return _csrIifePromise;
}

class ApiWrapperCsrService {
  constructor() {
    this.csrWrapper = null;
  }

  /**
   * Load (if needed) the BC CSR IIFE and return its initialized client.
   * Returns null if BC hasn't published the CSR IIFE at any URL we know.
   * Cached across calls.
   */
  async getCsrWrapper() {
    if (this.csrWrapper) {
      return this.csrWrapper;
    }
    const Cls = await loadCsrIife();
    if (!Cls) {
      return null;
    }
    try {
      this.csrWrapper = typeof Cls.getInstance === 'function'
        ? Cls.getInstance({ endpointUrl: '/api' })
        : Cls;
      return this.csrWrapper;
    } catch (e) {
      dbg('[CsrWrapper] getInstance() failed:', e?.message);
      return null;
    }
  }

  /**
   * Prefer the CSR IIFE method for a given dot-path; otherwise use `fallback`.
   *
   * ⚠️ MUTATION SAFETY: a throw from the IIFE method may occur AFTER the request
   * was already sent (timeout / parse-fail), so re-running `fallback` would
   * DOUBLE-EXECUTE the call (double sale / refund / reply / tag). So:
   *   - ABSENT method or wrapper-load failure → fall back (nothing was sent — safe).
   *   - post-invocation THROW → fall back ONLY when opts.retryOnError is true.
   * Idempotent READS default to retryOnError:true (preserves resilience + the
   * existing fallback test). EVERY MUTATING caller MUST pass { retryOnError: false }
   * so a post-send error surfaces instead of being silently retried.
   *
   * opts.validate: a predicate on the unwrapped lib result. If it returns false the
   * lib SUCCEEDED but with an unusable/wrong shape (the f156c11 class — a truthy
   * envelope with no docs[] that the caller would silently degrade to []). For
   * idempotent reads (retryOnError) we then prefer the known-good direct fallback
   * instead of returning the bad shape. (Never applied to mutations — they don't
   * pass retryOnError:true, so a committed mutation is never re-run.)
   *
   * @param {string} dotPath e.g. 'api.user.findOrders'
   * @param {*} args         passed straight through to the wrapper method
   * @param {() => Promise<*>} fallback
   * @param {{retryOnError?: boolean, validate?: (r:any)=>boolean}} [opts]
   */
  async _viaCsr(dotPath, args, fallback, opts = {}) {
    const { retryOnError = true, validate } = opts;
    let fn = null, parent = null;
    try {
      const csr = await this.getCsrWrapper();
      if (csr) {
        const parts = dotPath.split('.');
        parent = csr;
        for (let i = 0; i < parts.length - 1; i++) {
          parent = parent == null ? parent : parent[parts[i]];
        }
        fn = parent == null ? null : parent[parts[parts.length - 1]];
      }
    } catch (err) {
      // Wrapper failed to LOAD — nothing was sent — safe to use the direct fallback.
      dbg(`[CsrWrapper] load failed for ${dotPath}, falling back: ${err?.message}`);
      return await fallback();
    }
    if (typeof fn !== 'function') {
      // Method ABSENT on this deployment — nothing was sent — safe to fall back.
      return await fallback();
    }
    try {
      const result = _unwrapBcResponse(await fn.call(parent, args));
      // Lib succeeded but with an unusable shape → for idempotent reads, use the
      // known-good direct call instead of silently degrading to an empty list.
      if (retryOnError && typeof validate === 'function' && !validate(result)) {
        dbg(`[CsrWrapper] ${dotPath} returned an unusable shape, falling back to direct`);
        return await fallback();
      }
      return result;
    } catch (err) {
      if (retryOnError) {
        dbg(`[CsrWrapper] ${dotPath} threw, retrying via fallback: ${err?.message}`);
        return await fallback();
      }
      // Mutation: the request may already have committed — surface, never re-run.
      dbg(`[CsrWrapper] ${dotPath} threw (mutation — NOT retried): ${err?.message}`);
      throw err;
    }
  }

  // True when `r` is a usable LIST response (an array, or a BC envelope carrying a
  // recognized array). Used as _viaCsr's `validate` for finders so a wrong-shape lib
  // success (truthy but no docs[]) falls back to the direct call instead of emptying the UI.
  _isUsableList(r) {
    if (Array.isArray(r)) return true;
    if (!r || typeof r !== 'object') return false;
    return Array.isArray(r.docs) || Array.isArray(r.orders) || Array.isArray(r.payments)
      || Array.isArray(r.orderHistories) || Array.isArray(r.data);
  }

  // csrWrapper.api.user.find — POST /database/search
  // Lib-first as of 2026-06-16: api.user.find was verified _id-equivalent to the
  // direct call for BOTH the unfiltered list AND a filtered by-email query (same
  // count, same _ids, same {docs,noMoreDocs,displayFields,dateFields} after getData()).
  // The lib wraps filters into `query` itself, so pass them flat. Direct
  // /database/search retained as the fallback (BC honors filters ONLY under `query`;
  // a top-level filter is ignored and returns the default list).
  // NOTE: API-level equivalence is green; confirm UsersPage search end-to-end after
  // the role-gate bundle deploys (live UI couldn't be exercised pre-deploy).
  async csrFindUsers(params = {}) {
    const { lastId, perPage, brandId, ...filters } = params;
    const body = { brandId: brandId || 'idlookup', collectionName: 'users', query: { ...filters } };
    if (lastId) body.lastId = lastId;
    if (perPage) body.perPage = perPage;
    const libArgs = { brandId: brandId || 'idlookup', ...filters };
    if (lastId) libArgs.lastId = lastId;
    if (perPage) libArgs.perPage = perPage;
    return await this._viaCsr('api.user.find', libArgs,
      () => apiWrapper._csrPost('/database/search', body), { validate: this._isUsableList });
  }

  // CSR/admin staff list. Staff live in the `admins` collection (roles:['csr'],
  // brandId:'bytecrtrs') — NOT in `users`. (`/database/search` IGNORES `isAdmin`, so the
  // old `users`+isAdmin query returned regular CUSTOMERS as "reps".) Verified live
  // 2026-06-18: `findAdmin({})` → 10 csr-role docs from `admins`; passing
  // `brandId:'idlookup'` filters them ALL out (staff are brand 'bytecrtrs') → 0. So we
  // drop any idlookup brand filter and go lib-first to findAdmin, with a direct `admins`
  // fallback. (This was our bug, not a BC one — see BC_CSR_ASKS_PACKAGE.md.)
  async csrFindCsReps(params = {}) {
    const { brandId, collectionName, isAdmin, ...rest } = params; // strip the legacy users/isAdmin/idlookup filters
    return await this._viaCsr('api.user.findAdmin', rest,
      () => apiWrapper._csrPost('/database/search', { collectionName: 'admins', ...rest }), { validate: this._isUsableList });
  }

  // csrWrapper.api.user.getUserDetail — POST /user/management/detail
  async csrGetUserDetail(userId) {
    return await this._viaCsr('api.user.getUserDetail', { userId },
      () => apiWrapper._csrPost('/user/management/detail', { userId }));
  }

  // csrWrapper.api.user.getAutoLoginUrl — POST /user/management/getAutoLoginUrl (BC added 2026-07-21).
  // Returns { url } — a one-click loginLink that logs the SERVER in AS the target user. The URL is a
  // BEARER CREDENTIAL (whoever opens it becomes that user), used for CSR impersonation ("log in as this
  // customer" to troubleshoot). Lib-first with a direct fallback. retryOnError:false — it MINTS a
  // credential; never double-issue on a flaky retry. Optional `redirect` = post-login SPA path.
  async csrGetAutoLoginUrl(userId, redirect) {
    const args = redirect ? { userId, redirect } : { userId };
    return await this._viaCsr('api.user.getAutoLoginUrl', args,
      () => apiWrapper._csrPost('/user/management/getAutoLoginUrl', args),
      { retryOnError: false });
  }

  // csrWrapper.api.attachment.download — GET /api/attachment/download.
  // Per BC docs: attachments returned by Find User Contact carry an `attachmentId`;
  // this downloads it. The IIFE manages the browser download (like downloadPdfReport),
  // so the UI just awaits it. Lib-only — no direct-POST fallback for a binary GET, so
  // error clearly if the CSR library isn't loaded.
  // playAudioFlag: per BC docs, if true and the file is audio, the IIFE PLAYS it via an
  // audio control instead of downloading (used for live-call recordings).
  async csrDownloadAttachment(attachmentId, { playAudioFlag = false } = {}) {
    const args = playAudioFlag ? { attachmentId, playAudioFlag: true } : { attachmentId };
    return await this._viaCsr('api.attachment.download', args,
      () => { throw new Error('Attachment download requires the CSR library (not loaded).'); },
      { retryOnError: false });
  }

  // csrWrapper.api.user.update — POST /user/management/update
  async csrUpdateUser(userId, body = {}) {
    return await this._viaCsr('api.user.update', { userId, ...body },
      () => apiWrapper._csrPost('/user/management/update', { userId, ...body }), { retryOnError: false });
  }

  // csrWrapper.api.user.create — POST /user/management/create
  async csrCreateUser(body = {}) {
    return await this._viaCsr('api.user.create', body,
      () => apiWrapper._csrPost('/user/management/create', body), { retryOnError: false });
  }

  // csrWrapper.api.user.findOrders — POST /commerceMgmt/userOrders
  // Returns { orders: [...], perPage: N }
  async csrFindUserOrders(params = {}) {
    // Lib-first (api.user.findOrders) — verified _id-equivalent to the direct
    // /commerceMgmt/userOrders call (same {orders,perPage} envelope after getData()).
    // On lib-absent/throw → direct /commerceMgmt/userOrders primary.
    //
    // The old /database/search commerceOrder recovery ladder was removed 2026-06-22:
    // it only ran on a (never-observed) 404 of /commerceMgmt/userOrders, it queried
    // commerceOrder which is role-gated (403 — BC ASK C) so it never recovered anything,
    // and the lib-only mandate forbids direct /database/search. On the theoretical 404 we
    // return an empty envelope (same net result the ladder produced) rather than crash.
    try {
      return await this._viaCsr('api.user.findOrders', params,
        () => apiWrapper._csrPost('/commerceMgmt/userOrders', params), { validate: this._isUsableList });
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 405) throw err;
      dbg(`[csrFindUserOrders] /commerceMgmt/userOrders → ${err?.status}; no commerceOrder recovery (role-gated, ASK C) — returning empty`);
      return { orders: [], perPage: 0, noMoreDocs: true, _fallback: 'no-recovery-path' };
    }
  }

  // Global order search via /database/search — collectionName: 'commerceOrder'.
  // Direct only: BC's IIFE has no global commerceOrder finder; api.user.findOrders
  // requires userId and 400s on bare brandId.
  async csrFindOrders(params = {}) {
    return await apiWrapper._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'commerceOrder', ...params });
  }

  // csrWrapper.api.user.getOrder — POST /commerceMgmt/getUserOrder
  // params: { userId, orderId, lastPaymentId? }
  async csrGetUserOrder(params = {}) {
    // Lib-first (api.user.getOrder) — verified _id-equivalent to the direct
    // /commerceMgmt/getUserOrder call (same {order} payload). On lib-absent/throw →
    // direct /commerceMgmt/getUserOrder.
    //
    // The old /database/search by-_id recovery was removed 2026-06-22: it queried the
    // role-gated commerceOrder collection (403 → it threw anyway, never recovered) and the
    // lib-only mandate forbids direct /database/search. /commerceMgmt/getUserOrder is the
    // verified path; a real failure now surfaces to the caller (same as before, which
    // re-threw the 403).
    return await this._viaCsr('api.user.getOrder', params,
      () => apiWrapper._csrPost('/commerceMgmt/getUserOrder', params));
  }

  // csrWrapper.api.user.cancelUncancelOrder — POST /commerceMgmt/cancelUncancelOrder
  // flag: true = cancel, false = uncancel
  async csrCancelUncancelOrder(orderId, flag) {
    return await this._viaCsr('api.user.cancelUncancelOrder', { orderId, flag },
      () => apiWrapper._csrPost('/commerceMgmt/cancelUncancelOrder', { orderId, flag }), { retryOnError: false });
  }

  // csrWrapper.api.user.refundVoidOrder — POST /commerceBilling/correct
  // params: { commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
  //           targetCommercePaymentId, targetCommercePaymentRevisionId, amount }
  async csrRefundVoidOrder(params = {}) {
    return await this._viaCsr('api.user.refundVoidOrder', params,
      // Direct fallback must inject billingSeriesId or BC rejects "billingSeriesId should
      // not be empty" (the IIFE injects it on /commerceBilling/correct; type 'signup' per
      // the deployed wrapper). Reached only when the IIFE refundVoidOrder path is
      // unavailable/throws. MUST be validated with one real low-value refund before relying.
      () => apiWrapper._csrPost('/commerceBilling/correct', params, { billingSeriesType: 'signup' }), { retryOnError: false });
  }

  // csrWrapper.api.user.findOrderPayments — POST /commerceMgmt/orderPayments
  // params: { orderId, lastPaymentId? }
  // Lib-first (verified _id-equivalent to the direct call 2026-06-16); direct fallback.
  async csrFindOrderPayments(orderId, lastPaymentId) {
    const body = { orderId };
    if (lastPaymentId) body.lastPaymentId = lastPaymentId;
    return await this._viaCsr('api.user.findOrderPayments', body,
      () => apiWrapper._csrPost('/commerceMgmt/orderPayments', body), { validate: this._isUsableList });
  }

  // csrWrapper.api.user.findOrderHistories — POST /commerceMgmt/orderHistories
  // params: { orderId, lastRevisionId? }
  // Lib-first (verified _id-equivalent to the direct call 2026-06-16); direct fallback.
  async csrFindOrderHistories(orderId, lastRevisionId) {
    const body = { orderId };
    if (lastRevisionId) body.lastRevisionId = lastRevisionId;
    return await this._viaCsr('api.user.findOrderHistories', body,
      () => apiWrapper._csrPost('/commerceMgmt/orderHistories', body), { validate: this._isUsableList });
  }

  // csrWrapper.api.user.updateSchedule — POST /commerceMgmt/updateSchedule
  // params: { scheduleId, dueTimestamp, amount? } (amount added 2026-05-13).
  // Was broken: targeted a non-existent IIFE method (`updateScheduleDueTimestamp`) AND a
  // wrong path (`/updateScheduleDueTimestamp`) → always 404'd. No UI caller today, but fixed
  // for correctness. ⚠️ mutates a subscription schedule — live-test before relying.
  async csrUpdateScheduleDueTimestamp(scheduleId, dueTimestamp, amount) {
    const payload = { scheduleId, dueTimestamp, ...(amount != null ? { amount } : {}) };
    return await this._viaCsr('api.user.updateSchedule', payload,
      () => apiWrapper._csrPost('/commerceMgmt/updateSchedule', payload), { retryOnError: false });
  }

  // POST /commerce/offer/findByShmName — added 2026-04-21
  // Returns the offer with transient.priceInfo.s0/s1 and extName.
  // params: { shmName, key? } — key defaults to 'main' on BC if omitted.
  async csrFindOfferByShmName(params = {}) {
    return await this._viaCsr('api.offer.findByShmName', params,
      () => apiWrapper._csrPost('/commerce/offer/findByShmName', params));
  }

  // CSR-initiated billing sale — POST /commerceBilling/sale
  // Used by CS agents to create orders on behalf of users (retention, comp, downsell).
  // Uses the admin session (connect.sid) so BC tags it as a CSR-initiated order.
  async csrCreateOrder(params = {}) {
    // The deployed csrWrapper exposes no `billing.sale`, so this ALWAYS hits the direct path
    // — which (like the refund /commerceBilling/correct) needs a billingSeriesId or BC rejects
    // with 406 "billingSeriesId should not be empty". Inject it (type 'sale', matching the
    // consumer _saleViaProxy). _viaCsr target kept so it auto-uses the IIFE if BC adds
    // billing.sale. ⚠️ Validate with one real low-value CSR sale.
    return await this._viaCsr('api.billing.sale', params,
      () => apiWrapper._csrPost('/commerceBilling/sale', params, { billingSeriesType: 'sale' }), { retryOnError: false });
  }

  // csrWrapper.api.optOut.find — POST /database/search
  // Lib-first as of 2026-06-22 (BC lib-only mandate): optOut.find verified live —
  // returns the proper { docs, noMoreDocs, displayFields, dateFields } envelope
  // (_isUsableList passes; dev set is empty). The lib builds the collectionName
  // itself, so pass only brandId + paging. Direct /database/search retained as a
  // guarded fallback so a wrong-shape lib success degrades to the known-good call.
  async csrFindOptOuts(params = {}) {
    return await this._viaCsr('api.optOut.find', { brandId: 'idlookup', ...params },
      () => apiWrapper._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'optOutRequest', ...params }),
      { validate: this._isUsableList });
  }

  // Direct POST /database/search (collectionName: userContact) — returns the
  // userContact COLLECTION (CSR-outbound mail `userContactCsrMail` + member
  // inbound replies `userContact`) for a given userId, filtered by targetUserId.
  // NOT routed through the IIFE: the same-named IIFE method `user.findUserContacts`
  // hits /contactMessage/admin/find/:targetUserId and returns *contactMessages* —
  // a DIFFERENT collection (see csrFindUserContactMessages below). Semantic trap;
  // do not "migrate" this to the IIFE method. (Direct call subject to the
  // userContact /database/search role gate — BC ask, BC_CSR_LIB_METHOD_GAPS.md #1.)
  async csrFindUserContacts(params = {}) {
    const { userId, ...rest } = params;
    const body = { collectionName: 'userContact', ...rest };
    if (userId) body.targetUserId = userId;
    return await apiWrapper._csrPost('/database/search', body);
  }

  // POST /database/search with collectionName=userContact and no targetUserId
  // filter — returns ALL userContact docs (member-initiated messages, CSR
  // outbound mail, internal notes). Used to populate the unified admin inbox
  // alongside contactMessage docs. Pagination via lastId.
  async csrFindAllUserContacts(params = {}) {
    const body = { collectionName: 'userContact', ...params };
    return await apiWrapper._csrPost('/database/search', body);
  }

  // csrWrapper.api.user.findUserAdminNotes — GET /message/admin/findNotes
  // BC's dedicated read endpoint for admin notes. Replaces the older
  // /database/search collectionName=userContact path which queries the wrong
  // collection after BC restructured admin notes 2026-04-17.
  // Returns { docs: [...], noMoreDocs } per BC convention.
  //
  // IIFE-first: BC's deployed backend started returning 400 on the direct GET
  // (2026-05-31). Going through csrWrapper.api.user.findUserAdminNotes lets
  // the IIFE attach whatever csr-side auth field BC now requires. Direct GET
  // stays as a fallback in case the IIFE method isn't on this deployment.
  async csrFindUserAdminNotes({ userId, lastId } = {}) {
    if (!userId) throw new Error('userId is required');
    const args = lastId ? { userId, lastId } : { userId };
    return await this._viaCsr('api.user.findUserAdminNotes', args, async () => {
      const qs = new URLSearchParams({ userId });
      if (lastId) qs.set('lastId', lastId);
      return await apiWrapper._csrGet(`/message/admin/findNotes?${qs.toString()}`);
    }, { validate: this._isUsableList });
  }

  // csrWrapper.api.message.note.createUserAdminNote — POST /message/admin/createNote
  // params: { userId, message, contentType, attachments }
  // BC documented the new path on 2026-04-17; fall back to the old path if BC's
  // dev backend hasn't deployed the new one yet (404/405). Targeted attempts only —
  // any other error re-throws immediately so real failures surface to the user.
  async csrCreateAdminNote(params = {}) {
    const { userId, message, contentType = 'text/plain', attachments } = params;
    const body = { userId, message, contentType };
    if (attachments) body.attachments = attachments;
    // Prefer the IIFE method when available — it knows the canonical path.
    try {
      const csr = await this.getCsrWrapper();
      const fn = csr?.api?.message?.note?.createUserAdminNote;
      if (typeof fn === 'function') return await fn.call(csr.api.message.note, body);
    } catch (csrErr) {
      dbg('[csrCreateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await apiWrapper._csrPost('/message/admin/createNote', body);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[csrCreateAdminNote] new path not live; falling back to legacy /message/admin/user/note/create');
        }
        const legacyBody = { targetUserId: userId, message, contentType };
        if (attachments) legacyBody.attachments = attachments;
        return await apiWrapper._csrPost('/message/admin/user/note/create', legacyBody);
      }
      throw err;
    }
  }

  // csrWrapper.api.message.note.createContactAdminNote — POST /message/admin/createNote
  // params: { contactMessageId, message, contentType, attachments }
  async csrCreateContactAdminNote(params = {}) {
    const { contactMessageId, message, contentType = 'text/plain', attachments } = params;
    const body = { contactMessageId, message, contentType };
    if (attachments) body.attachments = attachments;
    return await this._viaCsr('api.message.note.createContactAdminNote', body,
      () => apiWrapper._csrPost('/message/admin/createNote', body), { retryOnError: false });
  }

  // csrWrapper.api.message.note.updateAdminNote — POST /message/admin/updateNote
  // params: { messageId, message }
  // Dual-stack: try new path, fall back to legacy if BC hasn't deployed yet.
  async csrUpdateAdminNote(params = {}) {
    try {
      const csr = await this.getCsrWrapper();
      const fn = csr?.api?.message?.note?.updateAdminNote;
      if (typeof fn === 'function') return await fn.call(csr.api.message.note, params);
    } catch (csrErr) {
      dbg('[csrUpdateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await apiWrapper._csrPost('/message/admin/updateNote', params);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[csrUpdateAdminNote] new path not live; falling back to legacy /message/admin/user/note/update');
        }
        return await apiWrapper._csrPost('/message/admin/user/note/update', params);
      }
      throw err;
    }
  }

  // csrWrapper.api.message.contact.create — POST /api/contactMessage/admin/create
  // CSR-composed contactMessage (creates a thread as if the user submitted it).
  // params: { topic, name, email, phone, description, orderId, zip?, last4?, actorId?, attachments? }
  // Returns the created thread with { _id, hash, ... } so callers can reply via
  // csrCreateCsrReply or share the replyLinkUrl with the user.
  async csrCreateContactMessage(params = {}) {
    // BC 2026-06-02: /contactMessage/admin/create now requires "at least one of
    // brandId or shConId". Default to the idlookup brand when the caller doesn't
    // specify one (single-brand consumer) so CSR-composed threads don't 400.
    // Multi-brand callers can override with brandId/shConId/shColId.
    const body = params.brandId || params.shConId ? params : { brandId: 'idlookup', ...params };
    return await this._viaCsr('api.message.contact.create', body,
      () => apiWrapper._csrPost('/contactMessage/admin/create', body), { retryOnError: false });
  }

  // csrWrapper.api.user.createCsrMail — DEPRECATED 2026-04-17
  //
  // BC's old `/api/message/admin/user/csrMail/create` route returns 404
  // ("Cannot POST") on `dev.www.bytecrtrs.com`. The replacement is the
  // contact.createCsrReply path (`/contactMessage/admin/csrReply`), but
  // that endpoint requires an existing `contactMessageId` to reply to —
  // it's a thread-reply, not a standalone outbound mail.
  //
  // To preserve the "Request billing action" UX (CSR-initiated outbound
  // mail to finance with no prior user thread), we do a two-step flow:
  //
  //   1. csrCreateContactMessage — creates a new contactMessage thread on
  //      the user's behalf (BC stores it as if the user had submitted).
  //   2. csrCreateCsrReply — replies to that thread with the actual
  //      billing-action content. BC then handles the email + thread.
  //
  // The final thread is visible in /csr/tickets for follow-up. Callers
  // must pass enough user context (name, email, phone, orderId) to
  // satisfy the create endpoint's validators (same as the consumer-side
  // contactMessage/create body — phone must be a valid number; orderId
  // must match /^[a-zA-Z0-9]{8,24}$/).
  //
  // params:
  //   { targetUserId, subject, message, contentType?, attachments?,
  //     // additional fields required to bootstrap the new thread:
  //     userName, userEmail, userPhone, orderId }
  async csrCreateCsrMail(params = {}) {
    const {
      targetUserId, subject, message,
      contentType = 'text/plain', attachments,
      userName, userEmail, userPhone, orderId,
    } = params;

    if (!userEmail) throw new Error('userEmail is required to seed the contactMessage thread');

    // Step 1: create the contactMessage on the user's behalf. Use the
    // CSR subject as the thread topic so the new thread is recognizable.
    const phoneDigits = String(userPhone || '').replace(/\D/g, '');
    const phone = phoneDigits.length >= 10 ? phoneDigits : '2125550100'; // same sentinel consumer uses
    const created = await this.csrCreateContactMessage({
      topic: subject || 'Billing action requested by CSR',
      name: userName || 'Member',
      email: userEmail,
      phone,
      description: subject || 'Billing action requested by CSR',
      orderId: orderId && /^[a-zA-Z0-9]{8,24}$/.test(orderId) ? orderId : 'NOORDERID0000',
    });

    // BC returns the new contactMessage as { success, messageResult: { _id, id, ... }, mailResult }.
    // Extract the new thread id from messageResult (primary), falling back
    // to other shapes the IIFE may emit for older deployments.
    const data = created?.getData?.() ?? created;
    const newThread = data?.messageResult || data?.contactMessage || data?.doc || data?.docs?.[0] || data;
    const contactMessageId = newThread?._id || newThread?.id;
    if (!contactMessageId) {
      const err = new Error('CSR contact-message create returned no id; cannot reply.');
      err.createResponse = created;
      throw err;
    }

    // Step 2: post the actual billing-action body as a CSR reply.
    return await this.csrCreateCsrReply({
      contactMessageId,
      subject,
      message,
      contentType,
      ...(attachments ? { attachments } : {}),
    });
  }

  // csrWrapper.api.message.contact.find — GET /api/contactMessage/admin/find
  // Lists all contactMessages (member-linked and non-member) sorted by latest reply
  // or by contact date if no reply exists. Each record may include a latestReply.
  async csrFindContactMessages(params = {}) {
    // Lib-first (api.message.contact.find) — verified 2026-06-16: _id-equivalent
    // AND identical full key set (incl. latestReply) to the direct call on BOTH
    // page 1 and a lastId-paged page 2. (The prior "breaks inbox+dashboard" envelope
    // mismatch no longer reproduces through getData().) Direct GET retained as fallback.
    const qs = new URLSearchParams();
    if (params.lastId) qs.set('lastId', params.lastId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await this._viaCsr('api.message.contact.find', params,
      () => apiWrapper._csrGet(`/contactMessage/admin/find${suffix}`), { validate: this._isUsableList });
  }

  // csrWrapper.api.user.findUserContacts — POST /contactMessage/admin/find/:targetUserId
  // Lists contactMessages where targetUserId matches. Used to show a user's
  // open tickets on UserDetailPage without leaving the profile.
  //
  // Falls back to the known-working /contactMessage/admin/find (no path param)
  // and filters client-side when BC's targetUserId variant is unavailable on
  // this deployment.
  async csrFindUserContactMessages({ userId, userEmail, lastId } = {}) {
    if (!userId && !userEmail) throw new Error('userId or userEmail is required');
    // Try the targetUserId-keyed REST path first when we have an id, then fall
    // through to the inbox-wide scan + client-side filter below.
    //
    // Deliberately NOT routed through the IIFE's findUserContacts. Like its
    // sibling api.message.contact.find (see csrFindContactMessages, which is
    // "Direct only" for the same reason), findUserContacts returns a different
    // envelope shape than our parsers expect: _unwrapBcResponse yields a
    // truthy object with no docs[] array, which short-circuits this method and
    // renders an EMPTY Messages list on UserDetailPage. (Regressed by f156c11
    // when the IIFE-first pattern was applied to messages as well as notes;
    // the notes read csrFindUserAdminNotes keeps the IIFE — messages do not.)
    // Loose match on user-id OR email, merging two sources. We must ALWAYS run the
    // email scan when we have an email — NOT only on 404 — because consumer contact-
    // form messages carry no targetUserId/owner (verified live 2026-06-09: docs link
    // to the member only by sender email), so BC's targetUserId-keyed endpoint returns
    // 200-but-EMPTY for them and the old "fallback on 404" never fired. That left
    // consumer→CSR messages visible on the general inbox but missing from the user's
    // detail page. Dedupe by _id across both sources.
    const wantEmail = (userEmail || '').toLowerCase().trim();
    const byId = new Map();
    const add = (d) => { const k = d?._id || d?.id; byId.set(k || byId.size, d); };

    // (a) BC's targetUserId-keyed REST path — catches messages explicitly linked to
    // the user (e.g. CSR-composed mail). 404/405 = not on this deployment; ignore.
    if (userId) {
      try {
        const r = await apiWrapper._csrPost(`/contactMessage/admin/find/${encodeURIComponent(userId)}`, lastId ? { lastId } : {});
        (r?.docs ?? r?.data ?? (Array.isArray(r) ? r : [])).forEach(add);
      } catch (err) {
        if (err?.status !== 404 && err?.status !== 405) throw err;
        dbg(`[csrFindUserContactMessages] /contactMessage/admin/find/${userId} → ${err?.status}, relying on inbox scan`);
      }
    }

    // (b) Inbox scan + loose client match on targetUserId OR sender email. BC has no
    // server-side email filter on /contactMessage/admin/find, so a member's older
    // tickets sit beyond page 1 and were getting missed (e.g. a May ticket viewed in
    // June). Page through the inbox (bounded) and collect every match. Early-stops on
    // noMoreDocs, so a small inbox costs ~1-2 requests; the cap only bites in
    // high-volume prod (real fix = a BC server-side email filter — filed as a BC ask).
    // email/targetUserId are in displayFields (read by the general inbox), so
    // client-matching on them is safe. A caller-supplied lastId means single-page mode.
    let scanned = 0;
    if (wantEmail || userId) {
      const MAX_PAGES = lastId ? 1 : 40;
      let cursor = lastId || null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const raw = await this.csrFindContactMessages(cursor ? { lastId: cursor } : {});
        const docs = raw?.docs ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
        if (!docs.length) break;
        scanned += docs.length;
        for (const d of docs) {
          const t = d?.content?.targetUserId || d?.targetUserId;
          if (userId && t === userId) { add(d); continue; }
          if (!wantEmail) continue;
          const senderEmail = (d?.content?.input?.email || d?.content?.email || '').toLowerCase().trim();
          if (senderEmail === wantEmail) add(d);
        }
        const next = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
        if (raw?.noMoreDocs || !next || next === cursor) break;
        cursor = next;
      }
    }

    const merged = [...byId.values()];
    dbg(`[csrFindUserContactMessages] merged ${merged.length} (scanned ${scanned}; userId=${userId || '∅'}, email=${wantEmail || '∅'})`);
    return { docs: merged, noMoreDocs: true, _looseMatched: true };
  }

  // csrWrapper.api.message.contact.histories — GET /api/contactMessage/admin/histories
  // Returns the full thread (contact + user/csr replies) for a contact message.
  async csrFindContactHistories(params = {}) {
    // Lib-first (api.message.contact.histories) — verified _id-equivalent + sameKeys
    // to the direct call 2026-06-16. Direct GET retained as fallback.
    const qs = new URLSearchParams();
    if (params.contactMessageId) qs.set('contactMessageId', params.contactMessageId);
    if (params.lastId) qs.set('lastId', params.lastId);
    return await this._viaCsr('api.message.contact.histories', params,
      () => apiWrapper._csrGet(`/contactMessage/admin/histories?${qs.toString()}`), { validate: this._isUsableList });
  }

  // csrWrapper.api.message.contact.createCsrReply — POST /contactMessage/admin/csrReply
  // The deployed CSR IIFE uses /contactMessage/admin/csrReply (not the older
  // /message/admin/user/csrMail/create from earlier BC docs) and posts
  // FormData rather than JSON. Direct fallback follows the same shape.
  // params: { contactMessageId, subject, message, contentType, attachments? }
  async csrCreateCsrReply(params = {}) {
    const { contentType = 'text/html', ...rest } = params;
    const body = { contentType, ...rest };
    return await this._viaCsr('api.message.contact.createCsrReply', body,
      () => apiWrapper._csrPostFormData('/contactMessage/admin/csrReply', body), { retryOnError: false });
  }

  // csrWrapper.api.message.contact.setActor — POST /contactMessage/admin/setActor
  // Assigns an admin/CSR user to the contact message. actorId defaults to the caller.
  async csrSetContactActor(params = {}) {
    return await this._viaCsr('api.message.contact.setActor', params,
      () => apiWrapper._csrPost('/contactMessage/admin/setActor', params), { retryOnError: false });
  }

  // csrWrapper.api.message.contact.setTargetUser — POST /contactMessage/admin/setTargetUserId
  // Links a contactMessage to a specific user so it appears in findUserContacts.
  async csrSetContactTargetUser(params = {}) {
    return await this._viaCsr('api.message.contact.setTargetUser', params,
      () => apiWrapper._csrPost('/contactMessage/admin/setTargetUserId', params), { retryOnError: false });
  }

  // csrWrapper.api.message.contact.setTags — POST /contactMessage/admin/setTags
  // Replaces all tags (stored in message.index) with the provided array.
  async csrSetContactTags(params = {}) {
    return await this._viaCsr('api.message.contact.setTags', params,
      () => apiWrapper._csrPost('/contactMessage/admin/setTags', params), { retryOnError: false });
  }

  // csrWrapper.api.message.contact.replyLinkUrl — GET /contactMessage/admin/replyUrl
  // Returns the reply link URL that the user would receive via email.
  async csrGetContactReplyLinkUrl(params = {}) {
    // Lib-first (api.message.contact.replyLinkUrl) — verified identical replyLinkUrl
    // to the direct call 2026-06-16. Direct GET retained as fallback.
    const qs = new URLSearchParams();
    if (params.messageId) qs.set('messageId', params.messageId);
    return await this._viaCsr('api.message.contact.replyLinkUrl', params,
      () => apiWrapper._csrGet(`/contactMessage/admin/replyUrl?${qs.toString()}`));
  }

  // csrWrapper.api.managedContact.find — POST /database/search (collectionName: managedContact)
  // params: { type ('email'|'phone'), contactAddress?, lastId? }
  // Lib-first as of 2026-06-22 (BC lib-only mandate): managedContact.find verified live —
  // HONORS the type filter (email→10 docs all type:email, phone→0) and returns full docs
  // (type, contactAddress, status, …). The lib hits the same /database/search the direct
  // call does, so the body shape matches. Direct kept as a guarded fallback.
  async csrFindManagedContacts(params = {}) {
    return await this._viaCsr('api.managedContact.find', params,
      () => apiWrapper._csrPost('/database/search', { collectionName: 'managedContact', ...params }),
      { validate: this._isUsableList });
  }

  // csrWrapper.api.managedContact.unsubscribe — POST /managedContact/management/unsubscribe
  // params: { managedContactId }
  async csrUnsubscribeManagedContact(managedContactId) {
    return await this._viaCsr('api.managedContact.unsubscribe', { managedContactId },
      () => apiWrapper._csrPost('/managedContact/management/unsubscribe', { managedContactId }), { retryOnError: false });
  }

  // Visitor contact messages. Delegates to message.contact.find — verified live
  // 2026-06-17 that GET /contactMessage/admin/find returns the visitor submissions
  // (docs all `type:"contact"`), which is the same data the inbox uses. The old
  // direct `POST /database/search {collectionName:'contact'}` path 403s "Invalid
  // Database Search Role" for the CSR role and is what BC told us to drop in favor
  // of message.contact.find (BC_CSR_LIB_RESPONSE_MESSAGE.md item 2.4).
  async csrFindContacts(params = {}) {
    return await this.csrFindContactMessages(params);
  }

  // Links a visitor contact message to a real user account. Params: { messageId, targetUserId }.
  // Stays on the direct POST /message/admin/user/changeContactToUserContact: the IIFE has NO
  // `contact.changeContactToUserContact` (confirmed absent live 2026-06-17 — no `contact` namespace),
  // so _viaCsr always falls through to the direct call anyway.
  //
  // CANDIDATE lib replacement = csrSetContactTargetUser (message.contact.setTargetUser), but DO NOT
  // switch until BC confirms equivalence: (1) BC's csrApi.csv shows setTargetUser needs a
  // `currentRevisionId` concurrency token (an extra fetch), unlike this method's {messageId,targetUserId};
  // (2) "changeContactToUserContact" implies a contact→userContact collection conversion, whereas
  // setTargetUser only sets a targetUserId field — they may not be the same operation. Asked in
  // BC_CSR_LIB_RESPONSE_MESSAGE.md item 2.7. (NB: this path is currently unused by any page.)
  async csrChangeContactToUserContact(params = {}) {
    return await this._viaCsr('api.contact.changeContactToUserContact', params,
      () => apiWrapper._csrPost('/message/admin/user/changeContactToUserContact', params), { retryOnError: false });
  }

  // csrWrapper.api.tracking.findUser — POST /database/search
  // BC's IIFE shapes the body as { collectionName: 'trackings' (plural),
  // query: { 'data.type': type } } — confirmed against the deployed CSR
  // wrapper at dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js.
  // We extend with `updaterId` so the search filters server-side to a specific
  // user; without it BC returns events for everyone of that type and we'd have
  // to paginate through the whole system to find one user's events.
  // type supports pipe-separated values, e.g.
  //   'USER:nameSearchTeaser|USER:phoneSearchTeaser'.
  // Supported types: USER:nameSearchTeaser, USER:phoneSearchTeaser,
  //   USER:nameSearchTeaserOptOut, USER:phoneSearchTeaserOptOut,
  //   USER:nameSearch, USER:phoneSearch, USER:login (2026-04-13).
  async csrFindUserTracking(params = {}) {
    const { type, lastId, updaterId } = params;
    // Lib-first as of 2026-06-22 (BC lib-only mandate). The lib `tracking.findUser`
    // DOES scope server-side to the target user — verified live: with `updaterId` it
    // returned only that user's events (distinctUpdaterIds:1), and the docs carry the
    // `data`/`createdAt`/`updaterId`/`trackingIds` fields the activity tab renders. This
    // SUPERSEDES the older "the IIFE returns events for every user" note (that was the
    // DIRECT /database/search path; the lib method behaves differently). Pass type +
    // updaterId + a large perPage; the lib builds the {collectionName,query} body itself.
    const libArgs = { perPage: 100 };
    if (type) libArgs.type = type;
    if (updaterId) libArgs.updaterId = updaterId;
    if (lastId) libArgs.lastId = lastId;
    // Guarded direct fallback: the historical hand-built body. The DIRECT call does NOT
    // honor updaterId server-side (returns all users), which is why the caller still
    // client-filters by updaterId — a harmless no-op when the lib already scoped, and the
    // safety net if the lib path is unavailable. KEEP the caller's client filter.
    const query = {};
    if (type) query['data.type'] = type;
    if (updaterId) query['updaterId'] = updaterId;
    const body = {
      collectionName: 'trackings',
      query,
      perPage: 100,
      displayFields: ['_id', 'createdAt', 'data', 'updaterId', 'trackingIds'],
    };
    if (lastId) body.lastId = lastId;
    return await this._viaCsr('api.tracking.findUser', libArgs,
      () => apiWrapper._csrPost('/database/search', body),
      { validate: this._isUsableList });
  }
}

// Export singleton instance
export default new ApiWrapperCsrService();
