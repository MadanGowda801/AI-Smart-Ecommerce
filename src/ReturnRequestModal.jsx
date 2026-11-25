import React, { useState } from 'react';
import {
  RotateCcw, X, UploadCloud, AlertTriangle, CheckCircle2,
  Sparkles, ShieldCheck, Image, Loader2
} from 'lucide-react';
import returnsService from './returnsService';
import { useAuth } from './AuthContext';
import { formatINR } from './productsService';

const DEFECT_CATEGORIES = [
  { id: 'damaged_in_transit', label: 'Damaged in Transit / Crushed Box' },
  { id: 'manufacturing_defect', label: 'Hardware / Functional Defect' },
  { id: 'broken_seal', label: 'Broken Seal / Tampered Packaging' },
  { id: 'wrong_item', label: 'Wrong Item or Color Delivered' },
  { id: 'cosmetic_damage', label: 'Dents, Scratches or Cosmetic Flaws' }
];

export function ReturnRequestModal({ isOpen, onClose, order, onReturnSuccess }) {
  const { user } = useAuth();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [defectType, setDefectType] = useState('damaged_in_transit');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen || !order) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Please upload a valid image (JPG, PNG, or WEBP).');
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    setError('');
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result);
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please describe the issue with the item.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await returnsService.submitReturn({
        orderId: order.id,
        orderItemId: selectedItemId || null,
        reason: reason.trim(),
        description: description.trim() || reason.trim(),
        defectType,
        file,
        userId: user?.id,
        orderMeta: {
          userId: order.userId || user?.id,
          createdAt: order.date,
          status: order.status,
          totalAmount: order.pricing?.total || 0
        }
      });

      setSuccessResult(res.returnRequest);
      onReturnSuccess?.(res.returnRequest);
    } catch (err) {
      setError(err.message || 'Failed to submit return request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      background: 'rgba(5, 7, 15, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(15, 23, 42, 0.96))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <RotateCcw size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                Request Return & Report Defect
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Order #{order.id.slice(0, 8).toUpperCase()} · AI-assisted defect inspection
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {successResult ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#34d399',
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                Return Request Submitted!
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: '380px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                Your claim has been logged in our system. Our automated inspector and human review team will process your refund or replacement.
              </p>

              {/* AI Advisory Summary Preview */}
              {successResult.ai_analysis && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  textAlign: 'left',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.4rem' }}>
                    <Sparkles size={14} /> AI Advisory Inspection:
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#fff', marginBottom: '0.3rem' }}>
                    Suggested Category: <strong>{successResult.ai_analysis.suggestedCategory}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {successResult.ai_analysis.advisoryNotes}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                    Confidence Score: {Math.round((successResult.ai_analysis.confidence || 0.85) * 100)}% (Advisory for human agent)
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                Close & View Orders
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <AlertTriangle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Item Selection (if order has items) */}
              {order.items && order.items.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                    Select Defective Item
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="" style={{ background: '#0f172a' }}>Entire Order (All Items)</option>
                    {order.items.map((item) => (
                      <option key={item.orderItemId || item.id} value={item.orderItemId || item.id} style={{ background: '#0f172a' }}>
                        {item.name} ({formatINR(item.price)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Defect Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  Defect Classification
                </label>
                <select
                  value={defectType}
                  onChange={(e) => setDefectType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.82rem',
                  }}
                >
                  {DEFECT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: '#0f172a' }}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Reason & Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  Return Reason / Primary Issue *
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Display screen cracked, device won't power on"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    marginBottom: '0.75rem',
                  }}
                  required
                />

                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  Detailed Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe condition of box, visible scratches, packaging seals, or details for quality inspection..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 4. Upload Photo Evidence */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.35rem' }}>
                  Upload Photographic Evidence (JPG, PNG, max 5MB)
                </label>
                <div style={{
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  position: 'relative',
                  cursor: 'pointer',
                }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer',
                      width: '100%',
                      height: '100%',
                    }}
                  />
                  {filePreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                      <img
                        src={filePreview}
                        alt="Evidence preview"
                        style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{file?.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {(file.size / 1024).toFixed(1)} KB · Click to change
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8' }}>
                      <UploadCloud size={30} style={{ margin: '0 auto 0.4rem', opacity: 0.6 }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                        Click or drag photo evidence here
                      </div>
                      <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                        Clear photos of the package and item defect speed up approval
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Trust Badge */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.75rem',
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Sparkles size={16} color="#818cf8" style={{ flexShrink: 0 }} />
                <span>
                  Our <strong>AI Quality Inspector</strong> verifies evidence metadata to accelerate return approvals for genuine claims.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Submitting & Running AI Inspection...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Submit Return Request
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReturnRequestModal;
