import insforge from './insforge.js';

/**
 * Frontend Delivery Management Service
 * Communicates with /api/delivery/* with authenticated identity headers.
 * Never fabricates third-party courier tracking data.
 */

async function getAuthHeaders(user) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const session = await insforge.auth.getCurrentSession?.();
    const token = session?.data?.session?.accessToken || session?.data?.accessToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore if SDK session helper unavailable
  }

  let activeUser = user;
  if (!activeUser && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('smartshop_active_user');
      if (stored) activeUser = JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  if (activeUser?.id) headers['x-user-id'] = String(activeUser.id);
  if (activeUser?.role) headers['x-user-role'] = String(activeUser.role);
  if (activeUser?.email) headers['x-user-email'] = String(activeUser.email);

  return headers;
}

export const deliveryService = {
  /**
   * Register a newly created order with the delivery management backend.
   */
  async registerOrder(order, user = null) {
    if (!order?.id) return { ok: false };
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch('/api/delivery/register-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({ order })
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /**
   * Admin: Fetch all customer orders & delivery details with search/filters.
   */
  async adminGetDeliveryOrders(filters = {}, user = null) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.pincode) params.set('pincode', filters.pincode);
    if (filters.delayed) params.set('delayed', 'true');
    if (filters.pending) params.set('pending', 'true');

    const headers = await getAuthHeaders(user);
    const res = await fetch(`/api/delivery/admin/orders?${params.toString()}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to load delivery orders');
    return data;
  },

  /**
   * Admin: Assign delivery personnel, set estimated delivery date, or flag delay.
   */
  async adminAssignDelivery(payload, user = null) {
    const headers = await getAuthHeaders(user);
    const res = await fetch('/api/delivery/admin/assign', {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to assign delivery');
    return data;
  },

  /**
   * Admin OR Assigned Delivery Personnel: Update delivery status with date/time & notes.
   */
  async updateDeliveryStatus({ orderId, status, location = null, notes = null }, user = null) {
    const headers = await getAuthHeaders(user);
    const res = await fetch('/api/delivery/status', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ orderId, status, location, notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to update delivery status');
    return data;
  },

  /**
   * Delivery Personnel: Fetch ONLY deliveries assigned to the logged-in delivery agent.
   */
  async getAssignedDeliveries(user = null) {
    const headers = await getAuthHeaders(user);
    const res = await fetch('/api/delivery/assigned', {
      method: 'GET',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to load assigned deliveries');
    return data;
  },

  /**
   * Track Order: Fetch authoritative delivery details and full timestamped timeline.
   */
  async trackOrder(orderId, user = null) {
    const headers = await getAuthHeaders(user);
    const res = await fetch(`/api/delivery/track/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Unable to track this order');
    return data;
  }
};

export default deliveryService;

