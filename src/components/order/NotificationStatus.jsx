import { useState } from 'react';

const KIND_LABELS = {
  order_placed: 'Order & payment details',
  payment_confirmed: 'Payment received',
  order_cancelled: 'Order cancelled',
};

const REASONS = {
  not_enabled: 'automatic messages are not turned on yet',
  not_configured: 'sending is not set up yet',
  opted_out: 'the customer replied STOP to texts',
  invalid_number: 'this phone number can’t receive texts',
  timeout: 'the message service didn’t answer in time',
  provider_error: 'the message service rejected it',
};

function statusText(n) {
  const where = n.channel === 'sms' ? `Text to ${n.recipient}` : `Email to ${n.recipient}`;
  if (n.status === 'sent') return `${where}: sent${n.sentAt ? ` ${new Date(n.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`;
  if (n.status === 'sending') return `${where}: sending…`;
  const why = REASONS[n.reason] || n.reason || 'unknown problem';
  return `${where}: ${n.status === 'skipped' ? 'not sent' : 'failed'} — ${why}`;
}

/**
 * Staff view of the automatic texts/emails for an order, with Resend.
 * `onResend(kind, channel)` returns a promise; the parent reloads the order.
 */
export default function NotificationStatus({ order, onResend }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const rows = order.notifications || [];
  const requested = order.notifySms || order.notifyEmail;

  async function resend(n) {
    const key = `${n.kind}:${n.channel}`;
    setBusy(key);
    setError('');
    try {
      await onResend(n.kind, n.channel);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!requested && !rows.length) {
    return (
      <p className="notify-status notify-status-none">
        The customer didn’t choose text or email updates, so nothing was sent automatically.
      </p>
    );
  }

  return (
    <div className="notify-status" aria-live="polite">
      <h4>Messages to the customer</h4>
      {rows.length === 0 && <p>Sending…</p>}
      <ul>
        {rows.map((n) => (
          <li key={`${n.kind}:${n.channel}`} className={`notify-row notify-${n.status}`}>
            <span className="notify-kind">{KIND_LABELS[n.kind] || n.kind}</span>
            <span>{statusText(n)}</span>
            {n.status !== 'sending' && n.reason !== 'opted_out' && (
              <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(busy)} onClick={() => resend(n)}>
                {busy === `${n.kind}:${n.channel}` ? 'Sending…' : n.status === 'sent' ? 'Send again' : 'Retry'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
