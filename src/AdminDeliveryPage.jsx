import React, { useState, useEffect, useCallback } from 'react';
import AdminHeader from './AdminHeader';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import deliveryService from './deliveryService';
import {
  ALL_DELIVERY_STATUSES,
  getDeliveryStatusMeta,
  formatEstimatedDate,
  formatDeliveryTimestamp,
  DELIVERY_PERSONNEL_ROSTER
} from './deliveryConstants';
import { formatINR } from './productsService';
import { sanitizeMobileInput, validateMobileNumber, formatMobileDisplay } from './phoneUtils';
import {
  Search,
  RefreshCw,
  Truck,
  UserPlus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  Calendar,
  X,
  Send
} from 'lucide-react';

export default function AdminDeliveryPage() {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();

  const [orders, setOrders] = useState([]);
  const [roster, setRoster] = useState(DELIVERY_PERSONNEL_ROSTER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pincodeFilter, setPincodeFilter] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);

  // Assignment & Delay Modal
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [assignForm, setAssignForm] = useState({
    deliveryPersonId: '',
    deliveryPersonName: '',
    deliveryPersonPhone: '',
    estimatedDeliveryDate: '',
    isDelayed: false,
    delayReason: ''
  });
  const [assignError, setAssignError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await deliveryService.adminGetDeliveryOrders(
        {
          status: statusFilter,
          search: searchQuery.trim(),
          pincode: pincodeFilter.trim(),
          delayed: delayedOnly,
          pending: pendingOnly
        },
        user
      );
      setOrders(res.orders || []);
      if (Array.isArray(res.roster) && res.roster.length > 0) {
        setRoster(res.roster);
      }
    } catch (err) {
      setError(err.message || 'Failed to load delivery records');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, pincodeFilter, delayedOnly, pendingOnly, user]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const handleStatusChange = async (order, newStatus) => {
    setSavingId(order.id);
    try {
      const res = await deliveryService.updateDeliveryStatus(
        {
          orderId: order.id,
          status: newStatus,
          location: order.shipping_address?.city || 'Fulfillment Hub'
        },
        user
      );
      if (res?.ok) {
        const meta = getDeliveryStatusMeta(newStatus);
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...res.order } : o))
        );
        showToast(`${meta.icon} Order #${String(order.id).slice(-8).toUpperCase()} updated to "${meta.label}"`);
        if (res.notification && sendNotification) {
          sendNotification({
            title: res.notification.title,
            message: res.notification.message,
            type: 'order',
            link_page: 'order-tracking',
            link_params: { id: order.id }
          }).catch(() => {});
        }
      }
    } catch (err) {
      showToast(err.message || 'Status update failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const openAssignModal = (order) => {
    setAssignError('');
    setAssignModalOrder(order);
    const estDateVal = order.estimated_delivery_date
      ? new Date(order.estimated_delivery_date).toISOString().slice(0, 10)
      : '';
    setAssignForm({
      deliveryPersonId: order.delivery_person_id || '',
      deliveryPersonName: order.delivery_person_name || '',
      deliveryPersonPhone: sanitizeMobileInput(order.delivery_person_phone || ''),
      estimatedDeliveryDate: estDateVal,
      isDelayed: Boolean(order.is_delayed),
      delayReason: order.delay_reason || ''
    });
  };

  const handleSelectRosterAgent = (agentId) => {
    const found = roster.find((r) => r.id === agentId);
    if (found) {
      setAssignForm((prev) => ({
        ...prev,
        deliveryPersonId: found.id,
        deliveryPersonName: found.name,
        deliveryPersonPhone: sanitizeMobileInput(found.phone)
      }));
    } else {
      setAssignForm((prev) => ({ ...prev, deliveryPersonId: '' }));
    }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!assignModalOrder) return;
    setAssignError('');

    if (assignForm.deliveryPersonName.trim()) {
      const phoneErr = validateMobileNumber(assignForm.deliveryPersonPhone, true);
      if (phoneErr) {
        setAssignError(phoneErr);
        return;
      }
    }

    setSavingId(assignModalOrder.id);
    try {
      const res = await deliveryService.adminAssignDelivery(
        {
          orderId: assignModalOrder.id,
          deliveryPersonId: assignForm.deliveryPersonId || null,
          deliveryPersonName: assignForm.deliveryPersonName.trim() || null,
          deliveryPersonPhone: assignForm.deliveryPersonPhone
            ? sanitizeMobileInput(assignForm.deliveryPersonPhone)
            : null,
          estimatedDeliveryDate: assignForm.estimatedDeliveryDate
            ? new Date(`${assignForm.estimatedDeliveryDate}T18:00:00`).toISOString()
            : null,
          isDelayed: assignForm.isDelayed,
          delayReason: assignForm.isDelayed ? assignForm.delayReason.trim() || 'Operational delay' : null
        },
        user
      );

      if (res?.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === assignModalOrder.id ? { ...o, ...res.order } : o))
        );
        showToast(
          assignForm.isDelayed
            ? '⚠️ Delivery updated & delay notification sent to customer'
            : '✅ Delivery personnel & schedule updated'
        );
        if (res.notification && sendNotification) {
          sendNotification({
            title: res.notification.title,
            message: res.notification.message,
            type: 'order',
            link_page: 'order-tracking',
            link_params: { id: assignModalOrder.id }
          }).catch(() => {});
        }
        setAssignModalOrder(null);
      }
    } catch (err) {
      setAssignError(err.message || 'Failed to update assignment');
    } finally {
      setSavingId(null);
    }
  };

  // Summary counts
  const pendingCount = orders.filter((o) =>
    ['order_placed', 'order_confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivery_failed'].includes(
      o.delivery_status
    )
  ).length;
  const delayedCount = orders.filter((o) => o.is_delayed).length;
  const outCount = orders.filter((o) => o.delivery_status === 'out_for_delivery').length;
  const deliveredCount = orders.filter((o) => o.delivery_status === 'delivered').length;

  return (
    <div>
      <AdminHeader
        title="Delivery Management"
        subtitle="Assign delivery personnel, update live delivery statuses with timestamps, and monitor delayed or pending shipments"
        actionButton={
          <button onClick={loadDeliveries} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem' }}>
            <RefreshCw size={14} /> Refresh Deliveries
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.85rem',
            background: toast.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
            color: toast.type === 'error' ? '#f87171' : '#34d399',
            backdropFilter: 'blur(14px)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card-glass" style={{ padding: '1rem 1.15rem', borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Matching Orders</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{orders.length}</div>
        </div>
        <div
          className="card-glass"
          onClick={() => { setPendingOnly((v) => !v); setDelayedOnly(false); }}
          style={{ padding: '1rem 1.15rem', borderLeft: '3px solid #38bdf8', cursor: 'pointer', borderColor: pendingOnly ? '#38bdf8' : undefined }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} color="#38bdf8" /> Pending Deliveries
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div
          className="card-glass"
          onClick={() => { setDelayedOnly((v) => !v); setPendingOnly(false); }}
          style={{ padding: '1rem 1.15rem', borderLeft: '3px solid var(--accent-gold)', cursor: 'pointer', borderColor: delayedOnly ? 'var(--accent-gold)' : undefined }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={13} color="var(--accent-gold-light)" /> Delayed Deliveries
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-gold-light)', marginTop: '4px' }}>{delayedCount}</div>
        </div>
        <div className="card-glass" style={{ padding: '1rem 1.15rem', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Out for Delivery</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{outCount}</div>
        </div>
        <div className="card-glass" style={{ padding: '1rem 1.15rem', borderLeft: '3px solid var(--success)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="var(--success)" /> Delivered
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{deliveredCount}</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card-glass" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search Order ID, customer name, email, agent…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: '10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: '#fff',
                fontSize: '0.84rem'
              }}
            />
          </div>

          <div style={{ position: 'relative', width: '165px' }}>
            <MapPin size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Filter PIN Code"
              value={pincodeFilter}
              onChange={(e) => setPincodeFilter(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                width: '100%',
                padding: '9px 10px 9px 30px',
                borderRadius: '10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: '#fff',
                fontSize: '0.84rem'
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setPendingOnly((v) => !v)}
            className={`btn ${pendingOnly ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
          >
            <Clock size={14} /> Pending Only
          </button>

          <button
            type="button"
            onClick={() => setDelayedOnly((v) => !v)}
            style={{
              padding: '0.5rem 0.9rem',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: delayedOnly ? 'var(--amber-gradient)' : 'var(--gold-soft)',
              color: delayedOnly ? '#fff' : 'var(--accent-gold-light)',
              border: '1px solid var(--gold-border)'
            }}
          >
            <AlertTriangle size={14} /> Delayed Only
          </button>
        </div>

        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[{ key: 'all', label: 'All Statuses', icon: '📋' }, ...ALL_DELIVERY_STATUSES].map((st) => {
            const active = statusFilter === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#fff' : 'var(--text-secondary)'
                }}
              >
                {st.icon} {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--error-bg)', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Orders Delivery List */}
      {loading ? (
        <div className="card-glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading delivery queue…
        </div>
      ) : orders.length === 0 ? (
        <div className="card-glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No deliveries match the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map((order) => {
            const meta = getDeliveryStatusMeta(order.delivery_status);
            const addr = order.shipping_address || {};
            const isSaving = savingId === order.id;

            return (
              <div
                key={order.id}
                className="card-glass"
                style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${order.is_delayed ? 'var(--accent-gold)' : meta.color}`
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem', alignItems: 'flex-start' }}>
                  {/* Col 1: Order & Customer */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.98rem', color: '#fff' }}>
                        #{String(order.id).slice(-8).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: meta.bg, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                      {order.is_delayed && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', background: 'var(--gold-soft)', color: 'var(--accent-gold-light)', border: '1px solid var(--gold-border)' }}>
                          DELAYED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
                      {order.customer_name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      📞 {formatMobileDisplay(order.customer_phone || addr.mobile)} · {formatINR(order.total_amount)} ({order.payment_status})
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '3px' }}>
                      Updated: {formatDeliveryTimestamp(order.updated_at)}
                    </div>
                  </div>

                  {/* Col 2: Full Delivery Address + PIN */}
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                      Delivery Destination
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {addr.houseNumber || addr.addressLine}
                      {addr.street ? `, ${addr.street}` : ''}
                      {addr.landmark ? ` (Near ${addr.landmark})` : ''}
                      <br />
                      {addr.city}, {addr.state} — <strong style={{ color: 'var(--text-accent)' }}>PIN {order.delivery_pincode || addr.pincode}</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-accent)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Est: {formatEstimatedDate(order.estimated_delivery_date)}
                    </div>
                  </div>

                  {/* Col 3: Assigned Delivery Personnel */}
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                      Assigned Personnel
                    </div>
                    {order.delivery_person_name ? (
                      <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 700 }}>
                        <Truck size={13} color="var(--accent-primary)" style={{ marginRight: '5px', verticalAlign: '-2px' }} />
                        {order.delivery_person_name}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-accent)', fontWeight: 600, marginTop: '2px' }}>
                          <Phone size={11} style={{ marginRight: '4px' }} />
                          {formatMobileDisplay(order.delivery_person_phone)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold-light)' }}>Not assigned yet</div>
                    )}
                    <button
                      type="button"
                      onClick={() => openAssignModal(order)}
                      className="btn btn-secondary"
                      style={{ marginTop: '8px', padding: '0.4rem 0.8rem', fontSize: '0.76rem' }}
                    >
                      <UserPlus size={13} /> {order.delivery_person_name ? 'Reassign / Delay' : 'Assign Delivery Agent'}
                    </button>
                  </div>

                  {/* Col 4: Status Updater */}
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                      Update Delivery Status
                    </div>
                    <select
                      value={order.delivery_status}
                      disabled={isSaving}
                      onChange={(e) => handleStatusChange(order, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--accent-border)',
                        color: '#fff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {ALL_DELIVERY_STATUSES.map((st) => (
                        <option key={st.key} value={st.key}>
                          {st.icon} {st.label}
                        </option>
                      ))}
                    </select>
                    {order.delivered_at && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '6px', fontWeight: 600 }}>
                        ✓ Delivered: {formatDeliveryTimestamp(order.delivered_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Delivery Personnel & Delay Modal */}
      {assignModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(4, 9, 10, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setAssignModalOrder(null)}
        >
          <div
            className="card-glass"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent-border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Assign Delivery Personnel</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Order #{String(assignModalOrder.id).slice(-8).toUpperCase()} · PIN {assignModalOrder.delivery_pincode || assignModalOrder.shipping_address?.pincode}
                </p>
              </div>
              <button type="button" onClick={() => setAssignModalOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {assignError && (
              <div style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', background: 'var(--error-bg)', color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {assignError}
              </div>
            )}

            <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                  Quick Select Registered Delivery Agent
                </label>
                <select
                  value={assignForm.deliveryPersonId}
                  onChange={(e) => handleSelectRosterAgent(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="">-- Custom / Unassigned --</option>
                  {roster.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.phone}) — {agent.zone}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                    Personnel Name *
                  </label>
                  <input
                    type="text"
                    value={assignForm.deliveryPersonName}
                    onChange={(e) => setAssignForm((p) => ({ ...p, deliveryPersonName: e.target.value }))}
                    placeholder="e.g. Suresh Kumar"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                    <span>Contact (10 digits) *</span>
                    <span style={{ color: assignForm.deliveryPersonPhone.length === 10 ? '#34d399' : '#fbbf24' }}>
                      {assignForm.deliveryPersonPhone.length}/10
                    </span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={assignForm.deliveryPersonPhone}
                    onChange={(e) => setAssignForm((p) => ({ ...p, deliveryPersonPhone: sanitizeMobileInput(e.target.value) }))}
                    placeholder="9845123456"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={assignForm.estimatedDeliveryDate}
                  onChange={(e) => setAssignForm((p) => ({ ...p, estimatedDeliveryDate: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-gold-light)' }}>
                  <input
                    type="checkbox"
                    checked={assignForm.isDelayed}
                    onChange={(e) => setAssignForm((p) => ({ ...p, isDelayed: e.target.checked }))}
                  />
                  <span>Mark Delivery as Delayed & Notify Customer</span>
                </label>
                {assignForm.isDelayed && (
                  <input
                    type="text"
                    value={assignForm.delayReason}
                    onChange={(e) => setAssignForm((p) => ({ ...p, delayReason: e.target.value }))}
                    placeholder="Reason (e.g. Heavy rain in transit zone, rescheduled by 24h)"
                    style={{ marginTop: '0.65rem', width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--gold-border)', color: '#fff', fontSize: '0.82rem' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setAssignModalOrder(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingId === assignModalOrder.id} className="btn btn-primary" style={{ flex: 1 }}>
                  <Send size={14} /> {savingId === assignModalOrder.id ? 'Saving...' : 'Save & Notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

