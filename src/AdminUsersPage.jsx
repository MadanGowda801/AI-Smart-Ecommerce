import React, { useState } from 'react';
import { formatINR, mockUsers } from './mockData';
import AdminHeader from './AdminHeader';
import { useNavigation } from './NavigationContext';
import { Search, UserCheck, UserX, Mail, Phone, ShoppingBag, Star, Shield } from 'lucide-react';

// Augment mockUsers with extra demo users
const DEMO_USERS = [
  { id: 'u-001', name: 'Ravi Sharma', email: 'ravi.sharma@gmail.com', phone: '+91-98765-43210', city: 'Mumbai', orders: 8, totalSpend: 42500, status: 'active', role: 'customer', joined: '2025-12-01' },
  { id: 'u-002', name: 'Priya Nair', email: 'priya.nair@gmail.com', phone: '+91-91234-56789', city: 'Bengaluru', orders: 12, totalSpend: 68900, status: 'active', role: 'customer', joined: '2025-11-15' },
  { id: 'u-003', name: 'Arjun Singh', email: 'arjun.singh@outlook.com', phone: '+91-70000-99000', city: 'Delhi', orders: 3, totalSpend: 14200, status: 'active', role: 'customer', joined: '2026-01-10' },
  { id: 'u-004', name: 'Meena Joshi', email: 'meena.joshi@yahoo.co.in', phone: '+91-88844-55512', city: 'Pune', orders: 6, totalSpend: 28750, status: 'blocked', role: 'customer', joined: '2026-02-22' },
  { id: 'u-005', name: 'Kabir Das', email: 'kabir.das@gmail.com', phone: '+91-94561-78902', city: 'Hyderabad', orders: 2, totalSpend: 6300, status: 'active', role: 'customer', joined: '2026-04-01' },
  { id: 'u-006', name: 'Nidhi Verma', email: 'nidhi.verma@gmail.com', phone: '+91-99000-12345', city: 'Jaipur', orders: 19, totalSpend: 105600, status: 'active', role: 'vip', joined: '2025-08-11' },
  { id: 'u-007', name: 'Suresh Patil', email: 'suresh.patil@rediffmail.com', phone: '+91-81212-34567', city: 'Nashik', orders: 1, totalSpend: 2299, status: 'inactive', role: 'customer', joined: '2026-07-19' },
  { id: 'u-008', name: 'Divya Menon', email: 'divya.menon@gmail.com', phone: '+91-99887-66541', city: 'Chennai', orders: 15, totalSpend: 82400, status: 'active', role: 'vip', joined: '2025-10-05' },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const filtered = DEMO_USERS.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchStatus && matchRole;
  });

  const getStatusBadge = (status) => {
    if (status === 'active') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Active' };
    if (status === 'blocked') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Blocked' };
    return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', label: 'Inactive' };
  };

  return (
    <div>
      <AdminHeader
        title="Customer Management"
        subtitle={`${DEMO_USERS.length} registered users — monitor orders, lifetime value & account status`}
      />

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Customers</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0' }}>{DEMO_USERS.length}</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Active Users</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', margin: '4px 0' }}>{DEMO_USERS.filter(u => u.status === 'active').length}</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase' }}>VIP Members</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>{DEMO_USERS.filter(u => u.role === 'vip').length}</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, textTransform: 'uppercase' }}>Avg. Lifetime Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)', margin: '4px 0' }}>
            {formatINR(Math.round(DEMO_USERS.reduce((s, u) => s + u.totalSpend, 0) / DEMO_USERS.length))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-glass" style={{ padding: '14px 16px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by name, email, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
        >
          <option value="all">All Roles</option>
          <option value="customer">Customer</option>
          <option value="vip">VIP</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="card-glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Contact</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>City</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Orders</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Lifetime Value</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const badge = getStatusBadge(user.status);
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary-color), #ec4899)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{user.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                          <Mail size={12} /> {user.email}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} /> {user.phone}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.city}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <ShoppingBag size={14} color="var(--primary-color)" /> {user.orders}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{formatINR(user.totalSpend)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {user.role === 'vip' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>
                          <Star size={11} fill="#fbbf24" color="#fbbf24" /> VIP
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Customer</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '6px', background: badge.bg, color: badge.color, fontSize: '0.75rem', fontWeight: 600 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(user.joined).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
