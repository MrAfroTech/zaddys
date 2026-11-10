import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, HttpError, readJson, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { isUuid, loadOrder, loadStaffOrder, mapRpcError, notifyOrderChange, requestZelle, siteOrigin } from '../../server/orders.js';
import { notifyOrder } from '../../server/notify.js';

const ACTIONS = ['manual_review', 'return_to_pending', 'cancel', 'complete', 'resend_messages', 'zelle_request_sent'];
const MESSAGE_KINDS = ['order_placed', 'payment_confirmed', 'order_cancelled'];

const RPC_ERRORS = {
  order_not_found: [404, 'Order not found.'],
  invalid_transition: [409, 'That change is not allowed for this order’s current status. Refresh and try again.'],
  reason_required: [422, 'Add a reason for cancelling.'],
  manager_required: [403, 'Only an owner or manager can cancel a paid order.'],
  not_client_staff: [403, 'This account is not authorized for this restaurant.'],
};

/**
 * POST /api/staff/order-actions — { orderId, action, reason? }
 * manual_review | return_to_pending : payment needs / no longer needs review
 * cancel   : closes the order (pending payment -> cancelled; a paid order keeps
 *            its paid record and is flagged "cancelled_after_payment")
 * complete : closes a paid order (handed to the customer)
 * resend_messages : { kind, channel? } re-sends a customer text/email
 * zelle_request_sent : staff sent the Zelle request from the bank app
 * Payment status and order status are changed independently; every change is
 * written to order_events with the staff member's identity.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  const body = readJson(req);

  if (!isUuid(body.orderId)) throw new HttpError(400, 'Invalid order.');
  if (!ACTIONS.includes(body.action)) throw new HttpError(400, 'Unknown action.');
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';

  if (body.action === 'zelle_request_sent') {
    await requestZelle({ client, orderId: body.orderId, action: 'sent', actorType: 'staff', staff });
    sendJson(res, 200, { result: 'ok', order: await loadStaffOrder(body.orderId, client, siteOrigin(req)) });
    return;
  }

  if (body.action === 'resend_messages') {
    if (!MESSAGE_KINDS.includes(body.kind)) throw new HttpError(400, 'Unknown message.');
    if (body.channel !== undefined && body.channel !== 'sms' && body.channel !== 'email') throw new HttpError(400, 'Unknown channel.');
    const loaded = await loadOrder(body.orderId, client.id);
    if (!loaded) throw new HttpError(404, 'Order not found.');
    await notifyOrder({
      client,
      order: loaded.order,
      items: loaded.items,
      kind: body.kind,
      origin: siteOrigin(req),
      force: true,
      channels: body.channel ? [body.channel] : null,
    });
    sendJson(res, 200, { result: 'ok', order: await loadStaffOrder(body.orderId, client, siteOrigin(req)) });
    return;
  }

  const { error } = await serviceClient().rpc('ordering_order_action', {
    p_client_id: client.id,
    p_order_id: body.orderId,
    p_action: body.action,
    p_reason: reason || null,
    p_staff: staff.userId,
    p_staff_name: staff.displayName,
  });
  if (error) throw mapRpcError(error, RPC_ERRORS);

  if (body.action === 'cancel') {
    await notifyOrderChange({ client, orderId: body.orderId, kind: 'order_cancelled', origin: siteOrigin(req) });
  }
  sendJson(res, 200, { result: 'ok' });
});
