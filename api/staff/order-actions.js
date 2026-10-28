import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, HttpError, readJson, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { isUuid, mapRpcError } from '../../server/orders.js';

const ACTIONS = ['manual_review', 'return_to_pending', 'cancel', 'complete'];

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

  const { error } = await serviceClient().rpc('ordering_order_action', {
    p_client_id: client.id,
    p_order_id: body.orderId,
    p_action: body.action,
    p_reason: reason || null,
    p_staff: staff.userId,
    p_staff_name: staff.displayName,
  });
  if (error) throw mapRpcError(error, RPC_ERRORS);

  sendJson(res, 200, { result: 'ok' });
});
