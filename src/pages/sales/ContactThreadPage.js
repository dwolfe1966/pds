import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/designSystem';

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = {
  page: {
    minHeight: '60vh',
    backgroundColor: colors.background.paper,
    padding: `${spacing['2xl']} ${spacing.lg}`,
  },
  container: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  banner: {
    backgroundColor: '#eef6ff',
    border: `1px solid #b6d4fe`,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    marginBottom: spacing.lg,
    fontSize: typography.fontSize.sm,
    color: '#0c4a87',
    lineHeight: typography.lineHeight.normal,
  },
  header: {
    marginBottom: spacing.lg,
  },
  subject: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    margin: `0 0 ${spacing.xs} 0`,
  },
  meta: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    margin: 0,
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  messageBubble: (isSupport) => ({
    maxWidth: '80%',
    alignSelf: isSupport ? 'flex-end' : 'flex-start',
    backgroundColor: isSupport ? colors.primary.main : colors.neutral.white,
    color: isSupport ? colors.text.inverse : colors.text.primary,
    border: isSupport ? 'none' : `1px solid ${colors.border.light}`,
    borderRadius: borderRadius.lg,
    padding: `${spacing.sm} ${spacing.md}`,
    boxShadow: shadows.sm,
  }),
  messageBody: {
    margin: 0,
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal,
    whiteSpace: 'pre-wrap',
  },
  messageTimestamp: (isSupport) => ({
    fontSize: typography.fontSize.xs,
    color: isSupport ? 'rgba(255,255,255,0.7)' : colors.text.tertiary,
    marginTop: spacing.xs,
    display: 'block',
  }),
  messageSender: (isSupport) => ({
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: isSupport ? 'rgba(255,255,255,0.85)' : colors.text.secondary,
    marginBottom: spacing.xs / 2,
    display: 'block',
  }),
  replySection: {
    borderTop: `1px solid ${colors.border.light}`,
    paddingTop: spacing.lg,
  },
  replyLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    display: 'block',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.primary,
    border: `1px solid ${colors.border.medium}`,
    borderRadius: borderRadius.md,
    resize: 'vertical',
    boxSizing: 'border-box',
    lineHeight: typography.lineHeight.normal,
  },
  submitBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary.main,
    color: colors.text.inverse,
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
    border: 'none',
    cursor: 'pointer',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  // States
  center: {
    textAlign: 'center',
    padding: spacing['2xl'],
    color: colors.text.secondary,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: `1px solid ${colors.accent.error}`,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.accent.error,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  emptyState: {
    textAlign: 'center',
    padding: spacing.xl,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  backLink: {
    display: 'inline-block',
    marginBottom: spacing.md,
    color: colors.text.link,
    fontSize: typography.fontSize.sm,
    textDecoration: 'none',
  },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const ContactThreadPage = () => {
  const { threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchThread = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.getContactThread(threadId);
        if (!cancelled) setThread(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load this support thread.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchThread();
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread?.messages?.length]);

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setReplyError('');
    try {
      const updated = await api.replyToContactThread(threadId, { message: reply.trim() });
      setThread(updated);
      setReply('');
    } catch (err) {
      setReplyError(err?.message || 'Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main style={s.page}>
        <div style={{ ...s.container, ...s.center }}>
          <p>Loading thread...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main style={s.page}>
        <div style={s.container}>
          <Link to="/contact" style={s.backLink}>&larr; Back to Contact</Link>
          <div style={s.errorBox}>{error}</div>
        </div>
      </main>
    );
  }

  const messages = thread?.messages || [];
  const created = thread?.createdAt ? new Date(thread.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : '';

  return (
    <main style={s.page}>
      <div style={s.container}>
        <Link to="/contact" style={s.backLink}>&larr; Back to Contact</Link>

        <div style={s.banner}>
          This is your private support thread. Bookmark this page to return to it.
        </div>

        {/* Thread header */}
        <div style={s.header}>
          <h1 style={s.subject}>{thread?.subject || 'Support Thread'}</h1>
          <p style={s.meta}>
            {thread?.name && <>{thread.name} &middot; </>}
            {thread?.email && <>{thread.email} &middot; </>}
            {created && <>Opened {created}</>}
          </p>
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div style={s.emptyState}>No messages yet.</div>
        ) : (
          <div style={s.messageList}>
            {messages.map((msg, i) => {
              const isSupport = msg.sender === 'support';
              const ts = msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              }) : '';
              return (
                <div key={msg._id || i} style={s.messageBubble(isSupport)}>
                  <span style={s.messageSender(isSupport)}>
                    {isSupport ? 'Support' : (thread?.name || 'You')}
                  </span>
                  <p style={s.messageBody}>{msg.message || msg.body || ''}</p>
                  {ts && <span style={s.messageTimestamp(isSupport)}>{ts}</span>}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Reply form */}
        <form style={s.replySection} onSubmit={handleSubmitReply}>
          <label style={s.replyLabel} htmlFor="thread-reply">Reply</label>
          <textarea
            id="thread-reply"
            style={s.textarea}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
          />
          {replyError && <div style={s.errorBox}>{replyError}</div>}
          <button
            type="submit"
            style={{
              ...s.submitBtn,
              ...(sending || !reply.trim() ? s.submitBtnDisabled : {}),
            }}
            disabled={sending || !reply.trim()}
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default ContactThreadPage;
