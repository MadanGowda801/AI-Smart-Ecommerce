import React, { useState } from 'react';
import { useNavigation } from './NavigationContext';
import { useProducts } from './ProductsContext';
import AdminHeader from './AdminHeader';
import { 
  ArrowLeft, Save, Sparkles, Image as ImageIcon, 
  Check, AlertCircle, Plus, Trash2 
} from 'lucide-react';
import ProductImageUploader from './ProductImageUploader';

const PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80',
  'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&q=80',
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80'
];

export default function AdminAddProductPage() {
  const { navigate } = useNavigation();
  const { addProduct } = useProducts();

  const [formData, setFormData] = useState({
    name: '',
    category: 'electronics',
    price: '',
    originalPrice: '',
    stock: '25',
    image: '',
    image_url: '',
    image_key: '',
    angleImage2: '',
    angleImage3: '',
    angleImage4: '',
    model3dUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    shortDesc: '',
    description: '',
    badge: 'New Arrival',
    isAiPick: false,
    featured: false,
    rating: 4.5,
    reviewsCount: 1
  });

  const [specKey, setSpecKey] = useState('');
  const [specVal, setSpecVal] = useState('');
  const [specs, setSpecs] = useState({
    'Warranty': '1 Year Manufacturer',
    'Origin': 'Made in India'
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddSpec = (e) => {
    e.preventDefault();
    if (specKey.trim() && specVal.trim()) {
      setSpecs(prev => ({ ...prev, [specKey.trim()]: specVal.trim() }));
      setSpecKey('');
      setSpecVal('');
    }
  };

  const handleRemoveSpec = (keyToRemove) => {
    const updated = { ...specs };
    delete updated[keyToRemove];
    setSpecs(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      alert('Please fill in product name and price.');
      return;
    }

    setSaving(true);

    try {
      const priceNum = parseFloat(formData.price);
      const origPriceNum = formData.originalPrice ? parseFloat(formData.originalPrice) : Math.round(priceNum * 1.25);
      const discountPct = Math.round(((origPriceNum - priceNum) / origPriceNum) * 100);
      const finalImage = formData.image || PRESET_IMAGES[0];
      const extraAngles = [formData.angleImage2, formData.angleImage3, formData.angleImage4]
        .map((u) => (u || '').trim())
        .filter(Boolean);

      const newProd = {
        ...formData,
        image: finalImage,
        image_url: finalImage,
        images: [finalImage, ...extraAngles],
        model3dUrl: formData.model3dUrl || null,
        model_3d_url: formData.model3dUrl || null,
        price: priceNum,
        originalPrice: origPriceNum,
        discount: discountPct > 0 ? `${discountPct}% OFF` : '',
        stock: parseInt(formData.stock, 10) || 10,
        specs: specs,
        rating: 4.5,
        reviewsCount: 0
      };

      await addProduct(newProd);
      setSaving(false);
      setSavedSuccess(true);

      setTimeout(() => {
        navigate('admin-products');
      }, 1000);
    } catch (err) {
      console.error('Failed to add product:', err);
      alert(err.message || 'Failed to add product. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminHeader
        title="Add New Catalog Product"
        subtitle="Publish a new product with pricing, specs & AI recommendation tags"
        actionButton={
          <button
            onClick={() => navigate('admin-products')}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back to Catalog
          </button>
        }
      />

      {savedSuccess && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px',
          fontWeight: 600
        }}>
          <Check size={20} /> Product created successfully! Redirecting to products table...
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Left Column: Core Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>Basic Information</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UltraClear Noise Canceling Wireless Pro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="electronics">Electronics</option>
                      <option value="audio">Audio</option>
                      <option value="wearables">Wearables</option>
                      <option value="cameras">Cameras</option>
                      <option value="gaming">Gaming</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Promotional Badge
                    </label>
                    <select
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="New Arrival">New Arrival</option>
                      <option value="Best Seller">Best Seller</option>
                      <option value="Hot Deal">Hot Deal</option>
                      <option value="Top Rated">Top Rated</option>
                      <option value="Limited Edition">Limited Edition</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Short Summary (Catalog snippet)
                  </label>
                  <input
                    type="text"
                    placeholder="Short 1-sentence value proposition..."
                    value={formData.shortDesc}
                    onChange={(e) => setFormData({ ...formData, shortDesc: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Full Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Provide full product specifications, customer benefits and features..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Specifications Card */}
            <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>Technical Specifications</h3>

              {/* Existing specs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {Object.entries(specs).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <span><strong>{k}:</strong> {v}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(k)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add spec inline */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Spec Key (e.g. Battery)"
                  value={specKey}
                  onChange={(e) => setSpecKey(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
                <input
                  type="text"
                  placeholder="Value (e.g. 40 Hours)"
                  value={specVal}
                  onChange={(e) => setSpecVal(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSpec}
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Inventory & Image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Pricing & Stock Card */}
            <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700 }}>Pricing & Stock (INR)</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Sale Price in INR (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 4999"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: 700
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Original / MRP Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 7999 (Used to calculate discount %)"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Initial Inventory Units *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 35"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* AI Pick & Feature toggles */}
                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isAiPick}
                      onChange={(e) => setFormData({ ...formData, isAiPick: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={14} color="#a78bfa" /> AI Top Pick Tag
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Highlights product across customer AI recommendation sections
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Feature on Home Page Carousel</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Showcase on front-page hero spotlight</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Media & Image Card */}
            <div className="card-glass" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={18} /> Product Imagery (InsForge Storage)
              </h3>

              <ProductImageUploader
                imageUrl={formData.image}
                imageKey={formData.image_key}
                onImageChange={({ url, key }) => {
                  setFormData((prev) => ({
                    ...prev,
                    image: url,
                    image_url: url,
                    image_key: key
                  }));
                }}
                presetImages={PRESET_IMAGES}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={18} /> {saving ? 'Publishing...' : 'Publish Product'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
