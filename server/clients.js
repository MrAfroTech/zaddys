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
    // '*' so newer settings columns (e.g. notification senders) are picked up
    // without breaking before their migration has run.
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'active') {
    throw new HttpError(503, 'Ordering is not available for this restaurant right now.', 'client_unavailable');
  }
  return data;
}
