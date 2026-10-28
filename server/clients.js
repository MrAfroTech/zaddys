import { serviceClient } from './supabase.js';
import { HttpError } from './http.js';

/**
 * Which establishment this deployment serves. All clients share the same
 * tables in the shared Supabase project; a deployment is pinned to one client
 * by CLIENT_SLUG (server env). The client is never taken from the browser.
 */
export async function getClient() {
  const slug = (process.env.CLIENT_SLUG || '').trim();
  if (!slug) throw new Error('CLIENT_SLUG is not set');
  const { data, error } = await serviceClient()
    .from('clients')
    .select('id, slug, name, status, order_number_prefix, timezone, cashapp_cashtag, zelle_recipient, online_ordering_enabled, sales_tax_rate_bp, sales_tax_label')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'active') {
    throw new HttpError(503, 'Ordering is not available for this restaurant right now.', 'client_unavailable');
  }
  return data;
}
