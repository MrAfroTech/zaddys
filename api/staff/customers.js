import { allowMethods, handle, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';
import { findCustomer } from '../../server/customers.js';

/**
 * Staff only. GET /api/staff/customers?phone=...
 * What we remember about a returning customer of this restaurant (name,
 * email, how they like order updates), so staff don't re-ask. Returns
 * { customer: null } for a new number.
 */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const client = await getClient();
  await requireStaff(req, client);
  sendJson(res, 200, { customer: await findCustomer(client, req.query?.phone) });
});
