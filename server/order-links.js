import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(orderId) {
  return createHmac('sha256', env('ORDER_LINK_SECRET')).update(`order-status:${orderId}`).digest('base64url');
}

/**
 * Customer order links are `<orderId>.<signature>`. The signature is an
 * HMAC with a server-only secret, so links can't be guessed or derived from
 * the order number, and the same link can be re-issued if a checkout retry
 * returns an existing order.
 */
export function orderStatusRef(orderId) {
  return `${orderId}.${sign(orderId)}`;
}

export function orderStatusPath(orderId) {
  return `/order/status/${orderStatusRef(orderId)}`;
}

/** Returns the order id if the reference is authentic, otherwise null. */
export function verifyOrderStatusRef(ref) {
  if (typeof ref !== 'string' || ref.length > 200) return null;
  const dot = ref.indexOf('.');
  if (dot === -1) return null;
  const orderId = ref.slice(0, dot);
  const given = ref.slice(dot + 1);
  if (!UUID_RE.test(orderId)) return null;
  const expected = sign(orderId);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return orderId;
}
