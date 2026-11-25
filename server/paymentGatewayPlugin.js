import crypto from 'node:crypto';
import { createAdminClient } from '@insforge/sdk';
import {
  calculateServerCartPricing,
  recalculateOrderTotalFromDb,
  verifyPaymentAmountMatchesServer,
  fromPaise
} from './promotionService.js';

/**
 * Vite Dev Server Plugin: Payment Gateway API Backend (Razorpay Sandbox)
 *
 * Endpoints:
 *   GET  /api/payments/config              → public config (key ID, currency, mode)
 *   POST /api/payments/create-order        → create gateway order server-side
 *   POST /api/payments/simulate-signature  → sandbox-only: server-generated HMAC sig
 *   POST /api/payments/verify-payment      → authoritative HMAC verification + DB update
 *   POST /api/payments/record-failure      → record failure in DB + notify user
 *   POST /api/payments/cancel              → record cancellation in DB
 *   POST /api/payments/payment-status      → check current payment status for an order
 *
 * SECURITY RULES (enforced here, not on the client):
 *   - RAZORPAY_KEY_SECRET never leaves this file / process.
 *   - Payment verification is HMAC-SHA256 with timing-safe comparison.
 *   - Orders are only marked 'paid' after server-side cryptographic verification.
 *   - The client returning "success" is NEVER trusted without server verification.
 *   - DB updates use the INSFORGE_API_KEY (admin/service key), never the anon key.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// ── plugin export ─────────────────────────────────────────────────────────────

export default function paymentGatewayPlugin(env = {}) {
  const insforgeUrl      = env.INSFORGE_URL       || process.env.INSFORGE_URL       || '';
  const insforgeApiKey   = env.INSFORGE_API_KEY    || process.env.INSFORGE_API_KEY    || '';
  const razorpayKeyId    = env.VITE_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
  const razorpaySecret   = env.RAZORPAY_KEY_SECRET  || process.env.RAZORPAY_KEY_SECRET  || '';
  const paymentMode      = env.PAYMENT_GATEWAY_MODE || process.env.PAYMENT_GATEWAY_MODE || 'test';
  const catalogOverride  = env.__CATALOG_OVERRIDE__ || null;

  // Privileged admin client using server-only INSFORGE_API_KEY (or injected test mock)
  const admin = env.__ADMIN_CLIENT__ || ((insforgeUrl && insforgeApiKey)
    ? createAdminClient({ baseUrl: insforgeUrl, apiKey: insforgeApiKey })
    : null);

  // Server-authoritative ledger for local catalog / offline orders
  const offlineOrderLedger = new Map();

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUuidString(value) {
    return UUID_REGEX.test(String(value || '').trim());
  }
  function isLocalCatalogOrderId(orderId) {
    const id = String(orderId || '').trim();
    return id.startsWith('local-ord-') || id.startsWith('ORD-');
  }

  function signLocalCheckoutToken(payload) {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', razorpaySecret || 'smartshop-sandbox-local-token-key')
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  function verifyLocalCheckoutToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac('sha256', razorpaySecret || 'smartshop-sandbox-local-token-key')
      .update(encoded)
      .digest('base64url');
    try {
      const expBuf = Buffer.from(expected, 'utf-8');
      const recBuf = Buffer.from(sig, 'utf-8');
      if (expBuf.length !== recBuf.length || !crypto.timingSafeEqual(expBuf, recBuf)) return null;
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }

  // ── InsForge Admin DB helpers ──────────────────────────────────────────────

  /** PATCH a table row identified by matchColumn = matchValue */
  async function dbPatch(table, matchColumn, matchValue, data) {
    if (!admin) return null;
    try {
      const { data: updated, error } = await admin.database
        .from(table)
        .update(data)
        .eq(matchColumn, matchValue)
        .select();
      if (error) console.error(`[PaymentGW] dbPatch ${table} error:`, error.message);
      return updated;
    } catch (err) {
      console.error(`[PaymentGW] dbPatch ${table}:`, err.message);
      return null;
    }
  }

  /** POST a new row to a table */
  async function dbInsert(table, row) {
    if (!admin) return null;
    try {
      const { data, error } = await admin.database
        .from(table)
        .insert([row])
        .select();
      if (error) console.error(`[PaymentGW] dbInsert ${table} error:`, error.message);
      return data;
    } catch (err) {
      console.error(`[PaymentGW] dbInsert ${table}:`, err.message);
      return null;
    }
  }

  /** SELECT rows from a table with a simple eq filter */
  async function dbSelect(table, matchColumn, matchValue, selectCols = '*') {
    if (!admin) return null;
    try {
      const { data, error } = await admin.database
        .from(table)
        .select(selectCols)
        .eq(matchColumn, matchValue);
      if (error) console.error(`[PaymentGW] dbSelect ${table} error:`, error.message);
      return data;
    } catch (err) {
      console.error(`[PaymentGW] dbSelect ${table}:`, err.message);
      return null;
    }
  }

  /** Call a Postgres RPC function via PostgREST */
  async function dbRpc(fnName, args) {
    if (!admin) return null;
    try {
      const { data, error } = await admin.database.rpc(fnName, args);
      if (error) console.warn(`[PaymentGW] dbRpc ${fnName} notice:`, error.message);
      return data;
    } catch (err) {
      console.error(`[PaymentGW] dbRpc ${fnName}:`, err.message);
      return null;
    }
  }

  /** Record a payment_event row */
  async function recordPaymentEvent(eventData) {
    return dbInsert('payment_events', eventData);
  }

  /** Append a notification for the order owner */
  async function notifyOrderOwner(orderId, title, message) {
    try {
      const rows = await dbSelect('orders', 'id', orderId, 'user_id');
      if (rows && rows[0]?.user_id) {
        await dbInsert('notifications', {
          user_id: rows[0].user_id,
          title,
          message,
          type: 'order',
          is_read: false,
          link_page: 'order-details',
          link_params: { id: orderId },
        });
      }
    } catch { /* non-critical */ }
  }

  // ── HMAC-SHA256 signature verification ───────────────────────────────────

  function verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, receivedSig) {
    const expected = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    try {
      const expBuf = Buffer.from(expected, 'utf-8');
      const recBuf = Buffer.from(receivedSig, 'utf-8');
      if (expBuf.length !== recBuf.length) return false;
      return crypto.timingSafeEqual(expBuf, recBuf);
    } catch {
      return false;
    }
  }

  // ── Authentication verification helper ────────────────────────────────────
  async function getAuthenticatedUser(req) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    try {
      const resp = await fetch(`${insforgeUrl}/api/auth/sessions/current`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const body = await resp.json();
        return body?.user || null;
      }
    } catch (err) {
      console.warn('[PaymentGW] Token verification error:', err.message);
    }
    return null;
  }

  // ── Vite plugin ───────────────────────────────────────────────────────────

  const paymentMiddleware = async (req, res, next) => {
    const url = req.url || '';

        // ── 1. GET /api/payments/config ──────────────────────────────────────
        if (req.method === 'GET' && url.startsWith('/api/payments/config')) {
          return sendJson(res, 200, {
            keyId:    razorpayKeyId,
            mode:     paymentMode,
            currency: 'INR',
            provider: 'razorpay',
          });
        }

        // ── 2. POST /api/payments/create-order ───────────────────────────────
        if (req.method === 'POST' && url.startsWith('/api/payments/create-order')) {
          try {
            const body = await parseJsonBody(req);
            const { orderId, customerName, customerEmail, items, couponCode, shippingMethod } = body;

            if (!orderId) {
              return sendJson(res, 400, { error: 'orderId is required' });
            }

            const isLocalCatalogOrder = isLocalCatalogOrderId(orderId);
            const isUuidOrder = isUuidString(orderId);

            // Fetch authoritative order from DB only for UUID order IDs (avoids Postgres UUID cast errors for ORD-* / local-ord-*)
            const orderRows = isUuidOrder
              ? await dbSelect('orders', 'id', orderId, 'id,user_id,total_amount,payment_status')
              : null;

            // Authoritative server-side pricing for catalog SKU orders (ORD-*) & offline fallback orders (local-ord-*):
            // Never trusts client prices or totals — always recalculates strictly from trusted server catalog & promo rules.
            const existingLedger = offlineOrderLedger.get(String(orderId)) || null;
            const effectiveItems =
              Array.isArray(items) && items.length > 0
                ? items
                : Array.isArray(existingLedger?.items) && existingLedger.items.length > 0
                  ? existingLedger.items
                  : null;
            const effectiveCoupon = couponCode !== undefined ? couponCode : (existingLedger?.couponCode ?? null);
            const effectiveShipping = shippingMethod || existingLedger?.shippingMethod || 'standard';

            if ((!orderRows || !orderRows[0]) && isLocalCatalogOrder && effectiveItems) {
              if (existingLedger?.paymentStatus === 'paid') {
                return sendJson(res, 400, { error: 'Order has already been marked as paid' });
              }

              const serverCalc = await calculateServerCartPricing({
                admin,
                items: effectiveItems,
                couponCode: effectiveCoupon || null,
                shippingMethod: effectiveShipping,
                strictCatalog: true,
                allowRawSubtotalFallback: false,
                catalogOverride
              });

              if (!serverCalc.ok || serverCalc.amountInPaise <= 0) {
                return sendJson(res, 400, {
                  error: serverCalc.error || 'Unable to verify server-calculated checkout amount'
                });
              }

              const razorpayOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
              const paymentId = existingLedger?.paymentId || `local-pay-${Date.now()}`;
              const checkoutToken = signLocalCheckoutToken({
                orderId: String(orderId),
                paymentId,
                razorpayOrderId,
                expectedPaise: serverCalc.amountInPaise,
                expectedAmount: serverCalc.grandTotal
              });

              offlineOrderLedger.set(String(orderId), {
                orderId: String(orderId),
                paymentId,
                razorpayOrderId,
                expectedPaise: serverCalc.amountInPaise,
                expectedAmount: serverCalc.grandTotal,
                paymentStatus: 'pending',
                orderStatus: 'order_placed',
                items: effectiveItems,
                couponCode: effectiveCoupon || null,
                shippingMethod: effectiveShipping
              });

              console.log(
                `[PaymentGW] ✅ Created gateway order ${razorpayOrderId}` +
                ` for catalog order ${orderId} (₹${serverCalc.grandTotal})`
              );

              return sendJson(res, 200, {
                success:        true,
                orderId,
                paymentId,
                razorpayOrderId,
                checkoutToken,
                amount:         serverCalc.amountInPaise,
                serverCalculatedTotal: serverCalc.grandTotal,
                currency:       'INR',
                keyId:          razorpayKeyId,
                name:           'SmartShop India',
                description:    `Payment for Order #${(orderId || '').slice(0, 8).toUpperCase()}`,
                prefill: {
                  name:  customerName  || 'Valued Customer',
                  email: customerEmail || 'customer@smartshop.in',
                },
                notes: { appOrderId: orderId },
              });
            }

            if (!orderRows || !orderRows[0]) {
              return sendJson(res, 404, { error: 'Order not found in database' });
            }
            const order = orderRows[0];

            if (order.payment_status === 'paid') {
              return sendJson(res, 400, { error: 'Order has already been marked as paid' });
            }

            // Verify user authorization: caller must own the order or be an admin
            const authUser = await getAuthenticatedUser(req);
            if (authUser && order.user_id && authUser.id !== order.user_id && authUser.profile?.role !== 'admin') {
              return sendJson(res, 403, { error: 'Unauthorized: cannot initiate payment for another customer order' });
            }

            // AUTHORITATIVE SERVER RECALCULATION BEFORE PAYMENT:
            // Recompute checkout total from DB order_items + trusted product catalog prices + promotion rules.
            // Client-supplied amount in the body is completely ignored to prevent price tampering.
            const recalc = await recalculateOrderTotalFromDb({
              admin,
              orderId,
              catalogOverride
            });

            if (!recalc.ok) {
              return sendJson(res, 400, { error: recalc.error || 'Failed to recalculate authoritative order total' });
            }

            if (!recalc.orderTotalMatches) {
              console.warn(`[PaymentGW] ❌ SECURITY ALERT: Tampered order total detected for ${orderId}. ${recalc.mismatchReason}`);
              return sendJson(res, 400, {
                error: recalc.mismatchReason || 'Order total does not match server-calculated checkout amount'
              });
            }

            const authoritativeAmount = recalc.expectedTotal;
            const amountInPaise       = recalc.expectedPaise;
            if (isNaN(authoritativeAmount) || authoritativeAmount <= 0 || amountInPaise <= 0) {
              return sendJson(res, 400, { error: 'Invalid order amount stored in database' });
            }

            const razorpayOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const userId          = order.user_id || authUser?.id || null;

            // Check if a payment row already exists for this order (from order creation or previous retry)
            let paymentId = null;
            const existingPayments = await dbSelect('payments', 'order_id', orderId, 'id,user_id');
            if (existingPayments && existingPayments.length > 0) {
              paymentId = existingPayments[0].id;
              await dbPatch('payments', 'id', paymentId, {
                user_id:               userId || existingPayments[0].user_id,
                amount:                authoritativeAmount,
                payment_method:       'razorpay',
                payment_status:       'pending',
                razorpay_order_id:    razorpayOrderId,
                gateway_mode:         paymentMode,
                transaction_reference: null,
              });
            } else {
              const paymentRows = await dbInsert('payments', {
                order_id:             orderId,
                user_id:              userId,
                amount:               authoritativeAmount,
                payment_method:       'razorpay',
                payment_status:       'pending',
                razorpay_order_id:    razorpayOrderId,
                gateway_mode:         paymentMode,
                transaction_reference: null,
              });
              paymentId = paymentRows?.[0]?.id || null;
            }

            // Audit: initiated
            await recordPaymentEvent({
              order_id:          orderId,
              payment_id:        paymentId,
              event_type:        'initiated',
              gateway_provider:  'razorpay',
              gateway_mode:      paymentMode,
              razorpay_order_id: razorpayOrderId,
            });

            console.log(
              `[PaymentGW] ✅ Created gateway order ${razorpayOrderId}` +
              ` for app order ${orderId} (₹${authoritativeAmount})`
            );

            return sendJson(res, 200, {
              success:        true,
              orderId,
              paymentId,
              razorpayOrderId,
              amount:         amountInPaise,
              serverCalculatedTotal: authoritativeAmount,
              currency:       'INR',
              keyId:          razorpayKeyId,
              name:           'SmartShop India',
              description:    `Payment for Order #${(orderId || '').slice(0, 8).toUpperCase()}`,
              prefill: {
                name:  customerName  || authUser?.profile?.name || 'Valued Customer',
                email: customerEmail || authUser?.email || 'customer@smartshop.in',
              },
              notes: { appOrderId: orderId },
            });
          } catch (err) {
            console.error('[PaymentGW] create-order error:', err);
            return sendJson(res, 500, { error: 'Internal error creating gateway order' });
          }
        }

        // ── 3. POST /api/payments/simulate-signature (sandbox only) ──────────
        if (req.method === 'POST' && url.startsWith('/api/payments/simulate-signature')) {
          try {
            // SECURITY GUARD: Strictly forbid simulated signatures in production / live mode
            if (paymentMode === 'live') {
              return sendJson(res, 403, {
                error: 'Signature simulation is strictly forbidden in live mode',
              });
            }

            const { razorpayOrderId, razorpayPaymentId } = await parseJsonBody(req);
            if (!razorpayOrderId || !razorpayPaymentId) {
              return sendJson(res, 400, { error: 'razorpayOrderId and razorpayPaymentId required' });
            }
            const signature = crypto
              .createHmac('sha256', razorpaySecret)
              .update(`${razorpayOrderId}|${razorpayPaymentId}`)
              .digest('hex');

            return sendJson(res, 200, {
              success: true,
              razorpayOrderId,
              razorpayPaymentId,
              razorpaySignature: signature,
            });
          } catch (err) {
            console.error('[PaymentGW] simulate-signature error:', err);
            return sendJson(res, 500, { error: 'Signature simulation failed' });
          }
        }

        // ── 4. POST /api/payments/verify-payment ─────────────────────────────
        //       The ONLY place where an order is marked as paid.
        if (req.method === 'POST' && url.startsWith('/api/payments/verify-payment')) {
          try {
            const body = await parseJsonBody(req);
            const {
              orderId, paymentId,
              razorpayOrderId, razorpayPaymentId, razorpaySignature,
              checkoutToken,
              amountInPaise: clientAmountInPaise,
              amount: clientAmountRupees
            } = body;

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
              return sendJson(res, 400, {
                verified: false,
                error: 'Missing required verification parameters',
              });
            }

            // ── AUTHORITATIVE HMAC-SHA256 verification ────────────────────
            const isValid = verifyRazorpaySignature(
              razorpayOrderId, razorpayPaymentId, razorpaySignature
            );

            if (!isValid) {
              console.warn(
                `[PaymentGW] ❌ SECURITY ALERT: Signature mismatch for order ${orderId}`
              );
              // Record failed event in DB only for UUID orders
              if (isUuidString(orderId)) {
                await recordPaymentEvent({
                  order_id:           orderId,
                  payment_id:         paymentId || null,
                  event_type:         'failed',
                  gateway_mode:       paymentMode,
                  razorpay_order_id:  razorpayOrderId,
                  razorpay_payment_id: razorpayPaymentId,
                  error_code:         'SIGNATURE_MISMATCH',
                  error_description:  'Cryptographic signature verification failed',
                });
              }
              return sendJson(res, 400, {
                verified: false,
                error: 'Payment verification failed: invalid cryptographic signature',
              });
            }

            const normalizedClientPaise =
              clientAmountInPaise !== undefined && clientAmountInPaise !== null
                ? Math.round(Number(clientAmountInPaise))
                : clientAmountRupees !== undefined && clientAmountRupees !== null
                ? Math.round(Number(clientAmountRupees) * 100)
                : null;

            // Authoritative ledger / signed-token verification for catalog SKU (ORD-*) & offline (local-ord-*) orders
            const tokenEntry = isLocalCatalogOrderId(orderId) ? verifyLocalCheckoutToken(checkoutToken) : null;
            const validTokenEntry =
              tokenEntry && String(tokenEntry.orderId) === String(orderId) ? tokenEntry : null;

            if (offlineOrderLedger.has(String(orderId)) || validTokenEntry) {
              const ledgerEntry = offlineOrderLedger.get(String(orderId)) || {
                ...validTokenEntry,
                paymentStatus: 'pending',
                orderStatus: 'order_placed'
              };
              if (ledgerEntry.razorpayOrderId !== razorpayOrderId) {
                return sendJson(res, 400, {
                  verified: false,
                  error: 'Gateway order reference does not match initiated checkout order'
                });
              }

              const offlineCheck = verifyPaymentAmountMatchesServer({
                expectedPaise: ledgerEntry.expectedPaise,
                clientAmountInPaise: normalizedClientPaise
              });
              if (!offlineCheck.matches) {
                return sendJson(res, 400, {
                  verified: false,
                  error: offlineCheck.reason
                });
              }

              ledgerEntry.paymentStatus = 'paid';
              ledgerEntry.orderStatus = 'payment_confirmed';
              ledgerEntry.transactionReference = razorpayPaymentId;
              offlineOrderLedger.set(String(orderId), ledgerEntry);

              console.log(
                `[PaymentGW] ✅ Catalog order payment verified (₹${ledgerEntry.expectedAmount}) for ${orderId} txn ${razorpayPaymentId}`
              );

              return sendJson(res, 200, {
                verified:             true,
                verifiedAmount:       ledgerEntry.expectedAmount,
                verifiedAmountInPaise: ledgerEntry.expectedPaise,
                paymentStatus:        'paid',
                orderStatus:          'payment_confirmed',
                transactionReference: razorpayPaymentId,
                message:              'Payment verified and order updated.',
              });
            }

            if (!isUuidString(orderId)) {
              return sendJson(res, 404, { verified: false, error: 'Order not found' });
            }

            // Verify order ownership
            const authUser = await getAuthenticatedUser(req);
            const orderRows = await dbSelect('orders', 'id', orderId, 'id,user_id,total_amount,payment_status');
            if (!orderRows || !orderRows[0]) {
              return sendJson(res, 404, { verified: false, error: 'Order not found' });
            }
            const order = orderRows[0];
            if (authUser && order.user_id && authUser.id !== order.user_id && authUser.profile?.role !== 'admin') {
              return sendJson(res, 403, { verified: false, error: 'Unauthorized: cannot verify payment for another customer order' });
            }

            // Verify gateway order binding & recalculate server-authoritative checkout amount
            const paymentRows = await dbSelect('payments', 'order_id', orderId, 'id,amount,razorpay_order_id,payment_status');
            const paymentRow = paymentRows?.[0] || null;

            if (paymentRow?.razorpay_order_id && paymentRow.razorpay_order_id !== razorpayOrderId) {
              console.warn(`[PaymentGW] ❌ SECURITY ALERT: Cross-order signature replay attempt for order ${orderId}`);
              await recordPaymentEvent({
                order_id:            orderId,
                payment_id:          paymentId || paymentRow.id || null,
                event_type:          'failed',
                gateway_mode:        paymentMode,
                razorpay_order_id:   razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
                error_code:          'ORDER_REFERENCE_MISMATCH',
                error_description:   'Gateway order ID does not match initiated payment record for this order',
              });
              return sendJson(res, 400, {
                verified: false,
                error: 'Gateway order reference does not match initiated checkout order',
              });
            }

            const recalc = await recalculateOrderTotalFromDb({
              admin,
              orderId,
              catalogOverride
            });

            const amountVerification = recalc.ok
              ? verifyPaymentAmountMatchesServer({
                  expectedPaise: recalc.expectedPaise,
                  storedOrderPaise: recalc.storedOrderPaise,
                  paymentRowAmount: paymentRow?.amount ?? null,
                  clientAmountInPaise: normalizedClientPaise
                })
              : { matches: false, reason: recalc.error || 'Failed to recalculate server checkout amount' };

            if (!recalc.ok || !recalc.orderTotalMatches || !amountVerification.matches) {
              const mismatchError =
                amountVerification.reason ||
                recalc.mismatchReason ||
                'Verified payment amount does not match server-calculated checkout amount';

              console.warn(`[PaymentGW] ❌ SECURITY ALERT: Amount mismatch on order ${orderId}: ${mismatchError}`);
              await recordPaymentEvent({
                order_id:            orderId,
                payment_id:          paymentId || paymentRow?.id || null,
                event_type:          'failed',
                gateway_mode:        paymentMode,
                razorpay_order_id:   razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
                error_code:          'AMOUNT_MISMATCH',
                error_description:   mismatchError,
              });
              return sendJson(res, 400, {
                verified: false,
                error: mismatchError,
              });
            }

            console.log(
              `[PaymentGW] ✅ Signature & amount (₹${fromPaise(recalc.expectedPaise)}) verified for order ${orderId} txn ${razorpayPaymentId}`
            );

            // ── Update DB atomically via SECURITY DEFINER RPC ────────────
            const rpcResult = await dbRpc('mark_order_paid', {
              p_order_id:            orderId,
              p_razorpay_order_id:   razorpayOrderId,
              p_razorpay_payment_id: razorpayPaymentId,
              p_razorpay_signature:  razorpaySignature,
            });

            // Fallback: direct table patch if RPC not available (migration pending)
            if (!rpcResult || rpcResult.error || rpcResult?.ok === false) {
              console.warn('[PaymentGW] RPC mark_order_paid fallback triggered:', rpcResult);
              await dbPatch('payments', 'order_id', orderId, {
                payment_status:        'paid',
                razorpay_order_id:     razorpayOrderId,
                razorpay_payment_id:   razorpayPaymentId,
                razorpay_signature:    razorpaySignature,
                transaction_reference: razorpayPaymentId,
                paid_at:               new Date().toISOString(),
              });
              await dbPatch('orders', 'id', orderId, {
                payment_status: 'paid',
                order_status:   'payment_confirmed',
                status:         'payment_confirmed',
              });
              await recordPaymentEvent({
                order_id:            orderId,
                payment_id:          paymentId || null,
                event_type:          'verified',
                gateway_mode:        paymentMode,
                razorpay_order_id:   razorpayOrderId,
                razorpay_payment_id: razorpayPaymentId,
              });

              // Push notification only on fallback (RPC already sends it when successful)
              await notifyOrderOwner(
                orderId,
                'Payment Confirmed',
                `Payment confirmed via Razorpay. Reference: ${razorpayPaymentId}`
              );
            }

            return sendJson(res, 200, {
              verified:              true,
              verifiedAmount:        recalc.expectedTotal,
              verifiedAmountInPaise: recalc.expectedPaise,
              paymentStatus:         'paid',
              orderStatus:           'payment_confirmed',
              transactionReference:  razorpayPaymentId,
              message:               'Payment verified and order updated.',
            });
          } catch (err) {
            console.error('[PaymentGW] verify-payment error:', err);
            return sendJson(res, 500, { verified: false, error: 'Internal verification error' });
          }
        }

        // ── 5. POST /api/payments/record-failure ─────────────────────────────
        if (req.method === 'POST' && url.startsWith('/api/payments/record-failure')) {
          try {
            const {
              orderId, paymentId, razorpayOrderId, errorCode, errorDescription,
            } = await parseJsonBody(req);

            if (offlineOrderLedger.has(String(orderId)) || isLocalCatalogOrderId(orderId)) {
              const entry = offlineOrderLedger.get(String(orderId));
              if (entry && entry.paymentStatus !== 'paid') {
                entry.paymentStatus = 'failed';
                entry.failureCode = errorCode || 'PAYMENT_FAILED';
                entry.failureDescription = errorDescription || 'Transaction declined';
              }
              console.log(`[PaymentGW] Recording failure for catalog order ${orderId}: ${errorCode || 'PAYMENT_FAILED'}`);
              return sendJson(res, 200, {
                recorded:      true,
                paymentStatus: 'failed',
                canRetry:      true,
                orderId,
              });
            }

            const authUser = await getAuthenticatedUser(req);
            const orderRows = await dbSelect('orders', 'id', orderId, 'id,user_id');
            if (authUser && orderRows?.[0]?.user_id && authUser.id !== orderRows[0].user_id && authUser.profile?.role !== 'admin') {
              return sendJson(res, 403, { error: 'Unauthorized: cannot record failure for another customer order' });
            }

            console.log(`[PaymentGW] Recording failure for order ${orderId}: ${errorCode}`);

            const rpcResult = await dbRpc('mark_order_payment_failed', {
              p_order_id:          orderId,
              p_razorpay_order_id: razorpayOrderId || null,
              p_error_code:        errorCode        || 'PAYMENT_FAILED',
              p_error_description: errorDescription || 'Transaction declined',
            });

            // Fallback if RPC not yet deployed
            if (!rpcResult || rpcResult.error || rpcResult?.ok === false) {
              await dbPatch('payments', 'order_id', orderId, {
                payment_status:      'failed',
                failure_code:        errorCode        || 'PAYMENT_FAILED',
                failure_description: errorDescription || 'Transaction declined',
                failed_at:           new Date().toISOString(),
              });
              await dbPatch('orders',   'id',       orderId, { payment_status: 'failed' });
              await recordPaymentEvent({
                order_id:          orderId,
                payment_id:        paymentId || null,
                event_type:        'failed',
                gateway_mode:      paymentMode,
                razorpay_order_id: razorpayOrderId || null,
                error_code:        errorCode        || 'PAYMENT_FAILED',
                error_description: errorDescription || 'Transaction declined',
              });

              // Push notification only on fallback (RPC already sends it when successful)
              await notifyOrderOwner(
                orderId,
                'Payment Failed',
                `Payment attempt failed: ${errorDescription || 'Transaction declined'}. You can retry anytime.`
              );
            }

            return sendJson(res, 200, {
              recorded:      true,
              paymentStatus: 'failed',
              canRetry:      true,
              orderId,
            });
          } catch (err) {
            console.error('[PaymentGW] record-failure error:', err);
            return sendJson(res, 500, { error: 'Failed to record payment failure' });
          }
        }

        // ── 6. POST /api/payments/cancel ─────────────────────────────────────
        if (req.method === 'POST' && url.startsWith('/api/payments/cancel')) {
          try {
            const { orderId, paymentId, razorpayOrderId, reason } = await parseJsonBody(req);

            if (offlineOrderLedger.has(String(orderId)) || isLocalCatalogOrderId(orderId)) {
              const entry = offlineOrderLedger.get(String(orderId));
              if (entry && entry.paymentStatus !== 'paid') {
                entry.paymentStatus = 'cancelled';
              }
              console.log(`[PaymentGW] Payment cancelled by user for catalog order ${orderId}`);
              return sendJson(res, 200, {
                recorded:      true,
                paymentStatus: 'cancelled',
                canRetry:      true,
                orderId,
              });
            }

            const authUser = await getAuthenticatedUser(req);
            const orderRows = await dbSelect('orders', 'id', orderId, 'id,user_id');
            if (authUser && orderRows?.[0]?.user_id && authUser.id !== orderRows[0].user_id && authUser.profile?.role !== 'admin') {
              return sendJson(res, 403, { error: 'Unauthorized: cannot record cancellation for another customer order' });
            }

            console.log(`[PaymentGW] Payment cancelled by user for order ${orderId}`);

            await dbPatch('payments', 'order_id', orderId, { payment_status: 'cancelled' });

            await recordPaymentEvent({
              order_id:          orderId,
              payment_id:        paymentId || null,
              event_type:        'cancelled',
              gateway_mode:      paymentMode,
              razorpay_order_id: razorpayOrderId || null,
              metadata:          { reason: reason || 'User dismissed checkout' },
            });

            return sendJson(res, 200, {
              recorded:      true,
              paymentStatus: 'cancelled',
              canRetry:      true,
              orderId,
            });
          } catch (err) {
            console.error('[PaymentGW] cancel error:', err);
            return sendJson(res, 500, { error: 'Failed to record cancellation' });
          }
        }

        // ── 7. GET /api/payments/payment-status?orderId=… ────────────────────
        if (req.method === 'GET' && url.startsWith('/api/payments/payment-status')) {
          try {
            const qs      = new URL(`http://localhost${url}`).searchParams;
            const orderId = qs.get('orderId');
            if (!orderId) return sendJson(res, 400, { error: 'orderId required' });

            if (offlineOrderLedger.has(String(orderId))) {
              const entry = offlineOrderLedger.get(String(orderId));
              return sendJson(res, 200, {
                orderId,
                paymentStatus: entry.paymentStatus,
                orderStatus: entry.orderStatus || (entry.paymentStatus === 'paid' ? 'payment_confirmed' : 'order_placed'),
                transactionReference: entry.transactionReference || null,
              });
            }

            if (!isUuidString(orderId)) {
              return sendJson(res, 404, { error: 'Order not found' });
            }

            const authUser = await getAuthenticatedUser(req);
            const rows = await dbSelect('orders', 'id', orderId, 'id,user_id,payment_status,order_status,status');
            if (!rows || !rows[0]) return sendJson(res, 404, { error: 'Order not found' });

            const order = rows[0];
            if (authUser && order.user_id && authUser.id !== order.user_id && authUser.profile?.role !== 'admin') {
              return sendJson(res, 403, { error: 'Unauthorized: cannot inspect status of another customer order' });
            }
            return sendJson(res, 200, {
              orderId,
              paymentStatus: order.payment_status,
              orderStatus:   order.order_status || order.status,
            });
          } catch (err) {
            console.error('[PaymentGW] payment-status error:', err);
            return sendJson(res, 500, { error: 'Failed to fetch payment status' });
          }
        }

        next();
      };

      return {
        name: 'payment-gateway-backend',
        configureServer(server) {
          server.middlewares.use(paymentMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(paymentMiddleware);
        },
      };
}
