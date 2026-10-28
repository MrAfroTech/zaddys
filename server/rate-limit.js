import { createHash } from 'node:crypto';
import { serviceClient } from './supabase.js';
import { HttpError } from './http.js';

/**
 * Per-visitor limits for public endpoints, sized for a quick-service shop:
 * a family placing a few separate orders is fine; scripted spam is not.
 * Visitors are identified by a salted hash of their IP — raw IPs aren't stored.
 */
export const LIMITS = {
  checkout: { windowSeconds: 15 * 60, max: 5 }, // 5 orders / 15 min
  orderStatus: { windowSeconds: 10 * 60, max: 120 }, // ~4x the page's 30 s auto-refresh
};

function clientIp(req) {
  const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || '';
  return String(forwarded).split(',')[0].trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export async function enforceRateLimit(req, name, client) {
  const limit = LIMITS[name];
  const salt = process.env.ORDER_LINK_SECRET || '';
  const visitor = createHash('sha256').update(`${salt}:${clientIp(req)}`).digest('hex').slice(0, 32);
  const { data, error } = await serviceClient().rpc('ordering_hit_rate_limit', {
    p_bucket: `${client.slug}:${name}:${visitor}`,
    p_window_seconds: limit.windowSeconds,
    p_limit: limit.max,
  });
  if (error) throw error;
  if (data !== true) {
    throw new HttpError(429, 'Too many requests. Please wait a few minutes and try again, or call the shop.', 'rate_limited');
  }
}
