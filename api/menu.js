import { serviceClient } from '../server/supabase.js';
import { allowMethods, handle, sendJson } from '../server/http.js';
import { getClient } from '../server/clients.js';
import { paymentMethods } from '../server/payment-methods.js';

/**
 * GET /api/menu — this deployment's client's orderable menu, from the shared
 * menus/menu_items tables. Read-only and public. Unavailable items are
 * returned (flagged) so the cart can explain why something can't be ordered.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const client = await getClient();
  const supabase = serviceClient();

  const { data: menus, error: menusError } = await supabase
    .from('menus')
    .select('id')
    .eq('client_id', client.id)
    .eq('is_active', true);
  if (menusError) throw menusError;

  let items = [];
  if (menus.length) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, description, price_cents, category, image_url, image_alt, is_available, display_order, is_demo')
      .eq('client_id', client.id)
      .in('menu_id', menus.map((m) => m.id))
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    items = data;
  }

  sendJson(res, 200, {
    restaurantName: client.name,
    onlineOrderingEnabled: client.online_ordering_enabled,
    paymentMethods: paymentMethods(client).map(({ id, label }) => ({ id, label })),
    salesTaxRateBp: client.sales_tax_rate_bp,
    salesTaxLabel: client.sales_tax_label,
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      priceCents: m.price_cents,
      category: m.category,
      imageUrl: m.image_url,
      imageAlt: m.image_alt,
      isAvailable: m.is_available,
      isDemo: m.is_demo,
    })),
  });
});
