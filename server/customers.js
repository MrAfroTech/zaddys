import { serviceClient } from './supabase.js';

/**
 * US-first phone normalization to E.164: 10 digits -> +1..., 11 digits
 * starting with 1 -> +1..., an explicit +country number is kept. Returns null
 * when the number can't be texted reliably.
 */
export function phoneE164(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  if (text.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Saves the order's customer (name, email, update preferences, SMS consent)
 * and links the order to them. Never fails the order: if this step fails, the
 * order still stands and the error is logged.
 */
export async function rememberCustomer({ client, orderId, input, source }) {
  const phone = phoneE164(input.customer.phone);
  if (!phone) return null;
  const { data, error } = await serviceClient().rpc('ordering_remember_customer', {
    p_client_id: client.id,
    p_order_id: orderId,
    p_phone_e164: phone,
    p_name: input.customer.name,
    p_email: input.customer.email || null,
    p_notify_sms: input.customer.notifySms,
    p_notify_email: input.customer.notifyEmail,
    p_consent_source: source === 'staff' ? 'staff_verbal' : 'online_checkout',
  });
  if (error) {
    console.error('remember_customer_failed', { orderId, message: error.message });
    return null;
  }
  return data;
}

/** Staff lookup by phone: what we remember about a returning customer. */
export async function findCustomer(client, rawPhone) {
  const phone = phoneE164(rawPhone);
  if (!phone) return null;
  const { data, error } = await serviceClient()
    .from('client_customers')
    .select('name, email, notify_sms, notify_email, sms_opted_out_at, order_count, last_order_at')
    .eq('client_id', client.id)
    .eq('phone_e164', phone)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name,
    email: data.email || '',
    notifySms: data.notify_sms && !data.sms_opted_out_at,
    notifyEmail: data.notify_email,
    smsOptedOut: Boolean(data.sms_opted_out_at),
    orderCount: data.order_count,
    lastOrderAt: data.last_order_at,
  };
}

/** Marks a number as opted out after the carrier/AWS reports a STOP. */
export async function markSmsOptedOut(clientId, customerId) {
  if (!customerId) return;
  const { error } = await serviceClient()
    .from('client_customers')
    .update({ sms_opted_out_at: new Date().toISOString(), notify_sms: false })
    .eq('client_id', clientId)
    .eq('id', customerId);
  if (error) console.error('mark_opted_out_failed', { customerId, message: error.message });
}
