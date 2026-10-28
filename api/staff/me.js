import { allowMethods, handle, sendJson } from '../../server/http.js';
import { getClient } from '../../server/clients.js';
import { requireStaff } from '../../server/staff-auth.js';

/** GET /api/staff/me — confirms the signed-in user is active staff for this client. */
export default handle(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  const client = await getClient();
  const staff = await requireStaff(req, client);
  sendJson(res, 200, { staff: { displayName: staff.displayName, role: staff.role }, restaurantName: client.name });
});
