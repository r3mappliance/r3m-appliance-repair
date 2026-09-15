// Powers the app's "Requests" inbox.
// GET  -> list recent service requests
// PATCH -> update a request's status ({ id, status })
//
// Protected by a shared secret so random visitors can't read customer data:
// the caller must send  Authorization: Bearer <APP_API_TOKEN>
//
// Requires these Vercel Environment Variables:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   APP_API_TOKEN

function isAuthorized(req) {
  const expected = process.env.APP_API_TOKEN;
  if (!expected) return false;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return token === expected;
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: 'server_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/service_requests?order=created_at.desc&limit=100`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      const rows = await r.json();
      return res.status(200).json({ ok: true, requests: rows });
    } catch (err) {
      console.error('list requests failed', err);
      return res.status(500).json({ ok: false, error: 'fetch_failed' });
    }
  }

  if (req.method === 'PATCH') {
    const body = readJsonBody(req);
    const { id, status } = body || {};
    const allowed = ['new', 'contacted', 'scheduled', 'dismissed'];
    if (!id || !allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_id_or_status' });
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/service_requests?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('update request failed', err);
      return res.status(500).json({ ok: false, error: 'update_failed' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
