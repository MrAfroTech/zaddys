import { createHash } from 'node:crypto';
import { serviceClient } from './supabase.js';
import { HttpError } from './http.js';
import { paymentInstructions } from './payment-methods.js';
import { orderStatusPath } from './order-links.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9-]{16,80}$/;
const MAX_LINES = 20;
// Must match the limits in create_order (db/schema.sql); the database is the authority.
export const ORDER_LIMITS = {
  online: { maxQty: 15, maxItems: 40, maxTotalCents: 25000 },
  staff: { maxQty: 50, maxItems: 150, maxTotalCents: 100000 },
};

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Validates the request shape. Prices are never accepted from the client. */
export function validateOrderInput(body, source) {
  const limits = ORDER_LIMITS[source];
  const errors = {};
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
    throw new HttpError(400, 'Missing or invalid request key. Please refresh and try again.', 'bad_idempotency_key');
  }

  const customer = body.customer || {};
  const name = cleanText(customer.name, 80);
  const phoneRaw = cleanText(customer.phone, 30);
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const email = cleanText(customer.email, 120).toLowerCase();

  if (name.length < 2) errors.name = 'Please enter your name.';
  if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = 'Please enter a valid phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email or leave it blank.';

  const paymentMethod = body.paymentMethod;
  if (paymentMethod !== 'cash_app' && paymentMethod !== 'zelle') errors.paymentMethod = 'Choose how you will pay.';

  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) {
    errors.items = 'Your cart is empty.';
  } else if (items.length > MAX_LINES) {
    errors.items = 'Too many different items in one order.';
  } else {
    let count = 0;
    for (const line of items) {
      const qty = line?.quantity;
      if (!UUID_RE.test(String(line?.menuItemId || '')) || !Number.isInteger(qty) || qty < 1 || qty > limits.maxQty) {
        errors.items = `Each item needs a quantity between 1 and ${limits.maxQty}.`;
        break;
      }
      count += qty;
    }
    if (!errors.items && count > limits.maxItems) {
      errors.items = source === 'online'
        ? `Online orders are limited to ${limits.maxItems} items. For a bigger order, please call the shop.`
        : `Orders are limited to ${limits.maxItems} items.`;
    }
  }

  if (Object.keys(errors).length) {
    throw Object.assign(new HttpError(422, 'Please check your order details.', 'validation_failed'), { fields: errors });
  }

  return {
    idempotencyKey,
    customer: { name, phone: phoneRaw, email },
    paymentMethod,
    items: items.map((l) => ({ menu_item_id: l.menuItemId.toLowerCase(), quantity: l.quantity })),
  };
}

/** Same request -> same fingerprint, so a reused key with different contents is rejected. */
function fingerprint(source, input) {
  const items = [...input.items].sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id));
  return createHash('sha256')
    .update(JSON.stringify({ source, customer: input.customer, paymentMethod: input.paymentMethod, items }))
    .digest('hex');
}

const RPC_ERRORS = {
  idempotency_key_reused: [409, 'This checkout was already submitted with different details. Please refresh and try again.'],
  empty_order: [422, 'Your cart is empty.'],
  too_many_lines: [422, 'Too many different items in one order.'],
  invalid_quantity: [422, 'One of the quantities is over the limit for this order.'],
  item_unavailable: [409, 'One or more items are no longer available. Please review your cart.'],
  order_too_large: [422, 'This order is over the size limit for online ordering. For a bigger order, please call the shop.'],
  too_many_open_orders: [429, 'You already have unpaid orders with us. Please pay for or cancel those first, or call the shop.'],
  client_unavailable: [503, 'Ordering is not available for this restaurant right now.'],
  ordering_disabled: [503, 'Online ordering is not open yet. Please call the shop to order.'],
  not_client_staff: [403, 'This account is not authorized for this restaurant.'],
  invalid_source: [400, 'Invalid order request.'],
  payment_method_unavailable: [422, 'That payment method is not available. Please choose another.'],
};

export function mapRpcError(error, table = RPC_ERRORS) {
  const key = Object.keys(table).find((k) => error?.message?.includes(k));
  if (key) return new HttpError(table[key][0], table[key][1], key);
  return error;
}

/**
 * Creates an order through the database function, which looks up current
 * prices, checks availability, computes totals and is idempotent on the
 * request key. Online and staff orders both come through here.
 */
export async function createOrder({ client, source, staff = null, input }) {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc('ordering_create_order', {
    p_client_id: client.id,
    p_idempotency_key: `${source}:${input.idempotencyKey}`,
    p_fingerprint: fingerprint(source, input),
    p_source: source,
    p_staff: staff ? staff.userId : null,
    p_customer_name: input.customer.name,
    p_customer_phone: input.customer.phone,
    p_customer_email: input.customer.email || null,
    p_items: input.items,
    p_payment_method: input.paymentMethod,
  });
  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) throw new Error('create_order returned no order');
  return { orderId: row.order_id, created: row.created };
}

/** Loads an order only if it belongs to the given client. */
export async function loadOrder(orderId, clientId) {
  const supabase = serviceClient();
  const { data: order, error } = await supabase
    .from('client_orders')
    .select('*')
    .eq('id', orderId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: itemsError } = await supabase
    .from('client_order_items')
    .select('position, name_snapshot, unit_price_cents, quantity, line_total_cents')
    .eq('order_id', orderId)
    .eq('client_id', clientId)
    .order('position');
  if (itemsError) throw itemsError;
  return { order, items };
}

function itemView(items) {
  return items.map((i) => ({
    name: i.name_snapshot,
    quantity: i.quantity,
    unitPriceCents: i.unit_price_cents,
    lineTotalCents: i.line_total_cents,
  }));
}

function awaitingPayment(order) {
  return order.order_status === 'open' && (order.payment_status === 'pending' || order.payment_status === 'manual_review');
}

export function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

/**
 * What a customer may see: their items, totals and statuses, and payment
 * instructions while payment is outstanding. No contact details beyond their
 * first name, no references, notes, staff names or verification records.
 */
export function customerView(order, items, client) {
  return {
    restaurantName: client.name,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customerFirstName: order.customer_name.split(/\s+/)[0],
    items: itemView(items),
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    salesTaxLabel: order.sales_tax_label,
    feesCents: order.fees_cents,
    totalCents: order.total_cents,
    pricingNote: order.pricing_note,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    paymentInstructions: awaitingPayment(order) ? paymentInstructions(order, client) : null,
  };
}

/** Full staff view, including contact details and the verification history. */
export function staffView(order, items, verifications, client, { origin = '' } = {}) {
  const statusPath = orderStatusPath(order.id);
  return {
    id: order.id,
    orderNumber: order.order_number,
    source: order.source,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customer: { name: order.customer_name, phone: order.customer_phone, email: order.customer_email },
    items: itemView(items),
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    salesTaxLabel: order.sales_tax_label,
    feesCents: order.fees_cents,
    totalCents: order.total_cents,
    pricingNote: order.pricing_note,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentReference: order.payment_reference,
    paymentFlag: order.payment_flag,
    paidAt: order.paid_at,
    orderStatus: order.order_status,
    statusUrl: `${origin}${statusPath}`,
    paymentInstructions: awaitingPayment(order)
      ? paymentInstructions(order, client, { statusUrl: `${origin}${statusPath}` })
      : null,
    verifications: (verifications || []).map((v) => ({
      outcome: v.outcome,
      method: v.method,
      expectedAmountCents: v.expected_amount_cents,
      verifiedAmountCents: v.verified_amount_cents,
      transactionReference: v.transaction_reference,
      notes: v.notes,
      verifiedBy: v.verified_by_name,
      verifiedAt: v.verified_at,
    })),
  };
}

export function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}
