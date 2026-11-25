/**
 * Delivery Management System — Canonical Status Definitions & Helpers
 * Shared across Customer Orders, Tracking Timeline, Admin Delivery Management,
 * Delivery Personnel Dashboard, and Server Delivery API.
 */

export const PRIMARY_DELIVERY_PIPELINE = [
  {
    key: 'order_placed',
    label: 'Order Placed',
    shortDesc: 'Order received by store',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    icon: '📝'
  },
  {
    key: 'order_confirmed',
    label: 'Order Confirmed',
    shortDesc: 'Verified & approved by admin',
    color: '#2dd4bf',
    bg: 'rgba(45, 212, 191, 0.14)',
    icon: '✅'
  },
  {
    key: 'packed',
    label: 'Packed',
    shortDesc: 'Quality checked & securely packed',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.14)',
    icon: '📦'
  },
  {
    key: 'shipped',
    label: 'Shipped',
    shortDesc: 'Dispatched from fulfillment hub',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.14)',
    icon: '🚚'
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    shortDesc: 'Delivery personnel on the way',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.16)',
    icon: '🛵'
  },
  {
    key: 'delivered',
    label: 'Delivered',
    shortDesc: 'Delivered & confirmed with timestamp',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.16)',
    icon: '📬'
  }
];

export const EXCEPTION_DELIVERY_STATUSES = [
  {
    key: 'cancelled',
    label: 'Cancelled',
    shortDesc: 'Order was cancelled',
    color: '#f87171',
    bg: 'rgba(239, 68, 68, 0.14)',
    icon: '❌'
  },
  {
    key: 'delivery_failed',
    label: 'Delivery Failed',
    shortDesc: 'Delivery attempt unsuccessful',
    color: '#fb7185',
    bg: 'rgba(251, 113, 133, 0.14)',
    icon: '⚠️'
  },
  {
    key: 'return_requested',
    label: 'Return Requested',
    shortDesc: 'Customer requested a return',
    color: '#fcd34d',
    bg: 'rgba(252, 211, 77, 0.14)',
    icon: '↩️'
  },
  {
    key: 'returned',
    label: 'Returned',
    shortDesc: 'Item returned & verified',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.16)',
    icon: '📥'
  }
];

export const ALL_DELIVERY_STATUSES = [
  ...PRIMARY_DELIVERY_PIPELINE,
  ...EXCEPTION_DELIVERY_STATUSES
];

export const DELIVERY_AGENT_ALLOWED_STATUSES = [
  'shipped',
  'out_for_delivery',
  'delivered',
  'delivery_failed'
];

export const VALID_DELIVERY_STATUS_KEYS = new Set(ALL_DELIVERY_STATUSES.map((s) => s.key));

/**
 * Normalize legacy or display statuses into canonical delivery status keys.
 */
export function normalizeDeliveryStatus(rawStatus) {
  const s = String(rawStatus || 'order_placed').trim().toLowerCase().replace(/\s+/g, '_');
  const map = {
    placed: 'order_placed',
    order_placed: 'order_placed',
    pending: 'order_placed',
    payment_confirmed: 'order_confirmed',
    order_confirmed: 'order_confirmed',
    confirmed: 'order_confirmed',
    processing: 'packed',
    packed: 'packed',
    shipped: 'shipped',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    delivery_failed: 'delivery_failed',
    failed: 'delivery_failed',
    return_requested: 'return_requested',
    returned: 'returned'
  };
  return map[s] || 'order_placed';
}

export function getDeliveryStatusMeta(rawStatus) {
  const key = normalizeDeliveryStatus(rawStatus);
  return (
    ALL_DELIVERY_STATUSES.find((s) => s.key === key) || {
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      shortDesc: 'Delivery status updated',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.14)',
      icon: '📋'
    }
  );
}

export function getPipelineStepIndex(rawStatus) {
  const key = normalizeDeliveryStatus(rawStatus);
  return PRIMARY_DELIVERY_PIPELINE.findIndex((s) => s.key === key);
}

/**
 * Calculate a real deterministic Estimated Delivery Date ISO string based on
 * shipping method and order date (never uses fake third-party courier APIs).
 */
export function computeEstimatedDeliveryDate(shippingMethod = 'standard', baseDate = new Date()) {
  const d = new Date(baseDate);
  const daysMap = {
    sameday: 0,
    express: 2,
    standard: 4
  };
  const addDays = daysMap[String(shippingMethod || 'standard').toLowerCase()] ?? 4;
  d.setDate(d.getDate() + addDays);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export function formatEstimatedDate(isoOrText) {
  if (!isoOrText) return 'To be scheduled';
  const parsed = new Date(isoOrText);
  if (Number.isNaN(parsed.getTime())) return String(isoOrText);
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDeliveryTimestamp(iso) {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso);
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Built-in store delivery roster for quick assignment (editable by admin).
 */
export const DELIVERY_PERSONNEL_ROSTER = [
  {
    id: 'usr-delivery-1',
    name: 'Suresh Kumar',
    phone: '9845123456',
    email: 'delivery@smartshop.in',
    zone: 'Bengaluru & South Zone'
  },
  {
    id: 'usr-delivery-2',
    name: 'Arjun Nair',
    phone: '9820456789',
    email: 'arjun.delivery@smartshop.in',
    zone: 'Mumbai & West Zone'
  },
  {
    id: 'usr-delivery-3',
    name: 'Deepak Sharma',
    phone: '9811345678',
    email: 'deepak.delivery@smartshop.in',
    zone: 'Delhi NCR & North Zone'
  }
];

