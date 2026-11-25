import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { useNotifications } from './NotificationContext';
import deliveryService from './deliveryService';
import {
  getDeliveryStatusMeta,
  formatEstimatedDate,
  formatDeliveryTimestamp
} from './deliveryConstants';
import { formatINR } from './productsService';
import { formatMobileDisplay } from './phoneUtils';
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Package,
  LogOut,
  Store,
  Clock,
  X
} from 'lucide-react';

export default function DeliveryDashboardPage() {
  const { user, signOut } = useAuth();
  const { navigate } = useNavigation();
  const { sendNotification } = useNotifications();

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Confirm Delivered or Failed modal
  const [actionModal, setActionModal] = useState(null); // { order, targetStatus: 'delivered' | 'delivery_failed' }
  const [actionNote, setActionNote] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAssigned = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await deliveryService.getAssignedDeliveries(user);
      setDeliveries(res.deliveries || []);
    } catch (err) {
      setError(err.message || 'Unable to load assigned deliveries');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const submitStatusUpdate = async (order, nextStatus, note = '') => {
    setUpdatingId(order.id);
    try {
      const res = await deliveryService.updateDeliveryStatus(
        {
          orderId: order.id,
          status: nextStatus,
          location: order.shipping_address?.city || 'Customer Delivery Area',
          notes: note || undefined
        },
        user
      );
      if (res?.ok) {
        const meta = getDeliveryStatusMeta(nextStatus);
        setDeliveries((prev) =>
          prev.map((d) => (d.id === order.id ? { ...d, ...res.order } : d))
        );
        showToast(`${meta.icon} Delivery #${String(order.id).slice(-8).toUpperCase()} marked as "${meta.label}"`);
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
      setUpdatingId(null);
      setActionModal(null);
      setActionNote('');
    }
  };

  const activeCount = deliveries.filter((d) => !['delivered', 'cancelled', 'returned'].includes(d.delivery_status)).length;
  const outCount = deliveries.filter((d) => d.delivery_status === 'out_for_delivery').length;
  const deliveredCount = deliveries.filter((d) => d.delivery_status === 'delivered').length;
  const failedCount = deliveries.filter((d) => d.delivery_status === 'delivery_failed').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Topbar */}
      <header
        style={{
          background: 'var(--bg-navbar)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(16px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="brand-icon" style={{ width: '38px', height: '38px' }}>
            <Truck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
              TrustCart <span className="gradient-text">Delivery Partner</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-accent)', fontWeight: 600 }}>
              Agent: {user?.name || user?.email}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button onClick={loadAssigned} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => navigate('home')} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
            <Store size={14} /> Storefront
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate('home');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <main className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
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

        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            My Assigned <span className="gradient-text">Deliveries</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            You can view and update only deliveries explicitly assigned to your account.
          </p>
        </div>

        {/* Agent KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div className="card-glass" style={{ padding: '1rem', borderLeft: '3px solid var(--accent-primary)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Assigned</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{activeCount}</div>
          </div>
          <div className="card-glass" style={{ padding: '1rem', borderLeft: '3px solid var(--accent-gold)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Out for Delivery</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-gold-light)', marginTop: '4px' }}>{outCount}</div>
          </div>
          <div className="card-glass" style={{ padding: '1rem', borderLeft: '3px solid var(--success)' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed Delivered</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{deliveredCount}</div>
          </div>
          <div className="card-glass" style={{ padding: '1rem', borderLeft: '3px solid #f87171' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Delivery Failed</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>{failedCount}</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--error-bg)', color: '#f87171', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="card-glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading your assigned deliveries…
          </div>
        ) : deliveries.length === 0 ? (
          <div className="card-glass" style={{ padding: '3rem', textAlign: 'center' }}>
            <Package size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ marginBottom: '0.35rem' }}>No Deliveries Assigned Yet</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              When an administrator assigns deliveries to your account, they will appear here automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {deliveries.map((order) => {
              const meta = getDeliveryStatusMeta(order.delivery_status);
              const addr = order.shipping_address || {};
              const isDelivered = order.delivery_status === 'delivered';
              const isCancelled = order.delivery_status === 'cancelled';
              const busy = updatingId === order.id;

              return (
                <div
                  key={order.id}
                  className="card-glass"
                  style={{
                    padding: '1.35rem',
                    borderLeft: `4px solid ${meta.color}`
                  }}
                >
                  {/* Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
                          Order #{String(order.id).slice(-8).toUpperCase()}
                        </span>
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700, background: meta.bg, color: meta.color }}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-accent)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} /> Est. Delivery: {formatEstimatedDate(order.estimated_delivery_date)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff' }}>{formatINR(order.total_amount)}</div>
                      <div style={{ fontSize: '0.74rem', color: order.payment_status === 'paid' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        {order.payment_status === 'paid' ? 'Prepaid (Paid)' : `Collect on Delivery (${order.payment_method})`}
                      </div>
                    </div>
                  </div>

                  {/* Customer Contact & Full Address */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                        Customer Details
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#fff' }}>{order.customer_name}</div>
                      <a
                        href={`tel:${order.customer_phone || addr.mobile}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.84rem', color: 'var(--text-accent)', fontWeight: 700 }}
                      >
                        <Phone size={14} /> {formatMobileDisplay(order.customer_phone || addr.mobile)}
                      </a>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="var(--accent-primary)" /> Delivery Address
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {addr.houseNumber || addr.addressLine}
                        {addr.street ? `, ${addr.street}` : ''}
                        {addr.landmark ? ` (Landmark: ${addr.landmark})` : ''}
                        <br />
                        {addr.city}, {addr.state} — <strong style={{ color: '#fff' }}>PIN {order.delivery_pincode || addr.pincode}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Delivered Timestamp or Agent Actions */}
                  {isDelivered ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={17} />
                      <span>Delivered & Confirmed on {formatDeliveryTimestamp(order.delivered_at || order.updated_at)}</span>
                    </div>
                  ) : !isCancelled && (
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {order.delivery_status !== 'shipped' && order.delivery_status !== 'out_for_delivery' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitStatusUpdate(order, 'shipped', 'Picked up & dispatched by delivery partner')}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
                        >
                          🚚 Mark Shipped
                        </button>
                      )}

                      {order.delivery_status !== 'out_for_delivery' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitStatusUpdate(order, 'out_for_delivery', 'Delivery partner is en route to customer address')}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', borderColor: 'var(--gold-border)', color: 'var(--accent-gold-light)' }}
                        >
                          🛵 Out for Delivery
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setActionModal({ order, targetStatus: 'delivered' }); setActionNote('Handed directly to recipient at doorstep'); }}
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem' }}
                      >
                        <CheckCircle2 size={15} /> Confirm Delivered
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setActionModal({ order, targetStatus: 'delivery_failed' }); setActionNote(''); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.35)' }}
                      >
                        <AlertTriangle size={14} /> Delivery Failed
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirm Delivered / Failed Modal */}
      {actionModal && (
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
          onClick={() => setActionModal(null)}
        >
          <div
            className="card-glass"
            style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--accent-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>
                {actionModal.targetStatus === 'delivered' ? 'Confirm Order Delivery' : 'Report Failed Delivery'}
              </h3>
              <button type="button" onClick={() => setActionModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Order #{String(actionModal.order.id).slice(-8).toUpperCase()} for <strong>{actionModal.order.customer_name}</strong>.
              <br />
              <span style={{ color: 'var(--text-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <Clock size={12} /> Timestamp will be recorded automatically ({new Date().toLocaleString('en-IN')})
              </span>
            </p>

            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              {actionModal.targetStatus === 'delivered' ? 'Delivery Confirmation Note' : 'Reason for Failed Delivery *'}
            </label>
            <textarea
              rows={3}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={actionModal.targetStatus === 'delivered' ? 'e.g. Received by customer at doorstep' : 'e.g. Customer unreachable / Door locked'}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem', marginBottom: '1.25rem', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button type="button" onClick={() => setActionModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId === actionModal.order.id || (actionModal.targetStatus === 'delivery_failed' && !actionNote.trim())}
                onClick={() => submitStatusUpdate(actionModal.order, actionModal.targetStatus, actionNote)}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: actionModal.targetStatus === 'delivery_failed' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined
                }}
              >
                {actionModal.targetStatus === 'delivered' ? 'Confirm Delivered' : 'Record Failed Attempt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

