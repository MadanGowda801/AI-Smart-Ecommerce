import React, { useState } from 'react';
import { useNavigation } from './NavigationContext';
import { useProducts } from './ProductsContext';
import { formatINR } from './mockData';
import AdminHeader from './AdminHeader';
import { 
  Plus, Search, Edit3, Trash2, ExternalLink, Star, 
  Sparkles, Filter, AlertCircle, Check, Package
} from 'lucide-react';
import EmptyState from './EmptyState';
import RestockModal from './RestockModal';

export default function AdminProductsPage() {
  const { navigate } = useNavigation();
  const { products, deleteProduct, updateStock } = useProducts();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleDelete = (id) => {
    deleteProduct(id);
    setDeleteConfirmId(null);
  };

  return (
    <div>
      <AdminHeader
        title="Product Management"
        subtitle={`Manage your store's ${products.length} live products, pricing, and AI tags`}
        actionButton={
          <button
            className="btn btn-primary"
            onClick={() => navigate('admin-add-product')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Add Product
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="card-glass" style={{
        padding: '16px 20px',
        borderRadius: '12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Filter size={16} color="var(--text-secondary)" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Categories ({products.length})</option>
            {categories.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No Products Match"
          description="Try adjusting your search criteria or category filter."
          actionLabel="Clear Filters"
          onAction={() => { setSearchTerm(''); setSelectedCategory('all'); }}
        />
      ) : (
        <div className="card-glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Product</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Price</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Rating</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tags</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isLowStock = p.stock <= 10;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Product Name + Image */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={p.image}
                            alt={p.name}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              background: 'rgba(255, 255, 255, 0.05)',
                              flexShrink: 0
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              ID: {p.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          fontSize: '0.8rem'
                        }}>
                          {p.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700 }}>{formatINR(p.price)}</div>
                        {p.originalPrice && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                            {formatINR(p.originalPrice)}
                          </div>
                        )}
                      </td>

                      {/* Stock */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontWeight: 600,
                          color: isLowStock ? '#f87171' : '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {p.stock} units
                          {isLowStock && <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>Low</span>}
                        </span>
                      </td>

                      {/* Rating */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                          <Star size={14} fill="#f59e0b" color="#f59e0b" />
                          <span>{p.rating}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>({p.reviewsCount || 0})</span>
                        </div>
                      </td>

                      {/* AI tags */}
                      <td style={{ padding: '12px 16px' }}>
                        {p.isAiPick ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(124, 58, 237, 0.15)',
                            color: '#a78bfa',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}>
                            <Sparkles size={11} /> AI Top Pick
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Standard</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {/* Live preview */}
                          <button
                            onClick={() => navigate('product-details', { productId: p.id })}
                            title="View on Storefront"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px'
                            }}
                          >
                            <ExternalLink size={16} />
                          </button>

                          {/* Restock */}
                          <button
                            onClick={() => setRestockProduct(p)}
                            title="Restock Units"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#818cf8',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px'
                            }}
                          >
                            <Package size={16} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => navigate('admin-edit-product', { productId: p.id })}
                            title="Edit Product"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px'
                            }}
                          >
                            <Edit3 size={16} />
                          </button>

                          {/* Delete or Confirm */}
                          {deleteConfirmId === p.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleDelete(p.id)}
                                title="Confirm Delete"
                                style={{
                                  background: '#ef4444',
                                  border: 'none',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              title="Delete Product"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <RestockModal
        product={restockProduct}
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        onRestockSuccess={async (productId, newStock) => {
          return await updateStock(productId, newStock);
        }}
      />

      {/* Confirm Product Removal Modal */}
      {deleteConfirmId && (() => {
        const prodToRemove = products.find((p) => p.id === deleteConfirmId);
        if (!prodToRemove) return null;
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(5, 8, 18, 0.78)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={() => setDeleteConfirmId(null)}
          >
            <div
              className="card-glass"
              style={{
                maxWidth: '440px',
                width: '100%',
                padding: '1.5rem',
                borderRadius: '18px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(15, 20, 35, 0.98)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    Confirm Product Removal
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Permanently remove this product from the store catalog
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.25rem' }}>
                <img
                  src={prodToRemove.image}
                  alt={prodToRemove.name}
                  style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prodToRemove.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {formatINR(prodToRemove.price)} • {prodToRemove.stock} in stock
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(prodToRemove.id)}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={15} /> Yes, Remove Product
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
