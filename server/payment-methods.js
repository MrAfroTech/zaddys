/**
 * Payment methods offered per client: Cash App and/or Zelle, configured on the
 * client's row in the shared clients table (cashapp_cashtag, zelle_recipient).
 *
 * What this does and does NOT do:
 * - It shows customers exactly who to pay, the exact amount, and the order
 *   number to put in the payment note.
 * - For Cash App it links to the restaurant's $Cashtag with the amount filled
 *   in (cash.app/$tag/12.48), so the customer taps once and confirms. The
 *   payment note can't be pre-filled, so the order number is still asked for.
 * - It does NOT create payment requests or confirm payment.
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
    methods.push({
      id: 'zelle',
      label: 'Zelle',
      handle: zelle,
      url: null,
      // Link from the restaurant's Zelle QR code: opens Zelle's bank picker with
      // the restaurant as recipient. Amount can't be pre-filled.
      zelleUrl: client.zelle_pay_url || null,
      recipientName: client.zelle_recipient_name || null,
    });
  }
  return methods;
}

/** Cash App link with the amount filled in, e.g. https://cash.app/$zaddysintampa/11.80 */
export function cashAppPayUrl(tag, cents) {
  return `https://cash.app/${tag}/${(cents / 100).toFixed(2)}`;
}

/** How to pay one order with one method: steps plus the one-tap link, if any. */
function methodOption(method, order, client) {
  const amount = formatCents(order.total_cents);
  const payUrl = method.id === 'cash_app' ? cashAppPayUrl(method.handle, order.total_cents) : method.zelleUrl || null;
  const shownAs = method.recipientName ? ` Your bank will show the recipient as ${method.recipientName}.` : '';
  const steps = method.id === 'cash_app'
    ? [
        `Tap Pay with Cash App. It opens ${method.handle} with ${amount} filled in.`,
        `Add your order number ${order.order_number} in the note ("For"), then pay.`,
      ]
    : payUrl
      ? [
          `Tap Pay with Zelle (or scan the QR code) and choose your bank. It opens Zelle with ${client.name} as the recipient.${shownAs}`,
          `Enter exactly ${amount} and put your order number ${order.order_number} in the memo, then send.`,
        ]
      : [
          'Open your bank’s app (or the Zelle app) and choose Send with Zelle.',
          `Send to ${method.handle} (${client.name}).${shownAs}`,
          `Send exactly ${amount}.`,
          `Put your order number ${order.order_number} in the memo.`,
        ];
  steps.push('Your order stays "awaiting payment confirmation" until our staff see your payment arrive.');
  return { id: method.id, label: method.label, handle: method.handle, url: method.url, payUrl, recipientName: method.recipientName || null, steps };
}

/**
 * Payment instructions for an order. Top-level fields describe the method the
 * customer picked; `options` lists every method this client offers (picked
 * one first) so the customer can switch on the order page — staff verify
 * whichever method the money actually arrives by.
 */
export function paymentInstructions(order, client, { statusUrl } = {}) {
  const amount = formatCents(order.total_cents);
  const methods = paymentMethods(client);
  const method = methods.find((m) => m.id === order.payment_method);
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
      options: [],
      steps: [
        `Your order ${order.order_number} has been received. Amount due: ${amount}.`,
        'Payment details are not available right now. The restaurant will contact you with how to pay.',
      ],
      messageText: `${client.name} order ${order.order_number}: amount due ${amount}. Payment details will follow.`,
    };
  }

  const options = [method, ...methods.filter((m) => m.id !== method.id)].map((m) => methodOption(m, order, client));
  const chosen = options[0];

  const messageLines = [
    `${client.name} order ${order.order_number}`,
    `Amount due: ${amount}`,
    ...options.map((o) => (o.id === 'cash_app' ? `Pay with Cash App: ${o.payUrl}` : `Pay with Zelle: ${o.payUrl || o.handle}`)),
    `Please put ${order.order_number} in the payment note.`,
    'We will confirm once we see your payment.',
  ];
  if (statusUrl) messageLines.push(`Order status: ${statusUrl}`);

  return {
    ...base,
    handle: chosen.handle,
    url: chosen.url,
    payUrl: chosen.payUrl,
    steps: chosen.steps,
    options,
    messageText: messageLines.join('\n'),
  };
}
