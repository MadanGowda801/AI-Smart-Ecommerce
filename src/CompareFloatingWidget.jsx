import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Scale,
  X,
  Minus,
  Trash2,
  Sparkles,
  RefreshCw,
  Check,
  AlertTriangle,
  Award,
  ThumbsUp,
  ThumbsDown,
  IndianRupee,
  Cpu,
  BatteryCharging,
  Camera,
  Gamepad2,
  Briefcase,
  HardDrive,
  BadgePercent,
  SlidersHorizontal,
  RotateCcw,
  ShoppingCart,
  ExternalLink,
  Loader2,
  Info,
  Maximize2
} from 'lucide-react';
import { useCompare } from './CompareContext';
import { useCart } from './CartContext';
import { useNavigation } from './NavigationContext';
import { compareService } from './compareService';
import { formatINR } from './productsService';
import {
  SUGGESTED_PREFERENCE_OPTIONS,
  CATEGORY_MANUAL_FIELDS,
  EMPTY_MANUAL_REQUIREMENTS,
  NOT_AVAILABLE_LABEL,
  MIN_COMPARE_PRODUCTS,
  MAX_COMPARE_PRODUCTS
} from './compareConstants';
import './compare.css';

const OPTION_ICON_MAP = {
  budget_friendly: IndianRupee,
  best_performance: Cpu,
  battery_life: BatteryCharging,
  camera_display: Camera,
  gaming_entertainment: Gamepad2,
  student_office: Briefcase,
  storage_connectivity: HardDrive,
  best_overall_value: BadgePercent
};

const WEIGHT_LABELS = {
  budgetPrice: 'Budget & Price Suitability',
  performanceSpecs: 'Performance & Specs',
  userPriorities: 'Your Selected Priorities',
  qualityRatings: 'Quality & Ratings',
  warrantyReliability: 'Warranty & Availability',
  valueForMoney: 'Overall Value for Money'
};

export function CompareFloatingWidget() {
  const {
    selectedIds,
    selectedProducts,
    selectedCount,
    canCompare,
    isAtMax,
    isOpen,
    isMinimized,
    feedback,
    clearFeedback,
    removeFromCompare,
    clearCompare,
    openCompare,
    closeCompare,
    minimizeCompare,
    reopenCompare
  } = useCompare();

  const { addItem } = useCart();
  const { currentPath, navigate } = useNavigation();

  // Real-time matrix state
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [dataSource, setDataSource] = useState(null);

  // Table display toggles
  const [highlightDiffs, setHighlightDiffs] = useState(true);
  const [diffsOnly, setDiffsOnly] = useState(false);

  // Section 5: 8 Pre-Suggested Options state { [optionId]: string[] (selected subOption ids) }
  const [selectedPrefMap, setSelectedPrefMap] = useState({});
  const [customBudgetInput, setCustomBudgetInput] = useState('');

  // Section 6: Manual Requirements state (draft + applied)
  const [manualDraft, setManualDraft] = useState({ ...EMPTY_MANUAL_REQUIREMENTS });
  const [appliedPreferences, setAppliedPreferences] = useState(null);
  const [prefsAppliedToast, setPrefsAppliedToast] = useState(false);

  // Section 7 & 8: AI Recommendation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [addedWinnerToCart, setAddedWinnerToCart] = useState(false);

  const resultSectionRef = useRef(null);

  // Hide floating trigger during active checkout submit screens if empty, or tuck neatly so checkout controls are never covered
  const isCheckoutPage = currentPath === 'checkout';

  // Fetch & revalidate real-time comparison matrix whenever selectedIds (>=2) changes and panel is open
  const loadLiveMatrix = async (idsToFetch) => {
    if (!Array.isArray(idsToFetch) || idsToFetch.length < MIN_COMPARE_PRODUCTS) {
      setMatrixData(null);
      setMatrixError(null);
      return;
    }
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const res = await compareService.fetchComparisonMatrix(idsToFetch);
      setMatrixData(res.matrix);
      setFetchedAt(res.fetchedAt);
      setDataSource(res.dataSource);
    } catch (err) {
      setMatrixError(err.message || 'Failed to load live product comparison data.');
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    // Clear stale AI result when product selection changes
    setAiResult(null);
    setAiError(null);
    if (isOpen && selectedIds.length >= MIN_COMPARE_PRODUCTS) {
      loadLiveMatrix(selectedIds);
    } else if (selectedIds.length < MIN_COMPARE_PRODUCTS) {
      setMatrixData(null);
    }
  }, [selectedIds.join(','), isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeCompare();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeCompare]);

  // Determine relevant category bucket for Section 6 manual inputs
  const activeCategoryBucket = useMemo(() => {
    if (manualDraft.productCategory) {
      const val = manualDraft.productCategory.toLowerCase();
      if (CATEGORY_MANUAL_FIELDS[val]) return val;
    }
    return matrixData?.dominantCategoryBucket || 'electronics';
  }, [manualDraft.productCategory, matrixData]);

  const visibleManualFields = useMemo(() => {
    return new Set(CATEGORY_MANUAL_FIELDS[activeCategoryBucket] || CATEGORY_MANUAL_FIELDS.electronics);
  }, [activeCategoryBucket]);

  // Toggle one of the 8 preference cards
  const togglePrefCard = (optionId) => {
    setSelectedPrefMap((prev) => {
      const next = { ...prev };
      if (next[optionId]) {
        delete next[optionId];
      } else {
        next[optionId] = [];
      }
      return next;
    });
  };

  // Toggle a sub-option chip inside a preference card
  const togglePrefSubOption = (e, optionId, subOpt) => {
    e.stopPropagation();
    setSelectedPrefMap((prev) => {
      const current = prev[optionId] || [];
      const exists = current.includes(subOpt.id);
      let updated;
      if (optionId === 'budget_friendly') {
        // Budget brackets act cleanly as single-select radio chips (or deselect on second click)
        updated = exists ? [] : [subOpt.id];
      } else {
        updated = exists ? current.filter((x) => x !== subOpt.id) : [...current, subOpt.id];
      }
      return { ...prev, [optionId]: updated };
    });
  };

  // Build unified preferences payload (combining 8 suggested cards + manual requirements)
  const buildPreferencesPayload = () => {
    const selectedOptions = Object.entries(selectedPrefMap).map(([id, subOptions]) => ({
      id,
      subOptions
    }));

    return {
      selectedOptions,
      customBudget: selectedPrefMap.budget_friendly?.includes('custom_budget') ? customBudgetInput : '',
      manual: { ...manualDraft }
    };
  };

  const handleApplyPreferences = () => {
    const payload = buildPreferencesPayload();
    setAppliedPreferences(payload);
    setPrefsAppliedToast(true);
    setTimeout(() => setPrefsAppliedToast(false), 2600);
  };

  const handleResetPreferences = () => {
    setSelectedPrefMap({});
    setCustomBudgetInput('');
    setManualDraft({ ...EMPTY_MANUAL_REQUIREMENTS });
    setAppliedPreferences(null);
    setAiResult(null);
    setAiError(null);
  };

  const handleGenerateRecommendation = async () => {
    if (!canCompare) return;
    const prefsPayload = buildPreferencesPayload();
    setAppliedPreferences(prefsPayload);
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await compareService.generateRecommendation(selectedIds, prefsPayload);
      setMatrixData(res.matrix);
      setFetchedAt(res.fetchedAt);
      setDataSource(res.dataSource);
      setAiResult(res);
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err) {
      setAiError(
        err.message ||
          'AI recommendation service encountered an error. Your comparison table remains fully available above.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const activePrefCount = useMemo(() => {
    const cardCount = Object.keys(selectedPrefMap).length;
    const manualCount = Object.values(manualDraft).filter((v) => String(v || '').trim().length > 0).length;
    return cardCount + manualCount;
  }, [selectedPrefMap, manualDraft]);

  const winnerId = aiResult?.recommendation?.bestProduct?.productId || null;

  const displayedRows = useMemo(() => {
    if (!matrixData?.rows) return [];
    if (!diffsOnly) return matrixData.rows;
    return matrixData.rows.filter((r) => r.hasDifference);
  }, [matrixData, diffsOnly]);

  const handleNavigateProduct = (productId) => {
    minimizeCompare();
    navigate('product-details', { params: { id: productId } });
  };

  return (
    <>
      {/* 1. Floating Button / Minimized Reopen Bar */}
      {!isOpen && !(isCheckoutPage && selectedCount === 0) && (
        <div className="ai-compare-fab-wrap">
          {feedback && (
            <div className={`ai-compare-toast ${feedback.type || 'info'}`} role="status">
              <Info size={15} style={{ flexShrink: 0 }} />
              <span>{feedback.message}</span>
              <button
                onClick={clearFeedback}
                aria-label="Dismiss message"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  padding: '2px'
                }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          <button
            id="ai-compare-floating-btn"
            className={`ai-compare-fab ${isMinimized ? 'is-minimized' : ''}`}
            onClick={isMinimized ? reopenCompare : openCompare}
            aria-label="AI Compare Products"
            title="Open AI Smart Product Comparison"
          >
            <Scale size={18} />
            <span>{isMinimized ? 'Reopen AI Compare' : 'AI Compare Products'}</span>
            <span className={`ai-compare-fab-badge ${canCompare ? 'ready' : ''}`}>
              {selectedCount}/{MAX_COMPARE_PRODUCTS}
            </span>
            {isMinimized && <Maximize2 size={14} />}
          </button>
        </div>
      )}

      {/* 2. Floating Comparison Drawer / Modal */}
      {isOpen && (
        <div
          className="ai-compare-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="AI Smart Product Comparison"
          onClick={(e) => {
            if (e.target === e.currentTarget) minimizeCompare();
          }}
        >
          <div className="ai-compare-drawer">
            {/* Drawer Header */}
            <div className="ai-compare-header">
              <div className="ai-compare-header-left">
                <div className="ai-compare-icon-box">
                  <Scale size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 className="ai-compare-title">AI Compare Products</h2>
                  <div className="ai-compare-subtitle">
                    {selectedCount} of {MAX_COMPARE_PRODUCTS} products selected
                    {fetchedAt && (
                      <>
                        {' · '}
                        Live data verified at {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {dataSource === 'insforge_live' ? ' (InsForge DB)' : ''}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="ai-compare-header-actions">
                {canCompare && (
                  <button
                    className="ai-compare-icon-btn"
                    onClick={() => loadLiveMatrix(selectedIds)}
                    disabled={matrixLoading}
                    title="Re-fetch latest prices, stock & specs"
                  >
                    <RefreshCw size={14} className={matrixLoading ? 'animate-spin' : ''} />
                    <span className="hide-on-mobile">Refresh</span>
                  </button>
                )}
                <button
                  className="ai-compare-icon-btn"
                  onClick={minimizeCompare}
                  title="Minimize panel while browsing"
                  aria-label="Minimize comparison panel"
                >
                  <Minus size={15} />
                  <span className="hide-on-mobile">Minimize</span>
                </button>
                <button
                  className="ai-compare-icon-btn close-btn"
                  onClick={closeCompare}
                  title="Close comparison panel"
                  aria-label="Close comparison panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="ai-compare-body">
              {/* Inline Feedback / Max Limit Alert */}
              {feedback && (
                <div
                  style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${feedback.type === 'warning' ? 'var(--gold-border)' : feedback.type === 'error' ? 'rgba(248,113,113,0.45)' : 'var(--accent-border)'}`,
                    background: feedback.type === 'warning' ? 'var(--warning-bg)' : feedback.type === 'error' ? 'var(--error-bg)' : 'var(--accent-soft)',
                    color: feedback.type === 'warning' ? 'var(--accent-gold-light)' : feedback.type === 'error' ? 'var(--error)' : 'var(--text-accent)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}
                >
                  <span>{feedback.message}</span>
                  <button
                    onClick={clearFeedback}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* A. Selected Products Management Strip */}
              <div className="ai-compare-selected-strip">
                <div className="ai-compare-strip-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Selected Products ({selectedCount}/{MAX_COMPARE_PRODUCTS})
                    </strong>
                    {isAtMax && (
                      <span className="ai-compare-pill gold">
                        <AlertTriangle size={11} /> Maximum 5 products reached
                      </span>
                    )}
                    {!canCompare && selectedCount > 0 && (
                      <span className="ai-compare-pill teal">
                        Add {MIN_COMPARE_PRODUCTS - selectedCount} more product to start comparison
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      className="ai-compare-icon-btn"
                      onClick={() => {
                        minimizeCompare();
                        navigate('products');
                      }}
                    >
                      + Browse Products
                    </button>
                    {selectedCount > 0 && (
                      <button
                        className="ai-compare-icon-btn close-btn"
                        onClick={clearCompare}
                        id="ai-compare-clear-all-btn"
                      >
                        <Trash2 size={14} /> Clear All
                      </button>
                    )}
                  </div>
                </div>

                {selectedCount === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.8rem 1rem', color: 'var(--text-muted)' }}>
                    <Scale size={36} style={{ opacity: 0.45, marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      No Products Selected Yet
                    </div>
                    <p style={{ fontSize: '0.82rem', maxWidth: '460px', margin: '0 auto 1rem' }}>
                      Click <strong>Compare</strong> on any 2 to 5 product cards or product detail pages to inspect verified specs side by side and get an AI-tailored recommendation.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        minimizeCompare();
                        navigate('products');
                      }}
                    >
                      Explore Catalog to Compare
                    </button>
                  </div>
                ) : (
                  <div className="ai-compare-selected-grid">
                    {selectedProducts.map((prod) => (
                      <div key={prod.id} className="ai-compare-chip-card">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://placehold.co/100x100/0f1e23/14b8a6?text=${encodeURIComponent(prod.id)}`;
                          }}
                        />
                        <div className="ai-compare-chip-meta">
                          <div className="ai-compare-chip-name" title={prod.name}>
                            {prod.name}
                          </div>
                          <div className="ai-compare-chip-price">
                            {formatINR(prod.price)}
                          </div>
                        </div>
                        <button
                          className="ai-compare-chip-remove"
                          onClick={() => removeFromCompare(prod.id)}
                          title={`Remove ${prod.name}`}
                          aria-label={`Remove ${prod.name}`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Minimum-2 Guard Notice */}
              {selectedCount === 1 && (
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--accent-border)',
                    background: 'rgba(20, 184, 166, 0.06)',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.86rem'
                  }}
                >
                  <strong>1 product selected.</strong> Select at least <strong>2 products</strong> (up to 5) to unlock the comparison table and AI recommendation engine.
                </div>
              )}

              {/* B. Category-Specific Product Comparison Table */}
              {canCompare && (
                <section className="ai-compare-section" aria-label="Product Comparison Table">
                  <div className="ai-compare-section-header">
                    <div>
                      <h3 className="ai-compare-section-title">
                        <Scale size={18} color="var(--accent-primary)" />
                        Side-by-Side Specification Comparison
                      </h3>
                      {matrixData?.isCrossCategory && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold-light)', marginTop: '3px' }}>
                          Comparing items from multiple categories — showing shared specs + applicable category specifications.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={highlightDiffs}
                          onChange={(e) => setHighlightDiffs(e.target.checked)}
                        />
                        Highlight Differences
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={diffsOnly}
                          onChange={(e) => setDiffsOnly(e.target.checked)}
                        />
                        Differences Only
                      </label>
                    </div>
                  </div>

                  {matrixLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '2rem', color: 'var(--text-accent)' }}>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Fetching latest real-time product prices, stock, and specifications...</span>
                    </div>
                  )}

                  {matrixError && !matrixLoading && (
                    <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--error-bg)', border: '1px solid rgba(248,113,113,0.4)', color: 'var(--error)', fontSize: '0.84rem' }}>
                      <strong>Error loading comparison table:</strong> {matrixError}
                    </div>
                  )}

                  {matrixData && !matrixLoading && (
                    <div className="ai-compare-table-scroll">
                      <table className="ai-compare-table">
                        <thead>
                          <tr>
                            <th className="ai-compare-spec-col">Specification</th>
                            {matrixData.products.map((p) => {
                              const isLowest = matrixData.lowestPriceIds?.includes(p.id);
                              const isBestVal = matrixData.bestValueIds?.includes(p.id);
                              const isWinner = winnerId && winnerId.toLowerCase() === p.id.toLowerCase();
                              return (
                                <th
                                  key={p.id}
                                  className={`ai-compare-product-col-head ${isWinner ? 'ai-compare-col-winner' : ''}`}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                      <img
                                        src={p.image}
                                        alt={p.name}
                                        onClick={() => handleNavigateProduct(p.id)}
                                        style={{
                                          width: '74px',
                                          height: '74px',
                                          borderRadius: '10px',
                                          objectFit: 'cover',
                                          cursor: 'pointer',
                                          border: '1px solid var(--border-subtle)'
                                        }}
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = `https://placehold.co/120x120/0f1e23/14b8a6?text=${encodeURIComponent(p.id)}`;
                                        }}
                                      />
                                      <button
                                        className="ai-compare-chip-remove"
                                        onClick={() => removeFromCompare(p.id)}
                                        title={`Remove ${p.name}`}
                                        aria-label={`Remove ${p.name}`}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>

                                    <div
                                      onClick={() => handleNavigateProduct(p.id)}
                                      style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', cursor: 'pointer', lineHeight: 1.3 }}
                                    >
                                      {p.name}
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                      {isWinner && (
                                        <span className="ai-compare-pill gold">
                                          <Award size={11} /> AI Winner
                                        </span>
                                      )}
                                      {isLowest && matrixData.products.length > 1 && (
                                        <span className="ai-compare-pill emerald">Lowest Price</span>
                                      )}
                                      {isBestVal && (
                                        <span className="ai-compare-pill teal">Best Value</span>
                                      )}
                                    </div>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRows.map((row) => (
                            <tr
                              key={row.key}
                              className={highlightDiffs && row.hasDifference ? 'ai-compare-row-diff' : ''}
                            >
                              <td className="ai-compare-spec-col">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                                  <span>{row.label}</span>
                                  {highlightDiffs && row.hasDifference && (
                                    <span
                                      title="Differs across compared products"
                                      style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: 'var(--accent-primary)',
                                        flexShrink: 0
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                              {row.values.map((val, idx) => {
                                const prod = matrixData.products[idx];
                                const isMissing = val === NOT_AVAILABLE_LABEL;
                                const isHighlighted = row.highlightIds?.includes(prod.id);
                                const isWinner = winnerId && winnerId.toLowerCase() === prod.id.toLowerCase();
                                return (
                                  <td
                                    key={`${row.key}-${prod.id}`}
                                    className={`${isWinner ? 'ai-compare-col-winner' : ''} ${isMissing ? 'ai-compare-cell-na' : ''} ${isHighlighted ? 'ai-compare-cell-highlight' : ''}`}
                                  >
                                    {val}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* C. Section 5: 8 Pre-Suggested Smart Requirement Cards */}
              {canCompare && (
                <section className="ai-compare-section" aria-label="Smart Requirement Selection">
                  <div className="ai-compare-section-header">
                    <div>
                      <h3 className="ai-compare-section-title">
                        <Sparkles size={18} color="var(--accent-gold)" />
                        What matters most to you?
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Select one or more priority cards and sub-options below to shape the AI weighting.
                      </div>
                    </div>
                    {Object.keys(selectedPrefMap).length > 0 && (
                      <span className="ai-compare-pill teal">
                        {Object.keys(selectedPrefMap).length} Priority Card{Object.keys(selectedPrefMap).length > 1 ? 's' : ''} Active
                      </span>
                    )}
                  </div>

                  <div className="ai-compare-pref-grid">
                    {SUGGESTED_PREFERENCE_OPTIONS.map((opt) => {
                      const Icon = OPTION_ICON_MAP[opt.id] || Sparkles;
                      const isSelected = Object.prototype.hasOwnProperty.call(selectedPrefMap, opt.id);
                      const chosenSubs = selectedPrefMap[opt.id] || [];
                      return (
                        <div
                          key={opt.id}
                          className={`ai-compare-pref-card ${isSelected ? 'active' : ''}`}
                          onClick={() => togglePrefCard(opt.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              togglePrefCard(opt.id);
                            }
                          }}
                        >
                          <div className="ai-compare-pref-card-head">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Icon size={15} color={isSelected ? 'var(--accent-gold-light)' : 'var(--accent-primary)'} />
                              <span className="ai-compare-pref-title">
                                OPTION {opt.optionNumber}: {opt.title}
                              </span>
                            </div>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#04090a',
                                flexShrink: 0
                              }}
                            >
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </span>
                          </div>

                          <div className="ai-compare-pref-desc">{opt.description}</div>

                          <div className="ai-compare-subchips">
                            {opt.subOptions.map((sub) => {
                              const subActive = chosenSubs.includes(sub.id);
                              return (
                                <button
                                  type="button"
                                  key={sub.id}
                                  className={`ai-compare-subchip ${subActive ? 'selected' : ''}`}
                                  onClick={(e) => togglePrefSubOption(e, opt.id, sub)}
                                >
                                  {sub.label}
                                </button>
                              );
                            })}
                          </div>

                          {opt.id === 'budget_friendly' && chosenSubs.includes('custom_budget') && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ marginTop: '0.35rem' }}
                            >
                              <input
                                type="number"
                                min="500"
                                step="500"
                                className="ai-compare-input"
                                placeholder="Enter custom max budget in ₹ (e.g. 25000)"
                                value={customBudgetInput}
                                onChange={(e) => setCustomBudgetInput(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* D. Section 6: Manual Requirement Input */}
              {canCompare && (
                <section className="ai-compare-section" aria-label="Manual Requirements">
                  <div className="ai-compare-section-header">
                    <div>
                      <h3 className="ai-compare-section-title">
                        <SlidersHorizontal size={18} color="var(--accent-primary)" />
                        Enter Your Own Requirements
                      </h3>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        All fields are optional and tailored to the compared category. Combine with suggested cards above for precise AI evaluation.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="ai-compare-icon-btn"
                        onClick={handleResetPreferences}
                        id="ai-compare-reset-prefs-btn"
                      >
                        <RotateCcw size={14} /> Reset
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
                        onClick={handleApplyPreferences}
                        id="ai-compare-apply-prefs-btn"
                      >
                        <Check size={14} /> Apply Preferences
                      </button>
                    </div>
                  </div>

                  {prefsAppliedToast && (
                    <div
                      style={{
                        marginBottom: '0.85rem',
                        padding: '0.5rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--success-bg)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        color: '#34d399',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      Preferences applied ({activePrefCount} criteria active). Click &quot;Generate AI Recommendation&quot; below to evaluate!
                    </div>
                  )}

                  <div className="ai-compare-manual-grid">
                    {visibleManualFields.has('maxBudget') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-max-budget">Maximum Budget (₹)</label>
                        <input
                          id="cmp-max-budget"
                          type="number"
                          min="0"
                          className="ai-compare-input"
                          placeholder="e.g. 25000"
                          value={manualDraft.maxBudget}
                          onChange={(e) => setManualDraft((p) => ({ ...p, maxBudget: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('preferredBrand') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-brand">Preferred Brand</label>
                        <input
                          id="cmp-brand"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. AeroTech, NovaMobile, SonicWave"
                          value={manualDraft.preferredBrand}
                          onChange={(e) => setManualDraft((p) => ({ ...p, preferredBrand: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('productCategory') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-category">Product Category</label>
                        <select
                          id="cmp-category"
                          className="ai-compare-input"
                          value={manualDraft.productCategory}
                          onChange={(e) => setManualDraft((p) => ({ ...p, productCategory: e.target.value }))}
                        >
                          <option value="">Auto-detected ({matrixData?.dominantCategoryBucket || 'electronics'})</option>
                          <option value="electronics">Electronics &amp; Laptops</option>
                          <option value="smartphones">Smartphones</option>
                          <option value="wearables">Wearables &amp; Smartwatches</option>
                          <option value="audio">Audio &amp; Headphones</option>
                          <option value="smart-home">Smart Home &amp; IoT</option>
                          <option value="accessories">Accessories &amp; Gadgets</option>
                          <option value="gaming">Gaming &amp; Displays</option>
                        </select>
                      </div>
                    )}

                    {visibleManualFields.has('primaryUsage') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-usage">Primary Usage</label>
                        <input
                          id="cmp-usage"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. Programming, video editing, daily commute"
                          value={manualDraft.primaryUsage}
                          onChange={(e) => setManualDraft((p) => ({ ...p, primaryUsage: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('minRam') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-ram">Minimum RAM</label>
                        <select
                          id="cmp-ram"
                          className="ai-compare-input"
                          value={manualDraft.minRam}
                          onChange={(e) => setManualDraft((p) => ({ ...p, minRam: e.target.value }))}
                        >
                          <option value="">Any RAM</option>
                          <option value="8GB">8GB or higher</option>
                          <option value="12GB">12GB or higher</option>
                          <option value="16GB">16GB or higher</option>
                          <option value="32GB">32GB or higher</option>
                        </select>
                      </div>
                    )}

                    {visibleManualFields.has('minStorage') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-storage">Minimum Storage</label>
                        <select
                          id="cmp-storage"
                          className="ai-compare-input"
                          value={manualDraft.minStorage}
                          onChange={(e) => setManualDraft((p) => ({ ...p, minStorage: e.target.value }))}
                        >
                          <option value="">Any Storage</option>
                          <option value="128GB">128GB or higher</option>
                          <option value="256GB">256GB or higher</option>
                          <option value="512GB">512GB or higher</option>
                          <option value="1TB">1TB or higher</option>
                        </select>
                      </div>
                    )}

                    {visibleManualFields.has('preferredProcessor') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-cpu">Preferred Processor</label>
                        <input
                          id="cmp-cpu"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. Snapdragon 8, Intel Core, Apple M3"
                          value={manualDraft.preferredProcessor}
                          onChange={(e) => setManualDraft((p) => ({ ...p, preferredProcessor: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('minBattery') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-battery">Minimum Battery Capacity</label>
                        <input
                          id="cmp-battery"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. 5000mAh or 14-hour or 40 hours"
                          value={manualDraft.minBattery}
                          onChange={(e) => setManualDraft((p) => ({ ...p, minBattery: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('preferredDisplaySize') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-display">Preferred Display Size</label>
                        <input
                          id="cmp-display"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. 14-inch, 6.7-inch, 27-inch"
                          value={manualDraft.preferredDisplaySize}
                          onChange={(e) => setManualDraft((p) => ({ ...p, preferredDisplaySize: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('cameraRequirements') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-camera">Camera Requirements</label>
                        <input
                          id="cmp-camera"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. OIS, 50MP+, night vision, 1080p 60fps"
                          value={manualDraft.cameraRequirements}
                          onChange={(e) => setManualDraft((p) => ({ ...p, cameraRequirements: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('warrantyPreference') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-warranty">Warranty Preference</label>
                        <select
                          id="cmp-warranty"
                          className="ai-compare-input"
                          value={manualDraft.warrantyPreference}
                          onChange={(e) => setManualDraft((p) => ({ ...p, warrantyPreference: e.target.value }))}
                        >
                          <option value="">Any Warranty</option>
                          <option value="1 Year">At least 1 Year Warranty</option>
                          <option value="2 Years">2 Years Warranty</option>
                        </select>
                      </div>
                    )}

                    {visibleManualFields.has('requiredConnectivity') && (
                      <div className="ai-compare-field">
                        <label htmlFor="cmp-conn">Required Connectivity</label>
                        <input
                          id="cmp-conn"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. 5G, Wi-Fi 6E, Bluetooth 5.3, USB-C, HDMI"
                          value={manualDraft.requiredConnectivity}
                          onChange={(e) => setManualDraft((p) => ({ ...p, requiredConnectivity: e.target.value }))}
                        />
                      </div>
                    )}

                    {visibleManualFields.has('otherRequirements') && (
                      <div className="ai-compare-field full-span">
                        <label htmlFor="cmp-other">Other Special Requirements</label>
                        <input
                          id="cmp-other"
                          type="text"
                          className="ai-compare-input"
                          placeholder="e.g. Lightweight under 1.5kg, ANC, waterproof IPX7, touchscreen stylus..."
                          value={manualDraft.otherRequirements}
                          onChange={(e) => setManualDraft((p) => ({ ...p, otherRequirements: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  {/* Primary AI Recommendation Trigger */}
                  <div style={{ marginTop: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {appliedPreferences
                        ? `Ready with ${activePrefCount} combined preference criteria (revalidates live catalog data).`
                        : 'You can generate a balanced AI recommendation right away or combine any preferences above.'}
                    </div>

                    <button
                      type="button"
                      id="ai-compare-generate-btn"
                      className="btn btn-primary"
                      disabled={!canCompare || aiLoading}
                      onClick={handleGenerateRecommendation}
                      style={{ padding: '0.78rem 1.5rem', fontSize: '0.92rem' }}
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 size={17} className="animate-spin" />
                          <span>Analyzing Live Specs &amp; Generating Recommendation...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={17} />
                          <span>Generate AI Recommendation</span>
                        </>
                      )}
                    </button>
                  </div>
                </section>
              )}

              {/* AI Error Banner (Comparison table remains working above) */}
              {aiError && (
                <div
                  style={{
                    padding: '1rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--error-bg)',
                    border: '1px solid rgba(248, 113, 113, 0.45)',
                    color: 'var(--error)',
                    fontSize: '0.84rem'
                  }}
                >
                  <strong>AI Recommendation Notice:</strong> {aiError}
                </div>
              )}

              {/* E. Section 8: AI Final Result Section (Below Comparison Table) */}
              {aiResult?.recommendation && (
                <section
                  ref={resultSectionRef}
                  className="ai-compare-section ai-compare-result-wrap"
                  aria-label="AI Final Recommendation Result"
                  id="ai-compare-final-result"
                >
                  <div className="ai-compare-section-header" style={{ marginBottom: 0 }}>
                    <h3 className="ai-compare-section-title">
                      <Award size={20} color="var(--accent-gold)" />
                      AI Final Recommendation Result
                    </h3>
                    <span className={`ai-compare-pill ${aiResult.aiEnhanced ? 'gold' : 'teal'}`}>
                      {aiResult.aiEnhanced ? 'AI Enhanced + Weighted Engine' : 'Verified Weighted Engine'}
                    </span>
                  </div>

                  {/* Fallback / Incomplete Data Notices */}
                  {aiResult.aiNotice && (
                    <div style={{ padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', background: 'var(--info-bg)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#bae6fd', fontSize: '0.79rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{aiResult.aiNotice}</span>
                    </div>
                  )}

                  {aiResult.recommendation.incompleteDataNotice && (
                    <div style={{ padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', background: 'var(--warning-bg)', border: '1px solid var(--gold-border)', color: 'var(--accent-gold-light)', fontSize: '0.79rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{aiResult.recommendation.incompleteDataNotice}</span>
                    </div>
                  )}

                  {/* 1. BEST PRODUCT FOR YOU */}
                  <div className="ai-compare-winner-card">
                    <img
                      className="ai-compare-winner-img"
                      src={aiResult.recommendation.bestProduct.image}
                      alt={aiResult.recommendation.bestProduct.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://placehold.co/150x150/0f1e23/f59e0b?text=Best`;
                      }}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <span className="ai-compare-pill gold">
                          <Award size={12} /> BEST PRODUCT FOR YOU
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {aiResult.recommendation.bestProduct.brand}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.3rem' }}>
                        {aiResult.recommendation.bestProduct.name}
                      </h3>

                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-accent)', marginBottom: '0.5rem' }}>
                        {aiResult.recommendation.bestProduct.priceFormatted}
                      </div>

                      <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 0.75rem' }}>
                        {aiResult.recommendation.bestProduct.reason}
                      </p>

                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
                          onClick={() => {
                            const fullProd = selectedProducts.find(
                              (sp) => sp.id.toLowerCase() === aiResult.recommendation.bestProduct.productId.toLowerCase()
                            );
                            if (fullProd) {
                              addItem(fullProd, 1);
                              setAddedWinnerToCart(true);
                              setTimeout(() => setAddedWinnerToCart(false), 1800);
                            }
                          }}
                        >
                          {addedWinnerToCart ? <Check size={15} /> : <ShoppingCart size={15} />}
                          <span>{addedWinnerToCart ? 'Added to Cart!' : 'Add Winner to Cart'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
                          onClick={() => handleNavigateProduct(aiResult.recommendation.bestProduct.productId)}
                        >
                          <ExternalLink size={14} /> View Product Details
                        </button>
                      </div>
                    </div>

                    <div
                      className="ai-compare-score-ring"
                      style={{ '--score-deg': `${Math.round((aiResult.recommendation.bestProduct.overallScore / 100) * 360)}deg` }}
                      title="Advisory overall suitability score out of 100"
                    >
                      <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                        {aiResult.recommendation.bestProduct.overallScore}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-accent)', fontWeight: 700 }}>/ 100</span>
                    </div>
                  </div>

                  {/* Transparent Weighted Evaluation Breakdown */}
                  {aiResult.scoring?.weights && aiResult.scoring?.ranked && (
                    <div className="ai-compare-analysis-card">
                      <h4>TRANSPARENT WEIGHTED EVALUATION SCORES</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                        {Object.entries(aiResult.scoring.weights).map(([k, pct]) => (
                          <span key={k} className="ai-compare-pill teal">
                            {WEIGHT_LABELS[k] || k}: {pct}%
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                        {aiResult.scoring.ranked.map((r, idx) => (
                          <div
                            key={r.productId}
                            style={{
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              background: idx === 0 ? 'rgba(20, 184, 166, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                              border: `1px solid ${idx === 0 ? 'var(--accent-border)' : 'var(--border-subtle)'}`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', gap: '0.5rem' }}>
                              <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                #{idx + 1} {r.name}
                              </strong>
                              <span style={{ fontWeight: 800, color: idx === 0 ? 'var(--accent-gold-light)' : 'var(--text-accent)', fontSize: '0.86rem' }}>
                                {r.overallScore}/100
                              </span>
                            </div>
                            <div style={{ height: '7px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '0.45rem' }}>
                              <div
                                style={{
                                  width: `${r.overallScore}%`,
                                  height: '100%',
                                  background: idx === 0 ? 'var(--amber-gradient)' : 'var(--accent-gradient)'
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                              <span>Budget: {r.breakdown.budgetPrice}</span>
                              <span>Specs: {r.breakdown.performanceSpecs}</span>
                              <span>Priorities: {r.breakdown.userPriorities}</span>
                              <span>Ratings: {r.breakdown.qualityRatings}</span>
                              <span>Reliability: {r.breakdown.warrantyReliability}</span>
                              <span>Value: {r.breakdown.valueForMoney}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. WHY THIS PRODUCT IS BEST & PRICE/VALUE ANALYSIS */}
                  <div className="ai-compare-analysis-grid">
                    <div className="ai-compare-analysis-card">
                      <h4><Sparkles size={15} /> WHY THIS PRODUCT IS BEST</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {aiResult.recommendation.whyBest}
                      </p>
                    </div>

                    <div className="ai-compare-analysis-card">
                      <h4><IndianRupee size={15} /> PRICE AND VALUE ANALYSIS</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {aiResult.recommendation.priceValueAnalysis}
                      </p>
                    </div>
                  </div>

                  {/* 3. ADVANTAGES & DISADVANTAGES */}
                  <div className="ai-compare-analysis-grid">
                    <div className="ai-compare-analysis-card">
                      <h4 style={{ color: '#34d399' }}><ThumbsUp size={15} /> ADVANTAGES</h4>
                      <ul className="ai-compare-list">
                        {(aiResult.recommendation.advantages || []).map((adv, idx) => (
                          <li key={idx}>{adv}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="ai-compare-analysis-card">
                      <h4 style={{ color: '#fbbf24' }}><ThumbsDown size={15} /> DISADVANTAGES</h4>
                      <ul className="ai-compare-list">
                        {(aiResult.recommendation.disadvantages || []).map((dis, idx) => (
                          <li key={idx}>{dis}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 4. RUNNER-UP & OTHER PRODUCTS */}
                  <div className="ai-compare-analysis-grid">
                    {aiResult.recommendation.runnerUp && (
                      <div className="ai-compare-analysis-card">
                        <h4 style={{ color: 'var(--accent-gold-light)' }}><Award size={15} /> RUNNER-UP</h4>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.55rem' }}>
                          <img
                            src={aiResult.recommendation.runnerUp.image}
                            alt={aiResult.recommendation.runnerUp.name}
                            style={{ width: '54px', height: '54px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://placehold.co/80x80/0f1e23/14b8a6?text=2nd`;
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                              {aiResult.recommendation.runnerUp.name}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-accent)', fontWeight: 700 }}>
                              {aiResult.recommendation.runnerUp.priceFormatted} · Score: {aiResult.recommendation.runnerUp.overallScore}/100
                            </div>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                          {aiResult.recommendation.runnerUp.whenBetter}
                        </p>
                      </div>
                    )}

                    <div className="ai-compare-analysis-card">
                      <h4>OTHER PRODUCTS</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {(aiResult.recommendation.otherProducts || []).map((op) => (
                          <div
                            key={op.productId}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(255, 255, 255, 0.025)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.82rem',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.5
                            }}
                          >
                            {op.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5. FINAL VERDICT */}
                  <div className="ai-compare-verdict-box">
                    <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={16} color="var(--accent-gold)" /> FINAL VERDICT
                    </h4>
                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.6 }}>
                      {aiResult.recommendation.finalVerdict}
                    </p>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                      {aiResult.recommendation.disclaimer}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CompareFloatingWidget;

