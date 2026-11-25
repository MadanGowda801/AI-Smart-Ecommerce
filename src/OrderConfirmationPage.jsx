import React, { useEffect, useState } from 'react';
import {
  CheckCircle, Package, Truck, MapPin, Calendar, CreditCard,
  ArrowRight, Copy, Check, ShoppingBag, ExternalLink, Printer, ShieldCheck
} from 'lucide-react';
import { useNavigation } from './NavigationContext';
import { useOrders } from './OrdersContext';
import ordersService from './ordersService';
import Breadcrumb from './Breadcrumb';
import { formatINR } from './productsService';

export default function OrderConfirmationPage() {
  const { params, navigate } = useNavigation();
  const { orders, getOrderById } = useOrders();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const orderId = params?.id || params?.orderId;

  useEffect(() => {
    let isMounted = true;

    async function fetchOrderDetails() {
      setIsLoading(true);
      setError(null);

      try {
        if (!orderId) {
          // If no ID passed, try grabbing latest order from context
          if (orders && orders.length > 0) {
            if (isMounted) setOrder(orders[0]);
          } else {
            const { data: userOrders } = await ordersService.getUserOrders();
            if (isMounted && userOrders && userOrders.length > 0) {
              setOrder(userOrders[0]);
            } else {
              if (isMounted) setError('No recent order found.');
            }
          }
          return;
        }

        // Try getting from context cached orders first
        const cached = await getOrderById(orderId);
        if (cached && isMounted) {
          setOrder(cached);
          setIsLoading(false);
          return;
        }

        // Query database directly
        const { data, error: dbErr } = await ordersService.getOrderById(orderId);
        if (dbErr) {
          if (isMounted) setError(dbErr.message || 'Unable to load order details');
        } else if (isMounted) {
          setOrder(data);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to retrieve order confirmation');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchOrderDetails();
    return () => { isMounted = false; };
  }, [orderId, orders, getOrderById]);

  const copyToClipboard = (text, type = 'id') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedTracking(true);
        setTimeout(() => setCopiedTracking(false), 2000);
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8',
          margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Confirming Your Order...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving receipt details from verified database...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Breadcrumb items={[{ label: 'Orders', path: 'orders' }, { label: 'Confirmation' }]} />
        <div className="card-glass" style={{ maxWidth: '500px', margin: '2rem auto', padding: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Order Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {error || "We couldn't locate the requested order details."}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('orders')}>
              View My Orders
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('products')}>
              Shop Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCOD = String(order.paymentMethod || '').toLowerCase().includes('cod');
  const isPaid = order.paymentStatus === 'paid' || !isCOD;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      <Breadcrumb items={[{ label: 'Orders', path: 'orders' }, { label: 'Confirmation' }]} />

      {/* Top Hero Card */}
      <div
        className="card-glass"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-lg, 18px)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.85) 70%)',
          marginBottom: '2rem',
          textAlign: 'center'
        }}
      >
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          color: '#fff'
        }}>
          <CheckCircle size={42} strokeWidth={2.5} />
        </div>

        <span style={{
          display: 'inline-block',
          padding: '0.35rem 0.9rem',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.18)',
          color: '#34d399',
          fontSize: '0.82rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '0.85rem'
        }}>
          Order Placed Successfully
        </span>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
          Thank You For Your <span className="gradient-text">Purchase!</span>
        </h1>

        <p style={{ maxWidth: '620px', margin: '0 auto 1.5rem', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.6 }}>
          We have received your order and initiated fulfillment. A confirmation has been registered to your account notifications.
        </p>

        {/* Quick Order Info Pill */}
        <div style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '0.85rem 1.4rem',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-subtle)' }}>Order ID:</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <button
              onClick={() => copyToClipboard(order.id, 'id')}
              title="Copy Full Order ID"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copiedId ? 'var(--success)' : 'var(--text-subtle)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              {copiedId ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <Calendar size={15} style={{ color: 'var(--accent, #6366f1)' }} />
            <span style={{ color: 'var(--text-subtle)' }}>Estimated Delivery:</span>
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>{order.estimatedDelivery}</span>
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <CreditCard size={15} style={{ color: isPaid ? 'var(--success)' : '#fbbf24' }} />
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: isPaid ? '#34d399' : '#fbbf24'
            }}>
              {isPaid ? 'PAID' : 'COD PENDING'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Details (Left) + Summary (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

        {/* Left Column: Tracking & Address & Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Delivery & Logistics Card */}
          <div className="card-glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md, 14px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', pb: '1rem', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Logistics & Dispatch</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', margin: 0 }}>Fulfillment via verified courier</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('order-tracking', { params: { id: order.id } })}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                Track Live <ArrowRight size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Courier Partner</span>
                <p style={{ fontWeight: 600, margin: '2px 0 0', fontSize: '0.9rem' }}>{order.courier}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Tracking Number</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.85rem' }}>
                    {order.trackingNumber}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.trackingNumber, 'tracking')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedTracking ? 'var(--success)' : 'var(--text-subtle)', padding: 0 }}
                  >
                    {copiedTracking ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Shipping Method</span>
                <p style={{ fontWeight: 600, margin: '2px 0 0', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                  {order.shippingMethod} Delivery
                </p>
              </div>
            </div>
          </div>

          {/* Shipping Address Card */}
          <div className="card-glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md, 14px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(236,72,153,0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Delivery Address</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', margin: 0 }}>Package will be delivered here</p>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.35rem' }}>
                {order.shippingAddress?.fullName || 'Valued Customer'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
                {order.shippingAddress?.addressLine || order.shippingAddress?.line1 || ''}
                {order.shippingAddress?.line2 ? `, ${order.shippingAddress.line2}` : ''}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.35rem' }}>
                {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
              </p>
              {order.shippingAddress?.mobile && (
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem', margin: 0 }}>
                  Phone: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{order.shippingAddress.mobile}</span>
                </p>
              )}
            </div>
          </div>

          {/* Purchased Items List */}
          <div className="card-glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md, 14px)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Items in this Order</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {order.items?.length || 0} {(order.items?.length === 1) ? 'item' : 'items'}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {(order.items || []).map((item, idx) => (
                <div
                  key={item.orderItemId || item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <img
                    src={item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop&q=80'}
                    alt={item.name}
                    style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', background: '#1e293b' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', margin: 0 }}>
                      Qty: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{item.quantity}</span> × {formatINR(item.price)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {formatINR((item.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Breakdown & Next Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Pricing Breakdown Card */}
          <div className="card-glass" style={{ padding: '1.75rem', borderRadius: 'var(--radius-md, 14px)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              Payment Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatINR(order.pricing?.subtotal || 0)}
                </span>
              </div>

              {(order.pricing?.discount > 0 || order.couponCode) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Coupon Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span style={{ fontWeight: 600 }}>−{formatINR(order.pricing?.discount || 0)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Shipping & Handling</span>
                <span style={{ fontWeight: 600, color: (order.pricing?.shipping || 0) === 0 ? 'var(--success)' : 'var(--text-main)' }}>
                  {(order.pricing?.shipping || 0) === 0 ? 'FREE' : `+${formatINR(order.pricing.shipping)}`}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>GST (5%)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {formatINR(order.pricing?.tax || 0)}
                </span>
              </div>

              <div style={{
                borderTop: '1px solid var(--border-light)',
                paddingTop: '1rem',
                marginTop: '0.35rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Grand Total</span>
                <span style={{ fontWeight: 900, fontSize: '1.6rem', color: '#fff', letterSpacing: '-0.02em' }}>
                  {formatINR(order.pricing?.total || 0)}
                </span>
              </div>
            </div>

            <div style={{
              marginTop: '1.25rem',
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem'
            }}>
              <ShieldCheck size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Payment Method: {order.paymentMethod}</p>
                {order.transactionReference && (
                  <p style={{ margin: '3px 0 0', color: '#38bdf8', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                    Txn Ref: {order.transactionReference}
                  </p>
                )}
                <p style={{ margin: '3px 0 0', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                  {isPaid ? 'Payment verified through secure checkout gateway.' : 'Please keep exact cash ready upon delivery.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="card-glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md, 14px)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('order-tracking', { params: { id: order.id } })}
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700 }}
            >
              <Truck size={18} />
              <span>Track Live Order</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => navigate('orders')}
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <Package size={18} />
              <span>View in My Orders</span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                className="btn btn-ghost"
                onClick={handlePrint}
                style={{ fontSize: '0.85rem', padding: '0.65rem', border: '1px solid var(--border-subtle)' }}
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => navigate('products')}
                style={{ fontSize: '0.85rem', padding: '0.65rem', border: '1px solid var(--border-subtle)' }}
              >
                <ShoppingBag size={15} />
                <span>Continue Shop</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
