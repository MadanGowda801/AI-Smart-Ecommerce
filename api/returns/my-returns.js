import { admin, dbSelect } from '../_db.js';

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

  const queryUserId = req.query?.userId || authUser?.id;
  if (!queryUserId) {
    return res.status(401).json({ ok: false, error: 'Authentication required.' });
  }

  // Prevent customer from viewing another customer's returns
  const isAdmin = authUser?.role === 'admin' || authUser?.email?.toLowerCase() === 'admin@smartshop.in';
  if (authUser && authUser.id !== queryUserId && !isAdmin) {
    return res.status(403).json({ ok: false, error: 'Unauthorized: Cannot access returns for another customer.' });
  }

  if (admin) {
    try {
      const { data, error } = await admin.database
        .from('return_requests')
        .select('*')
        .eq('user_id', queryUserId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return res.status(200).json({ ok: true, returns: data });
      }
    } catch {}
  }

  const rows = await dbSelect('return_requests', 'user_id', queryUserId);
  return res.status(200).json({ ok: true, returns: rows || [] });
}

