import { admin, dbPatch, dbSelect } from '../../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
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

  const { returnId, action, adminNotes } = req.body || {};
  const validActions = ['approved', 'rejected', 'under_review', 'completed'];
  const normalizedAction = (action === 'approve') ? 'approved' :
                           (action === 'reject') ? 'rejected' :
                           (action === 'complete') ? 'completed' : action;

  if (!returnId || !validActions.includes(normalizedAction)) {
    return res.status(400).json({
      ok: false,
      error: `returnId and valid action (${validActions.join(' | ')}) required.`
    });
  }

  const reviewerId = authUser?.id || 'admin-reviewer';
  const nowIso = new Date().toISOString();
  const sanitizedNotes = (adminNotes || '').replace(/<[^>]*>/g, '').trim().slice(0, 1000);

  if (admin) {
    try {
      const { data, error } = await admin.database
        .from('return_requests')
        .update({
          status: normalizedAction,
          admin_notes: sanitizedNotes,
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', returnId)
        .select()
        .single();

      if (!error && data) {
        return res.status(200).json({ ok: true, returnRequest: data });
      }
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  const updated = await dbPatch('return_requests', 'id', returnId, {
    status: normalizedAction,
    admin_notes: sanitizedNotes,
    reviewed_by: reviewerId,
    reviewed_at: nowIso,
    updated_at: nowIso
  });

  return res.status(200).json({ ok: true, returnRequest: updated ? updated[0] : null });
}

