import React, { useState, useEffect, useCallback } from 'react';
import { User, Package, MapPin, Edit2, Plus, Check, LogOut, Shield, Star, Heart, CheckCircle2, ShieldCheck, Database, Key, Sparkles, RefreshCw, Bell, TrendingDown, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useOrders } from './OrdersContext';
import { useNavigation } from './NavigationContext';
import { useRecommendations } from './RecommendationContext';
import Breadcrumb from './Breadcrumb';
import ProductCard from './ProductCard';
import { formatINR } from './productsService';
import { INITIAL_PRODUCTS } from './mockData';
import priceTrackerService from './priceTrackerService';
import { sanitizeMobileInput, validateMobileNumber, formatMobileDisplay } from './phoneUtils';

const TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'price-alerts', label: 'Price Alerts', icon: Bell },
  { id: 'recommendations', label: 'AI Recommendations', icon: Sparkles },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'settings', label: 'Settings & Profile', icon: Edit2 }
];

export function ProfilePage() {
  const { user, signOut, updateProfile } = useAuth();
  const { orders, addresses, saveAddress, deleteAddress, setDefaultAddress } = useOrders();
  const { navigate } = useNavigation();
  const { recommendations, sections, isLoading: isRecLoading, refreshRecommendations } = useRecommendations();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState('');
  const [newAddr, setNewAddr] = useState({
    label: 'Home',
    fullName: user?.name || '',
    phone: sanitizeMobileInput(user?.phone || ''),
    houseNumber: '',
    street: '',
    landmark: '',
    city: user?.city || '',
    state: 'Karnataka',
    pincode: '',
    is_default: false
  });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    city: user?.city || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!user?.id) return;
    
    // Immediate hydration from local storage for 0ms render
    try {
      const stored = JSON.parse(localStorage.getItem('smartshop_price_alerts') || '[]');
      const userStored = Array.isArray(stored) ? stored.filter((a) => a.user_id === user.id) : [];
      if (userStored.length > 0) {
        const immediateAlerts = userStored.map((a) => {
          const catalogMatch = INITIAL_PRODUCTS.find((p) => String(p.id) === String(a.product_id));
          const prod = a.products || catalogMatch || {};
          const curPrice = Number(prod.price || a.initial_price || 0);
          const targetPrice = Number(a.target_price || 0);
          const difference = curPrice - targetPrice;
          const percentAway = curPrice > 0 ? Math.round((difference / curPrice) * 100) : 0;
          return {
            id: a.id,
            productId: a.product_id,
            targetPrice,
            initialPrice: Number(a.initial_price || 0),
            currentPrice: curPrice,
            difference,
            percentAway: Math.max(0, percentAway),
            isTriggered: Boolean(a.is_triggered || curPrice <= targetPrice),
            triggeredAt: a.triggered_at,
            createdAt: a.created_at,
            product: {
              id: prod.id || a.product_id,
              name: prod.name || 'Catalog Product',
              image: prod.image || prod.image_url,
              stock: prod.stock ?? 10,
            },
            formattedCurrent: formatINR(curPrice),
            formattedTarget: formatINR(targetPrice),
            formattedInitial: formatINR(Number(a.initial_price || 0)),
          };
        });
        setAlerts(immediateAlerts);
      }
    } catch {}

    setAlertsLoading(true);
    try {
      const { data } = await priceTrackerService.getUserAlerts(user.id);
      if (data && data.length > 0) {
        setAlerts(data);
      }
    } catch {
      // keep immediate alerts
    } finally {
      setAlertsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'price-alerts') {
      loadAlerts();
    }
  }, [activeTab, loadAlerts]);

  const handleDeleteAlert = async (alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      await priceTrackerService.deletePriceAlert(alertId);
    } catch {}
  };

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
        city: user.city || ''
      });
    }
  }, [user]);

  if (!user) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
        <h2>Please Sign In</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>You need to be logged in with your InsForge account to view your profile.</p>
        <button className="btn btn-primary" onClick={() => navigate('login')}>Sign In Now</button>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    // Validate 10-digit mobile number if provided
    if (editForm.phone.trim()) {
      const phoneErr = validateMobileNumber(editForm.phone, false);
      if (phoneErr) {
        setSaveError(phoneErr);
        setIsSaving(false);
        return;
      }
    }

    try {
      const res = await updateProfile({
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        city: editForm.city.trim()
      });

      if (res.success) {
        setEditMode(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(res.error || 'Failed to update profile on InsForge.');
      }
    } catch (err) {
      setSaveError('Network error while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'My Account' }]} />

      {/* Profile Header */}
      <div className="card-glass" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, flexShrink: 0, boxShadow: 'var(--shadow-glow)', overflow: 'hidden' }}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (user.name || 'U').charAt(0).toUpperCase()
          )}
        </div>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{user.name}</h1>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: user.role === 'admin' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)', color: user.role === 'admin' ? '#fbbf24' : '#a5b4fc', padding: '0.2rem 0.55rem', borderRadius: '4px', textTransform: 'uppercase' }}>
              {user.role}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
              <ShieldCheck size={12} /> InsForge Session Active
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user.email}</div>
          {user.phone && <div style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', marginTop: '2px' }}>{user.phone}</div>}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>Member since {user.joinedDate}</div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user.role === 'admin' && (
            <button
              onClick={() => navigate('admin-dashboard')}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#fff',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Shield size={16} /> Admin Console
            </button>
          )}

          <div style={{ textAlign: 'center', padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a5b4fc' }}>{orders.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Orders</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }} className="profile-layout">
        {/* Sidebar Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: isActive ? 'var(--accent-soft)' : 'none', border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent', color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: isActive ? 700 : 500, fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition-fast)' }}
              >
                <Icon size={17} color={isActive ? 'var(--accent-primary)' : 'currentColor'} />
                {tab.label}
              </button>
            );
          })}
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />
          <button
            onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'none', border: '1px solid transparent', color: '#f87171', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={17} /> Sign Out
          </button>
        </nav>

        {/* Content Area */}
        <div className="card-glass" style={{ padding: '1.75rem', minHeight: '400px' }}>
          {activeTab === 'overview' && (
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.5rem' }}>Account Overview</h2>

              {/* InsForge Backend Security Card */}
              <div style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                marginBottom: '1.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Database size={18} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>InsForge Cloud Session Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>User ID: </span>
                    <code style={{ color: '#fff', fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                      {user.id}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Auth Method: </span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>Email + Password (Bcrypt/Argon2)</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Assigned Role: </span>
                    <span style={{ color: user.role === 'admin' ? '#fbbf24' : '#10b981', fontWeight: 700 }}>{user.role}</span>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>Recent Orders</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentOrders.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No orders placed yet.</p>
                ) : (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate('order-details', { params: { id: order.id } })}
                      style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{order.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '4px', background: order.status === 'Delivered' ? 'var(--success-bg)' : 'rgba(99,102,241,0.15)', color: order.status === 'Delivered' ? 'var(--success)' : '#a5b4fc' }}>
                          {order.status}
                        </span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.25rem' }}>{formatINR(order.pricing?.total || 0)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button onClick={() => navigate('orders')} className="btn btn-secondary" style={{ marginTop: '1.25rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                View All Orders
              </button>

              {/* Recommended For You Section in Overview */}
              {recommendations.length > 0 && (
                <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a5b4fc', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Sparkles size={13} color="#ec4899" />
                        <span>AI Recommended For You</span>
                      </div>
                      <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.2rem' }}>Picks Based On Your Activity</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('recommendations')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
                    >
                      View AI Recommendations Hub →
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {recommendations.slice(0, 3).map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.5rem' }}>All Orders</h2>
              {orders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>You haven't placed any orders yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {orders.map((order) => (
                    <div key={order.id} className="card-glass" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{order.id}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>{new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '4px', background: order.status === 'Delivered' ? 'var(--success-bg)' : order.status === 'Out for Delivery' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)', color: order.status === 'Delivered' ? 'var(--success)' : order.status === 'Out for Delivery' ? '#fbbf24' : '#a5b4fc' }}>
                          {order.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{formatINR(order.pricing?.total || 0)}</div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => navigate('order-details', { params: { id: order.id } })} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                            View Details
                          </button>
                          <button onClick={() => navigate('order-tracking', { params: { id: order.id } })} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                            Track Order
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'price-alerts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <ShieldCheck size={14} color="#10b981" />
                    <span>Verified Catalog Alerts</span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Active Price Alerts</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    Receive automated notifications as soon as verified catalog prices drop to your target.
                  </p>
                </div>
                <button onClick={loadAlerts} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <RefreshCw size={13} />
                  <span>Refresh</span>
                </button>
              </div>

              {alertsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading your price alerts...
                </div>
              ) : alerts.length === 0 ? (
                <div className="card-glass" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>No Active Price Alerts</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                    You haven't set any price drop alerts yet. Open any product in the catalog and click "Set Target Price Alert" to track prices.
                  </p>
                  <button onClick={() => navigate('products')} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
                    Browse Catalog
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="card-glass"
                      style={{
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: alert.isTriggered ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 280px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
                          <img
                            src={alert.product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}
                            alt={alert.product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>
                            {alert.product.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Current: <strong style={{ color: '#fff' }}>{alert.formattedCurrent}</strong>
                            </span>
                            <span style={{ color: '#818cf8', fontWeight: 600 }}>
                              Target: <strong>{alert.formattedTarget}</strong>
                            </span>
                            {alert.percentAway > 0 && !alert.isTriggered && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                {alert.percentAway}% drop needed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {alert.isTriggered ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)' }}>
                            🎯 Target Reached!
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', background: 'rgba(245,158,11,0.12)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)' }}>
                            Watching
                          </span>
                        )}

                        <button
                          onClick={() => navigate('product-details', { params: { id: alert.productId } })}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', gap: '0.3rem' }}
                        >
                          <ExternalLink size={13} />
                          <span>View Item</span>
                        </button>

                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.65rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                          title="Cancel Price Alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ec4899', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Sparkles size={14} color="#ec4899" />
                    <span>AI Behavioral Scoring Engine</span>
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>Your Personalized Recommendations</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    Dynamically ranked using InsForge user activity: category affinity, search tokens, cart & wishlist history, purchases, and ratings.
                  </p>
                </div>
                <button
                  onClick={() => refreshRecommendations()}
                  className="btn btn-secondary"
                  disabled={isRecLoading}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <RefreshCw size={14} className={isRecLoading ? 'spin' : ''} />
                  <span>{isRecLoading ? 'Recomputing...' : 'Refresh AI Scores'}</span>
                </button>
              </div>

              {/* Signals Explained Banner */}
              <div style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                marginBottom: '2rem'
              }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.5rem' }}>
                  ⚡ Multi-Signal Scoring Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <div>🎯 <strong>Category Preference</strong>: 30%</div>
                  <div>🔍 <strong>Search Keyword Intent</strong>: 20%</div>
                  <div>👆 <strong>Clicks & Views</strong>: 15%</div>
                  <div>🛒 <strong>Cart & Wishlist Affinity</strong>: 15%</div>
                  <div>📦 <strong>Purchase History</strong>: 10%</div>
                  <div>⭐ <strong>Rating & Popularity</strong>: 10%</div>
                </div>
              </div>

              {isRecLoading && recommendations.length === 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.5rem' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="card-glass" style={{ height: '320px', borderRadius: 'var(--radius-lg)', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              ) : recommendations.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.5rem' }}>
                  {recommendations.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Browse products or add items to your cart to calibrate your AI recommendations!</p>
                  <button onClick={() => navigate('products')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Explore Catalog</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Saved Delivery Addresses</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Manage addresses with House Number, Street, Landmark, State & PIN Code for faster checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddrForm((v) => !v); setAddrError(''); }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 1rem' }}
                >
                  <Plus size={15} /> {showAddrForm ? 'Cancel' : 'Add New Address'}
                </button>
              </div>

              {showAddrForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAddrError('');
                    if (!newAddr.fullName.trim()) { setAddrError('Full Name is required.'); return; }
                    const phoneErr = validateMobileNumber(newAddr.phone, true);
                    if (phoneErr) { setAddrError(phoneErr); return; }
                    if (!newAddr.houseNumber.trim()) { setAddrError('House Number is required.'); return; }
                    if (!newAddr.street.trim()) { setAddrError('Street is required.'); return; }
                    if (!newAddr.city.trim()) { setAddrError('City is required.'); return; }
                    if (!/^\d{6}$/.test(newAddr.pincode.trim())) { setAddrError('Enter a valid 6-digit PIN Code.'); return; }

                    setAddrSaving(true);
                    const { error: saveErr } = await saveAddress({
                      ...newAddr,
                      is_default: newAddr.is_default || addresses.length === 0
                    });
                    setAddrSaving(false);
                    if (saveErr) {
                      setAddrError(saveErr.message || 'Could not save address.');
                    } else {
                      setShowAddrForm(false);
                      setNewAddr({
                        label: 'Home',
                        fullName: user?.name || '',
                        phone: sanitizeMobileInput(user?.phone || ''),
                        houseNumber: '',
                        street: '',
                        landmark: '',
                        city: user?.city || '',
                        state: 'Karnataka',
                        pincode: '',
                        is_default: false
                      });
                    }
                  }}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-border)',
                    marginBottom: '1.5rem'
                  }}
                >
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>New Delivery Address</h3>
                  {addrError && (
                    <div style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', fontSize: '0.82rem', marginBottom: '1rem' }}>
                      {addrError}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Full Name *</label>
                      <input type="text" required value={newAddr.fullName} onChange={(e) => setNewAddr((p) => ({ ...p, fullName: e.target.value }))} placeholder="Rohan Verma" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                        <span>Mobile Number (10 digits) *</span>
                        <span style={{ color: newAddr.phone.length === 10 ? '#34d399' : '#fbbf24' }}>{newAddr.phone.length}/10</span>
                      </label>
                      <input type="tel" inputMode="numeric" maxLength={10} required value={newAddr.phone} onChange={(e) => setNewAddr((p) => ({ ...p, phone: sanitizeMobileInput(e.target.value) }))} placeholder="9876543210" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>House / Flat Number *</label>
                      <input type="text" required value={newAddr.houseNumber} onChange={(e) => setNewAddr((p) => ({ ...p, houseNumber: e.target.value }))} placeholder="Flat 402, Prestige Palms" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Street / Road *</label>
                      <input type="text" required value={newAddr.street} onChange={(e) => setNewAddr((p) => ({ ...p, street: e.target.value }))} placeholder="Whitefield Main Road" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Landmark</label>
                      <input type="text" value={newAddr.landmark} onChange={(e) => setNewAddr((p) => ({ ...p, landmark: e.target.value }))} placeholder="Near Forum Value Mall" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>City *</label>
                      <input type="text" required value={newAddr.city} onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))} placeholder="Bengaluru" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>State *</label>
                      <input type="text" required value={newAddr.state} onChange={(e) => setNewAddr((p) => ({ ...p, state: e.target.value }))} placeholder="Karnataka" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>PIN Code (6 digits) *</label>
                      <input type="text" inputMode="numeric" maxLength={6} required value={newAddr.pincode} onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="560066" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAddr.is_default} onChange={(e) => setNewAddr((p) => ({ ...p, is_default: e.target.checked }))} />
                      Set as default delivery address
                    </label>
                    <button type="submit" disabled={addrSaving} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.55rem 1.25rem' }}>
                      {addrSaving ? 'Saving...' : 'Save Address'}
                    </button>
                  </div>
                </form>
              )}

              {addresses.length === 0 ? (
                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    No saved delivery addresses yet. Add one for 1-click checkout.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      style={{
                        padding: '1.15rem',
                        background: addr.is_default ? 'var(--accent-soft)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${addr.is_default ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: '4px' }}>
                            {addr.label || 'Home'}
                          </span>
                          {addr.is_default && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-accent)', fontWeight: 800 }}>
                              ★ DEFAULT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>{addr.full_name || addr.fullName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '4px' }}>
                          {addr.house_number || addr.line1}
                          {addr.street ? `, ${addr.street}` : ''}
                          {addr.landmark ? ` (Near ${addr.landmark})` : ''}
                          <br />
                          {addr.city}, {addr.state} — <strong>{addr.pincode}</strong>
                          <br />
                          📞 {formatMobileDisplay(addr.phone)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(addr.id)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem' }}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteAddress(addr.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.35rem 0.7rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.28)' }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1.5rem' }}>Account & Profile Settings</h2>

              {saveSuccess && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}>
                  ✓ Profile updated and saved to InsForge backend!
                </div>
              )}

              {saveError && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.875rem' }}>
                  {saveError}
                </div>
              )}

              <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Display Name</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      disabled={isSaving}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary-color)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none' }}
                    />
                  ) : (
                    <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>{user.name}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    <span>Mobile Number (10 digits only)</span>
                    {editMode && editForm.phone && (
                      <span style={{ fontSize: '0.72rem', color: editForm.phone.length === 10 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                        {editForm.phone.length}/10 digits
                      </span>
                    )}
                  </label>
                  {editMode ? (
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={editForm.phone}
                      onKeyDown={(e) => {
                        if ((editForm.phone || '').length >= 10 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                          if (/^\d$/.test(e.key)) {
                            e.preventDefault();
                          }
                        }
                      }}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: sanitizeMobileInput(e.target.value) }))}
                      disabled={isSaving}
                      placeholder="10 digits only (e.g. 9876543210)"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary-color)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none' }}
                    />
                  ) : (
                    <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>{formatMobileDisplay(user.phone) || 'Not set'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Primary City</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                      disabled={isSaving}
                      placeholder="e.g. Bengaluru"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary-color)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none' }}
                    />
                  ) : (
                    <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>{user.city || 'Not set'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Email Address (InsForge User Identity)</label>
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{user.email}</div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                  {editMode ? (
                    <>
                      <button className="btn btn-primary" onClick={handleSaveProfile} disabled={isSaving} style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}>
                        {isSaving ? 'Saving to InsForge...' : <><Check size={15} /> Save Changes</>}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setEditMode(false)} disabled={isSaving} style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setEditMode(true)} style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}>
                      <Edit2 size={15} /> Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
