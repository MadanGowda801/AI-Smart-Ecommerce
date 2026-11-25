import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import productsService, { normalizeProduct } from './productsService';
import { CATEGORIES, INITIAL_PRODUCTS, INITIAL_REVIEWS, LEGACY_TEST_PRODUCTS } from './mockData';
import insforge from './insforge';
import { deleteProductImage } from './storageService';
import { useNotifications } from './NotificationContext';

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const { sendNotification } = useNotifications();
  const [products, setProducts] = useState(() => INITIAL_PRODUCTS.map((p) => normalizeProduct(p)));
  const [categories, setCategories] = useState(() => CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [reviews, setReviews] = useState(() => {
    try {
      const stored = localStorage.getItem('aurastore_reviews');
      return stored ? JSON.parse(stored) : INITIAL_REVIEWS;
    } catch {
      return INITIAL_REVIEWS;
    }
  });

  // Sync reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('aurastore_reviews', JSON.stringify(reviews));
    } catch (e) {
      console.warn('Could not save reviews to localStorage', e);
    }
  }, [reviews]);

  /**
   * Fetch all live categories and products from InsForge database
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catResult, prodResult] = await Promise.all([
        productsService.getCategories(),
        productsService.getProducts({ limit: 100 })
      ]);

      if (catResult.error && prodResult.error) {
        throw new Error(catResult.error.message || prodResult.error.message || 'Failed to connect to database');
      }

      const baseCatalog = INITIAL_PRODUCTS.map((p) => normalizeProduct(p));
      const baseIds = new Set(baseCatalog.map((p) => String(p.id).toLowerCase()));
      const baseNames = new Set(baseCatalog.map((p) => String(p.name || '').toLowerCase()));

      let mergedProducts = baseCatalog;
      if (prodResult.data && prodResult.data.length > 0) {
        const extraDbProducts = prodResult.data.filter(
          (p) =>
            !baseIds.has(String(p.id).toLowerCase()) &&
            !baseNames.has(String(p.name || '').toLowerCase())
        );
        mergedProducts = [...baseCatalog, ...extraDbProducts];
      }
      setProducts(mergedProducts);

      const enrichedCategories = CATEGORIES.map((cat) => ({
        ...cat,
        itemCount: mergedProducts.filter(
          (p) =>
            p.categoryId === cat.id ||
            String(p.category || '').toLowerCase() === String(cat.name || '').toLowerCase()
        ).length,
        subcategories: cat.subcategories || [
          `${cat.name} Flagships`,
          `Best Sellers`,
          `Budget Picks`
        ]
      }));
      setCategories(enrichedCategories);
    } catch (err) {
      console.warn('[ProductsContext] Using fallback catalog:', err.message);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Synchronous product lookup by ID
   */
  const getProductById = useCallback((id) => {
    if (!id) return null;
    const targetStr = String(id).toLowerCase();
    const match = products.find(
      (p) =>
        String(p.id).toLowerCase() === targetStr ||
        String(p.slug || '').toLowerCase() === targetStr
    );
    if (match) return match;
    const legacyMatch = (LEGACY_TEST_PRODUCTS || []).find(
      (p) => String(p.id).toLowerCase() === targetStr
    );
    return legacyMatch ? normalizeProduct(legacyMatch) : null;
  }, [products]);

  /**
   * Asynchronous product fetch directly from InsForge database
   * (useful for deep links or refresh on direct product detail view)
   */
  const fetchProductById = useCallback(async (id) => {
    const existing = getProductById(id);
    if (existing) return { data: existing, error: null };
    return await productsService.getProductById(id);
  }, [getProductById]);

  /**
   * Fetch reviews for a given product
   */
  const getProductReviews = useCallback((productId) => {
    return reviews.filter((r) => r.productId === productId);
  }, [reviews]);

  /**
   * Submit new product review
   */
  const addReview = useCallback((reviewData) => {
    const newReview = {
      id: `rev-${Date.now()}`,
      date: 'Today',
      verified: true,
      ...reviewData
    };
    setReviews((prev) => [newReview, ...prev]);

    // Recalculate average rating for product
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === reviewData.productId) {
          const productRevs = [...reviews.filter((r) => r.productId === p.id), newReview];
          const avg = (
            productRevs.reduce((sum, r) => sum + r.rating, 0) / productRevs.length
          ).toFixed(1);
          return {
            ...p,
            rating: parseFloat(avg),
            reviewsCount: p.reviewsCount + 1
          };
        }
        return p;
      })
    );
  }, [reviews]);

  /**
   * Admin Operations: Add product
   */
  const addProduct = useCallback(async (productData) => {
    const primaryImg = productData.image || productData.image_url || '';
    const imgKey = productData.image_key || productData.imageKey || null;

    const newProd = normalizeProduct({
      id: productData.id || `prod-${Date.now()}`,
      rating: 4.5,
      review_count: 1,
      stock: productData.stock || 10,
      price: productData.price,
      discount: productData.discountPercent || 0,
      image: primaryImg,
      image_url: primaryImg,
      image_key: imgKey,
      ...productData
    });

    setProducts((prev) => [newProd, ...prev]);

    // Persist to InsForge if authenticated
    try {
      const { data, error } = await insforge.database.from('products').insert([{
        name: productData.name,
        brand: productData.brand,
        price: Number(productData.price),
        discount: Number(productData.discountPercent || 0),
        stock: Number(productData.stock || 10),
        description: productData.description,
        image: primaryImg,
        image_url: primaryImg,
        image_key: imgKey,
        slug: productData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category_id: productData.categoryId || null
      }]).select();

      if (!error && data && data[0]) {
        setProducts((prev) =>
          prev.map((p) => (p.id === newProd.id ? { ...p, id: data[0].id } : p))
        );
        if (sendNotification) {
          sendNotification({
            title: 'New Product Added to Catalog',
            message: `"${newProd.name}" (₹${Number(newProd.price).toLocaleString('en-IN')}) has been published to the store catalog.`,
            type: 'system',
            variant: 'added',
            image: primaryImg,
            actionLabel: 'View Catalog',
            link_page: 'admin-products'
          }).catch(() => {});
        }
        return { ...newProd, id: data[0].id };
      }
    } catch (e) {
      console.warn('Could not persist new product to InsForge DB', e);
    }

    if (sendNotification) {
      sendNotification({
        title: 'New Product Added to Catalog',
        message: `"${newProd.name}" (₹${Number(newProd.price).toLocaleString('en-IN')}) has been published to the store catalog.`,
        type: 'system',
        variant: 'added',
        image: primaryImg,
        actionLabel: 'View Catalog',
        link_page: 'admin-products'
      }).catch(() => {});
    }

    return newProd;
  }, [sendNotification]);

  /**
   * Admin Operations: Update product
   */
  const updateProduct = useCallback(async (id, updatedFields) => {
    try {
      const payload = {
        name: updatedFields.name,
        brand: updatedFields.brand,
        price: updatedFields.price !== undefined ? Number(updatedFields.price) : undefined,
        discount: updatedFields.discount !== undefined
          ? (typeof updatedFields.discount === 'number'
              ? updatedFields.discount
              : parseFloat(String(updatedFields.discount).replace(/[^0-9.]/g, '')) || 0)
          : (updatedFields.discountPercent !== undefined ? Number(updatedFields.discountPercent) : undefined),
        stock: updatedFields.stock !== undefined ? Math.max(0, parseInt(updatedFields.stock, 10)) : undefined,
        description: updatedFields.description,
        image: updatedFields.image || updatedFields.image_url,
        image_url: updatedFields.image_url || updatedFields.image,
        image_key: updatedFields.image_key || updatedFields.imageKey
      };

      // Strip undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const { data, error } = await insforge.database
        .from('products')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) {
        console.error('[ProductsContext] Error updating product in InsForge DB:', error);
        throw error;
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const merged = { ...p, ...updatedFields, ...payload };
            return normalizeProduct(merged);
          }
          return p;
        })
      );

      if (sendNotification) {
        sendNotification({
          title: 'Product Details Updated',
          message: `"${updatedFields.name || 'Product'}" has been updated in the catalog.`,
          type: 'system',
          variant: 'catalog',
          image: updatedFields.image || updatedFields.image_url
        }).catch(() => {});
      }

      return { data: data?.[0] || null, error: null };
    } catch (e) {
      console.warn('[ProductsContext] Could not persist update to InsForge DB', e);
      // Still update local state optimistically
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p))
      );
      if (sendNotification) {
        sendNotification({
          title: 'Product Details Updated',
          message: `"${updatedFields.name || 'Product'}" has been updated in the catalog.`,
          type: 'system',
          variant: 'catalog',
          image: updatedFields.image || updatedFields.image_url
        }).catch(() => {});
      }
      return { data: null, error: null };
    }
  }, [sendNotification]);

  /**
   * Admin Operations: Delete product
   */
  const deleteProduct = useCallback(async (id) => {
    // 1. Locate product to check for stored image key
    let keyToDelete = null;
    const existing = products.find((p) => p.id === id);
    if (existing?.image_key || existing?.imageKey) {
      keyToDelete = existing.image_key || existing.imageKey;
    } else {
      try {
        const { data } = await insforge.database
          .from('products')
          .select('image_key')
          .eq('id', id)
          .single();
        if (data?.image_key) {
          keyToDelete = data.image_key;
        }
      } catch (err) {
        // ignore
      }
    }

    // 2. Remove from local state
    setProducts((prev) => prev.filter((p) => p.id !== id));

    // 3. Delete unused image from InsForge Storage bucket
    if (keyToDelete) {
      deleteProductImage(keyToDelete).catch((err) => {
        console.warn('[ProductsContext] Could not delete image from storage:', err);
      });
    }

    // 4. Remove database record
    try {
      await insforge.database.from('products').delete().eq('id', id);
    } catch (e) {
      console.warn('Could not delete product from InsForge DB', e);
    }

    if (sendNotification) {
      sendNotification({
        title: 'Product Removed from Catalog',
        message: `"${existing?.name || id}" has been permanently removed from the store catalog.`,
        type: 'system',
        variant: 'removed',
        image: existing?.image || existing?.image_url || null
      }).catch(() => {});
    }
  }, [products, sendNotification]);

  /**
   * Admin Operations: Update stock
   */
  const updateStock = useCallback(async (id, newStock) => {
    const val = Math.max(0, parseInt(newStock, 10));
    const existing = products.find((p) => p.id === id);

    try {
      const { data, error } = await insforge.database
        .from('products')
        .update({ stock: val })
        .eq('id', id)
        .select();

      if (error) {
        console.error('[ProductsContext] Error updating stock in InsForge DB:', error);
        throw error;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock: val, inStock: val > 0 } : p))
      );

      if (sendNotification) {
        sendNotification({
          title: 'Inventory Stock Updated',
          message: `Stock for "${existing?.name || id}" updated to ${val} units.`,
          type: 'system',
          variant: 'catalog',
          image: existing?.image || null
        }).catch(() => {});
      }

      return { success: true, newStock: val, data: data?.[0], error: null };
    } catch (e) {
      console.warn('Could not update stock in InsForge DB', e);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock: val, inStock: val > 0 } : p))
      );
      if (sendNotification) {
        sendNotification({
          title: 'Inventory Stock Updated',
          message: `Stock for "${existing?.name || id}" updated to ${val} units.`,
          type: 'system',
          variant: 'catalog',
          image: existing?.image || null
        }).catch(() => {});
      }
      return { success: true, newStock: val, error: null };
    }
  }, [products, sendNotification]);

  return (
    <ProductsContext.Provider
      value={{
        products,
        categories,
        isLoading,
        error,
        refreshProducts: loadData,
        refreshCategories: loadData,
        getProductById,
        fetchProductById,
        getProductReviews,
        addReview,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStock,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}

export default ProductsContext;
