import React, { useState, useEffect, useCallback } from 'react';
import { formatINR } from './mockData';
import AdminHeader from './AdminHeader';
import { useNavigation } from './NavigationContext';
import {
  fetchDashboardKPIs,
  fetchUserGrowth,
  fetchTopCustomers,
  fetchActivityFeed,
  fetchActivityBreakdown,
  fetchSearchAnalytics,
  fetchRecommendationStats,
} from './adminAnalyticsService';
import {
  Users,
  UserPlus,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  RefreshCw,
  Search,
  Sparkles,
  ShoppingBag,
  Eye,
  Heart,
  ShoppingCart,
  Calendar,
  Layers,
  Star,
  ExternalLink,
} from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminCustomerAnalyticsPage() {
  const { navigate } = useNavigation();

  // Filters & State
  const [loading, setLoading] = useState(true);
  const [growthMonths, setGrowthMonths] = useState(6); // 3, 6, 12
  const [activityDays, setActivityDays] = useState(30); // 7, 30, 90
  const [searchDays, setSearchDays] = useState(30);     // 7, 30, 90

  // Data states
  const [kpis, setKpis] = useState(null);
  const [userGrowth, setUserGrowth] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityBreakdown, setActivityBreakdown] = useState({ data: [], total: 0 });
  const [searchAnalytics, setSearchAnalytics] = useState({ data: [], totalSearches: 0 });
  const [recommendationStats, setRecommendationStats] = useState({ data: [], summary: { total: 0, avgScore: '0.00', uniqueProducts: 0 } });
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Load user growth when growthMonths changes
  const loadUserGrowth = useCallback(async () => {
    try {
      const res = await fetchUserGrowth(growthMonths);
      if (res?.data) setUserGrowth(res.data);
    } catch (err) {
      console.error('[AdminCustomerAnalytics] Growth error:', err);
    }
  }, [growthMonths]);

  // Load activity breakdown when activityDays changes
  const loadActivityBreakdown = useCallback(async () => {
    try {
      const res = await fetchActivityBreakdown(activityDays);
      if (res) setActivityBreakdown({ data: res.data || [], total: res.total || 0 });
    } catch (err) {
      console.error('[AdminCustomerAnalytics] Activity error:', err);
    }
  }, [activityDays]);

  // Load search analytics when searchDays changes
  const loadSearchAnalytics = useCallback(async () => {
    try {
      const res = await fetchSearchAnalytics(searchDays, 12);
      if (res) setSearchAnalytics({ data: res.data || [], totalSearches: res.totalSearches || 0 });
    } catch (err) {
      console.error('[AdminCustomerAnalytics] Search error:', err);
    }
  }, [searchDays]);

  // Main loader for initial KPIs, top customers, feed & recommendations
  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisRes, topCustRes, actRes, recsRes] = await Promise.all([
        fetchDashboardKPIs(),
        fetchTopCustomers(10),
        fetchActivityFeed(12),
        fetchRecommendationStats(10),
      ]);

      if (kpisRes.data) setKpis(kpisRes.data);
      if (topCustRes.data) setTopCustomers(topCustRes.data);
      if (actRes.data) setActivityFeed(actRes.data);
      if (recsRes.data) setRecommendationStats({ data: recsRes.data, summary: recsRes.summary });

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[AdminCustomerAnalytics] Base error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadUserGrowth();
  }, [loadUserGrowth]);

  useEffect(() => {
    loadActivityBreakdown();
  }, [loadActivityBreakdown]);

  useEffect(() => {
    loadSearchAnalytics();
  }, [loadSearchAnalytics]);

  const refreshAll = () => {
    loadBaseData();
    loadUserGrowth();
    loadActivityBreakdown();
    loadSearchAnalytics();
  };

  const maxUserGrowth = userGrowth.length > 0 ? Math.max(...userGrowth.map(u => u.newUsers || 0), 1) : 1;
  const totalUsersFromGrowth = userGrowth.reduce((s, u) => s + (u.newUsers || 0), 0);
  const totalSpendAll = topCustomers.reduce((s, c) => s + (c.totalSpend || 0), 0);
  const avgSpendPerCustomer =
    topCustomers.length > 0 ? Math.round(totalSpendAll / topCustomers.length) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <AdminHeader
        title="Customer Intelligence & Engagement"
        subtitle="User acquisition, behavioral activity, search keywords & recommendation interactions"
        actionButton={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {lastRefreshed && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={refreshAll}
              disabled={loading}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('admin-users')}
              style={{ fontSize: '0.85rem' }}
            >
              Manage Customers
            </button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Registered Users */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Total Customers
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            {(kpis?.totalUsers ?? 0).toLocaleString()}
          </div>
          {kpis?.userGrowth !== null && kpis?.userGrowth !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                color: kpis.userGrowth >= 0 ? '#10b981' : '#f87171',
                marginTop: '6px',
              }}
            >
              {kpis.userGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {kpis.userGrowth >= 0 ? '+' : ''}
              {kpis.userGrowth}% vs last month
            </div>
          )}
        </div>

        {/* New Users This Month */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              New This Month
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
              }}
            >
              <UserPlus size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>
            {kpis?.thisMonthUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Registered in current calendar month
          </div>
        </div>

        {/* Total Platform Interactions */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Tracked Activities
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
              <Activity size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
            {activityBreakdown.total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            In the last {activityDays} days
          </div>
        </div>

        {/* Search Activity KPI */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Search Queries
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
              <Search size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#f472b6' }}>
            {searchAnalytics.totalSearches.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {searchAnalytics.data.length} unique search keywords
          </div>
        </div>

        {/* AI Recommendations KPI */}
        <div className="card-glass" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              AI Recommendations
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
              <Sparkles size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#a78bfa' }}>
            {recommendationStats.summary.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Across {recommendationStats.summary.uniqueProducts} catalog products
          </div>
        </div>
      </div>

      {/* Row 2: Customer Activity Breakdown & User Growth Chart */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Customer Activity Breakdown */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: 'var(--primary-color)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Customer Activity Breakdown
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Behavioral distribution ({activityBreakdown.total} events recorded)
              </p>
            </div>

            {/* Range Selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setActivityDays(d)}
                  style={{
                    background: activityDays === d ? 'var(--primary-color)' : 'transparent',
                    color: activityDays === d ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          {activityBreakdown.data.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activityBreakdown.data.map(act => (
                <div key={act.type}>
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
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: act.color,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{act.label}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700 }}>{act.count}</span>
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          marginLeft: '8px',
                          fontSize: '0.8rem',
                        }}
                      >
                        ({act.percentage}%)
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
                        width: `${act.percentage}%`,
                        background: act.color,
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
              No customer activity events found for the last {activityDays} days.
            </div>
          )}
        </div>

        {/* User Growth Over Time */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Customer Acquisition Trend
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {totalUsersFromGrowth} new accounts registered
              </p>
            </div>

            {/* Range Selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {[3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setGrowthMonths(m)}
                  style={{
                    background: growthMonths === m ? 'var(--primary-color)' : 'transparent',
                    color: growthMonths === m ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
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

          {userGrowth.length > 0 && userGrowth.some(u => u.newUsers > 0) ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: '200px',
                gap: '10px',
                paddingTop: '24px',
              }}
            >
              {userGrowth.map((item, idx) => {
                const count = item.newUsers || 0;
                const heightPct = Math.max(4, Math.round((count / maxUserGrowth) * 100));
                const isHighest = count > 0 && count === maxUserGrowth;
                return (
                  <div
                    key={`${item.month}-${idx}`}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                    }}
                    title={`${item.month}: ${count} new registrations`}
                  >
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: isHighest ? '#818cf8' : 'var(--text-secondary)',
                        marginBottom: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {count > 0 ? count : ''}
                    </span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          background: isHighest
                            ? 'linear-gradient(180deg, #818cf8 0%, var(--primary-color) 100%)'
                            : count > 0
                            ? 'rgba(99, 102, 241, 0.4)'
                            : 'rgba(255, 255, 255, 0.04)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s ease',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        color: isHighest ? '#fff' : 'var(--text-secondary)',
                        marginTop: '8px',
                        fontWeight: isHighest ? 700 : 500,
                      }}
                    >
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              No registration records found for this period.
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Search Activity Analytics & Recommendation Interactions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Search Activity Analytics */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: '#f472b6' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Search Query Analytics
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Top keywords searched by customers on the storefront
              </p>
            </div>

            {/* Range */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setSearchDays(d)}
                  style={{
                    background: searchDays === d ? 'var(--primary-color)' : 'transparent',
                    color: searchDays === d ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          {searchAnalytics.data.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      textAlign: 'left',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Search Query</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Searches</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Unique Users</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Last Searched</th>
                  </tr>
                </thead>
                <tbody>
                  {searchAnalytics.data.map((item, idx) => (
                    <tr
                      key={item.term}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 8px',
                          fontWeight: 700,
                          color: idx === 0 ? '#f472b6' : 'var(--text-secondary)',
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          "{item.term}"
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                        {item.count}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {item.uniqueUsers}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontSize: '0.76rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {formatDateTime(item.lastSearched)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              No search activities logged in the last {searchDays} days.
            </div>
          )}
        </div>

        {/* Recommendation Interactions & AI Intelligence */}
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
                <Sparkles size={18} style={{ color: '#a78bfa' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Recommendation Interactions
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Targeted recommendations served by recommendation engine
              </p>
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                fontWeight: 600,
              }}
            >
              Avg Confidence: {recommendationStats.summary.avgScore}
            </div>
          </div>

          {recommendationStats.data.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recommendationStats.data.map(rec => (
                <div
                  key={rec.productId}
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
                  {rec.image ? (
                    <img
                      src={rec.image}
                      alt={rec.name}
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
                        fontSize: '0.86rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rec.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      💡 {rec.reason}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: '#c4b5fd',
                      }}
                    >
                      Score {rec.score}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {rec.count} recommendations
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
              No recommendation records found.
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Top Customers by Spend & Real-time Event Stream */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Top Customers Table */}
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
                Top Customers by Lifetime Spend
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Highest-grossing accounts aggregated from orders
              </p>
            </div>
            <Award size={20} style={{ color: '#fbbf24' }} />
          </div>

          {topCustomers.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      textAlign: 'left',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <th style={{ padding: '10px 8px' }}>#</th>
                    <th style={{ padding: '10px 8px' }}>Customer</th>
                    <th style={{ padding: '10px 8px' }}>Orders</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, idx) => (
                    <tr
                      key={c.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td
                        style={{
                          padding: '10px 8px',
                          fontWeight: 700,
                          color: idx === 0 ? 'var(--primary-color)' : 'var(--text-secondary)',
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {c.email ? c.email.replace(/(.{3}).+(@.+)/, '$1***$2') : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        {c.orderCount}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#10b981',
                        }}
                      >
                        {formatINR(c.totalSpend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              No customer purchase data yet.
            </div>
          )}
        </div>

        {/* Live Event Activity Feed */}
        <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Live Platform Activity Feed
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-time operational events from notifications & platform activities
              </p>
            </div>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: '#10b981',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                }}
              />
              Live
            </span>
          </div>

          {activityFeed.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '380px',
                overflowY: 'auto',
              }}
            >
              {activityFeed.map(act => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{act.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {act.text}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {act.time}
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
              No activity events recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
