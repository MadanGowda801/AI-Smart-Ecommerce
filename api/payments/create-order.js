import crypto from 'node:crypto';
import { admin, dbSelect, dbInsert, dbPatch, razorpayKeyId, razorpaySecret, paymentMode } from '../_db.js';
import { calculateServerCartPricing, recalculateOrderTotalFromDb } from '../../server/promotionService.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, customerName, customerEmail, items, couponCode, shippingMethod } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const isUuidOrder = isUuidString(orderId);
    const isLocalCatalogOrder = isLocalCatalogOrderId(orderId);
    const orderRows = isUuidOrder
      ? await dbSelect('orders', 'id', orderId, 'id,user_id,total_amount,payment_status')
      : null;

    if ((!orderRows || !orderRows[0]) && isLocalCatalogOrder && Array.isArray(items) && items.length > 0) {
      const serverCalc = await calculateServerCartPricing({
        admin,
        items,
        couponCode: couponCode || null,
        shippingMethod: shippingMethod || 'standard',
        strictCatalog: true,
        allowRawSubtotalFallback: false
      });

      if (!serverCalc.ok || serverCalc.amountInPaise <= 0) {
        return res.status(400).json({
          error: serverCalc.error || 'Unable to verify server-calculated checkout amount'
        });
      }

      const razorpayOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const paymentId = `local-pay-${Date.now()}`;
      const checkoutToken = signLocalCheckoutToken({
        orderId: String(orderId),
        paymentId,
        razorpayOrderId,
        expectedPaise: serverCalc.amountInPaise,
        expectedAmount: serverCalc.grandTotal
      });

      return res.status(200).json({
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
      return res.status(404).json({ error: 'Order not found in database' });
    }
    const order = orderRows[0];

    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'Order has already been marked as paid' });
    }

    const recalc = await recalculateOrderTotalFromDb({ admin, orderId });
    if (!recalc.ok) {
      return res.status(400).json({ error: recalc.error || 'Failed to recalculate authoritative order total' });
    }
    if (!recalc.orderTotalMatches) {
      return res.status(400).json({
        error: recalc.mismatchReason || 'Order total does not match server-calculated checkout amount'
      });
    }

    const authoritativeAmount = recalc.expectedTotal;
    const amountInPaise       = recalc.expectedPaise;
    if (isNaN(authoritativeAmount) || authoritativeAmount <= 0 || amountInPaise <= 0) {
      return res.status(400).json({ error: 'Invalid order amount stored in database' });
    }

    const razorpayOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const userId          = order.user_id || null;

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

    await dbInsert('payment_events', {
      order_id:          orderId,
      payment_id:        paymentId,
      event_type:        'initiated',
      gateway_provider:  'razorpay',
      gateway_mode:      paymentMode,
      razorpay_order_id: razorpayOrderId,
    });

    return res.status(200).json({
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
        name:  customerName  || 'Valued Customer',
        email: customerEmail || 'customer@smartshop.in',
      },
      notes: { appOrderId: orderId },
    });
  } catch (err) {
    console.error('[create-order error]:', err);
    return res.status(500).json({ error: 'Internal error creating gateway order' });
  }
}
