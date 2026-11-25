import React, { useState, useRef, useEffect } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  Heart,
  Bell,
  User,
  Search,
  Bot,
  Shield,
  Menu,
  X,
  LogOut,
  Package,
  CheckCheck,
  Truck,
  CreditCard,
  AlertCircle,
  Inbox,
  Users,
  Trash2,
  Home,
  Grid,
  Sparkles
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import { useNotifications } from './NotificationContext';
import { useNavigation } from './NavigationContext';

function getNotifIcon(notif) {
  const t = (notif.title || '').toLowerCase();
  if (t.includes('added to cart')) return <ShoppingCart size={14} color="#10b981" />;
  if (
    t.includes('removed from cart') ||
    t.includes('cart cleared') ||
    t.includes('removed from catalog') ||
    t.includes('removed from wishlist')
  )
    return <Trash2 size={14} color="#f87171" />;
  if (t.includes('wishlist')) return <Heart size={14} color="#ec4899" />;
  if (
    t.includes('added to catalog') ||
    t.includes('product details updated') ||
    t.includes('stock updated')
  )
    return <Package size={14} color="#10b981" />;
  if (t.includes('payment confirmed') || t.includes('paid')) return <CreditCard size={14} color="#10b981" />;
  if (t.includes('payment fail')) return <AlertCircle size={14} color="#f87171" />;
  if (t.includes('shipped') || t.includes('dispatched')) return <Truck size={14} color="#818cf8" />;
  if (t.includes('delivered')) return <CheckCheck size={14} color="#10b981" />;
  if (t.includes('cancelled')) return <AlertCircle size={14} color="#f87171" />;
  if (notif.type === 'order') return <Package size={14} color="#fbbf24" />;
  return <Bell size={14} color="#818cf8" />;
}

export function NotificationBell({ navigate }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const preview = notifications.slice(0, 5);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        style={{ padding: '0.45rem 0.65rem', position: 'relative', borderRadius: '10px' }}
        onClick={() => setOpen((prev) => !prev)}
        title="Notifications"
      >
        <Bell
          size={17}
          style={{
            animation: unreadCount > 0 ? 'bellRing 2s ease-in-out infinite' : 'none',
            color: unreadCount > 0 ? '#818cf8' : 'currentColor'
          }}
        />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#6366f1',
              color: '#fff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            width: '340px',
            maxHeight: '440px',
            overflowY: 'auto',
            background: 'rgba(12, 18, 34, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'rgba(12, 18, 34, 0.98)',
              borderRadius: '16px 16px 0 0'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Bell size={15} color="#818cf8" />
              Notifications
              {unreadCount > 0 && (
                <span style={{ fontSize: '0.68rem', background: '#6366f1', color: '#fff', padding: '2px 7px', borderRadius: '10px', fontWeight: 700 }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.73rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {preview.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Inbox size={28} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
              <div style={{ fontSize: '0.83rem' }}>No notifications yet</div>
            </div>
          ) : (
            <div style={{ padding: '6px' }}>
              {preview.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    markAsRead(notif.id);
                    setOpen(false);
                    if (notif.link?.page)
                      navigate(notif.link.page, notif.link.params ? { params: notif.link.params } : undefined);
                    else navigate('notifications');
                  }}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    padding: '10px 11px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: notif.is_read ? 'transparent' : 'rgba(99,102,241,0.08)',
                    transition: 'background 0.15s',
                    marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = notif.is_read ? 'transparent' : 'rgba(99,102,241,0.08)')
                  }
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {getNotifIcon(notif)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: notif.is_read ? 500 : 700,
                          color: notif.is_read ? 'var(--text-secondary)' : '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {notif.title}
                      </span>
                      <span style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{notif.time}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {notif.message}
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: '5px' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              position: 'sticky',
              bottom: 0,
              background: 'rgba(12, 18, 34, 0.98)',
              borderRadius: '0 0 16px 16px'
            }}
          >
            <button
              onClick={() => {
                setOpen(false);
                navigate('notifications');
              }}
              style={{
                width: '100%',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.28)',
                color: '#a5b4fc',
                borderRadius: '10px',
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar({ onOpenChat, onOpenVoice, onOpenCoShopping }) {
  const { user, isAdmin, isDeliveryPersonnel, signOut } = useAuth();
  const { totalCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { currentPath, navigate } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('search', { query: { q: searchQuery.trim() } });
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  const navItems = [
    { label: 'Home', path: 'home', icon: Home },
    { label: 'Categories', path: 'categories', icon: Grid },
    { label: 'Products', path: 'products', icon: ShoppingBag },
    { label: 'My Orders', path: 'orders', icon: Package },
    { label: 'Profile', path: 'profile', icon: User }
  ];

  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          {/* Brand Logo */}
          <div
            className="brand-logo"
            style={{ cursor: 'pointer', flexShrink: 0 }}
            onClick={() => navigate('home')}
          >
            <div className="brand-icon">
              <ShoppingBag size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.18rem', fontWeight: 800, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: 'var(--text-main)' }}>Trust</span>
                <span className="gradient-text">Cart</span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    background: 'var(--accent-gradient)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    letterSpacing: '0.03em'
                  }}
                >
                  AI
                </span>
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                2026 Smart Commerce
              </div>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              flex: '1 1 250px',
              maxWidth: '340px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
            className="navbar-search-desktop"
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '13px',
                color: 'var(--accent-primary)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="AI search laptops, 5G phones, ANC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.9rem 0.5rem 2.25rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'all var(--transition-fast)'
              }}
            />
          </form>

          {/* Desktop Navigation Links */}
          <nav className="navbar-links-desktop">
            <ul className="nav-links" style={{ margin: 0, padding: 0 }}>
              {navItems.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <li
                    key={item.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <span>{item.label}</span>
                  </li>
                );
              })}

              {/* AI Shopping Assistant Nav Item */}
              <li
                className="nav-link"
                onClick={onOpenChat}
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--text-accent)'
                }}
              >
                <Sparkles size={14} color="var(--accent-primary)" />
                <span>AI Assistant</span>
              </li>

              {/* Delivery Portal Link (Delivery Personnel Only) */}
              {isDeliveryPersonnel && (
                <li
                  className={`nav-link ${currentPath === 'delivery-dashboard' ? 'active' : ''}`}
                  onClick={() => navigate('delivery-dashboard')}
                  style={{
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-border)',
                    color: 'var(--text-accent)'
                  }}
                >
                  <Truck size={14} color="var(--accent-primary)" />
                  <span>Delivery Portal</span>
                </li>
              )}

              {/* Admin Dashboard Link (Admin Only in Primary Nav) */}
              {isAdmin && (
                <li
                  className={`nav-link ${currentPath.startsWith('admin-') ? 'active' : ''}`}
                  onClick={() => navigate('admin-dashboard')}
                  style={{
                    background: 'var(--gold-soft)',
                    border: '1px solid var(--gold-border)',
                    color: 'var(--accent-gold-light)'
                  }}
                >
                  <Shield size={14} color="var(--accent-gold-light)" />
                  <span>Admin Dashboard</span>
                </li>
              )}
            </ul>
          </nav>

          {/* Right Action Icons & Badges */}
          <div className="nav-actions">
            {/* Co-Shop Live button */}
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.7rem',
                fontSize: '0.78rem',
                gap: '0.35rem',
                borderRadius: '10px',
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent-border)',
                color: 'var(--text-accent)'
              }}
              onClick={onOpenCoShopping}
              title="Real-Time Collaborative Co-Shopping"
            >
              <Users size={15} color="var(--accent-primary)" />
              <span className="hide-on-mobile">Co-Shop</span>
            </button>

            {/* Wishlist */}
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.65rem',
                position: 'relative',
                borderRadius: '10px',
                borderColor: currentPath === 'wishlist' ? 'var(--accent-gold)' : undefined
              }}
              onClick={() => navigate('wishlist')}
              title="Wishlist"
            >
              <Heart size={17} color={wishlistCount > 0 ? 'var(--accent-gold-light)' : 'currentColor'} fill={wishlistCount > 0 ? 'rgba(245,158,11,0.22)' : 'none'} />
              {wishlistCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'var(--amber-gradient)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.66rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}
                >
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Notifications Bell */}
            <NotificationBell navigate={navigate} />

            {/* Cart Icon & Badge */}
            <button
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.7rem',
                position: 'relative',
                borderRadius: '10px',
                borderColor: currentPath === 'cart' ? 'var(--accent-primary)' : undefined
              }}
              onClick={() => navigate('cart')}
              title="Shopping Cart"
            >
              <ShoppingCart size={17} color={totalCount > 0 ? 'var(--text-accent)' : 'currentColor'} />
              {totalCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: 'var(--accent-gradient)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '0.66rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}
                >
                  {totalCount}
                </span>
              )}
            </button>

            {/* User Profile / Sign In Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', gap: '0.4rem', borderRadius: '10px' }}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                title="Account & Profile"
              >
                <User size={15} />
                <span className="hide-on-mobile">
                  {user ? user.name?.split(' ')[0] || user.email?.split('@')[0] : 'Sign In'}
                </span>
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '240px',
                    background: 'rgba(12, 18, 34, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                  onClick={() => setUserMenuOpen(false)}
                >
                  {user ? (
                    <>
                      <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>{user.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{user.email}</div>
                        <div style={{ marginTop: '0.3rem' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                              color: isAdmin ? '#fbbf24' : '#a5b4fc',
                              border: `1px solid ${isAdmin ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              fontWeight: 700
                            }}
                          >
                            {user.role}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate('profile')}
                        style={{ background: 'none', border: 'none', color: '#fff', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <User size={15} color="#a5b4fc" />
                        <span>My Profile</span>
                      </button>

                      <button
                        onClick={() => navigate('orders')}
                        style={{ background: 'none', border: 'none', color: '#fff', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <Package size={15} color="#a5b4fc" />
                        <span>My Orders</span>
                      </button>

                      <button
                        onClick={() => navigate('wishlist')}
                        style={{ background: 'none', border: 'none', color: '#fff', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <Heart size={15} color="#ec4899" />
                        <span>Saved Wishlist ({wishlistCount})</span>
                      </button>

                      <button
                        onClick={() => navigate('order-tracking')}
                        style={{ background: 'none', border: 'none', color: '#fff', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <Truck size={15} color="#38bdf8" />
                        <span>Track Shipment</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => navigate('admin-dashboard')}
                          style={{ background: 'rgba(245, 158, 11, 0.1)', border: 'none', color: '#fbbf24', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Shield size={15} />
                          <span>Admin Dashboard</span>
                        </button>
                      )}

                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.25rem 0' }} />

                      <button
                        onClick={async () => {
                          await signOut();
                          navigate('home');
                        }}
                        style={{ background: 'none', border: 'none', color: '#f87171', padding: '0.55rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('login')}
                        style={{ background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Customer Sign In
                      </button>
                      <button
                        onClick={() => navigate('register')}
                        style={{ background: 'none', border: 'none', color: '#a5b4fc', padding: '0.6rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Create New Account
                      </button>
                      <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.25rem 0' }} />
                      <button
                        onClick={() => navigate('admin-login')}
                        style={{ background: 'none', border: 'none', color: '#fbbf24', padding: '0.6rem 0.75rem', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Shield size={14} /> Admin Portal Login
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              className="btn btn-secondary mobile-menu-toggle"
              style={{ padding: '0.45rem 0.65rem', borderRadius: '10px' }}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '1rem 0',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#818cf8' }} />
              <input
                type="text"
                placeholder="AI search products, brands, specs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.3rem',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontSize: '0.875rem'
                }}
              />
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    background: currentPath === item.path ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                    border: currentPath === item.path ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: currentPath === item.path ? '#fff' : 'var(--text-secondary)',
                    textAlign: 'left',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: currentPath === item.path ? 700 : 600,
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenChat) onOpenChat();
                }}
                style={{
                  background: 'rgba(99, 102, 241, 0.14)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: '#c7d2fe',
                  textAlign: 'left',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Bot size={15} /> AI Assistant
              </button>
              <button
                onClick={() => {
                  navigate('wishlist');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: currentPath === 'wishlist' ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Wishlist ({wishlistCount})
              </button>
              <button
                onClick={() => {
                  navigate('cart');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: currentPath === 'cart' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cart ({totalCount})
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    navigate('admin-dashboard');
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.14)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                    textAlign: 'left',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    gridColumn: 'span 2'
                  }}
                >
                  Admin Dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
