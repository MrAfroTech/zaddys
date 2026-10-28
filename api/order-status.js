import { allowMethods, handle, HttpError, readJson, sendJson } from '../server/http.js';
import { getClient } from '../server/clients.js';
import { customerView, loadOrder } from '../server/orders.js';
import { verifyOrderStatusRef } from '../server/order-links.js';
import { enforceRateLimit } from '../server/rate-limit.js';

/**
 * POST /api/order-status — { ref } from the customer's order link.
 * The ref is the order id plus an HMAC signature; an order number or bare id
 * is never enough, and the order must belong to this deployment's client.
 * POST keeps the ref out of request-URL logs. Read-only.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const client = await getClient();
  await enforceRateLimit(req, 'orderStatus', client);

  const orderId = verifyOrderStatusRef(readJson(req).ref);
  const loaded = orderId ? await loadOrder(orderId, client.id) : null;
  if (!loaded) throw new HttpError(404, 'We could not find that order. Please check your link.', 'not_found');

  sendJson(res, 200, { order: customerView(loaded.order, loaded.items, client) });
});
