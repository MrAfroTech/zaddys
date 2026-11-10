import { allowMethods, handle, HttpError, readJson, sendJson } from '../server/http.js';
import { getClient } from '../server/clients.js';
import { customerView, loadOrder, requestZelle } from '../server/orders.js';
import { verifyOrderStatusRef } from '../server/order-links.js';
import { enforceRateLimit } from '../server/rate-limit.js';

/**
 * POST /api/order-status — { ref } from the customer's order link.
 * The ref is the order id plus an HMAC signature; an order number or bare id
 * is never enough, and the order must belong to this deployment's client.
 * POST keeps the ref out of request-URL logs. Read-only, except
 * { ref, action: 'request_zelle' }: the customer asks the restaurant to send
 * them a Zelle request (queued on the staff dashboard).
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const client = await getClient();
  await enforceRateLimit(req, 'orderStatus', client);

  const body = readJson(req);
  const orderId = verifyOrderStatusRef(body.ref);
  let loaded = orderId ? await loadOrder(orderId, client.id) : null;
  if (!loaded) throw new HttpError(404, 'We could not find that order. Please check your link.', 'not_found');

  if (body.action === 'request_zelle') {
    if (!client.zelle_recipient) throw new HttpError(422, 'Zelle is not available for this restaurant.', 'zelle_unavailable');
    await requestZelle({ client, orderId, actorType: 'customer' });
    loaded = await loadOrder(orderId, client.id);
  } else if (body.action !== undefined) {
    throw new HttpError(400, 'Unknown action.');
  }

  sendJson(res, 200, { order: customerView(loaded.order, loaded.items, client) });
});
