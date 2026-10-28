/** Small helpers shared by the /api handlers. */

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Order and payment data must never be cached by browsers or the CDN.
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendJson(res, 405, { error: 'Method not allowed.' });
  return false;
}

/** Vercel parses JSON bodies; fall back to parsing a string body. */
export function readJson(req) {
  const body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string' && body.trim()) {
    try {
      return JSON.parse(body);
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.');
    }
  }
  return {};
}

/**
 * Wraps a handler so thrown HttpErrors become JSON responses and anything
 * unexpected becomes a generic 500 (logged without request bodies, which
 * can contain customer contact details).
 */
export function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, code: err.code, fields: err.fields });
        return;
      }
      console.error('Unhandled API error:', err?.message || err);
      sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
    }
  };
}
