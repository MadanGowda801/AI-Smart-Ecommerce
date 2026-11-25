import insforge from './insforge.js';
import { normalizeProduct } from './productsService.js';
import { cartService } from './cartService.js';

/**
 * Wishlist Service
 * Direct InsForge database data-access for authenticated user wishlists.
 * Enforces RLS, uniqueness constraints, and seamless conversion to cart.
 */
export const wishlistService = {
  /**
   * Fetch all wishlist items for the authenticated user from the database
   */
  async getWishlist(userId) {
    if (!userId) {
      return { data: [], error: new Error('User ID is required to fetch wishlist') };
    }

    try {
      const { data, error } = await insforge.database
        .from('wishlist_items')
        .select('id, user_id, product_id, created_at, products(*, categories(id, name, slug))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[wishlistService.getWishlist] Error:', error);
        return { data: [], error };
      }

      const formatted = (data || []).map((item) => {
        const rawProduct = item.products;
        const normalized = rawProduct ? normalizeProduct(rawProduct) : null;
        const stock = normalized ? Number(normalized.stock ?? 0) : 0;

        return {
          id: item.product_id, // Match product ID for UI convenience
          wishlistItemId: item.id,
          productId: item.product_id,
          product: normalized,
          name: normalized?.name || 'Saved Product',
          price: normalized?.price || 0,
          originalPrice: normalized?.originalPrice || 0,
          image: normalized?.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
          category: normalized?.category || 'General',
          rating: normalized?.rating || 4.5,
          stock,
          inStock: stock > 0,
          createdAt: item.created_at
        };
      });

      return { data: formatted, error: null };
    } catch (err) {
      console.error('[wishlistService.getWishlist] Exception:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Add a product to the user's wishlist in the database
   * Prevents duplicates gracefully
   */
  async addToWishlist(userId, productId) {
    if (!userId || !productId) {
      return { data: null, error: new Error('User ID and Product ID are required') };
    }

    try {
      // Check if already in wishlist
      const { data: existing } = await insforge.database
        .from('wishlist_items')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        return { data: existing, isDuplicate: true, error: null };
      }

      const { data, error } = await insforge.database
        .from('wishlist_items')
        .insert([
          {
            user_id: userId,
            product_id: productId
          }
        ])
        .select('id, user_id, product_id, created_at')
        .single();

      if (error) {
        // If unique violation occurred concurrently, handle smoothly
        if (error.code === '23505' || error.message?.includes('unique')) {
          return { data: null, isDuplicate: true, error: null };
        }
        throw error;
      }

      return { data, isDuplicate: false, error: null };
    } catch (err) {
      console.error('[wishlistService.addToWishlist] Error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Remove a product from the user's wishlist in the database
   */
  async removeFromWishlist(userId, productId) {
    if (!userId || !productId) {
      return { error: new Error('User ID and Product ID are required') };
    }

    try {
      const { error } = await insforge.database
        .from('wishlist_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('[wishlistService.removeFromWishlist] Error:', err);
      return { error: err };
    }
  },

  /**
   * Move an item from wishlist to cart
   */
  async moveToCart(userId, product) {
    if (!userId || !product || !product.id) {
      return { error: new Error('User ID and product are required') };
    }

    try {
      // 1. Add to cart in database
      const { error: cartErr } = await cartService.addToCart(userId, product, 1);
      if (cartErr) throw cartErr;

      // 2. Remove from wishlist in database
      const { error: wishErr } = await this.removeFromWishlist(userId, product.id);
      if (wishErr) throw wishErr;

      return { error: null };
    } catch (err) {
      console.error('[wishlistService.moveToCart] Error:', err);
      return { error: err };
    }
  },

  /**
   * Sync guest wishlist items into database upon login
   */
  async syncGuestWishlist(userId, guestItems = []) {
    if (!userId || !Array.isArray(guestItems) || guestItems.length === 0) {
      return { error: null };
    }

    try {
      for (const item of guestItems) {
        const prodId = item.productId || item.id;
        if (prodId) {
          await this.addToWishlist(userId, prodId);
        }
      }
      return { error: null };
    } catch (err) {
      console.error('[wishlistService.syncGuestWishlist] Error:', err);
      return { error: err };
    }
  }
};

export default wishlistService;
