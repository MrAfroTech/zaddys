import { serviceClient } from '../../server/supabase.js';
import { allowMethods, handle, HttpError, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';

const RANGES = { today: 0, '7d': 6, '30d': 29, '90d': 89 };

/** Midnight in the client's timezone, `daysAgo` days back, as a UTC Date. */
function startOfDay(timezone, daysAgo) {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  // How far the client's wall clock is from UTC right now.
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = wallAsUtc - now.getTime();
  const localMidnight = Date.UTC(parts.year, parts.month - 1, parts.day - daysAgo);
  return new Date(localMidnight - offsetMs);
}

/**
 * Owner / manager only. GET /api/staff/stats?range=today|7d|30d|90d
 * Sales summary for the owner dashboard: paid sales, orders, average ticket,
 * new vs returning customers, by day, by payment method and source, top items.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    throw new HttpError(403, 'Only an owner or manager can see sales.', 'forbidden');
  }

  const range = RANGES[req.query?.range] !== undefined ? req.query.range : '7d';
  const timezone = client.timezone || 'America/New_York';
  const from = startOfDay(timezone, RANGES[range]);
  const to = new Date(Date.now() + 60_000);

  const { data, error } = await serviceClient().rpc('ordering_sales_summary', {
    p_client_id: client.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) {
    if (/ordering_sales_summary/.test(error.message)) {
      throw new HttpError(503, 'The sales dashboard needs the latest database update (db/004).', 'not_ready');
    }
    throw error;
  }
  sendJson(res, 200, { range, timezone, from: from.toISOString(), summary: data });
});
