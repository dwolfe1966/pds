/**
 * CSR API Service
 *
 * Wraps window.CsrWrapper (ByteCrtrs CSR Admin IIFE).
 * All responses are CsrResponseHelperGeneral — data is extracted via .getData().
 *
 * Initialization: CsrWrapper.getInstance({ endpointUrl })
 * Namespace:      wrapper.api.auth | .api.user | .api.optOut | .api.contact
 *
 * Set REACT_APP_USE_STUB_API=true in .env to use stub data without the IIFE.
 */

const USE_STUB   = process.env.REACT_APP_USE_STUB_API === 'true';
const BRAND_ID   = process.env.REACT_APP_BRAND_ID    || 'idlookup';

// Proxy mode (default true) — mirrors the consumer app's apiWrapper.js approach.
// In dev, all CsrWrapper calls go to our Express proxy (port 3001) which forwards
// server-side to BC, avoiding CORS.  Set REACT_APP_CSR_USE_PROXY=false in production
// if BC whitelists your domain.
const USE_PROXY  = process.env.REACT_APP_CSR_USE_PROXY !== 'false';
const PROXY_URL  = process.env.REACT_APP_CSR_PROXY_URL  || 'http://localhost:3001/api/proxy';
const DIRECT_URL = process.env.REACT_APP_CSR_DIRECT_URL || 'https://dev1.dev.www.bytecrtrs.com/api';
const API_URL    = USE_PROXY ? PROXY_URL : DIRECT_URL;

// ---------------------------------------------------------------------------
// CsrWrapper accessor — singleton init
// ---------------------------------------------------------------------------
function getWrapper() {
  if (typeof window === 'undefined') throw new Error('Browser only');
  if (!window.CsrWrapper) throw new Error('CsrWrapper IIFE not loaded');
  return window.CsrWrapper.getInstance({ endpointUrl: API_URL });
}

/**
 * Unwrap a CsrResponseHelperGeneral.
 * Throws if the response signals an error so callers can catch uniformly.
 */
function unwrap(res) {
  if (res.getError && res.getError()) {
    const err = res.getError();
    const status  = err?.response?.status;
    const message = err?.response?.data?.message
      || err?.response?.data?.error
      || err?.message
      || 'API request failed';
    const e = new Error(message);
    e.status = status;
    e.raw    = err;
    throw e;
  }
  return res.getData ? res.getData() : res;
}

// ---------------------------------------------------------------------------
// Stub data (only used when REACT_APP_USE_STUB_API=true)
// ---------------------------------------------------------------------------
const STUB_USERS = [
  { _id: 'u001', email: 'alice@example.com', firstName: 'Alice', lastName: 'Brown', status: 'active', createdAt: '2025-09-01T10:00:00Z', subscription: { status: 'active' } },
  { _id: 'u002', email: 'bob@example.com',   firstName: 'Bob',   lastName: 'Smith', status: 'active', createdAt: '2025-09-02T11:00:00Z', subscription: { status: 'inactive' } },
  { _id: 'u003', email: 'carol@example.com', firstName: 'Carol', lastName: 'Jones', status: 'inactive', createdAt: '2025-08-15T09:00:00Z', subscription: null },
];
const STUB_ADMIN_USERS = [
  { _id: 'a001', email: 'support1@idlookup.ai', firstName: 'Mark',  lastName: 'Chin',   roles: ['admin'], permissions: ['CSR Manager'] },
  { _id: 'a002', email: 'support2@idlookup.ai', firstName: 'Lisa',  lastName: 'Perez',  roles: ['csr'],   permissions: ['CSR'] },
  { _id: 'a003', email: 'support3@idlookup.ai', firstName: 'Chris', lastName: 'Estomo', roles: ['csr'],   permissions: ['CSR'] },
];
const STUB_ORDERS = [
  { _id: 'ord001', status: 'active', amount: 14.95, type: 'Sale',     createdAt: '2025-09-08T10:00:00Z', payerId: 'u001', schedule: { _id: 'sch001', dueTimestamp: 1775000000000 }, commercePayments: [], orderHistories: [] },
  { _id: 'ord002', status: 'active', amount:  1.50, type: 'Sale',     createdAt: '2025-09-08T10:05:00Z', payerId: 'u001', schedule: { _id: 'sch002', dueTimestamp: 1775000000000 }, commercePayments: [], orderHistories: [] },
  { _id: 'ord003', status: 'failed', amount:  0.00, type: 'Validate', createdAt: '2025-09-08T10:10:00Z', payerId: 'u002', schedule: null, commercePayments: [], orderHistories: [] },
];
const STUB_PAYMENTS = [
  { _id: 'pay001', orderId: 'ord001', amount: 14.95, status: 'fulfilled', type: 'Sale',     createdAt: '2025-09-08T10:00:00Z' },
  { _id: 'pay002', orderId: 'ord002', amount:  1.50, status: 'fulfilled', type: 'Sale',     createdAt: '2025-09-08T10:05:00Z' },
  { _id: 'pay003', orderId: 'ord003', amount:  0.00, status: 'failed',    type: 'Validate', createdAt: '2025-09-08T10:10:00Z' },
];
const STUB_NOTES = [
  { _id: 'n001', userId: 'u001', message: 'Customer requested refund.', createdAt: '2025-09-08T10:00:00Z' },
  { _id: 'n002', userId: 'u002', message: 'Service was unavailable.',   createdAt: '2025-09-07T09:00:00Z' },
];
const STUB_OPTOUTS = [
  { _id: 'oo001', brandId: 'idlookup', email: 'user@example.com', status: 'requested', provider: 'nameSearchIDI', targetId: '281475231322381', createdAt: '2025-09-09T10:06:00Z', type: 'name' },
];
const STUB_CONTACTS = [
  { _id: 'c001', email: 'contact1@example.com', firstName: 'John', lastName: 'Doe',   status: 'requested', brandId: 'idlookup', createdAt: '2025-09-09T08:00:00Z' },
  { _id: 'c002', email: 'contact2@example.com', firstName: 'Jane', lastName: 'Smith', status: 'fulfilled', brandId: 'idlookup', createdAt: '2025-09-08T08:00:00Z' },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
class CsrApiService {

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login({ username, password }) {
    if (USE_STUB) {
      if ((username === 'admin@admin.admin' && password === 'bcEdgeApiPass123!@#') ||
          (username === 'admin@idlookup.ai' && password === 'admin123'))
        return { user: { _id: 'a001', email: username, role: 'admin', firstName: 'Mark', lastName: 'Chin' } };
      throw new Error('Invalid credentials');
    }
    const res = await getWrapper().api.auth.login({ username, password });
    return unwrap(res);
  }

  async logout() {
    if (USE_STUB) return { success: true };
    try {
      const res = await getWrapper().api.auth.logout();
      return unwrap(res);
    } catch { return { success: true }; } // logout failure never blocks local teardown
  }

  async checkSession() {
    if (USE_STUB) return null;
    try {
      const res = await getWrapper().api.auth.login({});
      return unwrap(res);
    } catch { return null; }
  }

  // ── Users (members) ───────────────────────────────────────────────────────

  async findUsers({ brandId = BRAND_ID, email, lastId } = {}) {
    if (USE_STUB) {
      let users = [...STUB_USERS];
      if (email) users = users.filter(u => u.email.includes(email));
      if (lastId) { const i = users.findIndex(u => u._id === lastId); users = users.slice(i + 1); }
      return { users: users.slice(0, 20) };
    }
    const res = await getWrapper().api.user.find({ brandId, email, lastId });
    return unwrap(res);
  }

  async getUserDetail({ userId }) {
    if (USE_STUB) return { user: STUB_USERS.find(u => u._id === userId) || STUB_USERS[0] };
    const res = await getWrapper().api.user.getUserDetail({ userId });
    return unwrap(res);
  }

  // ── Admin users (staff) ───────────────────────────────────────────────────

  async findAdminUsers({ brandId = BRAND_ID, email, lastId } = {}) {
    if (USE_STUB) return { users: STUB_ADMIN_USERS };
    const res = await getWrapper().api.user.findAdmin({ brandId, email, lastId });
    return unwrap(res);
  }

  async createAdminUser({ email, password, firstName, lastName, roles = [], shConId = '', shColId = '' }) {
    if (USE_STUB) {
      const user = { _id: `a${Date.now()}`, email, firstName, lastName, roles };
      STUB_ADMIN_USERS.push(user);
      return { user };
    }
    const res = await getWrapper().api.user.create({ email, password, firstName, lastName, roles, shConId, shColId });
    return unwrap(res);
  }

  async updateAdminUser({ userId, ...fields }) {
    if (USE_STUB) {
      const u = STUB_ADMIN_USERS.find(u => u._id === userId);
      if (u) Object.assign(u, fields);
      return { user: u };
    }
    const res = await getWrapper().api.user.update({ userId, ...fields });
    return unwrap(res);
  }

  // ── Admin notes ───────────────────────────────────────────────────────────

  async findAdminNotes({ userId, lastId } = {}) {
    if (USE_STUB) return { notes: STUB_NOTES.filter(n => !userId || n.userId === userId) };
    const res = await getWrapper().api.user.findAdminNotes({ userId, lastId });
    const data = unwrap(res);
    // BC returns array or { notes: [] }
    return Array.isArray(data) ? { notes: data } : data;
  }

  async createAdminNote({ userId, message }) {
    if (USE_STUB) {
      const note = { _id: `n${Date.now()}`, userId, message, createdAt: new Date().toISOString() };
      STUB_NOTES.push(note);
      return { note };
    }
    const res = await getWrapper().api.user.createAdminNote({ userId, message });
    return unwrap(res);
  }

  async updateAdminNote({ messageId, message }) {
    if (USE_STUB) {
      const note = STUB_NOTES.find(n => n._id === messageId);
      if (note) note.message = message;
      return { note };
    }
    const res = await getWrapper().api.user.updateAdminNote({ messageId, message });
    return unwrap(res);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async findUserOrders({ userId, lastOrderId } = {}) {
    if (USE_STUB) return { orders: userId ? STUB_ORDERS.filter(o => o.payerId === userId) : STUB_ORDERS };
    const res = await getWrapper().api.user.findOrders({ userId, lastOrderId });
    const data = unwrap(res);
    return Array.isArray(data) ? { orders: data } : (data?.orders ? data : { orders: data?.orders ?? [] });
  }

  async getUserOrder({ userId, orderId, lastPaymentId }) {
    if (USE_STUB) {
      const order = STUB_ORDERS.find(o => o._id === orderId) || STUB_ORDERS[0];
      return { order, commercePayments: STUB_PAYMENTS.filter(p => p.orderId === orderId) };
    }
    const res = await getWrapper().api.user.getOrder({ userId, orderId, lastPaymentId });
    return unwrap(res);
  }

  async findOrderPayments({ orderId, lastPaymentId }) {
    if (USE_STUB) return { payments: STUB_PAYMENTS.filter(p => p.orderId === orderId) };
    const res = await getWrapper().api.user.findOrderPayments({ orderId, lastPaymentId });
    const data = unwrap(res);
    return Array.isArray(data) ? { payments: data } : data;
  }

  async findOrderHistories({ orderId, lastRevisionId }) {
    if (USE_STUB) return { histories: [] };
    const res = await getWrapper().api.user.findOrderHistories({ orderId, lastRevisionId });
    const data = unwrap(res);
    return Array.isArray(data) ? { histories: data } : data;
  }

  async cancelUncancelOrder({ orderId, flag }) {
    if (USE_STUB) { const o = STUB_ORDERS.find(o => o._id === orderId); if (o) o.status = flag ? 'cancelled' : 'active'; return { success: true }; }
    const res = await getWrapper().api.user.cancelUncancelOrder({ orderId, flag });
    return unwrap(res);
  }

  async refundVoidOrder({ commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId, targetCommercePaymentId, targetCommercePaymentRevisionId, amount }) {
    if (USE_STUB) return { success: true };
    const res = await getWrapper().api.user.refundVoidOrder({
      commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
      targetCommercePaymentId, targetCommercePaymentRevisionId, amount,
    });
    return unwrap(res);
  }

  async updateScheduleDueTimestamp({ scheduleId, dueTimestamp }) {
    if (USE_STUB) return { success: true };
    const res = await getWrapper().api.user.updateScheduleDueTimestamp({ scheduleId, dueTimestamp });
    return unwrap(res);
  }

  // ── OptOut ────────────────────────────────────────────────────────────────

  async findOptOuts({ status, brandId = BRAND_ID, email, provider, targetId, lastId } = {}) {
    if (USE_STUB) {
      let items = [...STUB_OPTOUTS];
      if (status) items = items.filter(o => o.status === status);
      if (email)  items = items.filter(o => o.email.includes(email));
      return { optOuts: items };
    }
    const res = await getWrapper().api.optOut.find({ status, brandId, email, provider, targetId, lastId });
    const data = unwrap(res);
    return Array.isArray(data) ? { optOuts: data } : data;
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async findContacts({ status, brandId = BRAND_ID, email, lastId } = {}) {
    if (USE_STUB) {
      let items = [...STUB_CONTACTS];
      if (status) items = items.filter(c => c.status === status);
      if (email)  items = items.filter(c => c.email.includes(email));
      return { contacts: items };
    }
    const res = await getWrapper().api.contact.find({ status, brandId, email, lastId });
    const data = unwrap(res);
    return Array.isArray(data) ? { contacts: data } : data;
  }

  // ── Payments (aggregate) ──────────────────────────────────────────────────

  async findAllPayments({ status } = {}) {
    if (USE_STUB) {
      let p = [...STUB_PAYMENTS];
      if (status) p = p.filter(x => x.status === status);
      return { payments: p };
    }
    // No direct BC endpoint for "all payments" — would need to aggregate per order.
    // For now returns empty; wire per-customer flow via findOrderPayments.
    return { payments: [] };
  }
}

export default new CsrApiService();
