import React, { useEffect, useState, useMemo } from 'react';
import { Package, ArrowRight, RefreshCw, X, Search, RotateCcw, AlertTriangle, CheckCircle2, Truck, Calendar, UserCheck } from 'lucide-react';
import { useOrders } from './OrdersContext';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import { formatINR } from './productsService';
import returnsService from './returnsService';
import ReturnRequestModal from './ReturnRequestModal';
import {
  getDeliveryStatusMeta,
  formatEstimatedDate,
  formatDeliveryTimestamp,
  normalizeDeliveryStatus
} from './deliveryConstants';

function getStatusStyle(status) {
  return getDeliveryStatusMeta(status);
}

function OrderSkeleton() {
  return (
    <div className="card-glass" style={{ padding: '1.5rem' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: '90px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', marginBottom: '1rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

export function OrdersPage() {
  const { orders, isLoading, error, fetchOrders, cancelOrder } = useOrders();
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const [cancellingId, setCancellingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [existingReturns, setExistingReturns] = useState({});

  const loadReturns = async () => {
    if (!user?.id) return;
    try {
      const list = await returnsService.getMyReturns(user.id);
      const map = {};
      (list || []).forEach(r => {
        map[r.order_id] = r;
      });
      setExistingReturns(map);
    } catch (e) {
      // Non-critical, ignore
    }
  };

  useEffect(() => {
    loadReturns();
  }, [user?.id]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const clean = searchQuery.trim().replace(/^#+/, '').toLowerCase();
    return orders.filter(order => {
      const fullId = (order.id || '').toLowerCase();
      const shortId = (order.id || '').slice(-8).toLowerCase();
      const startId = (order.id || '').slice(0, 8).toLowerCase();
      const ref = (order.transactionReference || '').toLowerCase();
      const courier = (order.courier || '').toLowerCase();
      const itemsMatch = (order.items || []).some(item =>
        (item.name || item.product?.name || '').toLowerCase().includes(clean)
      );
      return fullId.includes(clean) || shortId.includes(clean) || startId.includes(clean) || ref.includes(clean) || courier.includes(clean) || itemsMatch;
    });
  }, [orders, searchQuery]);

  useEffect(() => { fetchOrders(); }, []);

  const handleCancel = async (orderId) => {
    if (!confirm('Cancel this order?')) return;
    setCancellingId(orderId);
    await cancelOrder(orderId);
    setCancellingId(null);
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'My Orders' }]} />
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '2rem' }}>My <span className="gradient-text">Orders</span></h1>
        <OrderSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'My Orders' }]} />
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Failed to Load Orders</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchOrders}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'My Orders' }]} />
        <EmptyState
          icon={Package}
          title="No Orders Yet"
          description="You haven't placed any orders. Browse our catalog and make your first purchase!"
          actionLabel="Start Shopping"
          actionPath="products"
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'My Orders' }]} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>
          My <span className="gradient-text">Orders</span>
          <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
            ({orders.length} {orders.length === 1 ? 'order' : 'orders'})
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button className="btn btn-secondary" onClick={fetchOrders} style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('products')} style={{ fontSize: '0.875rem' }}>
            Continue Shopping
          </button>
        </div>
      </div>

      {/* Search Input for orders */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '420px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
        <input
          type="text"
          placeholder="Search by order ID (e.g. #EA244476), item, ref…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px 9px 36px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="card-glass" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: '12px' }}>
          <Package size={36} style={{ color: 'var(--text-subtle)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>No orders match "{searchQuery}"</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Try searching with fewer characters or without special symbols.
          </p>
          <button className="btn btn-secondary" onClick={() => setSearchQuery('')} style={{ fontSize: '0.8rem' }}>
            Clear Search
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredOrders.map((order) => {
          const canonicalStatus = normalizeDeliveryStatus(order.deliveryStatus || order.status);
          const statusStyle = getStatusStyle(canonicalStatus);
          const canCancel = ['order_placed', 'order_confirmed', 'packed'].includes(canonicalStatus);

          return (
            <div key={order.id} className="card-glass" style={{ padding: '1.5rem' }}>
              {/* Order Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.2rem' }}>
                    Placed on {new Date(order.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', fontFamily: 'monospace' }}>
                    #{order.id.slice(-8).toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <span>{order.paymentMethod}</span>
                    {canonicalStatus === 'delivered' && order.deliveredAt ? (
                      <span style={{ color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} /> Delivered on {formatDeliveryTimestamp(order.deliveredAt)}
                      </span>
                    ) : canonicalStatus !== 'cancelled' && (
                      <span style={{ color: 'var(--text-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} /> Est. Delivery: {formatEstimatedDate(order.estimatedDeliveryDate || order.estimatedDelivery)}
                      </span>
                    )}
                    {order.deliveryPersonName && (
                      <span style={{ color: 'var(--accent-gold-light)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <UserCheck size={13} /> Agent: {order.deliveryPersonName}
                      </span>
                    )}
                  </div>
                  {order.isDelayed && canonicalStatus !== 'delivered' && canonicalStatus !== 'cancelled' && (
                    <div style={{ marginTop: '0.45rem', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.14)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '3px 9px', borderRadius: '6px' }}>
                      <AlertTriangle size={12} /> Delivery Delayed: {order.delayReason || 'Schedule updated by fulfillment team'}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.28rem 0.7rem', borderRadius: 'var(--radius-full)', fontWeight: 700, fontSize: '0.73rem', background: statusStyle.bg, color: statusStyle.color }}>
                      <span>{statusStyle.icon}</span> {statusStyle.label}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      background: order.paymentStatus === 'paid' ? 'rgba(16,185,129,0.15)' : order.paymentStatus === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: order.paymentStatus === 'paid' ? '#34d399' : order.paymentStatus === 'failed' ? '#f87171' : '#fbbf24'
                    }}>
                      {order.paymentStatus === 'paid' ? '✓ Paid' : order.paymentStatus === 'failed' ? '✗ Payment Failed' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', marginTop: '0.2rem' }}>{formatINR(order.pricing.total)}</div>
                </div>
              </div>

              {/* Items Row */}
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {order.items.slice(0, 4).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Qty: {item.quantity} · {formatINR(item.price)}</div>
                    </div>
                  </div>
                ))}
                {order.items.length > 4 && (
                  <div style={{ padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center' }}>
                    +{order.items.length - 4} more
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                {existingReturns[order.id] ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '0.45rem 0.8rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: existingReturns[order.id].status === 'approved' ? 'rgba(16,185,129,0.15)' :
                                existingReturns[order.id].status === 'rejected' ? 'rgba(239,68,68,0.15)' :
                                existingReturns[order.id].status === 'completed' ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)',
                    color: existingReturns[order.id].status === 'approved' ? '#34d399' :
                           existingReturns[order.id].status === 'rejected' ? '#f87171' :
                           existingReturns[order.id].status === 'completed' ? '#38bdf8' : '#fbbf24',
                    border: '1px solid currentColor'
                  }}>
                    <RotateCcw size={13} />
                    Return {existingReturns[order.id].status.toUpperCase()}
                  </span>
                ) : (
                  order.status?.toLowerCase() === 'delivered' && (
                    <button
                      onClick={() => setReturnModalOrder(order)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }}
                      title="Request Defect Return within 7 days"
                    >
                      <RotateCcw size={14} /> Request Return
                    </button>
                  )
                )}

                {order.paymentStatus === 'failed' && (
                  <button
                    onClick={() => navigate('checkout', { params: { retryOrderId: order.id } })}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                  >
                    <RefreshCw size={14} /> Retry Payment
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={cancellingId === order.id}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    <X size={14} /> {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
                <button
                  onClick={() => navigate('order-confirmation', { params: { id: order.id } })}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                >
                  Confirmation
                </button>
                <button
                  onClick={() => navigate('order-tracking', { params: { id: order.id } })}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                >
                  <Truck size={14} /> Track My Order <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => navigate('order-details', { params: { id: order.id } })}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                >
                  View Invoice
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {returnModalOrder && (
        <ReturnRequestModal
          isOpen={!!returnModalOrder}
          order={returnModalOrder}
          onClose={() => setReturnModalOrder(null)}
          onReturnSuccess={() => {
            loadReturns();
          }}
        />
      )}
    </div>
  );
}

export default OrdersPage;
