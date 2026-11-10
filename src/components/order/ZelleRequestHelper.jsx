import { useState } from 'react';
import { formatCents } from '../../lib/money';

/**
 * Staff helper for asking a customer to pay by Zelle. Zelle can only be
 * started inside a bank app, so the request is sent from the restaurant's own
 * bank app; this lays out exactly what to enter, with copy buttons. The
 * customer then gets a notification from their bank and just taps Pay.
 */
export default function ZelleRequestHelper({ order, onMarkSent = null, busy = false }) {
  const [copied, setCopied] = useState('');
  const phone = (order.customer.phone || '').replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '');
  const email = order.customer.email || '';
  const amount = (order.totalCents / 100).toFixed(2);
  const memo = `${order.orderNumber} ${order.customer.name}`.slice(0, 40);

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied('');
    }
  }

  const row = (label, value, display = value) => (
    <li className="zelle-row">
      <span className="zelle-label">{label}</span>
      <strong className="zelle-value">{display}</strong>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(label, value)}>
        {copied === label ? 'Copied' : 'Copy'}
      </button>
    </li>
  );

  return (
    <section className="zelle-request" aria-label={`Send a Zelle request for ${order.orderNumber}`}>
      <h4>Send a Zelle request</h4>
      <ol className="zelle-steps">
        <li>Open the restaurant’s bank app → <strong>Zelle</strong> → <strong>Request</strong>.</li>
        <li>Enter these details:</li>
      </ol>
      <ul className="zelle-fields">
        {phone && row('Customer phone', phone, order.customer.phone)}
        {email && row('Customer email', email)}
        {row('Amount', amount, formatCents(order.totalCents))}
        {row('Memo', memo)}
      </ul>
      <ol className="zelle-steps" start={3}>
        <li>Send the request. The customer gets it in their own bank app and taps Pay.</li>
        {onMarkSent && <li>Tap <strong>Mark request sent</strong> so the customer’s order page tells them to look for it.</li>}
        <li>When the money arrives, use <strong>Verify payment</strong> on this order.</li>
      </ol>
      {onMarkSent && (
        <button type="button" className="btn btn-zelle" disabled={busy} onClick={onMarkSent}>
          {busy ? 'Saving…' : 'Mark request sent'}
        </button>
      )}
      <p className="zelle-note">
        The customer must be enrolled in Zelle with this phone or email. If the request bounces, ask which phone or
        email their bank’s Zelle uses.
      </p>
    </section>
  );
}
