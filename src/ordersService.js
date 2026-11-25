import insforge from './insforge.js';
import activityService from './activityService.js';
import recommendationService from './recommendationService.js';
import { sanitizeMobileInput } from './phoneUtils.js';
import {
  normalizeDeliveryStatus,
  computeEstimatedDeliveryDate
} from './deliveryConstants.js';
import deliveryService from './deliveryService.js';

/**
 * Orders Service
 * Handles all order and address operations via InsForge database.
 * All mutations enforce authenticated user scoping (RLS handles server-side).
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTrackingNumber() {
  const prefix = ['BLU', 'DTX', 'EKT', 'DHL', 'FDX'][Math.floor(Math.random() * 5)];
  const digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-IND-${digits}`;
}

function getEstimatedDelivery(shippingMethod) {
  const map = {
    standard: 'In 3-5 business days',
    express: 'In 1-2 business days',
    sameday: 'Today by 8:00 PM'
  };
  return map[shippingMethod] || map.standard;
}

function getCourier(shippingMethod) {
  const map = {
    standard: 'BlueDart Ground',
    express: 'BlueDart Express Air',
    sameday: 'EcomExpress Same-Day'
  };
  return map[shippingMethod] || map.standard;
}

/**
 * Normalize a raw DB order row into the shape the UI expects.
 */
export function normalizeOrder(raw) {
  if (!raw) return null;
  const pricing = {
    subtotal: Number(raw.subtotal_amount || 0),
    discount: Number(raw.discount_amount || 0),
    shipping: Number(raw.shipping_amount || 0),
    tax: Number(raw.tax_amount || 0),
    total: Number(raw.total_amount || 0)
  };

  // Parse shipping_address JSON (stored as text)
  let shippingAddress = {
    fullName: '',
    mobile: '',
    houseNumber: '',
    street: '',
    landmark: '',
    addressLine: '',
    city: '',
    state: '',
    pincode: ''
  };
  if (raw.shipping_address) {
    try {
      const parsed = typeof raw.shipping_address === 'string'
        ? JSON.parse(raw.shipping_address)
        : raw.shipping_address;
      shippingAddress = { ...shippingAddress, ...parsed };
    } catch {
      shippingAddress.addressLine = raw.shipping_address;
    }
  }

  const primaryPayment = Array.isArray(raw.payments) ? raw.payments[0] : (raw.payments || null);
  const transactionReference = primaryPayment?.transaction_reference || primaryPayment?.razorpay_payment_id || raw.transaction_reference || null;
  const paymentStatus = raw.payment_status || primaryPayment?.payment_status || 'pending';
  const canonicalDeliveryStatus = normalizeDeliveryStatus(raw.delivery_status || raw.status || raw.order_status || 'order_placed');
  const estDateIso =
    raw.estimated_delivery_date ||
    computeEstimatedDeliveryDate(raw.shipping_method || 'standard', raw.created_at || new Date());

  return {
    id: raw.id,
    userId: raw.user_id || null,
    date: raw.created_at,
    status: canonicalDeliveryStatus,
    deliveryStatus: canonicalDeliveryStatus,
    paymentStatus,
    paymentMethod: raw.payment_method || primaryPayment?.payment_method || 'Online',
    shippingMethod: raw.shipping_method || 'standard',
    couponCode: raw.coupon_code || null,
    courier: raw.courier || getCourier(raw.shipping_method),
    trackingNumber: raw.tracking_number || null,
    estimatedDelivery: raw.estimated_delivery || getEstimatedDelivery(raw.shipping_method),
    estimatedDeliveryDate: estDateIso,
    deliveryPersonId: raw.delivery_person_id || null,
    deliveryPersonName: raw.delivery_person_name || null,
    deliveryPersonPhone: raw.delivery_person_phone || null,
    deliveryAssignedAt: raw.delivery_assigned_at || null,
    deliveredAt: raw.delivered_at || null,
    isDelayed: Boolean(raw.is_delayed),
    delayReason: raw.delay_reason || null,
    deliveryNotes: raw.delivery_notes || null,
    deliveryPincode: raw.delivery_pincode || shippingAddress.pincode || '',
    shippingAddress,
    pricing,
    transactionReference,
    payment: primaryPayment,
    items: (raw.order_items || []).map((oi) => ({
      id: oi.product_id,
      orderItemId: oi.id,
      name: oi.products?.name || 'Product',
      price: Number(oi.unit_price || oi.price || 0),
      quantity: oi.quantity,
      image: oi.products?.image || oi.products?.image_url || '',
      category: oi.products?.categories?.name || ''
    }))
  };
}

// ─── Address Service ───────────────────────────────────────────────────────────

const LOCAL_ADDRESSES_KEY = 'smartshop_saved_addresses_v2';

function loadLocalAddresses(userId) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const all = JSON.parse(localStorage.getItem(LOCAL_ADDRESSES_KEY) || '[]');
    if (!Array.isArray(all)) return [];
    return userId ? all.filter((a) => String(a.user_id) === String(userId)) : all;
  } catch {
    return [];
  }
}

function saveLocalAddresses(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function normalizeAddressRecord(a) {
  if (!a) return a;
  const houseNumber = a.house_number || a.houseNumber || a.line1 || '';
  const street = a.street || a.line2 || '';
  const landmark = a.landmark || '';
  return {
    ...a,
    full_name: a.full_name || a.fullName || '',
    fullName: a.full_name || a.fullName || '',
    phone: sanitizeMobileInput(a.phone || a.mobile || ''),
    house_number: houseNumber,
    houseNumber,
    street,
    landmark,
    line1: a.line1 || houseNumber,
    line2: a.line2 || [street, landmark].filter(Boolean).join(', '),
    city: a.city || '',
    state: a.state || 'Karnataka',
    pincode: String(a.pincode || '').replace(/\D/g, '').slice(0, 6)
  };
}

export const addressService = {
  async getSavedAddresses(userId = null) {
    try {
      const { data, error } = await insforge.database
        .from('saved_addresses')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      const localList = loadLocalAddresses(userId);
      if (error || !Array.isArray(data)) {
        return { data: localList.map(normalizeAddressRecord), error: null };
      }

      const mergedMap = new Map();
      for (const row of data) mergedMap.set(String(row.id), normalizeAddressRecord(row));
      for (const row of localList) {
        if (!mergedMap.has(String(row.id))) mergedMap.set(String(row.id), normalizeAddressRecord(row));
      }
      return { data: Array.from(mergedMap.values()), error: null };
    } catch {
      return { data: loadLocalAddresses(userId).map(normalizeAddressRecord), error: null };
    }
  },

  async saveAddress(userId, address) {
    if (!userId) return { data: null, error: new Error('User required') };

    const houseNumber = (address.houseNumber || address.house_number || address.line1 || '').trim();
    const street = (address.street || address.line2 || '').trim();
    const landmark = (address.landmark || '').trim();
    const line1 = houseNumber || address.line1 || '';
    const line2 = [street, landmark ? `Landmark: ${landmark}` : ''].filter(Boolean).join(', ');
    const cleanPhone = sanitizeMobileInput(address.phone || address.mobile || '');
    const cleanPin = String(address.pincode || '').replace(/\D/g, '').slice(0, 6);

    const recordPayload = {
      user_id: userId,
      label: address.label || 'Home',
      full_name: (address.fullName || address.full_name || '').trim(),
      phone: cleanPhone,
      house_number: houseNumber,
      street,
      landmark,
      line1,
      line2,
      city: (address.city || '').trim(),
      state: (address.state || 'Karnataka').trim(),
      pincode: cleanPin,
      is_default: Boolean(address.is_default)
    };

    try {
      if (recordPayload.is_default) {
        await insforge.database
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error } = await insforge.database
        .from('saved_addresses')
        .insert([recordPayload])
        .select()
        .single();

      if (!error && data) {
        return { data: normalizeAddressRecord(data), error: null };
      }

      // Retry without newly added columns if DB migration hasn't been applied on remote yet
      if (error && /column|house_number|street|landmark/i.test(String(error.message || ''))) {
        const { house_number, street: _s, landmark: _l, ...legacyPayload } = recordPayload;
        const legacyRes = await insforge.database
          .from('saved_addresses')
          .insert([legacyPayload])
          .select()
          .single();
        if (!legacyRes.error && legacyRes.data) {
          return { data: normalizeAddressRecord({ ...legacyRes.data, house_number, street, landmark }), error: null };
        }
      }
    } catch {
      // Fallback to localStorage below
    }

    // Resilient local persistence
    const allLocal = loadLocalAddresses(null);
    const updatedList = recordPayload.is_default
      ? allLocal.map((a) => (String(a.user_id) === String(userId) ? { ...a, is_default: false } : a))
      : allLocal;
    const localAddr = normalizeAddressRecord({
      id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...recordPayload,
      created_at: new Date().toISOString()
    });
    saveLocalAddresses([localAddr, ...updatedList]);
    return { data: localAddr, error: null };
  },

  async updateAddress(addressId, updates) {
    const cleanPhone = updates.phone !== undefined ? sanitizeMobileInput(updates.phone) : undefined;
    const houseNumber = updates.houseNumber ?? updates.house_number ?? updates.line1;
    const street = updates.street ?? updates.line2;
    const landmark = updates.landmark;

    try {
      const { data, error } = await insforge.database
        .from('saved_addresses')
        .update({
          label: updates.label,
          full_name: updates.fullName || updates.full_name,
          phone: cleanPhone,
          house_number: houseNumber,
          street,
          landmark,
          line1: houseNumber || updates.line1,
          line2: [street, landmark ? `Landmark: ${landmark}` : ''].filter(Boolean).join(', '),
          city: updates.city,
          state: updates.state,
          pincode: updates.pincode,
          is_default: updates.is_default,
          updated_at: new Date().toISOString()
        })
        .eq('id', addressId)
        .select()
        .single();
      if (!error && data) return { data: normalizeAddressRecord(data), error: null };
    } catch {
      // ignore and update local
    }

    const allLocal = loadLocalAddresses(null);
    const next = allLocal.map((a) =>
      String(a.id) === String(addressId) ? normalizeAddressRecord({ ...a, ...updates, phone: cleanPhone ?? a.phone }) : a
    );
    saveLocalAddresses(next);
    return { data: next.find((a) => String(a.id) === String(addressId)) || null, error: null };
  },

  async deleteAddress(addressId) {
    try {
      await insforge.database
        .from('saved_addresses')
        .delete()
        .eq('id', addressId);
    } catch {
      // ignore
    }
    const allLocal = loadLocalAddresses(null).filter((a) => String(a.id) !== String(addressId));
    saveLocalAddresses(allLocal);
    return { error: null };
  },

  async setDefaultAddress(userId, addressId) {
    try {
      await insforge.database
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
      await insforge.database
        .from('saved_addresses')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', addressId);
    } catch {
      // ignore
    }
    const allLocal = loadLocalAddresses(null).map((a) =>
      String(a.user_id) === String(userId) ? { ...a, is_default: String(a.id) === String(addressId) } : a
    );
    saveLocalAddresses(allLocal);
    return { error: null };
  }
};

// ─── Orders Service ────────────────────────────────────────────────────────────

// In-flight submission lock to prevent duplicate orders
const activeSubmissions = new Set();
const LOCAL_ORDERS_STORAGE_KEY = 'smartshop_local_orders';

import { INITIAL_PRODUCTS, INITIAL_ORDERS } from './mockData.js';
import { calculatePricing, normalizeCategorySlug, toPaise, fromPaise } from './dynamicPricingEngine.js';

function isNetworkFetchFailure(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network request failed') || msg.includes('load failed');
}

function loadLocalOrders() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalOrder(orderObj) {
  try {
    if (typeof localStorage === 'undefined' || !orderObj) return;
    const prev = loadLocalOrders().filter((o) => o.id !== orderObj.id);
    localStorage.setItem(LOCAL_ORDERS_STORAGE_KEY, JSON.stringify([orderObj, ...prev]));
  } catch {
    // ignore storage quota errors
  }
}

export const ordersService = {
  /**
   * Fetch all orders for the authenticated user (latest first).
   * Merges InsForge DB orders with local catalog orders belonging to this user.
   */
  async getUserOrders(userId = null) {
    const localOrders = loadLocalOrders().filter(
      (o) => !userId || !o.userId || String(o.userId) === String(userId)
    );

    const mergeAndSort = (dbOrders) => {
      const seen = new Set();
      const merged = [];
      for (const o of [...localOrders, ...dbOrders]) {
        if (!o || !o.id || seen.has(String(o.id))) continue;
        seen.add(String(o.id));
        merged.push(o);
      }
      return merged.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    };

    try {
      const { data, error } = await insforge.database
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            price,
            products (id, name, image, image_url, categories(name))
          ),
          payments (
            id,
            amount,
            payment_status,
            payment_method,
            transaction_reference,
            razorpay_order_id,
            razorpay_payment_id,
            gateway_mode,
            paid_at,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (isNetworkFetchFailure(error)) {
          return { data: mergeAndSort(INITIAL_ORDERS), error: null };
        }
        return { data: localOrders, error };
      }
      return { data: mergeAndSort((data || []).map(normalizeOrder)), error: null };
    } catch (err) {
      if (isNetworkFetchFailure(err)) {
        return { data: mergeAndSort(INITIAL_ORDERS), error: null };
      }
      return { data: localOrders, error: err };
    }
  },

  /**
   * Persist verified payment outcome for local catalog orders (ORD-* / local-ord-*).
   * Only call after server-side /api/payments/verify-payment (or failure/cancel) returns.
   */
  updateLocalOrderPayment(orderId, { paymentStatus, status = null, transactionReference = null } = {}) {
    if (!orderId) return null;
    const allLocal = loadLocalOrders();
    const idx = allLocal.findIndex((o) => String(o.id) === String(orderId));
    if (idx === -1) return null;

    const existing = allLocal[idx];
    const nextStatus = status ? normalizeDeliveryStatus(status) : existing.status;
    const updated = {
      ...existing,
      paymentStatus: paymentStatus || existing.paymentStatus,
      status: nextStatus,
      deliveryStatus: nextStatus,
      transactionReference: transactionReference || existing.transactionReference || null,
      payment: {
        ...(existing.payment || {}),
        payment_status: paymentStatus || existing.paymentStatus,
        transaction_reference: transactionReference || existing.transactionReference || null,
        razorpay_payment_id: transactionReference || existing.payment?.razorpay_payment_id || null,
        paid_at: paymentStatus === 'paid' ? new Date().toISOString() : (existing.payment?.paid_at || null)
      }
    };

    saveLocalOrder(updated);

    // Sync updated payment/confirmation state with delivery ledger non-blockingly
    deliveryService.registerOrder({
      id: updated.id,
      user_id: updated.userId,
      created_at: updated.date,
      total_amount: updated.pricing?.total || 0,
      shipping_address: JSON.stringify(updated.shippingAddress || {}),
      delivery_pincode: updated.deliveryPincode || updated.shippingAddress?.pincode || '',
      payment_method: updated.paymentMethod,
      payment_status: updated.paymentStatus,
      shipping_method: updated.shippingMethod,
      estimated_delivery: updated.estimatedDelivery,
      estimated_delivery_date: updated.estimatedDeliveryDate,
      status: updated.status,
      order_status: updated.status,
      delivery_status: updated.deliveryStatus,
      order_items: (updated.items || []).map((it, i) => ({
        id: it.orderItemId || `${updated.id}-item-${i}`,
        product_id: it.id,
        quantity: it.quantity,
        unit_price: it.price,
        price: it.price,
        products: { id: it.id, name: it.name, image: it.image, categories: { name: it.category } }
      }))
    }).catch(() => {});

    return updated;
  },

  /**
   * Fetch a single order by ID for the authenticated user.
   */
  async getOrderById(orderId) {
    if (!orderId) return { data: null, error: new Error('Order ID required') };

    const localMatch = loadLocalOrders().find((o) => o.id === orderId);
    if (localMatch) return { data: localMatch, error: null };

    try {
      const { data, error } = await insforge.database
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            price,
            products (id, name, image, image_url, categories(name))
          ),
          payments (
            id,
            amount,
            payment_status,
            payment_method,
            transaction_reference,
            razorpay_order_id,
            razorpay_payment_id,
            gateway_mode,
            paid_at,
            created_at
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        if (isNetworkFetchFailure(error)) {
          const mockMatch = INITIAL_ORDERS.find((o) => o.id === orderId) || null;
          return { data: mockMatch, error: mockMatch ? null : error };
        }
        return { data: null, error };
      }
      return { data: normalizeOrder(data), error: null };
    } catch (err) {
      if (isNetworkFetchFailure(err)) {
        const mockMatch = INITIAL_ORDERS.find((o) => o.id === orderId) || null;
        return { data: mockMatch, error: mockMatch ? null : err };
      }
      return { data: null, error: err };
    }
  },

  /**
   * Create a new order in the database with strict server-side validation:
   * 1. Duplicate submission prevention (in-flight lock)
   * 2. Authoritative price lookup from DB (never trusts client prices)
   * 3. Stock availability verification before order creation
   * 4. Server-side discount, tax, shipping, and total calculation
   * 5. Order & order_items creation
   * 6. Payment record creation
   * 7. Post-order inventory update (does not reduce before success)
   * 8. Cart clearing & system notification
   */
  async createOrder({
    userId,
    items,              // Array of cart items: { id/productId, quantity, ... }
    shippingAddress,    // { fullName, mobile, addressLine, city, state, pincode }
    paymentMethod,      // string label e.g. "UPI (GPay / PhonePe / Paytm)"
    shippingMethod,     // 'standard' | 'express' | 'sameday'
    couponCode          // string | null
  }) {
    if (!userId) return { data: null, error: new Error('User must be authenticated') };
    if (!items || items.length === 0) return { data: null, error: new Error('Cart is empty') };

    // Duplicate submission guard
    const lockKey = String(userId);
    if (activeSubmissions.has(lockKey)) {
      return {
        data: null,
        error: new Error('Order placement is already being processed. Please wait...')
      };
    }
    activeSubmissions.add(lockKey);

    try {
      // 1. Consolidate duplicate product IDs & validate item quantities upfront
      const consolidatedInput = new Map();
      for (const rawItem of items) {
        if (!rawItem || rawItem.isUnavailable) continue;
        const pId = String(rawItem.productId || rawItem.id || '').trim();
        if (!pId) continue;

        const qty = parseInt(rawItem.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return {
            data: null,
            error: new Error(`Invalid quantity (${rawItem.quantity}) for product "${rawItem.name || pId}".`)
          };
        }

        if (consolidatedInput.has(pId)) {
          consolidatedInput.get(pId).quantity += qty;
        } else {
          consolidatedInput.set(pId, {
            productId: pId,
            name: rawItem.name || pId,
            quantity: qty,
            categoryId: rawItem.categoryId || rawItem.category_id || null,
            category: rawItem.category || '',
            image: rawItem.image || rawItem.image_url || ''
          });
        }
      }

      const productIds = Array.from(consolidatedInput.keys());
      if (productIds.length === 0) {
        return { data: null, error: new Error('No valid products in cart') };
      }

      // 2. Fetch authoritative product details, categories & stock from the database
      const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
      const uuidProductIds = productIds.filter(isUuid);
      const hasNonUuid = uuidProductIds.length < productIds.length;
      let dbProducts = [];
      let offlineCatalogMode = hasNonUuid;

      if (uuidProductIds.length > 0) {
        try {
          const { data: fetchedProducts, error: prodErr } = await insforge.database
            .from('products')
            .select('id, name, price, stock, category_id, image, image_url, categories(name, slug)')
            .in('id', uuidProductIds);

          if (prodErr) {
            if (isNetworkFetchFailure(prodErr) || hasNonUuid) {
              offlineCatalogMode = true;
            } else {
              console.error('[ordersService] Failed to query product prices:', prodErr);
              return {
                data: null,
                error: new Error('Unable to verify product details from catalog. Please try again.')
              };
            }
          } else if (Array.isArray(fetchedProducts)) {
            dbProducts = fetchedProducts;
          }
        } catch (fetchErr) {
          if (isNetworkFetchFailure(fetchErr) || hasNonUuid) {
            offlineCatalogMode = true;
          } else {
            throw fetchErr;
          }
        }
      }

      // Resolve any catalog SKU items (or unresolved items when offline) from trusted INITIAL_PRODUCTS
      const resolvedIds = new Set(dbProducts.map((p) => String(p.id)));
      const missingIds = productIds.filter((id) => !resolvedIds.has(String(id)));
      if (missingIds.length > 0) {
        const fallbackMatches = INITIAL_PRODUCTS.filter((p) => missingIds.includes(String(p.id))).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock ?? 99,
          category_id: p.categoryId || null,
          image: p.image,
          categories: { name: p.category, slug: p.categorySlug }
        }));
        if (fallbackMatches.length > 0) {
          offlineCatalogMode = true;
          dbProducts = [...dbProducts, ...fallbackMatches];
        }
      }

      // 3. Validate product existence and stock availability using trusted prices only
      const validatedItems = [];
      let serverSubtotalPaise = 0;

      for (const [pId, reqItem] of consolidatedInput.entries()) {
        const dbProd = (dbProducts || []).find((p) => String(p.id) === pId);

        if (!dbProd) {
          return {
            data: null,
            error: new Error(`Product "${reqItem.name || pId}" is no longer available in catalog.`)
          };
        }

        const qty = reqItem.quantity;
        const currentStock = Number(dbProd.stock ?? 0);
        if (currentStock < qty) {
          return {
            data: null,
            error: new Error(
              `Insufficient stock for "${dbProd.name}". Only ${currentStock} item(s) left in stock, but you requested ${qty}.`
            )
          };
        }

        const unitPaise = toPaise(dbProd.price || 0);
        const unitPrice = fromPaise(unitPaise);
        const lineTotalPaise = unitPaise * qty;
        const lineTotal = fromPaise(lineTotalPaise);
        serverSubtotalPaise += lineTotalPaise;

        validatedItems.push({
          id: dbProd.id,
          productId: dbProd.id,
          name: dbProd.name,
          quantity: qty,
          unitPrice,
          price: unitPrice,
          lineTotal,
          image: dbProd.image || dbProd.image_url || reqItem.image || '',
          categoryId: dbProd.category_id || reqItem.categoryId || null,
          categories: dbProd.categories || null,
          category: dbProd.categories?.name || reqItem.category || '',
          categorySlug: normalizeCategorySlug(dbProd)
        });
      }

      const serverSubtotal = fromPaise(serverSubtotalPaise);

      // 4. Resolve permitted user shopping context (prior non-cancelled order count)
      let priorOrderCount = null;
      if (!offlineCatalogMode) {
        try {
          const { data: priorOrders, error: priorErr } = await insforge.database
            .from('orders')
            .select('id, status')
            .eq('user_id', userId);
          if (!priorErr && Array.isArray(priorOrders)) {
            priorOrderCount = priorOrders.filter(
              (o) => String(o.status || '').toLowerCase() !== 'cancelled'
            ).length;
          }
        } catch {
          priorOrderCount = null;
        }
      } else {
        priorOrderCount = loadLocalOrders().filter(
          (o) => String(o.status || '').toLowerCase() !== 'cancelled'
        ).length;
      }

      const userContext = {
        isAuthenticated: Boolean(userId),
        priorOrderCount,
        preferredCategories: []
      };

      // 5. Authoritative Pricing via Dynamic Pricing Engine (+ server API verification in browser)
      let pricing = calculatePricing({
        items: validatedItems,
        subtotal: serverSubtotal,
        couponCode,
        shippingMethod,
        userContext
      });

      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        try {
          const serverRes = await fetch('/api/pricing/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: validatedItems.map((it) => ({
                id: it.productId,
                productId: it.productId,
                quantity: it.quantity
              })),
              couponCode: couponCode || null,
              shippingMethod: shippingMethod || 'standard',
              strictCatalog: true
            })
          });
          if (serverRes.ok) {
            const serverJson = await serverRes.json();
            if (serverJson?.ok) {
              pricing = serverJson;
            }
          }
        } catch {
          // Server endpoint unreachable in standalone preview; local authoritative DB calculation already ran
        }
      }

      const serverDiscount = pricing.totalDiscount;
      const serverShipping = pricing.shippingFee;
      const serverTax = pricing.tax;
      const serverTotal = pricing.grandTotal;
      const verifiedCouponCode = pricing.validatedCoupon ? pricing.validatedCoupon.code : null;

      const trackingNumber = null;
      const courier = getCourier(shippingMethod);
      const estimatedDeliveryDate = computeEstimatedDeliveryDate(shippingMethod || 'standard');
      const estimatedDelivery = getEstimatedDelivery(shippingMethod);
      const deliveryPincode = String(shippingAddress?.pincode || '').replace(/\D/g, '').slice(0, 6);
      const isCOD = String(paymentMethod || '').toLowerCase().includes('cod');
      // For all newly created orders (COD and Online Gateway), initial status is 'pending'
      // Online orders will be marked 'paid' ONLY after server-side cryptographic HMAC verification
      const paymentStatus = 'pending';

      // 7. Insert Order record into DB (or local offline fallback if cloud DB is unreachable)
      const shippingAddressJson = JSON.stringify(shippingAddress);

      if (offlineCatalogMode) {
        const localOrderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const rawLocal = {
          id: localOrderId,
          user_id: userId,
          created_at: new Date().toISOString(),
          total_amount: serverTotal,
          subtotal_amount: serverSubtotal,
          discount_amount: serverDiscount,
          tax_amount: serverTax,
          shipping_amount: serverShipping,
          shipping_address: shippingAddressJson,
          delivery_pincode: deliveryPincode,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          shipping_method: shippingMethod || 'standard',
          coupon_code: verifiedCouponCode,
          tracking_number: trackingNumber,
          courier,
          estimated_delivery: estimatedDelivery,
          estimated_delivery_date: estimatedDeliveryDate,
          status: 'order_placed',
          order_status: 'order_placed',
          delivery_status: 'order_placed',
          order_items: validatedItems.map((it, idx) => ({
            id: `${localOrderId}-item-${idx}`,
            product_id: it.productId,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            price: it.unitPrice,
            products: {
              id: it.productId,
              name: it.name,
              image: it.image,
              categories: { name: it.category }
            }
          }))
        };
        const localOrder = normalizeOrder(rawLocal);
        saveLocalOrder(localOrder);
        deliveryService.registerOrder(rawLocal).catch(() => {});
        return { data: localOrder, error: null };
      }

      const { data: orderData, error: orderError } = await insforge.database
        .from('orders')
        .insert([{
          user_id: userId,
          total_amount: serverTotal,
          subtotal_amount: serverSubtotal,
          discount_amount: serverDiscount,
          tax_amount: serverTax,
          shipping_amount: serverShipping,
          shipping_address: shippingAddressJson,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          shipping_method: shippingMethod || 'standard',
          coupon_code: verifiedCouponCode,
          tracking_number: trackingNumber,
          courier,
          estimated_delivery: estimatedDelivery,
          status: 'placed',
          order_status: 'placed'
        }])
        .select()
        .single();

      if (orderError) {
        if (isNetworkFetchFailure(orderError)) {
          const localOrderId = `local-ord-${Date.now().toString(36)}`;
          const localOrder = normalizeOrder({
            id: localOrderId,
            created_at: new Date().toISOString(),
            total_amount: serverTotal,
            subtotal_amount: serverSubtotal,
            discount_amount: serverDiscount,
            tax_amount: serverTax,
            shipping_amount: serverShipping,
            shipping_address: shippingAddressJson,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            shipping_method: shippingMethod || 'standard',
            coupon_code: verifiedCouponCode,
            tracking_number: trackingNumber,
            courier,
            estimated_delivery: estimatedDelivery,
            status: 'placed',
            order_status: 'placed',
            order_items: validatedItems.map((it, idx) => ({
              id: `${localOrderId}-item-${idx}`,
              product_id: it.productId,
              quantity: it.quantity,
              unit_price: it.unitPrice,
              price: it.unitPrice,
              products: {
                id: it.productId,
                name: it.name,
                image: it.image,
                categories: { name: it.category }
              }
            }))
          });
          saveLocalOrder(localOrder);
          return { data: localOrder, error: null };
        }
        console.error('[ordersService.createOrder] Order insert error:', orderError);
        return { data: null, error: orderError };
      }

      // 8. Insert Order Items (using authoritative unit prices from DB)
      const orderItemsPayload = validatedItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        price: item.unitPrice
      }));

      const { error: itemsError } = await insforge.database
        .from('order_items')
        .insert(orderItemsPayload);

      if (itemsError) {
        console.error('[ordersService.createOrder] Order items insert error:', itemsError);
        return { data: null, error: itemsError };
      }

      // 9. Record Payment
      const initialTxnRef = isCOD ? `COD-${Date.now()}` : null;
      const { error: payErr } = await insforge.database
        .from('payments')
        .insert([{
          order_id: orderData.id,
          user_id: userId,
          amount: serverTotal,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          transaction_reference: initialTxnRef
        }]);

      if (payErr) {
        console.warn('[ordersService.createOrder] Payment logging notice:', payErr);
      }

      // 10. Inventory Update (Crucial: only executed after successful order creation)
      for (const item of validatedItems) {
        const dbProd = dbProducts.find((p) => p.id === item.productId);
        const newStock = Math.max(0, (dbProd?.stock || 0) - item.quantity);

        const { error: stockErr } = await insforge.database
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', item.productId);

        if (stockErr) {
          console.warn(`[ordersService] Stock decrement notice for product ${item.productId}:`, stockErr);
        }

        // Log to inventory_history table
        try {
          await insforge.database
            .from('inventory_history')
            .insert([{
              product_id: item.productId,
              quantity_change: -item.quantity,
              reason: `Order #${orderData.id.slice(0, 8).toUpperCase()} purchase`
            }]);
        } catch (histErr) {
          console.warn('[ordersService] inventory_history logging notice:', histErr);
        }
      }

      // 11. Clear user's cart in DB
      try {
        await insforge.database
          .from('cart_items')
          .delete()
          .eq('user_id', userId);
      } catch (cartErr) {
        console.warn('[ordersService] Clear cart notice:', cartErr);
      }

      // 12. Send "Order Placed" notification into notifications table
      try {
        await insforge.database.rpc('send_notification', {
          p_user_id: userId,
          p_title: 'Order Placed',
          p_message: `Order #${orderData.id.slice(0, 8).toUpperCase()} for ₹${serverTotal.toLocaleString('en-IN')} has been placed successfully. ${isCOD ? 'Payment method: Cash on Delivery.' : 'Proceeding to payment.'}`,
          p_type: 'order',
          p_link_page: 'order-details',
          p_link_params: { id: orderData.id }
        });
      } catch (notifErr) {
        console.warn('[ordersService] Notification RPC notice, trying direct insert:', notifErr);
        try {
          await insforge.database
            .from('notifications')
            .insert([{
              user_id: userId,
              title: 'Order Placed',
              message: `Order #${orderData.id.slice(0, 8).toUpperCase()} for ₹${serverTotal.toLocaleString('en-IN')} has been placed successfully.`,
              type: 'order',
              is_read: false,
              link_page: 'order-details',
              link_params: { id: orderData.id }
            }]);
        } catch (insertErr) {
          console.warn('[ordersService] Direct notification insert notice:', insertErr);
        }
      }

      // 13. Track user purchase activity for recommendations & invalidate cache
      try {
        for (const item of validatedItems) {
          if (item.productId) {
            activityService.trackPurchase(userId, item.productId, item.categoryId).catch(() => {});
          }
        }
        recommendationService.invalidateCache(userId);
      } catch (actErr) {
        console.warn('[ordersService.createOrder] Activity tracking warning:', actErr);
      }

      return { data: normalizeOrder({ ...orderData, order_items: orderItemsPayload }), error: null };
    } catch (err) {
      console.error('[ordersService.createOrder] Unexpected error:', err);
      return { data: null, error: err };
    } finally {
      activeSubmissions.delete(lockKey);
    }
  },

  /**
   * Cancel an order (only if status is 'placed' or 'processing').
   * Uses customer_cancel_order RPC which safely restores stock and timeline entries.
   */
  async cancelOrder(orderId) {
    if (!orderId) return { error: new Error('Order ID required') };

    const localMatch = loadLocalOrders().find((o) => String(o.id) === String(orderId));
    if (localMatch) {
      const updated = this.updateLocalOrderPayment(orderId, { status: 'cancelled' });
      return { data: { ok: true, order: updated }, error: null };
    }

    const { data, error } = await insforge.database.rpc('customer_cancel_order', {
      p_order_id: orderId
    });

    if (error) {
      return { data: null, error };
    }
    if (data && data.ok === false) {
      return { data: null, error: new Error(data.error || 'Failed to cancel order') };
    }

    return { data, error: null };
  },

  /**
   * Admin: update order status via server-side function.
   * Creates timeline entry + customer notification automatically.
   * Only works if the caller is an admin (enforced in DB function).
   */
  async adminUpdateOrderStatus(orderId, newStatus, location = null, notes = null) {
    try {
      const { data, error } = await insforge.database.rpc('admin_update_order_status', {
        p_order_id:   orderId,
        p_new_status: newStatus,
        p_location:   location,
        p_notes:      notes
      });
      if (!error && data?.ok) {
        return { data, error: null };
      }
      console.warn('[ordersService] RPC admin_update_order_status did not succeed, falling back to direct update:', error || data?.reason);
    } catch (e) {
      console.warn('[ordersService] RPC error, falling back:', e);
    }
    // Fallback: direct update to orders table
    return this.updateOrderStatus(orderId, newStatus);
  },

  /**
   * Admin: fetch all orders (bypasses customer RLS via SECURITY DEFINER function).
   */
  async adminGetAllOrders({ status = null, search = null, limit = 100, offset = 0 } = {}) {
    const cleanSearch = search ? search.trim().replace(/^#+/, '').trim() : null;
    const { data, error } = await insforge.database.rpc('admin_get_all_orders', {
      p_status: status || null,
      p_search: cleanSearch || null,
      p_limit:  limit,
      p_offset: offset
    });
    if (error) return { data: [], error };
    return { data: data || [], error: null };
  },

  /**
   * Fetch the order timeline (event log) for a specific order.
   */
  async getOrderTimeline(orderId) {
    if (!orderId) return { data: [], error: new Error('Order ID required') };
    const { data, error } = await insforge.database
      .from('order_timeline')
      .select('id, status, title, description, location, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  /**
   * Admin: update order status (legacy direct DB update — kept for fallback).
   * Prefer adminUpdateOrderStatus for new code.
   */
  async updateOrderStatus(orderId, newStatus) {
    const { data, error } = await insforge.database
      .from('orders')
      .update({
        status: newStatus,
        order_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();
    return { data, error };
  }
};

export default ordersService;
