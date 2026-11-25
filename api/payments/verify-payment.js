import crypto from 'node:crypto';
import { admin, dbSelect, dbPatch, dbInsert, dbRpc, razorpaySecret, paymentMode } from '../_db.js';
import { recalculateOrderTotalFromDb, verifyPaymentAmountMatchesServer } from '../../server/promotionService.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidString(value) {
  return UUID_REGEX.test(String(value || '').trim());
}
function isLocalCatalogOrderId(orderId) {
  const id = String(orderId || '').trim();
  return id.startsWith('local-ord-') || id.startsWith('ORD-');
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      orderId, paymentId,
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      checkoutToken,
      amountInPaise: clientAmountInPaise,
      amount: clientAmountRupees,
    } = req.body || {};

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing required verification parameters',
      });
    }

    const isValid = verifyRazorpaySignature(
      razorpayOrderId, razorpayPaymentId, razorpaySignature
    );

    if (!isValid) {
      if (isUuidString(orderId)) {
        await dbInsert('payment_events', {
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
      return res.status(400).json({
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

    if (isLocalCatalogOrderId(orderId)) {
      const tokenData = verifyLocalCheckoutToken(checkoutToken);
      if (!tokenData || String(tokenData.orderId) !== String(orderId)) {
        return res.status(400).json({
          verified: false,
          error: 'Invalid or missing server checkout verification token'
        });
      }
      if (tokenData.razorpayOrderId !== razorpayOrderId) {
        return res.status(400).json({
          verified: false,
          error: 'Gateway order reference does not match initiated checkout order'
        });
      }
      const tokenCheck = verifyPaymentAmountMatchesServer({
        expectedPaise: tokenData.expectedPaise,
        clientAmountInPaise: normalizedClientPaise
      });
      if (!tokenCheck.matches) {
        return res.status(400).json({
          verified: false,
          error: tokenCheck.reason
        });
      }
      return res.status(200).json({
        verified:              true,
        verifiedAmount:        tokenData.expectedAmount,
        verifiedAmountInPaise: tokenData.expectedPaise,
        paymentStatus:         'paid',
        orderStatus:           'payment_confirmed',
        transactionReference:  razorpayPaymentId,
        message:               'Payment verified and order updated.',
      });
    }

    if (!isUuidString(orderId)) {
      return res.status(404).json({ verified: false, error: 'Order not found' });
    }

    const paymentRows = await dbSelect('payments', 'order_id', orderId, 'id,amount,razorpay_order_id,payment_status');
    const paymentRow = paymentRows?.[0] || null;
    if (paymentRow?.razorpay_order_id && paymentRow.razorpay_order_id !== razorpayOrderId) {
      await dbInsert('payment_events', {
        order_id:            orderId,
        payment_id:          paymentId || paymentRow.id || null,
        event_type:          'failed',
        gateway_mode:        paymentMode,
        razorpay_order_id:   razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        error_code:          'ORDER_REFERENCE_MISMATCH',
        error_description:   'Gateway order ID does not match initiated payment record',
      });
      return res.status(400).json({
        verified: false,
        error: 'Gateway order reference does not match initiated checkout order',
      });
    }

    const recalc = await recalculateOrderTotalFromDb({ admin, orderId });
    const amountCheck = recalc.ok
      ? verifyPaymentAmountMatchesServer({
          expectedPaise: recalc.expectedPaise,
          storedOrderPaise: recalc.storedOrderPaise,
          paymentRowAmount: paymentRow?.amount ?? null,
          clientAmountInPaise: normalizedClientPaise,
        })
      : { matches: false, reason: recalc.error || 'Failed to recalculate server checkout amount' };

    if (!recalc.ok || !recalc.orderTotalMatches || !amountCheck.matches) {
      const mismatchError =
        amountCheck.reason ||
        recalc.mismatchReason ||
        'Verified payment amount does not match server-calculated checkout amount';

      await dbInsert('payment_events', {
        order_id:            orderId,
        payment_id:          paymentId || paymentRow?.id || null,
        event_type:          'failed',
        gateway_mode:        paymentMode,
        razorpay_order_id:   razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        error_code:          'AMOUNT_MISMATCH',
        error_description:   mismatchError,
      });
      return res.status(400).json({
        verified: false,
        error: mismatchError,
      });
    }

    const rpcResult = await dbRpc('mark_order_paid', {
      p_order_id:            orderId,
      p_razorpay_order_id:   razorpayOrderId,
      p_razorpay_payment_id: razorpayPaymentId,
      p_razorpay_signature:  razorpaySignature,
    });

    if (!rpcResult || rpcResult.error || rpcResult?.ok === false) {
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
      await dbInsert('payment_events', {
        order_id:            orderId,
        payment_id:          paymentId || null,
        event_type:          'verified',
        gateway_mode:        paymentMode,
        razorpay_order_id:   razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      });
    }

    return res.status(200).json({
      verified:              true,
      verifiedAmount:        recalc.expectedTotal,
      verifiedAmountInPaise: recalc.expectedPaise,
      paymentStatus:         'paid',
      orderStatus:           'payment_confirmed',
      transactionReference:  razorpayPaymentId,
      message:               'Payment verified and order updated.',
    });
  } catch (err) {
    console.error('[verify-payment error]:', err);
    return res.status(500).json({ verified: false, error: 'Internal verification error' });
  }
}
