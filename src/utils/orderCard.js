// Card / payment-method extraction for CSR order views. BC stores the tokenized
// card on the order (`commerceTokens[0]`) and on each payment (`commercePayments[]
// .commerceToken`); both carry `lastDigits`, `bin`, `expiration {month,year}`,
// `type`, and enriched BIN data in `transient.bin {brand,type,level,country,bank}`.
// Returns null when no card is present (never fabricates).

export function formatCardExpiry(exp) {
  if (!exp || exp.month == null) return null;
  const mm = String(exp.month).padStart(2, '0');
  const yy = String(exp.year == null ? '' : exp.year).slice(-2);
  return yy ? `${mm}/${yy}` : mm;
}

export function getOrderCard(order) {
  if (!order) return null;
  // Prefer the order-level token; fall back to the first payment token with a card.
  let tok = (Array.isArray(order.commerceTokens) && order.commerceTokens[0]) || null;
  if (!tok || !tok.lastDigits) {
    const payTokens = (order.commercePayments || [])
      .map((p) => p.commerceToken)
      .filter((t) => t && t.lastDigits);
    tok = payTokens[0] || tok;
  }
  if (!tok || !tok.lastDigits) return null;
  const bin = (tok.transient && tok.transient.bin) || {};
  return {
    last4: tok.lastDigits,
    bin: tok.bin || bin.bin || null,
    brand: bin.brand || tok.type || null,   // VISA / MASTERCARD …
    type: bin.type || null,                 // DEBIT / CREDIT
    level: bin.level || null,               // CLASSIC / BUSINESS …
    country: bin.country || null,
    bank: bin.bank || null,
    expiry: formatCardExpiry(tok.expiration),
  };
}
