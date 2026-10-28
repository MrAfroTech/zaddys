import { serviceClient } from './supabase.js';
import { HttpError } from './http.js';

/**
 * Staff authorization. Staff sign in with Supabase Auth in the browser and
 * send their access token as `Authorization: Bearer <token>`. The server
 * verifies the token with Supabase and then requires an active row in
 * public.client_users for THIS deployment's client — a valid login, or staff
 * access to a different restaurant, is not enough.
 * Bearer tokens (not cookies) mean these endpoints aren't exposed to CSRF.
 */
export async function requireStaff(req, client) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'Please sign in.', 'unauthenticated');

  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'unauthenticated');

  const { data: staff, error: staffError } = await supabase
    .from('client_users')
    .select('user_id, display_name, role, is_active')
    .eq('client_id', client.id)
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || !staff.is_active) {
    throw new HttpError(403, 'This account is not authorized for this restaurant’s staff tools.', 'forbidden');
  }

  return {
    userId: staff.user_id,
    displayName: staff.display_name,
    role: staff.role,
    email: data.user.email,
  };
}
