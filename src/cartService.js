import insforge from './insforge.js';
import { normalizeProduct } from './productsService.js';

/**
 * Cart Service
 * Direct InsForge database data-access for authenticated shopping carts.
 * Enforces stock constraints, RLS user scoping, and product availability checks.
 */
export const cartService = {
  /**
   * Fetch all cart items for the authenticated user from the database
   */
  async getCart(userId) {
    if (!userId) {
      return { data: [], error: new Error('User ID is required to fetch cart') };
    }

    try {
      const { data, error } = await insforge.database
        .from('cart_items')
        .select('id, user_id, product_id, quantity, created_at, updated_at, products(*, categories(id, name, slug))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[cartService.getCart] Error:', error);
        return { data: [], error };
      }

      const formatted = (data || []).map((item) => {
        const rawProduct = item.products;
        const normalized = rawProduct ? normalizeProduct(rawProduct) : null;
        const stock = normalized ? Number(normalized.stock ?? 0) : 0;
        const isUnavailable = !normalized || stock <= 0;
        const clampedQty = Math.max(1, Math.min(item.quantity || 1, stock > 0 ? stock : item.quantity));

        return {
          id: item.product_id, // Consistently use product_id as item identifier for UI
          cartItemId: item.id,
          productId: item.product_id,
          quantity: clampedQty,
          originalDbQuantity: item.quantity,
          product: normalized,
          name: normalized?.name || 'Unavailable Product',
          price: normalized?.price || 0,
          originalPrice: normalized?.originalPrice || 0,
          image: normalized?.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
          category: normalized?.category || 'General',
          stock,
          inStock: stock > 0,
          isUnavailable,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        };
      });

      return { data: formatted, error: null };
    } catch (err) {
      console.error('[cartService.getCart] Exception:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Add a product to the user's cart in the database
   * Handles stock limits and duplicate increments
   */
  async addToCart(userId, product, quantityToAdd = 1) {
    if (!userId) {
      return { data: null, error: new Error('User must be logged in to add to cart') };
    }
    if (!product || !product.id) {
      return { data: null, error: new Error('Valid product is required') };
    }

    const hasExplicitStock = product.stock !== undefined && product.stock !== null && product.stock !== '';
    const availableStock = hasExplicitStock ? Number(product.stock) : (product.inStock === false ? 0 : 99);
    if (availableStock <= 0) {
      return { data: null, error: new Error('This item is currently out of stock') };
    }

    try {
      // 1. Check if product already exists in user's cart
      const { data: existingItems, error: fetchErr } = await insforge.database
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', userId)
        .eq('product_id', product.id)
        .maybeSingle();

      if (fetchErr) {
        console.error('[cartService.addToCart] Check error:', fetchErr);
      }

      if (existingItems) {
        // Item exists -> update quantity respecting available stock
        const currentQty = existingItems.quantity || 1;
        const newQty = Math.min(availableStock, currentQty + quantityToAdd);

        const { data: updated, error: updErr } = await insforge.database
          .from('cart_items')
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingItems.id)
          .select('id, user_id, product_id, quantity')
          .single();

        if (updErr) throw updErr;
        return { data: updated, isNew: false, quantity: newQty, error: null };
      } else {
        // New item -> insert new row
        const initialQty = Math.max(1, Math.min(availableStock, quantityToAdd));
        const { data: inserted, error: insErr } = await insforge.database
          .from('cart_items')
          .insert([
            {
              user_id: userId,
              product_id: product.id,
              quantity: initialQty
            }
          ])
          .select('id, user_id, product_id, quantity')
          .single();

        if (insErr) throw insErr;
        return { data: inserted, isNew: true, quantity: initialQty, error: null };
      }
    } catch (err) {
      console.error('[cartService.addToCart] Error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Update the quantity of an item in the cart
   * Enforces stock limits and removes item if newQuantity <= 0
   */
  async updateQuantity(userId, productId, newQuantity, availableStock = 99) {
    if (!userId || !productId) {
      return { data: null, error: new Error('User ID and Product ID are required') };
    }

    // If decreasing to 0 or below, remove from cart
    if (newQuantity <= 0) {
      return this.removeFromCart(userId, productId);
    }

    // Enforce stock ceiling
    const clampedQty = Math.max(1, Math.min(availableStock, newQuantity));

    try {
      const { data, error } = await insforge.database
        .from('cart_items')
        .update({
          quantity: clampedQty,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('product_id', productId)
        .select()
        .single();

      if (error) throw error;
      return { data, quantity: clampedQty, error: null };
    } catch (err) {
      console.error('[cartService.updateQuantity] Error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Remove a single product from the user's cart in the database
   */
  async removeFromCart(userId, productId) {
    if (!userId || !productId) {
      return { error: new Error('User ID and Product ID are required') };
    }

    try {
      const { error } = await insforge.database
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('[cartService.removeFromCart] Error:', err);
      return { error: err };
    }
  },

  /**
   * Clear all items in the user's cart
   */
  async clearCart(userId) {
    if (!userId) {
      return { error: new Error('User ID is required to clear cart') };
    }

    try {
      const { error } = await insforge.database
        .from('cart_items')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('[cartService.clearCart] Error:', err);
      return { error: err };
    }
  },

  /**
   * Synchronize guest items into the user's database cart upon login
   */
  async syncGuestCart(userId, guestItems = []) {
    if (!userId || !Array.isArray(guestItems) || guestItems.length === 0) {
      return { error: null };
    }

    try {
      for (const item of guestItems) {
        const prodId = item.productId || item.id;
        const qty = item.quantity || 1;
        const stock = item.stock || 99;
        if (prodId && stock > 0) {
          await this.addToCart(userId, { id: prodId, stock }, qty);
        }
      }
      return { error: null };
    } catch (err) {
      console.error('[cartService.syncGuestCart] Error:', err);
      return { error: err };
    }
  }
};

export default cartService;
