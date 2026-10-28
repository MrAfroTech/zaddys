/**
 * Payment methods offered per client: Cash App and/or Zelle, configured on the
 * client's row in the shared clients table (cashapp_cashtag, zelle_recipient).
 *
 * What this does and does NOT do:
 * - It shows customers exactly who to pay, the exact amount, and the order
 *   number to put in the payment note.
 * - It does NOT create payment requests, pre-fill amounts, or confirm payment.
 *   Neither a standard Cash App Business account nor Zelle offers a public
 *   API/webhook a small business can use to confirm payments, so staff verify
 *   each payment in the Cash App Business app or the business bank's Zelle
 *   history (see api/staff/payments.js).
 */
import { formatCents } from './money.js';

const CASHTAG_RE = /^\$[A-Za-z][A-Za-z0-9_-]{0,19}$/;

export const METHOD_LABELS = { cash_app: 'Cash App', zelle: 'Zelle' };

/** Methods this client has configured, in display order. */
export function paymentMethods(client) {
  const methods = [];
  const tag = (client?.cashapp_cashtag || '').trim();
  if (CASHTAG_RE.test(tag)) {
    // Profile link only; the customer types the amount and note in Cash App.
    methods.push({ id: 'cash_app', label: 'Cash App', handle: tag, url: `https://cash.app/${tag}` });
  }
  const zelle = (client?.zelle_recipient || '').trim();
  if (zelle) {
    // Zelle has no universal payment link; customers send from their own bank app.
    methods.push({ id: 'zelle', label: 'Zelle', handle: zelle, url: null });
  }
  return methods;
}

export function paymentInstructions(order, client, { statusUrl } = {}) {
  const amount = formatCents(order.total_cents);
  const method = paymentMethods(client).find((m) => m.id === order.payment_method);
  const base = {
    method: order.payment_method,
    methodLabel: METHOD_LABELS[order.payment_method] || order.payment_method,
    amountCents: order.total_cents,
    amountDisplay: amount,
    orderNumber: order.order_number,
    configured: Boolean(method),
  };

  if (!method) {
    return {
      ...base,
      steps: [
        `Your order ${order.order_number} has been received. Amount due: ${amount}.`,
        'Payment details are not available right now. The restaurant will contact you with how to pay.',
      ],
      messageText: `${client.name} order ${order.order_number}: amount due ${amount}. Payment details will follow.`,
    };
  }

  const steps = method.id === 'cash_app'
    ? [
        `Open Cash App and pay ${method.handle}.`,
        `Send exactly ${amount}.`,
        `Put your order number ${order.order_number} in the payment note ("For").`,
      ]
    : [
        'Open your bank’s app (or the Zelle app) and choose Send with Zelle.',
        `Send to ${method.handle} (${client.name}).`,
        `Send exactly ${amount}.`,
        `Put your order number ${order.order_number} in the memo.`,
      ];
  steps.push('Your order stays "awaiting payment confirmation" until our staff see your payment arrive.');

  const messageLines = [
    `${client.name} order ${order.order_number}`,
    `Amount due: ${amount}`,
    method.id === 'cash_app'
      ? `Pay with Cash App to ${method.handle} (${method.url})`
      : `Pay with Zelle to ${method.handle}`,
    `Please put ${order.order_number} in the payment note.`,
    'We will confirm once we see your payment.',
  ];
  if (statusUrl) messageLines.push(`Order status: ${statusUrl}`);

  return {
    ...base,
    handle: method.handle,
    url: method.url,
    steps,
    messageText: messageLines.join('\n'),
  };
}
