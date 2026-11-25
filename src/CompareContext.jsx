import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useProducts } from './ProductsContext';
import { MIN_COMPARE_PRODUCTS, MAX_COMPARE_PRODUCTS } from './compareConstants';

const STORAGE_KEY = 'smartshop_ai_compare_ids_v1';
const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const { products, getProductById } = useProducts();

  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      const unique = [];
      for (const id of parsed) {
        const str = String(id || '').trim();
        if (!str || seen.has(str.toLowerCase())) continue;
        seen.add(str.toLowerCase());
        unique.push(str);
        if (unique.length >= MAX_COMPARE_PRODUCTS) break;
      }
      return unique;
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'info'|'warning'|'error'|'success', message: string }

  // Persist selected product IDs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
    } catch {
      // non-blocking
    }
  }, [selectedIds]);

  const showFeedback = useCallback((type, message) => {
    setFeedback({ type, message, ts: Date.now() });
  }, []);

  // Auto-dismiss transient feedback messages after 4.5s
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback((prev) => (prev && prev.ts === feedback.ts ? null : prev));
    }, 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const selectedProducts = useMemo(() => {
    return selectedIds
      .map((id) => getProductById(id))
      .filter(Boolean);
  }, [selectedIds, getProductById, products]);

  const isInCompare = useCallback(
    (productId) => {
      if (!productId) return false;
      const target = String(productId).toLowerCase();
      return selectedIds.some((id) => String(id).toLowerCase() === target);
    },
    [selectedIds]
  );

  const addToCompare = useCallback(
    (productOrId) => {
      const productId = typeof productOrId === 'string' ? productOrId : productOrId?.id;
      const productName = typeof productOrId === 'object' ? productOrId?.name : null;

      if (!productId) {
        showFeedback('error', 'Invalid product cannot be added to comparison.');
        return { ok: false, reason: 'invalid' };
      }

      const target = String(productId).toLowerCase();
      if (selectedIds.some((id) => String(id).toLowerCase() === target)) {
        showFeedback('warning', `"${productName || productId}" is already in your comparison list.`);
        return { ok: false, reason: 'duplicate' };
      }

      if (selectedIds.length >= MAX_COMPARE_PRODUCTS) {
        showFeedback(
          'warning',
          `Maximum ${MAX_COMPARE_PRODUCTS} products allowed for comparison. Remove a product before adding another.`
        );
        return { ok: false, reason: 'limit_reached' };
      }

      setSelectedIds((prev) => [...prev, String(productId)]);
      const nextCount = selectedIds.length + 1;
      showFeedback(
        'success',
        nextCount >= MIN_COMPARE_PRODUCTS
          ? `Added "${productName || productId}" (${nextCount}/${MAX_COMPARE_PRODUCTS}). Ready to compare!`
          : `Added "${productName || productId}" (${nextCount}/${MAX_COMPARE_PRODUCTS}). Select at least ${MIN_COMPARE_PRODUCTS} products to compare.`
      );
      return { ok: true, count: nextCount };
    },
    [selectedIds, showFeedback]
  );

  const removeFromCompare = useCallback(
    (productId) => {
      if (!productId) return;
      const target = String(productId).toLowerCase();
      setSelectedIds((prev) => prev.filter((id) => String(id).toLowerCase() !== target));
      showFeedback('info', 'Product removed from comparison.');
    },
    [showFeedback]
  );

  const toggleCompare = useCallback(
    (product) => {
      if (!product?.id) return { ok: false };
      if (isInCompare(product.id)) {
        removeFromCompare(product.id);
        return { ok: true, action: 'removed' };
      }
      const res = addToCompare(product);
      return { ...res, action: res.ok ? 'added' : 'blocked' };
    },
    [isInCompare, removeFromCompare, addToCompare]
  );

  const clearCompare = useCallback(() => {
    setSelectedIds([]);
    showFeedback('info', 'Cleared all products from comparison.');
  }, [showFeedback]);

  const openCompare = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closeCompare = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const minimizeCompare = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(true);
  }, []);

  const reopenCompare = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const canCompare = selectedIds.length >= MIN_COMPARE_PRODUCTS;
  const isAtMax = selectedIds.length >= MAX_COMPARE_PRODUCTS;

  const value = useMemo(
    () => ({
      selectedIds,
      selectedProducts,
      selectedCount: selectedIds.length,
      minProducts: MIN_COMPARE_PRODUCTS,
      maxProducts: MAX_COMPARE_PRODUCTS,
      canCompare,
      isAtMax,
      isOpen,
      isMinimized,
      feedback,
      clearFeedback: () => setFeedback(null),
      isInCompare,
      addToCompare,
      removeFromCompare,
      toggleCompare,
      clearCompare,
      openCompare,
      closeCompare,
      minimizeCompare,
      reopenCompare
    }),
    [
      selectedIds,
      selectedProducts,
      canCompare,
      isAtMax,
      isOpen,
      isMinimized,
      feedback,
      isInCompare,
      addToCompare,
      removeFromCompare,
      toggleCompare,
      clearCompare,
      openCompare,
      closeCompare,
      minimizeCompare,
      reopenCompare
    ]
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return ctx;
}

export default CompareContext;

