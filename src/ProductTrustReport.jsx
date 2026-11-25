import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Award,
  RefreshCw,
  Info,
  Layers,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import trustReportService from './trustReportService.js';

export default function ProductTrustReport({ productId, productFallback = null }) {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      if (!productId) return;
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: repErr } = await trustReportService.getTrustReport(productId);
        if (repErr) throw repErr;
        if (isMounted) {
          setReport(data);
        }
      } catch (err) {
        console.error('Failed to load trust report:', err);
        if (isMounted) {
          setError(err.message || 'Unable to load verified Trust Report.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (isLoading) {
    return (
      <div
        id="trust-report-loading"
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <RefreshCw size={28} className="animate-spin" color="var(--accent-primary)" />
        <div>
          <div style={{ fontWeight: 600, color: '#fff' }}>Generating TrustCart AI Verified Trust Report...</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Auditing seller credentials, warranty terms, specifications, and genuine customer feedback.
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div
        id="trust-report-error"
        style={{
          padding: '2rem',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius-md)',
          color: '#fca5a5',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.8 }} />
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Unable to compile Trust Report</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
          {error || 'No verified catalog data available for this product.'}
        </div>
      </div>
    );
  }

  const {
    trustScore,
    sellerDetails,
    warrantyInfo,
    returnPolicyInfo,
    specifications,
    hasSpecs,
    reviewSummary,
    auditDetails,
  } = report;

  const scoreColor = trustScore >= 80 ? '#10b981' : trustScore >= 60 ? '#f59e0b' : '#64748b';
  const scoreBadgeBg = trustScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : trustScore >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)';

  return (
    <div id="product-trust-report" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner: Score & Verification Status */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          alignItems: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: scoreBadgeBg,
              border: `3px solid ${scoreColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {trustScore}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
              / 100
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={20} color={scoreColor} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                TrustCart AI Trust Score
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Calculated dynamically from verified seller ratings, manufacturer warranty documentation, transparent return windows, and authentic buyer feedback.
            </p>
          </div>
        </div>

        {/* Quick Trust Highlights */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            background: 'rgba(0,0,0,0.2)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
              Audit Checks Passed
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
              {auditDetails.passedCount} of {auditDetails.totalCount} Verified
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
              Genuine Reviews
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
              {reviewSummary.verifiedPurchasesCount} Verified Buyers
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Seller, Warranty & Returns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Seller Details */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#818cf8' }}>
              <BadgeCheck size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Seller Information
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
              {sellerDetails.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span style={{ color: '#fbbf24', fontWeight: 700 }}>★ {sellerDetails.rating}</span>
              <span>•</span>
              <span style={{ color: '#34d399' }}>{sellerDetails.statusText}</span>
            </div>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Source: {sellerDetails.source}
          </div>
        </div>

        {/* Card 2: Warranty Terms */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#38bdf8' }}>
              <Award size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Warranty Protection
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
              {warrantyInfo.terms}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {warrantyInfo.isSpecified
                ? 'Direct domestic coverage provided against hardware defects and malfunctions.'
                : 'Warranty not explicitly documented on catalog card; verify with retail packaging.'}
            </div>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Source: {warrantyInfo.source}
          </div>
        </div>

        {/* Card 3: Return Policy */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#10b981' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Return & Refund Policy
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
              {returnPolicyInfo.terms}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hassle-free return or brand replacement if the delivered product is defective, damaged, or unsealed.
            </div>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
            Source: {returnPolicyInfo.source}
          </div>
        </div>
      </div>

      {/* Review Intelligence & Themes Summary */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <FileText size={18} color="var(--accent-primary)" />
              <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Genuine Review Intelligence & Sentiment Themes
              </h4>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Synthesized exclusively from verified purchase customer feedback in our catalog.
            </p>
          </div>

          {reviewSummary.hasSufficientReviews && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ {reviewSummary.verifiedPercent}% Verified Purchases
              </span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#cbd5e1',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {reviewSummary.totalReviews} Total Reviews
              </span>
            </div>
          )}
        </div>

        {reviewSummary.hasSufficientReviews ? (
          <>
            {/* AI Verdict Summary Box */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.07)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                color: '#c7d2fe',
                lineHeight: 1.5,
              }}
            >
              <strong>AI Consensus Verdict:</strong> {reviewSummary.summaryVerdict}
            </div>

            {/* Pros and Cons Split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Common Positive Themes */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#10b981' }}>
                  <ThumbsUp size={16} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Common Praises (Pros)
                  </span>
                </div>
                {reviewSummary.positiveThemes.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {reviewSummary.positiveThemes.map((theme) => (
                      <li
                        key={theme.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <span style={{ color: '#10b981', fontWeight: 800 }}>+</span>
                        <span>{theme.label}</span>
                        {theme.sourceCount > 1 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                            ({theme.sourceCount} mentions)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No strong pros categorized yet.</div>
                )}
              </div>

              {/* Common Negative Themes / Trade-offs */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.04)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#ef4444' }}>
                  <ThumbsDown size={16} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Reported Trade-offs (Cons)
                  </span>
                </div>
                {reviewSummary.negativeThemes.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {reviewSummary.negativeThemes.map((theme) => (
                      <li
                        key={theme.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <span style={{ color: '#ef4444', fontWeight: 800 }}>−</span>
                        <span>{theme.label}</span>
                        {theme.sourceCount > 1 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                            ({theme.sourceCount} mentions)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No frequent critical complaints reported.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <Info size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.6 }} />
            No customer reviews currently logged for this catalog entry.
            <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
              Sentiment analysis activates automatically when authentic buyers leave feedback.
            </div>
          </div>
        )}
      </div>

      {/* Hardware Specifications Table */}
      {hasSpecs && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Layers size={18} color="#a855f7" />
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Verified Hardware Specifications Matrix
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(specifications).map(([key, val]) => (
              <div
                key={key}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {key}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, marginTop: '0.25rem' }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Audit & Missing Information Checklist */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <ShieldAlert size={18} color="#38bdf8" />
          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            Catalog Completeness & Verification Audit
          </h4>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          TrustCart AI transparently flags missing documentation without unsubstantiated fraud claims.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {auditDetails.checks.map((chk, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {chk.status === 'verified' ? (
                  <CheckCircle2 size={18} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                ) : chk.status === 'partial' ? (
                  <HelpCircle size={18} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
                ) : (
                  <Info size={18} color="#64748b" style={{ marginTop: '2px', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>
                    {chk.item}: <span style={{ fontWeight: 400, color: '#cbd5e1' }}>{chk.label}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {chk.notes}
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  background:
                    chk.status === 'verified'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : chk.status === 'partial'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(100, 116, 139, 0.15)',
                  color:
                    chk.status === 'verified'
                      ? '#34d399'
                      : chk.status === 'partial'
                      ? '#fbbf24'
                      : '#94a3b8',
                  flexShrink: 0,
                }}
              >
                {chk.status === 'verified' ? 'Verified' : chk.status === 'partial' ? 'Partial' : 'Unspecified'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
