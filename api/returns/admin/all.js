import { admin } from '../../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let authUser = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ') && admin) {
    try {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data } = await admin.auth.getUser(token);
      if (data?.user) authUser = data.user;
    } catch {}
  }

  const isAdmin = req.headers['x-user-role'] === 'admin' ||
                  authUser?.role === 'admin' ||
                  authUser?.email?.toLowerCase() === 'admin@smartshop.in';

  if (!isAdmin) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Admin privileges required.' });
  }

  if (admin) {
    try {
      const { data, error } = await admin.database
        .from('return_requests')
        .select('*, orders(id, total_amount, created_at, status)')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return res.status(200).json({ ok: true, returns: data });
      }
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, returns: [] });
}

