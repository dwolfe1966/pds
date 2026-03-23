/**
 * CSR API Service
 *
 * Wraps the ByteCrtrs csrWrapper IIFE for all Admin API calls.
 * When csrWrapper IIFE is not yet loaded, falls back to stub data
 * so the UI can be developed independently.
 *
 * TO WIRE REAL API:
 * 1. Add <script src="CSR_WRAPPER_URL"></script> to public/index.html
 * 2. Set REACT_APP_USE_STUB_API=false in .env
 * 3. Each method shows the real csrWrapper call in a comment.
 */

const USE_STUB = process.env.REACT_APP_USE_STUB_API !== 'false';
const BRAND_ID = process.env.REACT_APP_BRAND_ID || 'idlookup';

function getCsrWrapper() {
  if (typeof window === 'undefined') throw new Error('Browser only');
  if (!window.csrWrapper) throw new Error('csrWrapper not loaded — add IIFE script to index.html');
  return window.csrWrapper;
}

// ---------------------------------------------------------------------------
// Stub data helpers
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
  { _id: 'ord001', status: 'active',   amount: 14.95, type: 'Sale',     createdAt: '2025-09-08T10:00:00Z', payerId: 'u001', schedule: { _id: 'sch001', dueTimestamp: 1775000000000 } },
  { _id: 'ord002', status: 'active',   amount:  1.50, type: 'Sale',     createdAt: '2025-09-08T10:05:00Z', payerId: 'u001', schedule: { _id: 'sch002', dueTimestamp: 1775000000000 } },
  { _id: 'ord003', status: 'failed',   amount:  0.00, type: 'Validate', createdAt: '2025-09-08T10:10:00Z', payerId: 'u002', schedule: null },
];

const STUB_PAYMENTS = [
  { _id: 'pay001', orderId: 'ord001', amount: 14.95, status: 'fulfilled', type: 'Sale',     createdAt: '2025-09-08T10:00:00Z' },
  { _id: 'pay002', orderId: 'ord002', amount:  1.50, status: 'fulfilled', type: 'Sale',     createdAt: '2025-09-08T10:05:00Z' },
  { _id: 'pay003', orderId: 'ord003', amount:  0.00, status: 'failed',    type: 'Validate', createdAt: '2025-09-08T10:10:00Z' },
];

const STUB_NOTES = [
  { _id: 'n001', userId: 'u001', message: 'Customer requested refund.', createdAt: '2025-09-08T10:00:00Z', updatedAt: '2025-09-08T10:00:00Z' },
  { _id: 'n002', userId: 'u002', message: 'Service was unavailable.', createdAt: '2025-09-07T09:00:00Z', updatedAt: '2025-09-07T09:00:00Z' },
];

const STUB_OPTOUTS = [
  { _id: 'oo001', brandId: 'idlookup', email: 'user@example.com', status: 'requested', provider: 'nameSearchIDI', targetId: '281475231322381', createdAt: '2025-09-09T10:06:00Z', type: 'name' },
];

const STUB_CONTACTS = [
  { _id: 'c001', email: 'contact1@example.com', firstName: 'John', lastName: 'Doe',   status: 'requested', brandId: 'idlookup', createdAt: '2025-09-09T08:00:00Z' },
  { _id: 'c002', email: 'contact2@example.com', firstName: 'Jane', lastName: 'Smith', status: 'fulfilled', brandId: 'idlookup', createdAt: '2025-09-08T08:00:00Z' },
];

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------
class CsrApiService {

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login({ username, password }) {
    // Real: return await getCsrWrapper().api.auth.login({ username, password });
    if (USE_STUB) {
      if (username === 'admin@idlookup.ai' && password === 'admin123') {
        return { success: true, user: { _id: 'a001', email: username, role: 'admin', firstName: 'Mark', lastName: 'Chin' } };
      }
      throw new Error('Invalid credentials');
    }
    return await getCsrWrapper().api.auth.login({ username, password });
  }

  async logout() {
    // Real: return await getCsrWrapper().api.auth.logout();
    if (USE_STUB) return { success: true };
    return await getCsrWrapper().api.auth.logout();
  }

  async checkSession() {
    // Real: return await getCsrWrapper().api.auth.login({});
    if (USE_STUB) return null;
    try { return await getCsrWrapper().api.auth.login({}); } catch { return null; }
  }

  // ── Users (members) ───────────────────────────────────────────────────────

  async findUsers({ brandId = BRAND_ID, email, lastId } = {}) {
    // Real: return await getCsrWrapper().api.user.find({ brandId, email, lastId });
    if (USE_STUB) {
      let users = [...STUB_USERS];
      if (email) users = users.filter(u => u.email.includes(email));
      if (lastId) { const idx = users.findIndex(u => u._id === lastId); users = users.slice(idx + 1); }
      return { users: users.slice(0, 20) };
    }
    return await getCsrWrapper().api.user.find({ brandId, email, lastId });
  }

  async getUserDetail({ userId }) {
    // Real: return await getCsrWrapper().api.user.getUserDetail({ userId });
    if (USE_STUB) {
      const user = STUB_USERS.find(u => u._id === userId) || STUB_USERS[0];
      return { user };
    }
    return await getCsrWrapper().api.user.getUserDetail({ userId });
  }

  // ── Admin users (staff) ───────────────────────────────────────────────────

  async findAdminUsers({ brandId = BRAND_ID, email, lastId } = {}) {
    // Real: return await getCsrWrapper().api.user.findAdmin({ brandId, email, lastId });
    if (USE_STUB) {
      let users = [...STUB_ADMIN_USERS];
      if (email) users = users.filter(u => u.email.includes(email));
      return { users };
    }
    return await getCsrWrapper().api.user.findAdmin({ brandId, email, lastId });
  }

  async createAdminUser({ email, password, firstName, lastName, roles = [], shConId = '', shColId = '' }) {
    // Real: return await getCsrWrapper().api.user.create({ email, password, firstName, lastName, roles, shConId, shColId });
    if (USE_STUB) {
      const user = { _id: `a${Date.now()}`, email, firstName, lastName, roles, permissions: [] };
      STUB_ADMIN_USERS.push(user);
      return { user };
    }
    return await getCsrWrapper().api.user.create({ email, password, firstName, lastName, roles, shConId, shColId });
  }

  async updateAdminUser({ userId, ...fields }) {
    // Real: return await getCsrWrapper().api.user.update({ userId, ...fields });
    if (USE_STUB) {
      const user = STUB_ADMIN_USERS.find(u => u._id === userId);
      if (user) Object.assign(user, fields);
      return { user };
    }
    return await getCsrWrapper().api.user.update({ userId, ...fields });
  }

  // ── Admin notes ───────────────────────────────────────────────────────────

  async findAdminNotes({ userId, lastId } = {}) {
    // Real: return await getCsrWrapper().api.user.findAdminNotes({ userId, lastId });
    if (USE_STUB) {
      let notes = STUB_NOTES.filter(n => !userId || n.userId === userId);
      if (lastId) { const idx = notes.findIndex(n => n._id === lastId); notes = notes.slice(idx + 1); }
      return { notes };
    }
    return await getCsrWrapper().api.user.findAdminNotes({ userId, lastId });
  }

  async createAdminNote({ userId, message }) {
    // Real: return await getCsrWrapper().api.user.createAdminNote({ userId, message });
    if (USE_STUB) {
      const note = { _id: `n${Date.now()}`, userId, message, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      STUB_NOTES.push(note);
      return { note };
    }
    return await getCsrWrapper().api.user.createAdminNote({ userId, message });
  }

  async updateAdminNote({ messageId, message }) {
    // Real: return await getCsrWrapper().api.user.updateAdminNote({ messageId, message });
    if (USE_STUB) {
      const note = STUB_NOTES.find(n => n._id === messageId);
      if (note) { note.message = message; note.updatedAt = new Date().toISOString(); }
      return { note };
    }
    return await getCsrWrapper().api.user.updateAdminNote({ messageId, message });
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async findUserOrders({ userId, lastOrderId } = {}) {
    // Real: return await getCsrWrapper().api.user.findOrders({ userId, lastOrderId });
    if (USE_STUB) {
      let orders = userId ? STUB_ORDERS.filter(o => o.payerId === userId) : STUB_ORDERS;
      if (lastOrderId) { const idx = orders.findIndex(o => o._id === lastOrderId); orders = orders.slice(idx + 1); }
      return { orders };
    }
    return await getCsrWrapper().api.user.findOrders({ userId, lastOrderId });
  }

  async getUserOrder({ userId, orderId, lastPaymentId }) {
    // Real: return await getCsrWrapper().api.user.getOrder({ userId, orderId, lastPaymentId });
    if (USE_STUB) {
      const order = STUB_ORDERS.find(o => o._id === orderId) || STUB_ORDERS[0];
      return { order, commercePayments: STUB_PAYMENTS.filter(p => p.orderId === orderId) };
    }
    return await getCsrWrapper().api.user.getOrder({ userId, orderId, lastPaymentId });
  }

  async findOrderPayments({ orderId, lastPaymentId }) {
    // Real: return await getCsrWrapper().api.user.findOrderPayments({ orderId, lastPaymentId });
    if (USE_STUB) {
      return { payments: STUB_PAYMENTS.filter(p => p.orderId === orderId) };
    }
    return await getCsrWrapper().api.user.findOrderPayments({ orderId, lastPaymentId });
  }

  async findOrderHistories({ orderId, lastRevisionId }) {
    // Real: return await getCsrWrapper().api.user.findOrderHistories({ orderId, lastRevisionId });
    if (USE_STUB) return { histories: [] };
    return await getCsrWrapper().api.user.findOrderHistories({ orderId, lastRevisionId });
  }

  async cancelUncancelOrder({ orderId, flag }) {
    // Real: return await getCsrWrapper().api.user.cancelUncancelOrder({ orderId, flag });
    if (USE_STUB) {
      const order = STUB_ORDERS.find(o => o._id === orderId);
      if (order) order.status = flag ? 'cancelled' : 'active';
      return { success: true };
    }
    return await getCsrWrapper().api.user.cancelUncancelOrder({ orderId, flag });
  }

  async refundVoidOrder({ commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId, targetCommercePaymentId, targetCommercePaymentRevisionId, amount }) {
    // Real: return await getCsrWrapper().api.user.refundVoidOrder({ commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId, targetCommercePaymentId, targetCommercePaymentRevisionId, amount });
    if (USE_STUB) return { success: true };
    return await getCsrWrapper().api.user.refundVoidOrder({ commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId, targetCommercePaymentId, targetCommercePaymentRevisionId, amount });
  }

  async updateScheduleDueTimestamp({ scheduleId, dueTimestamp }) {
    // Real: return await getCsrWrapper().api.user.updateScheduleDueTimestamp({ scheduleId, dueTimestamp });
    if (USE_STUB) return { success: true };
    return await getCsrWrapper().api.user.updateScheduleDueTimestamp({ scheduleId, dueTimestamp });
  }

  // ── OptOut ────────────────────────────────────────────────────────────────

  async findOptOuts({ status, brandId = BRAND_ID, email, provider, targetId, lastId } = {}) {
    // Real: return await getCsrWrapper().api.optOut.find({ status, brandId, email, provider, targetId, lastId });
    if (USE_STUB) {
      let items = [...STUB_OPTOUTS];
      if (status) items = items.filter(o => o.status === status);
      if (email) items = items.filter(o => o.email.includes(email));
      return { optOuts: items };
    }
    return await getCsrWrapper().api.optOut.find({ status, brandId, email, provider, targetId, lastId });
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async findContacts({ status, brandId = BRAND_ID, email, lastId } = {}) {
    // Real: return await getCsrWrapper().api.contact.find({ status, brandId, email, lastId });
    if (USE_STUB) {
      let items = [...STUB_CONTACTS];
      if (status) items = items.filter(c => c.status === status);
      if (email) items = items.filter(c => c.email.includes(email));
      return { contacts: items };
    }
    return await getCsrWrapper().api.contact.find({ status, brandId, email, lastId });
  }

  // ── Payments (aggregate from orders) ─────────────────────────────────────
  // No direct BC "list all payments" endpoint. Derived from orders/findOrderPayments.

  async findAllPayments({ status, lastId } = {}) {
    if (USE_STUB) {
      let payments = [...STUB_PAYMENTS];
      if (status) payments = payments.filter(p => p.status === status);
      return { payments };
    }
    throw new Error('findAllPayments: No BC Admin API endpoint yet — aggregate from findOrderPayments per order.');
  }
}

export default new CsrApiService();
