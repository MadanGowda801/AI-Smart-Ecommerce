import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from './NavigationContext';
import { useOrders } from './OrdersContext';
import { useAuth } from './AuthContext';
import ordersService from './ordersService';
import deliveryService from './deliveryService';
import {
  PRIMARY_DELIVERY_PIPELINE,
  normalizeDeliveryStatus,
  getDeliveryStatusMeta,
  getPipelineStepIndex,
  formatEstimatedDate,
  formatDeliveryTimestamp
} from './deliveryConstants';
import { formatMobileDisplay } from './phoneUtils';
import {
  ArrowLeft,
  Phone,
  ShieldCheck,
  Check,
  Loader,
  RefreshCw,
  MapPin,
  Package,
  Truck,
  Calendar,
  AlertTriangle,
  UserCheck,
  Clock
} from 'lucide-react';
import Breadcrumb from './Breadcrumb';

export default function OrderTrackingPage() {
  const { params, navigate } = useNavigation();
  const { orders, getOrderById, getOrderTimeline } = useOrders();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState('');

  const loadOrder = useCallback(
    async (orderId, refreshing = false) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const targetId = orderId || orders[0]?.id;
        if (!targetId) {
          setOrder(null);
          setTimeline([]);
          return;
        }

        // 1. Try authoritative Delivery API first (enforces ownership / RBAC)
        try {
          const res = await deliveryService.trackOrder(targetId, user);
          if (res?.ok && res.order) {
            setOrder({
              ...res.order,
              status: res.order.delivery_status || res.order.status,
              estimatedDeliveryDate: res.order.estimated_delivery_date,
              deliveryPersonName: res.order.delivery_person_name,
              deliveryPersonPhone: res.order.delivery_person_phone,
              deliveredAt: res.order.delivered_at,
              isDelayed: res.order.is_delayed,
              delayReason: res.order.delay_reason,
              shippingAddress: res.order.shipping_address || {}
            });
            setTimeline(res.timeline || []);
            return;
          }
        } catch {
          // Fall through to OrdersContext / InsForge DB
        }

        // 2. Fallback to OrdersContext / ordersService
        let ord = await getOrderById(targetId);
        if (!ord) {
          const { data, error: fetchErr } = await ordersService.getOrderById(targetId);
          if (fetchErr) {
            setError(fetchErr.message);
            return;
          }
          ord = data;
        }
        setOrder(ord);
        if (ord?.id) {
          const tl = await getOrderTimeline(ord.id);
          setTimeline(tl || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getOrderById, getOrderTimeline, orders, user]
  );

  useEffect(() => {
    loadOrder(params?.id);
  }, [params?.id, orders.length, loadOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchId.trim().replace(/^#+/, '');
    if (!q) return;
    const found = orders.find(
      (o) =>
        o.id.toLowerCase() === q.toLowerCase() ||
        o.id.slice(-8).toUpperCase() === q.toUpperCase()
    );
    if (found) {
      loadOrder(found.id);
      setSearchId('');
    } else {
      setError(`No order found in your account matching "#${q}". Customers can only track their own orders.`);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
        <Loader size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading delivery tracking details…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3.2rem', marginBottom: '1rem' }}>📦</div>
        <h2 style={{ marginBottom: '0.5rem' }}>No Orders to Track</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {error || "You haven't placed any orders yet."}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('products')}>
          Browse Products
        </button>
      </div>
    );
  }

  const canonicalStatus = normalizeDeliveryStatus(order.deliveryStatus || order.delivery_status || order.status);
  const statusMeta = getDeliveryStatusMeta(canonicalStatus);
  const currentStep = getPipelineStepIndex(canonicalStatus);
  const isException = ['cancelled', 'delivery_failed', 'return_requested', 'returned'].includes(canonicalStatus);
  const isDelivered = canonicalStatus === 'delivered';
  const displayId = String(order.id).slice(-8).toUpperCase();
  const addr = order.shippingAddress || order.shipping_address || {};

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem', maxWidth: '1040px' }}>
      <Breadcrumb
        items={[
          { label: 'My Orders', path: 'orders' },
          { label: `#${displayId}`, path: 'order-details', params: { id: order.id } },
          { label: 'Track My Order' }
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <button
            onClick={() => navigate('orders')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              marginBottom: '6px',
              padding: 0
            }}
          >
            <ArrowLeft size={16} /> Back to My Orders
          </button>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>
            Track My <span className="gradient-text">Order</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Order <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>#{displayId}</strong> · Verified Store Delivery Status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Enter your Order ID…"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                fontSize: '0.85rem'
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 14px', fontSize: '0.85rem' }}>
              Track
            </button>
          </form>
          <button
            onClick={() => loadOrder(order.id, true)}
            className="btn btn-secondary"
            style={{ padding: '0 12px', fontSize: '0.85rem' }}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Syncing' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.1rem',
            borderRadius: '12px',
            background: 'var(--error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          {error}
        </div>
      )}

      {/* Delayed Delivery Alert Banner */}
      {order.isDelayed && !isDelivered && canonicalStatus !== 'cancelled' && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '1rem 1.25rem',
            borderRadius: '14px',
            background: 'var(--warning-bg)',
            border: '1px solid var(--gold-border)',
            color: 'var(--accent-gold-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertTriangle size={22} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Delivery Delayed Notice</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {order.delayReason || 'Your order delivery is experiencing a slight delay. Our team is actively prioritizing dispatch.'}
            </div>
          </div>
        </div>
      )}

      {/* Main Delivery Tracking Card */}
      <div className="card-glass" style={{ padding: '26px', borderRadius: '18px', marginBottom: '22px' }}>
        {/* Summary Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '18px',
            paddingBottom: '22px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '28px'
          }}
        >
          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Delivery Status
            </span>
            <div style={{ marginTop: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  background: statusMeta.bg,
                  color: statusMeta.color,
                  fontWeight: 800,
                  fontSize: '0.84rem'
                }}
              >
                <span>{statusMeta.icon}</span> {statusMeta.label}
              </span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              {isDelivered ? 'Delivered Date & Time' : 'Estimated Delivery Date'}
            </span>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: isDelivered ? 'var(--success)' : 'var(--text-accent)',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Calendar size={15} />
              <span>
                {isDelivered && order.deliveredAt
                  ? formatDeliveryTimestamp(order.deliveredAt)
                  : formatEstimatedDate(order.estimatedDeliveryDate || order.estimatedDelivery)}
              </span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Delivery Personnel
            </span>
            <div style={{ marginTop: '6px' }}>
              {order.deliveryPersonName ? (
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <UserCheck size={14} color="var(--accent-primary)" /> {order.deliveryPersonName}
                  </div>
                  {order.deliveryPersonPhone && (
                    <a
                      href={`tel:${order.deliveryPersonPhone}`}
                      style={{ fontSize: '0.78rem', color: 'var(--text-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                    >
                      <Phone size={12} /> {formatMobileDisplay(order.deliveryPersonPhone)}
                    </a>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Will be assigned before dispatch</span>
              )}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Delivery Address
            </span>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.45 }}>
              <strong style={{ color: '#fff' }}>{addr.fullName || 'Customer'}</strong>
              <br />
              {addr.houseNumber || addr.addressLine}
              {addr.street ? `, ${addr.street}` : ''}
              {addr.landmark ? ` (Near ${addr.landmark})` : ''}
              <br />
              {addr.city}, {addr.state} — <strong>{addr.pincode}</strong>
            </div>
          </div>
        </div>

        {/* 6-Stage Delivery Progress Timeline */}
        {!isException ? (
          <div style={{ marginBottom: '34px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} color="var(--accent-primary)" />
              <span>Delivery Progress Timeline</span>
            </h3>
            <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PRIMARY_DELIVERY_PIPELINE.length}, 1fr)`, gap: '6px', minWidth: '600px' }}>
                {PRIMARY_DELIVERY_PIPELINE.map((step, idx) => {
                  const done = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step.key} style={{ textAlign: 'center', position: 'relative' }}>
                      {idx < PRIMARY_DELIVERY_PIPELINE.length - 1 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '17px',
                            left: '50%',
                            width: '100%',
                            height: '3px',
                            background: idx < currentStep ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                            zIndex: 1,
                            transition: 'background 0.4s'
                          }}
                        />
                      )}
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          margin: '0 auto 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: done
                            ? isCurrent
                              ? 'var(--accent-gradient)'
                              : 'var(--success)'
                            : 'rgba(255,255,255,0.06)',
                          border: isCurrent ? '3px solid rgba(94, 234, 212, 0.45)' : '1px solid var(--border-subtle)',
                          boxShadow: isCurrent ? 'var(--shadow-glow)' : 'none',
                          fontSize: '0.88rem',
                          color: done ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        {done && !isCurrent ? <Check size={16} strokeWidth={3} /> : <span>{step.icon}</span>}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: isCurrent ? 800 : 600,
                          color: isCurrent ? 'var(--text-accent)' : done ? 'var(--text-main)' : 'var(--text-muted)',
                          marginBottom: '2px'
                        }}
                      >
                        {step.label}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                        {step.shortDesc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginBottom: '28px',
              padding: '1.25rem',
              borderRadius: '14px',
              background: statusMeta.bg,
              border: `1px solid ${statusMeta.color}55`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div style={{ fontSize: '1.8rem' }}>{statusMeta.icon}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: statusMeta.color }}>
                Status: {statusMeta.label}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {order.deliveryNotes || statusMeta.shortDesc}
              </div>
            </div>
          </div>
        )}

        {/* Timestamped Delivery History Log */}
        <div>
          <h4
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} color="var(--accent-primary)" />
            <span>Status History Log ({timeline.length} update{timeline.length !== 1 ? 's' : ''})</span>
          </h4>

          {timeline.length === 0 ? (
            <div
              style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}
            >
              Order recorded on {formatDeliveryTimestamp(order.date || order.created_at)}. Status updates from Admin or Delivery Personnel will appear here with exact date & time.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {timeline.map((entry, idx) => {
                const entryMeta = getDeliveryStatusMeta(entry.status);
                const isLatest = idx === 0;
                return (
                  <div
                    key={entry.id || idx}
                    style={{
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                      padding: '13px 16px',
                      borderRadius: '12px',
                      background: isLatest ? 'var(--accent-soft)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isLatest ? 'var(--accent-border)' : 'var(--border-subtle)'}`
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: '6px',
                        background: entryMeta.color
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isLatest ? '#fff' : 'var(--text-secondary)' }}>
                          {entry.title || entryMeta.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-accent)', fontWeight: 600 }}>
                          {formatDeliveryTimestamp(entry.created_at)}
                        </span>
                      </div>
                      {entry.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {entry.description}
                        </div>
                      )}
                      {entry.location && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <MapPin size={11} /> {entry.location}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Buyer Assurance Footer Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', flexShrink: 0 }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Verified Delivery Confirmation</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Every delivery milestone is logged with exact date & time by authorized staff.</div>
          </div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Privacy Protected Tracking</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Order tracking & delivery addresses are strictly scoped to the verified customer and assigned agent.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
