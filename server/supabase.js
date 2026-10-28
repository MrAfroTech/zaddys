import { createClient } from '@supabase/supabase-js';

export function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let client = null;

/**
 * Service-role client. Server-only: every table has RLS on with no policies,
 * so this is the only way to read or write ordering data. Never send this key
 * to the browser.
 */
export function serviceClient() {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
