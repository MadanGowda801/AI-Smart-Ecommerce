import insforge from './insforge.js';

/**
 * Client Service for Automated Defect Detection & Returns Portal
 */

export const returnsService = {
  /**
   * Converts a File to Base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Submits a return request with optional defect photo evidence
   */
  async submitReturn({ orderId, orderItemId, reason, description, defectType, file, userId, orderMeta = null }) {
    let evidenceBase64 = null;
    let mimeType = 'image/jpeg';

    if (file) {
      evidenceBase64 = await this.fileToBase64(file);
      mimeType = file.type || 'image/jpeg';
    }

    // Get current session token if available
    const token = await (insforge.auth?.tokenManager?.getAccessToken?.() || Promise.resolve(insforge.auth?.accessToken || ''));

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/returns/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId,
        orderItemId,
        reason,
        description: description || reason,
        defectType,
        evidenceBase64,
        mimeType,
        userId,
        ...(orderMeta ? { orderMeta } : {})
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit return request.');
    }
    return data;
  },

  /**
   * Fetches customer's own return requests
   */
  async getMyReturns(userId) {
    const token = await (insforge.auth?.tokenManager?.getAccessToken?.() || Promise.resolve(insforge.auth?.accessToken || ''));

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = userId ? `/api/returns/my-returns?userId=${encodeURIComponent(userId)}` : '/api/returns/my-returns';
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch returns.');
    return data.returns || [];
  },

  /**
   * Staff / Admin: Fetches all return requests
   */
  async getAdminReturns() {
    const token = await (insforge.auth?.tokenManager?.getAccessToken?.() || Promise.resolve(insforge.auth?.accessToken || ''));

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/returns/admin/all', { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch admin returns.');
    return data.returns || [];
  },

  /**
   * Staff / Admin: Review, approve, or reject return request
   */
  async reviewReturn({ returnId, action, adminNotes }) {
    const token = await (insforge.auth?.tokenManager?.getAccessToken?.() || Promise.resolve(insforge.auth?.accessToken || ''));

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/returns/admin/review', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ returnId, action, adminNotes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit review.');
    return data;
  }
};

export default returnsService;
