import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './EmailBroadcastPage.module.css';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'paid', label: 'Paid Members' },
  { value: 'unpaid', label: 'Unpaid Members' },
  { value: 'optin', label: 'Opted-in Only' },
];

/**
 * Admin page for composing and sending broadcast emails.
 * Shows a recent email log below the compose panel.
 */
const EmailBroadcastPage = () => {
  const { token } = useAuth();

  // Compose form state
  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState('all');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null); // { type: 'success' | 'error', message }

  // Email log state
  const [emailLog, setEmailLog] = useState([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState('');

  const fetchEmailLog = useCallback(async () => {
    setLogLoading(true);
    setLogError('');
    try {
      const data = await api.getEmailLog({ token });
      setEmailLog(data?.data || data?.emails || data || []);
    } catch (err) {
      setLogError(err.message || 'Failed to load email log.');
    } finally {
      setLogLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmailLog();
  }, [fetchEmailLog]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setSendResult({ type: 'error', message: 'Subject and message body are required.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      await api.sendEmailBroadcast({ subject, html: body, audience, token });
      setSendResult({ type: 'success', message: 'Broadcast sent successfully.' });
      setSubject('');
      setBody('');
      setAudience('all');
      fetchEmailLog();
    } catch (err) {
      setSendResult({ type: 'error', message: err.message || 'Failed to send broadcast.' });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Email Broadcast</h1>
        <p className={styles.subtitle}>Compose and send an email to a segment of your user base.</p>
      </div>

      {/* Compose panel */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Compose Email</h2>
        <form onSubmit={handleSend}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="eb-subject">Subject</label>
            <input
              id="eb-subject"
              className={styles.input}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject…"
              disabled={sending}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Audience</span>
            <div className={styles.audienceGroup}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.audienceOption}>
                  <input
                    type="radio"
                    name="audience"
                    value={opt.value}
                    checked={audience === opt.value}
                    onChange={() => setAudience(opt.value)}
                    disabled={sending}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="eb-body">Message Body</label>
            <textarea
              id="eb-body"
              className={styles.textarea}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here…"
              disabled={sending}
            />
          </div>

          <button type="submit" className={styles.sendBtn} disabled={sending}>
            {sending ? 'Sending…' : 'Send Email'}
          </button>

          {sendResult && (
            <div className={sendResult.type === 'success' ? styles.successMsg : styles.errorMsg}>
              {sendResult.message}
            </div>
          )}
        </form>
      </div>

      {/* Recent email log */}
      <div className={styles.card}>
        <div className={styles.logHeader}>
          <h2 className={styles.cardTitle}>Recent Email Log</h2>
          <button
            className={styles.refreshBtn}
            onClick={fetchEmailLog}
            disabled={logLoading}
            type="button"
          >
            {logLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {logError && <p className={styles.errorMsg}>{logError}</p>}

        {!logLoading && !logError && emailLog.length === 0 && (
          <div className={styles.emptyState}>No emails have been sent yet.</div>
        )}

        {emailLog.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Type</th>
                <th className={styles.th}>To</th>
                <th className={styles.th}>Subject</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Sent At</th>
              </tr>
            </thead>
            <tbody>
              {emailLog.map((entry, idx) => (
                <tr key={entry.id || idx}>
                  <td className={styles.td}>{entry.type || 'broadcast'}</td>
                  <td className={styles.td}>{entry.to || entry.audience || '—'}</td>
                  <td className={styles.td}>{entry.subject || '—'}</td>
                  <td className={styles.td}>
                    <span
                      className={`${styles.statusBadge} ${
                        entry.status === 'failed' ? styles.statusFailed : styles.statusSent
                      }`}
                    >
                      {entry.status || 'sent'}
                    </span>
                  </td>
                  <td className={styles.td}>{formatDate(entry.sentAt || entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
};

export default EmailBroadcastPage;
