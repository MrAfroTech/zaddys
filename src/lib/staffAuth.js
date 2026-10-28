import { createClient } from '@supabase/supabase-js';

/**
 * Staff sign-in uses Supabase Auth (email + password). Only the public URL
 * and anon key are in the browser; the anon key can't read or write any
 * ordering table (RLS, no policies). The server checks every staff request
 * against public.client_users for this deployment's client.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const staffAuthConfigured = Boolean(url && anonKey);

export const supabase = staffAuthConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'zaddys-staff-auth' } })
  : null;

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
