import React from 'react';
import {
  Package,
  TrendingUp,
  Users,
  IndianRupee,
  Database,
  Server,
  Plus,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  RotateCcw,
  BarChart3,
  PieChart,
  MapPin,
  CreditCard,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useOrders } from './OrdersContext';
import { useNavigation } from './NavigationContext';
import { adminAnalytics, formatINR } from './mockData';

export function AdminDashboardPage() {
  const { products, categories } = useProducts();
  const { orders } = useOrders();
  const { navigate } = useNavigation();

  const lowStockProducts = products.filter((p) => p.stock <= 10);
  const kpis = adminAnalytics?.kpis || {
    totalSalesINR: 1845890,
    salesGrowth: 18.4,
    totalOrders: 284,
    ordersGrowth: 12.1,
    totalUsers: 1420,
    userGrowth: 24.5
  };
  const salesChart = adminAnalytics?.salesChart || [];
  const maxSales = Math.max(...salesChart.map((m) => m.amount || 1), 500000);
  const categoryPerformance = adminAnalytics?.categoryPerformance || [];
  const paymentMethods = adminAnalytics?.paymentMethods || [];
  const topCities = adminAnalytics?.topCities || [];
  const customerActivity = adminAnalytics?.customerActivity || [];

  return (
    <div style={{ padding: '0.5rem 0 3rem' }}>
      {/* Executive Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div>
          <span
            className="feature-tag"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--text-accent)',
              border: '1px solid var(--accent-border)'
            }}
          >
            2026 Enterprise Control Center
          </span>
          <h1 style={{ fontSize: '2.2rem', marginTop: '0.45rem', fontWeight: 800 }}>
            Admin & Analytics <span className="gradient-text">Dashboard</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
            Real-time revenue intelligence, 60-SKU catalog oversight, AI defect return reviews, and InsForge cloud telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('admin-add-product')}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.84rem' }}
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('admin-orders')}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.84rem' }}
          >
            <ShoppingBag size={16} color="#818cf8" />
            <span>Manage Orders ({orders.length})</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('admin-delivery')}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.84rem' }}
          >
            <ShoppingBag size={16} color="var(--accent-primary)" />
            <span>Delivery Management</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('admin-returns')}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.84rem' }}
          >
            <RotateCcw size={16} color="#38bdf8" />
            <span>Returns & AI Defect Portal</span>
          </button>
        </div>
      </div>

      {/* 1. Primary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}
      >
        <div className="card-glass" style={{ padding: '1.35rem', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total Gross Revenue
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <IndianRupee size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.55rem', color: '#ffffff' }}>
            {formatINR(kpis.totalSalesINR)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#34d399', marginTop: '0.35rem', fontWeight: 700 }}>
            <ArrowUpRight size={14} />
            <span>+{kpis.salesGrowth}% vs last month</span>
          </div>
        </div>

        <div
          className="card-glass"
          onClick={() => navigate('admin-orders')}
          style={{ padding: '1.35rem', borderLeft: '3px solid #6366f1', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total Orders Processed
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.55rem', color: '#ffffff' }}>
            {kpis.totalOrders}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#a5b4fc', marginTop: '0.35rem', fontWeight: 700 }}>
            <ArrowUpRight size={14} />
            <span>+{kpis.ordersGrowth}% growth • {orders.length} active in session</span>
          </div>
        </div>

        <div
          className="card-glass"
          onClick={() => navigate('admin-products')}
          style={{ padding: '1.35rem', borderLeft: '3px solid #38bdf8', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Catalog Products & SKUs
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Package size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.55rem', color: '#ffffff' }}>
            {products.length}
          </div>
          <div style={{ fontSize: '0.76rem', color: lowStockProducts.length > 0 ? '#fbbf24' : '#34d399', marginTop: '0.35rem', fontWeight: 700 }}>
            {categories.length} Categories • {lowStockProducts.length} Low-Stock Alerts
          </div>
        </div>

        <div
          className="card-glass"
          onClick={() => navigate('admin-users')}
          style={{ padding: '1.35rem', borderLeft: '3px solid #8b5cf6', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Registered Customers
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.55rem', color: '#ffffff' }}>
            {kpis.totalUsers.toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#c084fc', marginTop: '0.35rem', fontWeight: 700 }}>
            <ArrowUpRight size={14} />
            <span>+{kpis.userGrowth}% customer acquisition</span>
          </div>
        </div>
      </div>

      {/* 2. Charts Row: Monthly Revenue Bar Chart + Category Performance Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}
      >
        {/* Monthly Revenue & Orders Bar Chart */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} color="#818cf8" />
                <span>Monthly Revenue Growth (INR)</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                6-Month sales trajectory across all 6 product departments
              </p>
            </div>
            <button
              onClick={() => navigate('admin-sales-analytics')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Full Report →
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${salesChart.length || 6}, 1fr)`,
              gap: '0.85rem',
              alignItems: 'flex-end',
              height: '210px',
              paddingTop: '1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            {salesChart.map((m) => {
              const heightPct = Math.max(15, Math.round((m.amount / maxSales) * 100));
              return (
                <div
                  key={m.month}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                    gap: '6px'
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 700 }}>
                    ₹{Math.round(m.amount / 1000)}k
                  </span>
                  <div
                    title={`${m.month}: ${formatINR(m.amount)} (${m.orders} orders)`}
                    style={{
                      width: '100%',
                      maxWidth: '44px',
                      height: `${heightPct}%`,
                      borderRadius: '8px 8px 3px 3px',
                      background: 'var(--accent-gradient)',
                      boxShadow: 'var(--shadow-glow)',
                      transition: 'height 0.4s ease'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: '6px' }}>
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Performance Distribution */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={18} color="#38bdf8" />
                <span>Revenue by Category</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Share across all 6 tech categories (60 products)
              </p>
            </div>
            <button
              onClick={() => navigate('admin-products')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              Manage Catalog →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {categoryPerformance.map((cat) => (
              <div key={cat.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{cat.category}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {formatINR(cat.sales)} ({cat.percentage}%)
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '999px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${cat.percentage}%`,
                      height: '100%',
                      background: cat.color || '#6366f1',
                      borderRadius: '999px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Payment Methods, Top Indian Cities & Live Activity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}
      >
        {/* Payment Methods Breakdown */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={17} color="#10b981" />
            <span>Payment Gateway Breakdown</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {paymentMethods.map((pm) => (
              <div
                key={pm.name}
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>{pm.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pm.count} verified transactions</div>
                </div>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#34d399',
                    background: 'rgba(16, 185, 129, 0.14)',
                    padding: '3px 9px',
                    borderRadius: '8px'
                  }}
                >
                  {pm.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Cities Leaderboard */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={17} color="#818cf8" />
            <span>Top Indian Metro Markets</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {topCities.map((c, idx) => (
              <div
                key={c.city}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.025)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: idx < 3 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.06)',
                      color: idx < 3 ? '#a5b4fc' : 'var(--text-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{c.city}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.orders} orders</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a5b4fc' }}>
                    {formatINR(c.revenue)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{c.percentage}% share</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Storefront & Admin Feed */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={17} color="#38bdf8" />
            <span>Live Platform Activity</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {customerActivity.map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '0.7rem 0.85rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: '2px solid #6366f1'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 600, lineHeight: 1.4 }}>
                  {act.text}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {act.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Backend Infrastructure Status */}
      <div className="card-glass" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} color="#10b981" />
          <span>InsForge BaaS & AI Engine Telemetry</span>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-subtle)' }}>
                <th style={{ padding: '0.75rem' }}>Service Module</th>
                <th style={{ padding: '0.75rem' }}>Operational Status</th>
                <th style={{ padding: '0.75rem' }}>Architecture</th>
                <th style={{ padding: '0.75rem' }}>Security Layer</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 700 }}>PostgreSQL Catalog & Orders</td>
                <td style={{ padding: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>● Online ({products.length} SKUs)</td>
                <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>InsForge Cloud DB (ap-southeast)</td>
                <td style={{ padding: '0.75rem', color: '#a5b4fc' }}>Row-Level Security (RLS)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.75rem', fontWeight: 700 }}>AI Search, Voice & Defect Vision</td>
                <td style={{ padding: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>● Active</td>
                <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Hybrid LLM + Deterministic Engine</td>
                <td style={{ padding: '0.75rem', color: '#a5b4fc' }}>Server-Side Proxy</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem', fontWeight: 700 }}>Razorpay Sandbox & Dynamic Pricing</td>
                <td style={{ padding: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>● Verified</td>
                <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>HMAC-SHA256 Signature Verification</td>
                <td style={{ padding: '0.75rem', color: '#a5b4fc' }}>Authoritative Server Totals</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
