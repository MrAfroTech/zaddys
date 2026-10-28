import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, HttpError, readJson, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { isUuid, mapRpcError } from '../../server/orders.js';

const RPC_ERRORS = {
  order_not_found: [404, 'Order not found.'],
  invalid_amount: [422, 'Enter the amount you saw in Cash App or Zelle.'],
  invalid_method: [422, 'Choose whether the payment arrived by Cash App or Zelle.'],
  reference_used_on_other_order: [409, 'That Cash App transaction is already recorded against a different order.'],
  order_cancelled: [409, 'This order is cancelled. Payment was not recorded.'],
  not_paid_yet: [409, 'This order is not paid yet — use “Verify payment” instead.'],
  not_client_staff: [403, 'This account is not authorized for this restaurant.'],
};

/**
 * POST /api/staff/payments — staff documents a payment they found in the
 * restaurant's Cash App Business account or the business bank's Zelle
 * history (manual verification).
 * Body: { orderId, method: 'cash_app'|'zelle', verifiedAmountCents,
 *         transactionReference?, notes?, confirmedReceived: true, additional?: boolean }
 *
 * - Marks the order paid ONLY if the verified amount equals the order total.
 * - A different amount moves the order to manual_review instead.
 * - A Cash App transaction reference can only be applied once, to one order.
 * - On an already-paid order nothing changes unless `additional` is set, which
 *   records a second payment and flags a possible duplicate (no auto refund).
 * - The staff member's identity comes from their session, not the request.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  const body = readJson(req);

  if (!isUuid(body.orderId)) throw new HttpError(400, 'Invalid order.');
  if (body.method !== 'cash_app' && body.method !== 'zelle') {
    throw new HttpError(422, 'Choose whether the payment arrived by Cash App or Zelle.', 'invalid_method');
  }
  if (body.confirmedReceived !== true) {
    throw new HttpError(422, 'Confirm that you found this payment in the business Cash App or bank account yourself. Customer screenshots or messages are not enough.', 'not_confirmed');
  }
  const amount = body.verifiedAmountCents;
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) {
    throw new HttpError(422, 'Enter the amount you saw in Cash App or Zelle.', 'invalid_amount');
  }
  const reference = typeof body.transactionReference === 'string' ? body.transactionReference.trim().slice(0, 120) : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';

  const { data, error } = await serviceClient().rpc('ordering_record_payment', {
    p_client_id: client.id,
    p_order_id: body.orderId,
    p_verified_amount_cents: amount,
    p_reference: reference || null,
    p_notes: notes || null,
    p_staff: staff.userId,
    p_staff_name: staff.displayName,
    p_method: body.method,
    p_additional: body.additional === true,
  });
  if (error) throw mapRpcError(error, RPC_ERRORS);

  sendJson(res, 200, { result: data?.result });
});
