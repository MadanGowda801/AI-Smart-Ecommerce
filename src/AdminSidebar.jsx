import React from 'react';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Boxes,
  ShoppingBag,
  Users,
  TrendingUp,
  BarChart3,
  Store,
  LogOut,
  Shield,
  RotateCcw,
  Truck
} from 'lucide-react';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';

export function AdminSidebar() {
  const { currentPath, navigate } = useNavigation();
  const { signOut, user } = useAuth();

  const menuItems = [
    { id: 'admin-dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'admin-products', label: 'Product Catalog', icon: Package },
    { id: 'admin-add-product', label: 'Add New Product', icon: PlusCircle },
    { id: 'admin-inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'admin-orders', label: 'Orders & Fulfillment', icon: ShoppingBag },
    { id: 'admin-delivery', label: 'Delivery Management', icon: Truck },
    { id: 'admin-returns', label: 'Returns & Defects (AI)', icon: RotateCcw },
    { id: 'admin-users', label: 'Customer Management', icon: Users },
    { id: 'admin-sales-analytics', label: 'Sales Analytics', icon: TrendingUp },
    { id: 'admin-customer-analytics', label: 'Customer Analytics', icon: BarChart3 }
  ];

  return (
    <aside
      className="card-glass"
      style={{
        width: '260px',
        minHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 0.85rem',
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border-light)',
        flexShrink: 0
      }}
    >
      {/* Admin Profile Brief */}
      <div style={{ padding: '0.5rem 0.75rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Shield size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Admin Console</div>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>Super Admin Access</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className="admin-nav-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--accent-gradient)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Icon size={17} style={{ pointerEvents: 'none', flexShrink: 0 }} color={isActive ? '#fff' : 'currentColor'} />
              <span style={{ pointerEvents: 'none' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Switch to Storefront */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => navigate('home')}
          className="btn btn-secondary"
          style={{ width: '100%', fontSize: '0.825rem', padding: '0.55rem', gap: '0.5rem' }}
        >
          <Store size={15} color="#10b981" />
          <span>Exit to Storefront</span>
        </button>

        <button
          type="button"
          onClick={signOut}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-subtle)',
            fontSize: '0.8rem',
            padding: '0.4rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <LogOut size={14} />
          <span>Sign Out Admin</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
