import React, { useState, useEffect } from 'react';
import AdminHeader from './AdminHeader';
import returnsService from './returnsService';
import { formatINR } from './productsService';
import {
  RotateCcw, Search, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, ShieldAlert, Eye, RefreshCw, Filter, Image as ImageIcon,
  Clock, Check, X, ShieldCheck
} from 'lucide-react';

export function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Review modal state
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    returnId: null,
    action: 'approve', // 'approve' | 'reject'
    adminNotes: ''
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchReturns = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await returnsService.getAdminReturns();
      setReturns(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load returns list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleOpenReview = (returnItem, action) => {
    let defaultNote = '';
    if (action === 'approve') {
      defaultNote = 'Return request verified and approved. Return pickup scheduled.';
    } else if (action === 'reject') {
      defaultNote = 'Evidence does not match return criteria or policy window exceeded.';
    } else if (action === 'under_review') {
      defaultNote = 'Claim assigned to technical specialist for detailed packaging / hardware inspection.';
    } else if (action === 'completed') {
      defaultNote = 'Defective unit received at warehouse. Reverse logistics verified and customer refund/replacement settled.';
    }

    setReviewModal({
      isOpen: true,
      returnId: returnItem.id,
      action,
      adminNotes: defaultNote
    });
  };

  const handleConfirmReview = async () => {
    if (!reviewModal.returnId) return;
    setIsSubmittingReview(true);
    try {
      const normalizedAction = reviewModal.action === 'approve' ? 'approved' :
                               reviewModal.action === 'reject' ? 'rejected' :
                               reviewModal.action === 'complete' ? 'completed' : reviewModal.action;

      await returnsService.reviewReturn({
        returnId: reviewModal.returnId,
        action: normalizedAction,
        adminNotes: reviewModal.adminNotes.trim()
      });
      setReviewModal({ isOpen: false, returnId: null, action: 'approve', adminNotes: '' });
      await fetchReturns();
    } catch (err) {
      alert(err.message || 'Failed to update return status.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const filteredReturns = returns.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const id = (r.id || '').toLowerCase();
    const orderId = (r.order_id || '').toLowerCase();
    const reason = (r.reason || '').toLowerCase();
    const defect = (r.defect_type || '').toLowerCase();
    const aiCategory = (r.ai_suggested_category || '').toLowerCase();
    return id.includes(q) || orderId.includes(q) || reason.includes(q) || defect.includes(q) || aiCategory.includes(q);
  });

  const counts = {
    all: returns.length,
    pending: returns.filter((r) => r.status === 'pending').length,
    under_review: returns.filter((r) => r.status === 'under_review').length,
    approved: returns.filter((r) => r.status === 'approved').length,
    rejected: returns.filter((r) => r.status === 'rejected').length,
    completed: returns.filter((r) => r.status === 'completed').length,
  };

  return (
    <div style={{ padding: '1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      <AdminHeader
        title="Returns & Defect Portal (AI Assisted)"
        subtitle="Review customer return requests, inspect photo evidence with AI defect analysis, and authorize claims."
      />

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', margin: '1.5rem 0' }}>
        {[
          { label: 'Total Claims', count: counts.all, color: '#818cf8', icon: RotateCcw },
          { label: 'Pending Review', count: counts.pending, color: '#fbbf24', icon: Clock },
          { label: 'Under Review', count: counts.under_review, color: '#60a5fa', icon: Search },
          { label: 'Approved Claims', count: counts.approved, color: '#34d399', icon: CheckCircle2 },
          { label: 'Rejected Claims', count: counts.rejected, color: '#f87171', icon: XCircle },
          { label: 'Completed', count: counts.completed, color: '#38bdf8', icon: ShieldCheck }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card-glass" style={{ padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stat.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{stat.count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="card-glass" style={{ padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${counts.all})` },
            { id: 'pending', label: `Pending (${counts.pending})` },
            { id: 'under_review', label: `Under Review (${counts.under_review})` },
            { id: 'approved', label: `Approved (${counts.approved})` },
            { id: 'rejected', label: `Rejected (${counts.rejected})` },
            { id: 'completed', label: `Completed (${counts.completed})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={statusFilter === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.9rem' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search order ID, reason, AI defect…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem'
              }}
            />
          </div>
          <button onClick={fetchReturns} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}>
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="card-glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin" style={{ color: '#818cf8', margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading return requests & defect evidence...</p>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="card-glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
          <ShieldCheck size={36} style={{ color: 'var(--text-subtle)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Return Requests Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {statusFilter !== 'all' ? `No ${statusFilter} return requests at this time.` : 'No claims have been submitted by customers yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredReturns.map((item) => {
            const isPending = item.status === 'pending';
            const confidencePercent = item.ai_confidence ? Math.round(item.ai_confidence * 100) : null;

            return (
              <div
                key={item.id}
                className="card-glass"
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: isPending ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid var(--border-light)',
                  background: isPending ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.03), rgba(17, 24, 39, 0.95))' : 'rgba(17, 24, 39, 0.7)'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.6fr 1.6fr auto', gap: '1.25rem', alignItems: 'start' }}>
                  {/* Column 1: Order & Customer Claim */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: '#818cf8' }}>
                        CLAIM #{item.id.slice(-6).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>•</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Order #{item.order_id?.slice(-8)?.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Defect Type: <span style={{ color: '#fbbf24', textTransform: 'capitalize' }}>{item.defect_type?.replace(/_/g, ' ')}</span>
                    </div>

                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      marginTop: '0.4rem',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginBottom: '2px', fontWeight: 600 }}>Customer Statement:</div>
                      "{item.reason}"
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
                      Submitted: {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Column 2: Photo Evidence */}
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                      Photo Evidence
                    </div>
                    {item.evidence_url ? (
                      <div
                        onClick={() => setPreviewImage(item.evidence_url)}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '110px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: '#0a0f1d'
                        }}
                      >
                        <img
                          src={item.evidence_url}
                          alt="Defect evidence"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                        >
                          <span style={{ fontSize: '0.75rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={14} /> Click to Enlarge
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: '110px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: '0.75rem', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                        <ImageIcon size={20} style={{ opacity: 0.5, marginBottom: '4px' }} />
                        No photo provided
                      </div>
                    )}
                  </div>

                  {/* Column 3: AI Defect Analysis (Advisory) */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                      <Sparkles size={14} color="#818cf8" />
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c7d2fe', textTransform: 'uppercase' }}>
                        AI Defect Inspector
                      </span>
                      <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                        Advisory
                      </span>
                    </div>

                    <div style={{
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(99, 102, 241, 0.06)',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      fontSize: '0.78rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Confidence:</span>
                        {confidencePercent !== null ? (
                          <span style={{
                            fontWeight: 700,
                            color: confidencePercent >= 80 ? '#34d399' : confidencePercent >= 50 ? '#fbbf24' : '#f87171'
                          }}>
                            {confidencePercent}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </div>

                      <div style={{ fontWeight: 600, color: '#e0e7ff', marginBottom: '0.25rem' }}>
                        {item.ai_suggested_category ? item.ai_suggested_category.replace(/_/g, ' ') : 'General Return Request'}
                      </div>

                      <div style={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.4 }}>
                        {item.ai_analysis_notes || 'Automated rule inspection completed.'}
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Review Decision & Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', minWidth: '150px' }}>
                    <div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: item.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                                    item.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' :
                                    item.status === 'completed' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: item.status === 'approved' ? '#34d399' :
                               item.status === 'rejected' ? '#f87171' :
                               item.status === 'completed' ? '#38bdf8' : '#fbbf24',
                        border: '1px solid currentColor'
                      }}>
                        {item.status === 'approved' ? <CheckCircle2 size={13} /> :
                         item.status === 'rejected' ? <XCircle size={13} /> :
                         <Clock size={13} />}
                        {item.status.toUpperCase()}
                      </span>
                    </div>

                    {(item.status === 'pending' || item.status === 'under_review') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', marginTop: '0.85rem' }}>
                        <button
                          onClick={() => handleOpenReview(item, 'approve')}
                          className="btn btn-primary"
                          style={{
                            fontSize: '0.76rem',
                            padding: '0.45rem 0.75rem',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Check size={13} /> Approve Return
                        </button>
                        <button
                          onClick={() => handleOpenReview(item, 'reject')}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.76rem',
                            padding: '0.45rem 0.75rem',
                            color: '#f87171',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <X size={13} /> Reject Claim
                        </button>
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleOpenReview(item, 'under_review')}
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.4rem 0.75rem',
                              color: '#60a5fa',
                              borderColor: 'rgba(96, 165, 250, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Search size={12} /> Under Review
                          </button>
                        )}
                      </div>
                    ) : item.status === 'approved' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', marginTop: '0.85rem' }}>
                        <button
                          onClick={() => handleOpenReview(item, 'completed')}
                          className="btn btn-primary"
                          style={{
                            fontSize: '0.76rem',
                            padding: '0.45rem 0.75rem',
                            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={13} /> Mark Completed
                        </button>
                        {item.admin_notes && (
                          <div style={{ maxWidth: '160px', wordBreak: 'break-word', color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.7rem' }}>
                            "{item.admin_notes}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.85rem', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                        {item.admin_notes && (
                          <div style={{ maxWidth: '160px', wordBreak: 'break-word', color: '#cbd5e1', fontStyle: 'italic', marginBottom: '4px' }}>
                            "{item.admin_notes}"
                          </div>
                        )}
                        Reviewed by Staff
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Image Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Enlarged Defect Evidence"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Review Confirmation Modal */}
      {reviewModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(5, 7, 15, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '480px', padding: '1.75rem', borderRadius: '16px' }}>
            <h3 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              marginBottom: '0.4rem',
              color: reviewModal.action === 'approve' ? '#34d399' :
                     reviewModal.action === 'reject' ? '#f87171' :
                     reviewModal.action === 'under_review' ? '#60a5fa' : '#38bdf8'
            }}>
              {reviewModal.action === 'approve' ? 'Approve Customer Return' :
               reviewModal.action === 'reject' ? 'Reject Return Claim' :
               reviewModal.action === 'under_review' ? 'Mark Claim Under Review' : 'Mark Return Completed'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              {reviewModal.action === 'approve'
                ? 'Approving initiates the return pickup and refund/replacement workflow. The customer will be notified.'
                : reviewModal.action === 'reject'
                ? 'Rejecting closes the return request. Please provide a clear explanation for the customer.'
                : reviewModal.action === 'under_review'
                ? 'Flags this claim for detailed QA inspection before making a final determination.'
                : 'Marks this return as completed after receiving defective merchandise and issuing refund or replacement.'}
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                Review Notes & Audit Trail
              </label>
              <textarea
                rows={3}
                value={reviewModal.adminNotes}
                onChange={(e) => setReviewModal({ ...reviewModal, adminNotes: e.target.value })}
                placeholder="Enter notes visible to the customer and team..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                onClick={() => setReviewModal({ isOpen: false, returnId: null, action: 'approve', adminNotes: '' })}
                disabled={isSubmittingReview}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReview}
                disabled={isSubmittingReview}
                className="btn btn-primary"
                style={{
                  fontSize: '0.82rem',
                  background: reviewModal.action === 'approve' ? 'linear-gradient(135deg, #10b981, #059669)' :
                              reviewModal.action === 'reject' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                              reviewModal.action === 'under_review' ? 'linear-gradient(135deg, #60a5fa, #2563eb)' :
                              'linear-gradient(135deg, #38bdf8, #0284c7)'
                }}
              >
                {isSubmittingReview ? 'Updating Status...' :
                 reviewModal.action === 'approve' ? 'Confirm Approval' :
                 reviewModal.action === 'reject' ? 'Confirm Rejection' :
                 reviewModal.action === 'under_review' ? 'Confirm Review Status' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminReturnsPage;
