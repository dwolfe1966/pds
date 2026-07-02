import { useEffect, useMemo, useState } from 'react';
import api from '../api';

/**
 * Resolve CSR ticket / contactMessage sender emails to user accounts so list rows
 * can show real member status and link to the user-detail page.
 *
 * Why: BC rarely sets `targetUserId` on member-submitted contactMessages, so the old
 * `!targetUserId → non-member` check labelled everyone "non-member". Consumer messages
 * link to a member only by sender EMAIL (see reference_bc_contactmessage_email_link),
 * so we resolve email → user via the same adminListUsers({ email }) lookup the inbox
 * search already uses. Deduped across rows and cached module-wide so revisits are free.
 */
const cache = new Map(); // emailLower → user object | null (null = looked up, no match)
const phoneCache = new Map(); // 10-digit phone → user object | null

export function ticketSenderEmail(item) {
  return (item?.content?.input?.email || item?.content?.email || '').trim();
}

// 10-digit caller phone for voicemail/live-call tickets (no email to link by).
export function ticketCallerPhone(item) {
  const c = item?.content || {};
  const d = c?.data || item?.data || {};
  const cands = [
    d.phone, d.ani, d.callerId, d.caller, d.from, d.fromNumber, d.callerNumber,
    d.callerPhone, d.number, c?.input?.phone, c?.phone,
    d?.trackingIds?.phone, item?.trackingIds?.phone,
  ];
  const raw = cands.find((v) => v != null && String(v).trim() !== '');
  const digits = String(raw || '').replace(/\D/g, '');
  const n = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  return n.length === 10 ? n : '';
}

async function lookupPhone(phone) {
  try {
    const res = await api.adminListUsers({ phone });
    const docs = res?.data?.docs ?? (Array.isArray(res?.data) ? res.data : (res?.docs ?? (Array.isArray(res) ? res : [])));
    // BC filters by phone server-side but doesn't return it on the user object
    // (reference_bc_user_object_no_zip), so trust the query: first doc is the match.
    phoneCache.set(phone, (Array.isArray(docs) ? docs : [])[0] || null);
  } catch {
    phoneCache.set(phone, null);
  }
}

/**
 * Resolve caller phones (voicemail tickets) → user accounts. Same shape/contract
 * as useTicketSenderUsers but keyed by 10-digit phone. Lets a voicemail row link
 * to the customer even though it has no sender email (Kwan: caller ID is in the
 * response; item 13).
 */
export function useTicketCallerUsers(items) {
  const phones = useMemo(
    () => [...new Set((items || []).map(ticketCallerPhone).filter(Boolean))],
    [items]
  );
  const key = phones.join(',');
  const [map, setMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todo = phones.filter((p) => !phoneCache.has(p));
      if (todo.length) await Promise.all(todo.map(lookupPhone));
      if (cancelled) return;
      const next = {};
      for (const p of phones) {
        const u = phoneCache.get(p);
        next[p] = u ? { userId: u._id || u.id, isSubscriber: isSubscriber(u), user: u } : null;
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}

// Same definition as UsersPage's isTierPro, for a consistent badge across the admin.
export function isSubscriber(u) {
  const status = (u?.status || u?.transient?.status || '').toLowerCase();
  if (status === 'active') return true;
  return Array.isArray(u?.roles) && u.roles.includes('subscriber');
}

async function lookup(email) {
  try {
    const res = await api.adminListUsers({ email });
    const docs = res?.data?.docs ?? (Array.isArray(res?.data) ? res.data : (res?.docs ?? (Array.isArray(res) ? res : [])));
    const u = (Array.isArray(docs) ? docs : []).find((x) => (x.email || '').toLowerCase() === email) || null;
    cache.set(email, u);
  } catch {
    cache.set(email, null); // don't retry a failed lookup this session
  }
}

/**
 * @param {Array} items — tickets / contactMessage docs
 * @returns {Object} map keyed by lowercased sender email →
 *   { userId, isSubscriber, user } for a match, `null` for a resolved non-match,
 *   `undefined` (absent) while a lookup is still pending.
 */
export function useTicketSenderUsers(items) {
  const emails = useMemo(
    () => [...new Set((items || []).map(ticketSenderEmail).filter(Boolean).map((e) => e.toLowerCase()))],
    [items]
  );
  const emailKey = emails.join(',');
  const [map, setMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todo = emails.filter((e) => !cache.has(e));
      if (todo.length) await Promise.all(todo.map(lookup));
      if (cancelled) return;
      const next = {};
      for (const e of emails) {
        const u = cache.get(e);
        next[e] = u ? { userId: u._id || u.id, isSubscriber: isSubscriber(u), user: u } : null;
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
  }, [emailKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
