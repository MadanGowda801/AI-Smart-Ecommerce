import React, { useState, useEffect } from 'react';
import { ArrowLeft, Package, MapPin, CreditCard, Truck, Loader, RefreshCw, Clock, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOrders } from './OrdersContext';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';
import Breadcrumb from './Breadcrumb';
import { formatINR } from './productsService';
import ordersService from './ordersService';
import returnsService from './returnsService';
import ReturnRequestModal from './ReturnRequestModal';

const STATUS_STYLE = {
  placed:            { bg: 'rgba(56,189,248,0.12)',   color: '#38bdf8',  label: 'Pending' },
  payment_confirmed: { bg: 'rgba(52,211,153,0.12)',   color: '#34d399',  label: 'Payment Confirmed' },
  processing:        { bg: 'rgba(245,158,11,0.12)',   color: '#fbbf24',  label: 'Processing' },
  shipped:           { bg: 'rgba(99,102,241,0.12)',   color: '#818cf8',  label: 'Shipped' },
  out_for_delivery:  { bg: 'rgba(236,72,153,0.12)',   color: '#ec4899',  label: 'Out for Delivery' },
  delivered:         { bg: 'rgba(16,185,129,0.12)',   color: '#10b981',  label: 'Delivered' },
  cancelled:         { bg: 'rgba(239,68,68,0.12)',    color: '#f87171',  label: 'Cancelled' },
};

export function OrderDetailsPage() {
  const { params, navigate } = useNavigation();
  const { getOrderById, getOrderTimeline } = useOrders();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [orderReturn, setOrderReturn] = useState(null);

  const checkExistingReturn = async (orderId, userId) => {
    if (!userId || !orderId) return;
    try {
      const myReturns = await returnsService.getMyReturns(userId);
      const match = (myReturns || []).find(r => r.order_id === orderId);
      if (match) setOrderReturn(match);
    } catch (e) {
      // non-critical
    }
  };

  useEffect(() => {
    async function loadOrder() {
      if (!params?.id) { setError('Order ID not found'); setIsLoading(false); return; }
      setIsLoading(true);
      try {
        // Always fetch fresh from DB for details page
        const { data, error: fetchErr } = await ordersService.getOrderById(params.id);
        if (fetchErr) setError(fetchErr.message);
        else {
          setOrder(data);
          // Load timeline in parallel
          const tl = await getOrderTimeline(params.id);
          setTimeline(tl);
          if (user?.id) checkExistingReturn(params.id, user.id);
        }
      } catch (err) {
        setError(err.message || 'Failed to load order');
      } finally {
        setIsLoading(false);
      }
    }
    loadOrder();
  }, [params?.id]);

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Loader size={36} style={{ animation: 'spin 1s linear infinite', color: '#818cf8', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading order details…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
        <h2>Order Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {error || "This order doesn't exist or belongs to another account."}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('orders')}>
          <ArrowLeft size={16} /> Back to Orders
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[order.status?.toLowerCase()] || STATUS_STYLE.placed;
  const displayId = order.id.slice(-8).toUpperCase();

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[
        { label: 'My Orders', path: 'orders' },
        { label: `#${displayId}` }
      ]} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace' }}>Order #{displayId}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Placed on {new Date(order.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.78rem', background: statusStyle.bg, color: statusStyle.color }}>
            {statusStyle.label}
          </span>
        </div>
        <button onClick={() => navigate('order-tracking', { params: { id: order.id } })} className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
          <Truck size={16} /> Live Track Shipment
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.75rem', alignItems: 'flex-start' }} className="order-detail-layout">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Items */}
          <div className="card-glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={18} color="#818cf8" /> Order Items ({order.items.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.id && navigate('product-details', { params: { id: item.id } })}
                  style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: item.id ? 'pointer' : 'default' }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📦</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    {item.category && <div style={{ fontSize: '0.74rem', color: '#818cf8', marginBottom: '0.2rem' }}>{item.category}</div>}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>Quantity: {item.quantity}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, marginTop: '0.2rem' }}>{formatINR(item.price)} each</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>{formatINR(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="card-glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} color="#10b981" /> Delivery Address
            </h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.75 }}>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{order.shippingAddress.fullName}</strong><br />
              {order.shippingAddress.addressLine}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
              {order.shippingAddress.mobile && <><br />📞 {order.shippingAddress.mobile}</>}
            </div>
          </div>

          {/* Shipment Info */}
          <div className="card-glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={18} color="#ec4899" /> Shipment Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              {[
                { label: 'Courier Partner', value: order.courier },
                { label: 'AWB / Tracking No.', value: order.trackingNumber },
                { label: 'Current Status', value: statusStyle.label },
                { label: 'Estimated Delivery', value: order.estimatedDelivery },
                { label: 'Shipping Method', value: order.shippingMethod?.charAt(0).toUpperCase() + (order.shippingMethod?.slice(1) || '') },
                { label: 'Payment Method', value: order.paymentMethod }
              ].map((info) => (
                <div key={info.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{info.label}</div>
                  <div style={{ fontWeight: 700, wordBreak: 'break-all', fontSize: '0.85rem' }}>{info.value || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Timeline Preview */}
          {timeline.length > 0 && (
            <div className="card-glass" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="#fbbf24" /> Order Timeline
                </span>
                <button
                  onClick={() => navigate('order-tracking', { params: { id: order.id } })}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  View full tracking →
                </button>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {timeline.slice(0, 3).map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: i === 0 ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px', background: i === 0 ? '#818cf8' : '#10b981' }} />
                    <div>
                      <div style={{ fontWeight: i === 0 ? 700 : 600, fontSize: '0.82rem', color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{entry.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(entry.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                {timeline.length > 3 && (
                  <button onClick={() => navigate('order-tracking', { params: { id: order.id } })}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '8px', fontSize: '0.78rem', cursor: 'pointer', marginTop: '4px' }}>
                    + {timeline.length - 3} more events
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card-glass" style={{ padding: '1.5rem', position: 'sticky', top: '90px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={18} color="#818cf8" /> Invoice Summary
          </h3>

          {/* Payment */}
          <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Payment Method</div>
            <div style={{ fontWeight: 700 }}>{order.paymentMethod}</div>
            {order.transactionReference && (
              <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                Ref: {order.transactionReference}
              </div>
            )}
            <div style={{
              fontSize: '0.75rem',
              marginTop: '0.25rem',
              color: order.paymentStatus === 'paid' ? 'var(--success)' : order.paymentStatus === 'failed' ? '#f87171' : '#fbbf24',
              fontWeight: 600
            }}>
              {order.paymentStatus === 'paid' ? '✓ Paid' : order.paymentStatus === 'failed' ? '✗ Payment Failed' : order.paymentStatus === 'pending' ? 'Pending' : order.paymentStatus}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.855rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Subtotal</span><span>{formatINR(order.pricing.subtotal)}</span>
            </div>
            {order.pricing.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                <span>−{formatINR(order.pricing.discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Shipping</span>
              <span style={{ color: order.pricing.shipping === 0 ? 'var(--success)' : '#fff' }}>
                {order.pricing.shipping === 0 ? 'FREE' : formatINR(order.pricing.shipping)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>GST / Tax</span><span>{formatINR(order.pricing.tax)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem' }}>Amount {order.paymentStatus === 'paid' ? 'Paid' : 'Due'}</span>
            <span style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{formatINR(order.pricing.total)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {orderReturn ? (
              <div style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: orderReturn.status === 'approved' ? 'rgba(16,185,129,0.1)' :
                            orderReturn.status === 'rejected' ? 'rgba(239,68,68,0.1)' :
                            orderReturn.status === 'completed' ? 'rgba(56,189,248,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${orderReturn.status === 'approved' ? 'rgba(16,185,129,0.3)' :
                                      orderReturn.status === 'rejected' ? 'rgba(239,68,68,0.3)' :
                                      orderReturn.status === 'completed' ? 'rgba(56,189,248,0.3)' : 'rgba(245,158,11,0.3)'}`,
                fontSize: '0.82rem',
              }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', marginBottom: '0.25rem' }}>
                  <RotateCcw size={14} color="#818cf8" /> Return Status:
                  <span style={{
                    color: orderReturn.status === 'approved' ? '#34d399' :
                           orderReturn.status === 'rejected' ? '#f87171' :
                           orderReturn.status === 'completed' ? '#38bdf8' : '#fbbf24',
                    textTransform: 'uppercase',
                    fontSize: '0.78rem'
                  }}>
                    {orderReturn.status}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  Reason: {orderReturn.reason}
                </div>
                {orderReturn.admin_notes && (
                  <div style={{ marginTop: '0.35rem', color: '#e2e8f0', fontSize: '0.74rem', fontStyle: 'italic' }}>
                    Note: {orderReturn.admin_notes}
                  </div>
                )}
              </div>
            ) : (
              order.status?.toLowerCase() === 'delivered' && (
                <button
                  onClick={() => setIsReturnModalOpen(true)}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.875rem', padding: '0.75rem', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }}
                >
                  <RotateCcw size={16} /> Request Return / Report Defect
                </button>
              )
            )}

            {order.paymentStatus === 'failed' && (
              <button
                onClick={() => navigate('checkout', { params: { retryOrderId: order.id } })}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.875rem', padding: '0.75rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
              >
                <RefreshCw size={16} /> Retry Failed Payment
              </button>
            )}
            <button onClick={() => navigate('order-tracking', { params: { id: order.id } })} className="btn btn-primary" style={{ width: '100%', fontSize: '0.875rem', padding: '0.75rem' }}>
              <Truck size={16} /> Track Live Shipment
            </button>
            <button onClick={() => navigate('orders')} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.875rem', padding: '0.75rem' }}>
              <ArrowLeft size={16} /> All Orders
            </button>
          </div>
        </div>
      </div>

      {isReturnModalOpen && (
        <ReturnRequestModal
          isOpen={isReturnModalOpen}
          order={order}
          onClose={() => setIsReturnModalOpen(false)}
          onReturnSuccess={(newReq) => {
            setOrderReturn(newReq);
            setIsReturnModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default OrderDetailsPage;
