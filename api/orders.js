import { allowMethods, handle, HttpError, readJson, sendJson } from '../server/http.js';
import { getClient } from '../server/clients.js';
import { afterOrderCreated, createOrder, customerView, siteOrigin, validateOrderInput } from '../server/orders.js';
import { orderStatusPath } from '../server/order-links.js';
import { enforceRateLimit } from '../server/rate-limit.js';

/**
 * POST /api/orders — customer checkout for this deployment's client.
 * Body: { idempotencyKey, customer: { name, phone, email?, notifySms?, notifyEmail? },
 *         paymentMethod, items: [{ menuItemId, quantity }] }
 * The client comes from server config (CLIENT_SLUG), not the request. Prices
 * and totals are computed in the database, which also checks every item
 * belongs to this client. A retry with the same idempotencyKey returns the
 * same order (200) instead of creating a duplicate (201). The customer is
 * remembered and gets the order by text/email if they opted in.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const client = await getClient();
  if (!client.online_ordering_enabled) {
    throw new HttpError(503, 'Online ordering is not open yet. Please call the shop to order.', 'ordering_disabled');
  }

  await enforceRateLimit(req, 'checkout', client);
  const input = validateOrderInput(readJson(req), 'online');
  const { orderId, created } = await createOrder({ client, source: 'online', input });
  const loaded = await afterOrderCreated({ client, orderId, input, source: 'online', origin: siteOrigin(req) });

  sendJson(res, created ? 201 : 200, {
    created,
    statusPath: orderStatusPath(orderId),
    order: customerView(loaded.order, loaded.items, client),
  });
});
