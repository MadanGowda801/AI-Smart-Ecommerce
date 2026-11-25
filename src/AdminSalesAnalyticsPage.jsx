import React, { useState, useEffect, useCallback } from 'react';
import { formatINR } from './mockData';
import AdminHeader from './AdminHeader';
import { useNavigation } from './NavigationContext';
import {
  fetchDashboardKPIs,
  fetchDailyRevenue,
  fetchWeeklyRevenue,
  fetchMonthlyRevenue,
  fetchCategoryPerformance,
  fetchPaymentMethodDistribution,
  fetchOrderStatusBreakdown,
  fetchTopProducts,
  fetchTopProductsByUnits,
  fetchLowStockProducts,
} from './adminAnalyticsService';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  CreditCard,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Package,
  AlertTriangle,
  Boxes,
  Layers,
  ChevronRight,
} from 'lucide-react';

const STATUS_LABELS = {
  placed:            'Placed',
  payment_confirmed: 'Payment Confirmed',
  processing:        'Processing',
  shipped:           'Shipped',
  out_for_delivery:  'Out for Delivery',
  delivered:         'Delivered',
  cancelled:         'Cancelled',
  pending:           'Pending',
};

export default function AdminSalesAnalyticsPage() {
  const { navigate } = useNavigation();

  // Granularity & Range State
  const [granularity, setGranularity] = useState('monthly'); // 'daily' | 'weekly' | 'monthly'
  const [dailyRange, setDailyRange] = useState(30);           // 7, 14, 30
  const [weeklyRange, setWeeklyRange] = useState(12);         // 6, 12
  const [monthlyRange, setMonthlyRange] = useState(6);        // 3, 6, 12

  // Top products toggle: 'revenue' | 'units'
  const [topProductMode, setTopProductMode] = useState('revenue');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // Data states
  const [kpis, setKpis] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [categoryPerf, setCategoryPerf] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState({});
  const [topProductsRevenue, setTopProductsRevenue] = useState([]);
  const [topProductsUnits, setTopProductsUnits] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Fetch sales chart data specifically when granularity or period changes
  const loadChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      let res;
      if (granularity === 'daily') {
        res = await fetchDailyRevenue(dailyRange);
      } else if (granularity === 'weekly') {
        res = await fetchWeeklyRevenue(weeklyRange);
      } else {
        res = await fetchMonthlyRevenue(monthlyRange);
      }
      if (res?.data) {
        setSalesChart(res.data);
      }
    } catch (err) {
      console.error('[AdminSalesAnalytics] Chart error:', err);
    } finally {
      setChartLoading(false);
    }
  }, [granularity, dailyRange, weeklyRange, monthlyRange]);

  // Load all other analytics on mount or manual refresh
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        kpisRes,
        catRes,
        pmRes,
        statusRes,
        topRevRes,
        topUnitsRes,
        lowStockRes,
      ] = await Promise.all([
        fetchDashboardKPIs(),
        fetchCategoryPerformance(),
        fetchPaymentMethodDistribution(),
        fetchOrderStatusBreakdown(),
        fetchTopProducts(8),
        fetchTopProductsByUnits(8),
        fetchLowStockProducts(10, 8),
      ]);

      if (kpisRes.data) setKpis(kpisRes.data);
      if (catRes.data) setCategoryPerf(catRes.data);
      if (pmRes.data) setPaymentMethods(pmRes.data);
      if (statusRes.data) setStatusBreakdown(statusRes.data);
      if (topRevRes.data) setTopProductsRevenue(topRevRes.data);
      if (topUnitsRes.data) setTopProductsUnits(topUnitsRes.data);
      if (lowStockRes.data) setLowStockList(lowStockRes.data);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[AdminSalesAnalytics] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Chart metrics
  const maxChartVal = salesChart.length > 0 ? Math.max(...salesChart.map(s => s.amount || 0), 1) : 1;
  const chartTotalRevenue = salesChart.reduce((sum, item) => sum + (item.amount || 0), 0);
  const chartTotalOrders = salesChart.reduce((sum, item) => sum + (item.orders || 0), 0);
  const activeTopProducts = topProductMode === 'revenue' ? topProductsRevenue : topProductsUnits;
  const totalStatusCount = Object.values(statusBreakdown).reduce((s, v) => s + (v.count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <AdminHeader
        title="Sales & Revenue Intelligence"
        subtitle="Gross merchandise value, time-filtered revenue, unit volume & inventory warnings"
        actionButton={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {lastRefreshed && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => {
                loadAllData();
                loadChartData();
              }}
              disabled={loading || chartLoading}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw
                size={14}
                style={{ animation: loading || chartLoading ? 'spin 1s linear infinite' : 'none' }}
              />
              Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('admin-orders')}
              style={{ fontSize: '0.85rem' }}
            >
              Manage Orders
            </button>
          </div>
        }
      />

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Revenue */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Total Revenue
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
            {formatINR(kpis?.totalRevenue ?? 0)}
          </div>
          {kpis?.revenueGrowth !== null && kpis?.revenueGrowth !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                color: kpis.revenueGrowth >= 0 ? '#10b981' : '#f87171',
                marginTop: '6px',
              }}
            >
              {kpis.revenueGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {kpis.revenueGrowth >= 0 ? '+' : ''}
              {kpis.revenueGrowth}% vs last month
            </div>
          )}
        </div>

        {/* Total Orders */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Total Orders
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <ShoppingBag size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {(kpis?.totalOrders ?? 0).toLocaleString()}
          </div>
          {kpis?.ordersGrowth !== null && kpis?.ordersGrowth !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                color: kpis.ordersGrowth >= 0 ? '#60a5fa' : '#f87171',
                marginTop: '6px',
              }}
            >
              {kpis.ordersGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {kpis.ordersGrowth >= 0 ? '+' : ''}
              {kpis.ordersGrowth}% vs last month
            </div>
          )}
        </div>

        {/* Products Sold (Total Units) */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Products Sold
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a78bfa',
              }}
            >
              <Package size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {(kpis?.totalUnitsSold ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Units fulfilled across orders
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Avg. Order Value
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(236, 72, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f472b6',
              }}
            >
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {formatINR(kpis?.avgOrderValue ?? 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Per completed checkout
          </div>
        </div>

        {/* Low Stock Warning Card */}
        <div
          className="card-glass"
          onClick={() => navigate('admin-inventory')}
          style={{
            padding: '20px',
            borderRadius: '14px',
            cursor: 'pointer',
            border: (kpis?.lowStockCount ?? 0) > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : undefined,
            transition: 'transform 0.2s ease, border-color 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>
              Low-Stock Items
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
              }}
            >
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#f87171' }}>
            {kpis?.lowStockCount ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            Needs restocking <ChevronRight size={13} />
          </div>
        </div>
      </div>

      {/* Sales Over Time: Granularity Switcher & Interactive Chart */}
      <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                {granularity === 'daily'
                  ? `Daily Sales (Last ${dailyRange} Days)`
                  : granularity === 'weekly'
                  ? `Weekly Sales (Last ${weeklyRange} Weeks)`
                  : `Monthly Sales Trend (${monthlyRange} Months)`}
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Period Revenue: <strong style={{ color: '#10b981' }}>{formatINR(chartTotalRevenue)}</strong> across{' '}
              <strong>{chartTotalOrders}</strong> orders
            </p>
          </div>

          {/* Granularity & Interval Switchers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Granularity Type */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {[
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ].map(g => (
                <button
                  key={g.id}
                  onClick={() => setGranularity(g.id)}
                  style={{
                    background: granularity === g.id ? 'var(--primary-color)' : 'transparent',
                    color: granularity === g.id ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Sub-period Range Selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {granularity === 'daily' &&
                [7, 14, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setDailyRange(d)}
                    style={{
                      background: dailyRange === d ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      color: dailyRange === d ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {d}D
                  </button>
                ))}

              {granularity === 'weekly' &&
                [6, 12].map(w => (
                  <button
                    key={w}
                    onClick={() => setWeeklyRange(w)}
                    style={{
                      background: weeklyRange === w ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      color: weeklyRange === w ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {w}W
                  </button>
                ))}

              {granularity === 'monthly' &&
                [3, 6, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setMonthlyRange(m)}
                    style={{
                      background: monthlyRange === m ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      color: monthlyRange === m ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m}M
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        {chartLoading ? (
          <div
            style={{
              height: '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
            Loading period sales data…
          </div>
        ) : salesChart.length > 0 && salesChart.some(s => s.amount > 0) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '240px',
              paddingTop: '30px',
              gap: salesChart.length > 20 ? '4px' : '8px',
              overflowX: 'auto',
            }}
          >
            {salesChart.map((item, idx) => {
              const amount = item.amount || 0;
              const heightPct = Math.max(4, Math.round((amount / maxChartVal) * 100));
              const isHighest = amount > 0 && amount === maxChartVal;
              const label = item.label || item.month || item.date || `P${idx + 1}`;

              return (
                <div
                  key={`${label}-${idx}`}
                  style={{
                    flex: 1,
                    minWidth: salesChart.length > 20 ? '16px' : '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    position: 'relative',
                  }}
                  title={`${label}: ${formatINR(amount)} (${item.orders || 0} orders)`}
                >
                  {/* Amount label on hover or if highest */}
                  {amount > 0 && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: isHighest ? '#10b981' : 'var(--text-secondary)',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {amount >= 100000 ? `₹${(amount / 100000).toFixed(1)}L` : `₹${Math.round(amount / 1000)}k`}
                    </span>
                  )}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        background: isHighest
                          ? 'linear-gradient(180deg, #10b981 0%, var(--primary-color) 100%)'
                          : amount > 0
                          ? 'rgba(124, 58, 237, 0.45)'
                          : 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: isHighest ? '#fff' : 'var(--text-secondary)',
                      marginTop: '6px',
                      whiteSpace: 'nowrap',
                      fontWeight: isHighest ? 700 : 500,
                    }}
                  >
                    {salesChart.length > 20 && idx % 3 !== 0 ? '' : label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              height: '220px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              gap: '8px',
            }}
          >
            <Calendar size={28} style={{ opacity: 0.4 }} />
            <span>No settled revenue recorded in this specific time window.</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              Orders with completed or confirmed payments appear here automatically.
            </span>
          </div>
        )}
      </div>

      {/* Row 2: Top Categories & Order Status Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Category Revenue Performance */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Top Categories</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Revenue & unit volume aggregated across line items
              </p>
            </div>
            <PieChart size={20} style={{ color: 'var(--primary-color)' }} />
          </div>

          {categoryPerf.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {categoryPerf.map(cat => (
                <div key={cat.category}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      marginBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: cat.color,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{cat.category}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700 }}>{formatINR(cat.sales)}</span>
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          marginLeft: '8px',
                          fontSize: '0.8rem',
                        }}
                      >
                        ({cat.units} sold • {cat.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${cat.percentage}%`,
                        background: cat.color,
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              No category sales data yet.
            </div>
          )}
        </div>

        {/* Order Status Distribution */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Order Status Distribution
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Fulfillment workflow breakdown ({totalStatusCount} total orders)
              </p>
            </div>
            <ShieldCheck size={20} style={{ color: '#10b981' }} />
          </div>

          {totalStatusCount > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {Object.entries(statusBreakdown)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([status, info]) => {
                  const pct = Math.round((info.count / totalStatusCount) * 100);
                  const color =
                    status === 'delivered'
                      ? '#10b981'
                      : status === 'cancelled'
                      ? '#f87171'
                      : status === 'shipped' || status === 'out_for_delivery'
                      ? '#a78bfa'
                      : status === 'payment_confirmed'
                      ? '#34d399'
                      : '#fbbf24';

                  return (
                    <div key={status}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem',
                          marginBottom: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: color,
                            }}
                          />
                          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {STATUS_LABELS[status] || status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600 }}>{info.count} orders</span>
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              marginLeft: '8px',
                              fontSize: '0.8rem',
                            }}
                          >
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: '7px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: color,
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              No orders recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Top Products & Low Stock Products */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Top Products (Toggle: Revenue vs Units) */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Top Performing Products
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Sorted by {topProductMode === 'revenue' ? 'total revenue generated' : 'units sold'}
              </p>
            </div>

            {/* Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                onClick={() => setTopProductMode('revenue')}
                style={{
                  background: topProductMode === 'revenue' ? 'var(--primary-color)' : 'transparent',
                  color: topProductMode === 'revenue' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                By Revenue
              </button>
              <button
                onClick={() => setTopProductMode('units')}
                style={{
                  background: topProductMode === 'units' ? 'var(--primary-color)' : 'transparent',
                  color: topProductMode === 'units' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                By Units Sold
              </button>
            </div>
          </div>

          {activeTopProducts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeTopProducts.map((prod, idx) => (
                <div
                  key={prod.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '8px',
                      background:
                        idx === 0
                          ? 'var(--primary-color)'
                          : idx === 1
                          ? 'rgba(139, 92, 246, 0.35)'
                          : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  {prod.image ? (
                    <img
                      src={prod.image}
                      alt={prod.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        background: 'rgba(255, 255, 255, 0.05)',
                        flexShrink: 0,
                      }}
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prod.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {prod.category || 'General'} • {prod.unitsSold} units sold
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>
                      {formatINR(prod.revenue)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      gross revenue
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              No product sales data recorded yet.
            </div>
          )}
        </div>

        {/* Low-Stock Inventory Warnings */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#f87171' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Low-Stock Products Alert
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Catalog items with stock ≤ 10 units requiring replenishment
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('admin-inventory')}
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
            >
              Restock All
            </button>
          </div>

          {lowStockList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lowStockList.map(prod => {
                const isCritical = prod.stock <= 3;
                return (
                  <div
                    key={prod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isCritical
                        ? 'rgba(239, 68, 68, 0.06)'
                        : 'rgba(245, 158, 11, 0.05)',
                      border: isCritical
                        ? '1px solid rgba(239, 68, 68, 0.25)'
                        : '1px solid rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          background: 'rgba(255, 255, 255, 0.05)',
                          flexShrink: 0,
                        }}
                        onError={e => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {prod.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {prod.category} • {formatINR(prod.price)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: isCritical
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                          color: isCritical ? '#f87171' : '#fbbf24',
                        }}
                      >
                        {prod.stock} left ({isCritical ? 'Critical' : 'Low'})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: '#10b981',
                fontSize: '0.85rem',
              }}
            >
              ✓ All catalog items are adequately stocked above threshold.
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Payment Method Distribution */}
      <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Payment Method Distribution
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Actual checkout settlement methods from live payments records
            </p>
          </div>
          <CreditCard size={20} style={{ color: '#10b981' }} />
        </div>

        {paymentMethods.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
            }}
          >
            {paymentMethods.map(pm => (
              <div
                key={pm.name}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pm.name}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: pm.percentage > 40 ? '#10b981' : 'var(--text-primary)',
                    }}
                  >
                    {pm.percentage}%
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}
                >
                  {pm.count} orders settled ({formatINR(pm.amount)})
                </div>
                <div
                  style={{
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pm.percentage}%`,
                      background: pm.percentage > 40 ? '#10b981' : 'var(--primary-color)',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 0',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            No payment transaction records found yet.
          </div>
        )}
      </div>
    </div>
  );
}
