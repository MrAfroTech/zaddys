import { serviceClient } from './supabase.js';

/**
 * Loyalty: every paid order counts once toward the customer's reward
 * ("every Nth order"); staff redeem it at the counter. Off unless the client
 * has loyalty_enabled and a loyalty_reward. All functions tolerate the
 * columns not existing yet (before db/004 is run) by reporting "off".
 */
export function loyaltyOn(client) {
  return Boolean(client.loyalty_enabled && client.loyalty_reward);
}

/** What a customer sees: progress toward the reward, or that it's ready. */
export function loyaltyView(client, points) {
  if (!loyaltyOn(client)) return null;
  const required = client.loyalty_orders_required || 10;
  const p = Math.max(0, points || 0);
  return {
    reward: client.loyalty_reward,
    required,
    points: p,
    progress: p % required,
    available: Math.floor(p / required),
  };
}

/** Points for many customers at once (staff lists). Map of customer id -> points. */
export async function loyaltyPoints(client, customerIds) {
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (!loyaltyOn(client) || !ids.length) return {};
  const { data, error } = await serviceClient()
    .from('client_customers')
    .select('id, loyalty_points')
    .eq('client_id', client.id)
    .in('id', ids);
  if (error) {
    console.error('loyalty_points_failed', { message: error.message });
    return {};
  }
  return Object.fromEntries(data.map((r) => [r.id, r.loyalty_points]));
}

/** Counts a paid order toward its customer's reward (once). Never throws. */
export async function countPaidOrder(client, orderId) {
  if (!loyaltyOn(client)) return null;
  const { data, error } = await serviceClient().rpc('ordering_loyalty_on_paid', { p_client_id: client.id, p_order_id: orderId });
  if (error) {
    console.error('loyalty_count_failed', { orderId, message: error.message });
    return null;
  }
  return data;
}
