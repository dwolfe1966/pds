// server/providers/console.js
// Development fallback provider — logs emails to stdout instead of sending.

async function send({ to, subject, html, type }) {
  console.log(`[email:console] TO=${to} SUBJECT="${subject}" TYPE=${type || 'unknown'}`);
}

module.exports = { send };
