import React, { useState, useMemo, useCallback } from 'react';
import styles from './EmailTicketsPage.module.css';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'adminTickets';

const SEED_TICKETS = [
  {
    id: 'TKT-001',
    from: 'customer@example.com',
    subject: 'Unable to login',
    status: 'open',
    createdAt: '2025-09-08T10:22:00Z',
    messages: [
      { from: 'customer@example.com', body: 'I keep getting an invalid credentials error. My password is correct.', ts: '2025-09-08T10:22:00Z', isCustomer: true },
    ],
  },
  {
    id: 'TKT-002',
    from: 'billing@example.com',
    subject: 'Billing question about charge',
    status: 'pending',
    createdAt: '2025-09-07T14:05:00Z',
    messages: [
      { from: 'billing@example.com', body: 'I was charged twice this month. Please investigate.', ts: '2025-09-07T14:05:00Z', isCustomer: true },
      { from: 'support@idlookup.ai', body: "We're looking into this. Can you provide your last 4 digits of the card?", ts: '2025-09-07T16:00:00Z', isCustomer: false },
    ],
  },
  {
    id: 'TKT-003',
    from: 'jane.doe@email.com',
    subject: 'Feature request: export data',
    status: 'closed',
    createdAt: '2025-09-06T09:00:00Z',
    messages: [
      { from: 'jane.doe@email.com', body: 'Would love to be able to export my search history as CSV.', ts: '2025-09-06T09:00:00Z', isCustomer: true },
      { from: 'support@idlookup.ai', body: "Thanks for the suggestion! We've logged this as a feature request.", ts: '2025-09-06T11:30:00Z', isCustomer: false },
    ],
  },
];

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...SEED_TICKETS];
  } catch {
    return [...SEED_TICKETS];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function shortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'open') return <span className={`${styles.badge} ${styles.badgeOpen}`}>Open</span>;
  if (s === 'pending') return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  return <span className={`${styles.badge} ${styles.badgeClosed}`}>Closed</span>;
}

// ─── EmailTicketsPage ─────────────────────────────────────────────────────────

const EmailTicketsPage = () => {
  const [tickets, setTickets] = useState(() => loadTickets());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(tickets[0]?.id || null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickets.filter((t) => {
      const matchSearch = !q ||
        t.subject.toLowerCase().includes(q) ||
        t.from.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tickets, search, statusFilter]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const updateTickets = (updated) => {
    saveTickets(updated);
    setTickets(updated);
  };

  const handleReply = (e) => {
    e.preventDefault();
    if (!reply.trim() || !selected) return;
    setReplying(true);
    const newMsg = {
      from: 'support@idlookup.ai',
      body: reply.trim(),
      ts: new Date().toISOString(),
      isCustomer: false,
    };
    const updated = tickets.map((t) =>
      t.id === selected.id
        ? { ...t, status: 'pending', messages: [...(t.messages || []), newMsg] }
        : t
    );
    updateTickets(updated);
    setReply('');
    setReplying(false);
    showToast('Reply sent.');
  };

  const handleStatusChange = (ticketId, newStatus) => {
    const updated = tickets.map((t) =>
      t.id === ticketId ? { ...t, status: newStatus } : t
    );
    updateTickets(updated);
    showToast(`Ticket marked as ${newStatus}.`);
  };

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Email Tickets</h1>
        <p className={styles.subtitle}>Support requests from customers.</p>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Two-panel layout */}
      <div className={styles.wrapper}>
        {/* Left: ticket list */}
        <div className={styles.ticketList}>
          {filtered.length === 0 && (
            <div className={styles.emptyList}>No tickets match your filters.</div>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              className={`${styles.ticketItem} ${t.id === selectedId ? styles.ticketItemActive : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              <div className={styles.ticketItemTop}>
                <span className={styles.ticketId}>{t.id}</span>
                <StatusBadge status={t.status} />
              </div>
              <div className={styles.ticketSubject}>{t.subject}</div>
              <div className={styles.ticketMeta}>{t.from} · {shortDate(t.createdAt)}</div>
            </button>
          ))}
        </div>

        {/* Right: detail + reply */}
        <div className={styles.ticketDetail}>
          {!selected ? (
            <div className={styles.emptyDetail}>Select a ticket to view details.</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailSubject}>{selected.subject}</h2>
                  <p className={styles.detailMeta}>
                    <strong>From:</strong> {selected.from} &nbsp;·&nbsp;
                    <strong>ID:</strong> {selected.id} &nbsp;·&nbsp;
                    {formatDate(selected.createdAt)}
                  </p>
                </div>
                <div className={styles.statusControls}>
                  <StatusBadge status={selected.status} />
                  {selected.status !== 'closed' && (
                    <button
                      className={styles.closeTicketBtn}
                      onClick={() => handleStatusChange(selected.id, 'closed')}
                    >
                      Close Ticket
                    </button>
                  )}
                  {selected.status === 'closed' && (
                    <button
                      className={styles.reopenBtn}
                      onClick={() => handleStatusChange(selected.id, 'open')}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Message thread */}
              <div className={styles.thread}>
                {(selected.messages || []).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`${styles.message} ${msg.isCustomer ? styles.messageCustomer : styles.messageAgent}`}
                  >
                    <div className={styles.msgFrom}>
                      {msg.isCustomer ? msg.from : 'Support'} · {formatDate(msg.ts)}
                    </div>
                    <div className={styles.msgBody}>{msg.body}</div>
                  </div>
                ))}
              </div>

              {/* Reply form */}
              {selected.status !== 'closed' && (
                <form className={styles.replyForm} onSubmit={handleReply}>
                  <textarea
                    className={styles.replyTextarea}
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    disabled={replying}
                  />
                  <div className={styles.replyActions}>
                    <button type="submit" className={styles.replyBtn} disabled={replying || !reply.trim()}>
                      {replying ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              )}
              {selected.status === 'closed' && (
                <p className={styles.closedMsg}>This ticket is closed. Reopen it to reply.</p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default EmailTicketsPage;
