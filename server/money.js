/** Integer cents -> "$8.99". All arithmetic stays in integer cents. */
export function formatCents(cents) {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
