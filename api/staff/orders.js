import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, readJson, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { afterOrderCreated, createOrder, loadStaffOrder, siteOrigin, staffView, validateOrderInput } from '../../server/orders.js';
import { notificationsByOrder } from '../../server/notify.js';

const VIEWS = {
  // Orders still waiting on payment confirmation, oldest first.
  awaiting: (q) => q.eq('order_status', 'open').in('payment_status', ['pending', 'manual_review']).order('created_at', { ascending: true }),
  // Paid orders still open (not yet handed over / closed).
  paid: (q) => q.eq('order_status', 'open').eq('payment_status', 'paid').order('paid_at', { ascending: true }),
  // Customers waiting for a Zelle request from the restaurant's bank app, oldest first.
  zelle: (q) => q.eq('order_status', 'open').in('payment_status', ['pending', 'manual_review']).eq('zelle_request_status', 'requested').order('zelle_requested_at', { ascending: true }),
  // Everything recent, newest first.
  recent: (q) => q.order('created_at', { ascending: false }),
};

/**
 * Staff only.
 * GET  /api/staff/orders?view=awaiting|zelle|paid|recent — order list with items and verification history.
 * GET  /api/staff/orders?view=counts — { counts: { zelle } } for the dashboard badge (polled).
 * POST /api/staff/orders — employee-assisted order; same validation, pricing
 *      and order creation as online checkout, recorded with the staff member.
 *      Texts/emails the customer if they agreed (customer.notifySms/notifyEmail).
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  const origin = siteOrigin(req);

  if (req.method === 'POST') {
    const input = validateOrderInput(readJson(req), 'staff');
    const { orderId, created } = await createOrder({ client, source: 'staff', staff, input });
    await afterOrderCreated({ client, orderId, input, source: 'staff', origin });
    sendJson(res, created ? 201 : 200, { created, order: await loadStaffOrder(orderId, client, origin) });
    return;
  }

  const supabase = serviceClient();
  if (req.query?.view === 'counts') {
    const { count, error } = await VIEWS.zelle(supabase.from('client_orders').select('id', { count: 'exact', head: true }).eq('client_id', client.id));
    if (error) {
      // Before db/003 is applied the column doesn't exist; report no queue.
      console.error('zelle_count_failed', { message: error.message });
      sendJson(res, 200, { counts: { zelle: 0 } });
      return;
    }
    sendJson(res, 200, { counts: { zelle: count || 0 } });
    return;
  }

  const view = VIEWS[req.query?.view] ? req.query.view : 'awaiting';
  const { data: orders, error } = await VIEWS[view](supabase.from('client_orders').select('*').eq('client_id', client.id)).limit(50);
  if (error) throw error;
  if (!orders.length) {
    sendJson(res, 200, { view, orders: [] });
    return;
  }

  const ids = orders.map((o) => o.id);
  const [{ data: items, error: itemsError }, { data: verifications, error: vError }, notes] = await Promise.all([
    supabase.from('client_order_items').select('order_id, position, name_snapshot, unit_price_cents, quantity, line_total_cents').eq('client_id', client.id).in('order_id', ids).order('position'),
    supabase.from('order_payments').select('*').eq('client_id', client.id).in('order_id', ids).order('verified_at'),
    notificationsByOrder(client.id, ids),
  ]);
  if (itemsError) throw itemsError;
  if (vError) throw vError;

  const byOrder = (rows) => rows.reduce((acc, r) => ((acc[r.order_id] ||= []).push(r), acc), {});
  const itemsBy = byOrder(items);
  const verBy = byOrder(verifications);
  sendJson(res, 200, {
    view,
    orders: orders.map((o) => staffView(o, itemsBy[o.id] || [], verBy[o.id] || [], client, { origin, notifications: notes[o.id] })),
  });
});
