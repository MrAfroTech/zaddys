import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, readJson, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { createOrder, loadOrder, siteOrigin, staffView, validateOrderInput } from '../../server/orders.js';

const VIEWS = {
  // Orders still waiting on payment confirmation, oldest first.
  awaiting: (q) => q.eq('order_status', 'open').in('payment_status', ['pending', 'manual_review']).order('created_at', { ascending: true }),
  // Paid orders still open (not yet handed over / closed).
  paid: (q) => q.eq('order_status', 'open').eq('payment_status', 'paid').order('paid_at', { ascending: true }),
  // Everything recent, newest first.
  recent: (q) => q.order('created_at', { ascending: false }),
};

/**
 * Staff only.
 * GET  /api/staff/orders?view=awaiting|paid|recent — order list with items and verification history.
 * POST /api/staff/orders — employee-assisted order; same validation, pricing
 *      and order creation as online checkout, recorded with the staff member.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  const origin = siteOrigin(req);

  if (req.method === 'POST') {
    const input = validateOrderInput(readJson(req), 'staff');
    const { orderId, created } = await createOrder({ client, source: 'staff', staff, input });
    const loaded = await loadOrder(orderId, client.id);
    sendJson(res, created ? 201 : 200, { created, order: staffView(loaded.order, loaded.items, [], client, { origin }) });
    return;
  }

  const view = VIEWS[req.query?.view] ? req.query.view : 'awaiting';
  const supabase = serviceClient();
  const { data: orders, error } = await VIEWS[view](supabase.from('client_orders').select('*').eq('client_id', client.id)).limit(50);
  if (error) throw error;
  if (!orders.length) {
    sendJson(res, 200, { view, orders: [] });
    return;
  }

  const ids = orders.map((o) => o.id);
  const [{ data: items, error: itemsError }, { data: verifications, error: vError }] = await Promise.all([
    supabase.from('client_order_items').select('order_id, position, name_snapshot, unit_price_cents, quantity, line_total_cents').eq('client_id', client.id).in('order_id', ids).order('position'),
    supabase.from('order_payments').select('*').eq('client_id', client.id).in('order_id', ids).order('verified_at'),
  ]);
  if (itemsError) throw itemsError;
  if (vError) throw vError;

  const byOrder = (rows) => rows.reduce((acc, r) => ((acc[r.order_id] ||= []).push(r), acc), {});
  const itemsBy = byOrder(items);
  const verBy = byOrder(verifications);
  sendJson(res, 200, {
    view,
    orders: orders.map((o) => staffView(o, itemsBy[o.id] || [], verBy[o.id] || [], client, { origin })),
  });
});
