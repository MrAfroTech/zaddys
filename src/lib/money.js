/** Integer cents -> "$8.99". Display only — totals that matter come from the server. */
export function formatCents(cents) {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** "8.99" / "$8.99" / "8" -> 899, or null if not a valid amount. */
export function parseDollarsToCents(text) {
  const m = /^\s*\$?\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(String(text || ''));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
}
