import React, { useState } from 'react';
import { useProducts } from './ProductsContext';
import { formatINR } from './mockData';
import AdminHeader from './AdminHeader';
import { useNavigation } from './NavigationContext';
import RestockModal from './RestockModal';
import { 
  AlertTriangle, Package, TrendingDown, Edit3, 
  Search, Filter, ChevronUp, ChevronDown
} from 'lucide-react';

export default function AdminInventoryPage() {
  const { navigate } = useNavigation();
  const { products, updateStock } = useProducts();
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [sortField, setSortField] = useState('stock');
  const [sortAsc, setSortAsc] = useState(true);
  const [restockProduct, setRestockProduct] = useState(null);

  const filtered = products
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      if (filterLevel === 'critical') return matchSearch && p.stock <= 5;
      if (filterLevel === 'low') return matchSearch && p.stock <= 10 && p.stock > 5;
      if (filterLevel === 'healthy') return matchSearch && p.stock > 10;
      return matchSearch;
    })
    .sort((a, b) => {
      if (sortField === 'stock') return sortAsc ? a.stock - b.stock : b.stock - a.stock;
      if (sortField === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortField === 'price') return sortAsc ? a.price - b.price : b.price - a.price;
      return 0;
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const criticalCount = products.filter(p => p.stock <= 5).length;
  const lowCount = products.filter(p => p.stock > 5 && p.stock <= 10).length;
  const healthyCount = products.filter(p => p.stock > 10).length;

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  return (
    <div>
      <AdminHeader
        title="Inventory & Stock Management"
        subtitle="Monitor warehouse levels, restocking needs and product availability"
        actionButton={
          <button className="btn btn-primary" onClick={() => navigate('admin-add-product')} style={{ fontSize: '0.85rem' }}>
            + Stock New Product
          </button>
        }
      />

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px', cursor: 'pointer', border: filterLevel === 'critical' ? '1px solid #ef4444' : undefined }} onClick={() => setFilterLevel(filterLevel === 'critical' ? 'all' : 'critical')}>
          <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Critical ≤ 5</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>{criticalCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Requires immediate restock</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px', cursor: 'pointer', border: filterLevel === 'low' ? '1px solid #f59e0b' : undefined }} onClick={() => setFilterLevel(filterLevel === 'low' ? 'all' : 'low')}>
          <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>Low ≤ 10</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>{lowCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Reorder soon</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px', cursor: 'pointer', border: filterLevel === 'healthy' ? '1px solid #10b981' : undefined }} onClick={() => setFilterLevel(filterLevel === 'healthy' ? 'all' : 'healthy')}>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Healthy &gt; 10</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', margin: '4px 0' }}>{healthyCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Adequate supply</div>
        </div>
        <div className="card-glass" style={{ padding: '18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total SKUs</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0' }}>{products.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Catalogued products</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card-glass" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search products by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'critical', 'low', 'healthy'].map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              style={{
                padding: '7px 14px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: filterLevel === level ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                color: filterLevel === level ? '#fff' : 'var(--text-secondary)'
              }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card-glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <button onClick={() => toggleSort('name')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.875rem' }}>
                    Product <SortIcon field="name" />
                  </button>
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <button onClick={() => toggleSort('price')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.875rem' }}>
                    Price <SortIcon field="price" />
                  </button>
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <button onClick={() => toggleSort('stock')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.875rem' }}>
                    Stock Units <SortIcon field="stock" />
                  </button>
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Stock Level</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Stock Bar</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isCritical = p.stock <= 5;
                const isLow = p.stock > 5 && p.stock <= 10;
                const statusColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
                const statusLabel = isCritical ? 'Critical' : isLow ? 'Low Stock' : 'Healthy';
                const stockBarPct = Math.min(100, (p.stock / 50) * 100);

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={p.image} alt={p.name} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', background: '#1e1e2e' }} />
                        <div>
                          <div style={{ fontWeight: 600, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.category}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{formatINR(p.price)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, color: statusColor, fontSize: '1rem' }}>{p.stock}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: `${statusColor}20`,
                        color: statusColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isCritical && <AlertTriangle size={11} />}
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: '100px' }}>
                      <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${stockBarPct}%`, background: statusColor, borderRadius: '3px', transition: 'width 0.4s' }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => setRestockProduct(p)}
                          title="Restock Units"
                          style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', cursor: 'pointer', padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Package size={13} /> Restock
                        </button>
                        <button
                          onClick={() => navigate('admin-edit-product', { productId: p.id })}
                          title="Edit Product"
                          style={{ background: 'none', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#60a5fa', cursor: 'pointer', padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      <RestockModal
        product={restockProduct}
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        onRestockSuccess={async (productId, newStock) => {
          return await updateStock(productId, newStock);
        }}
      />
    </div>
  );
}
