import { dbPatch, dbInsert, paymentMode } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, paymentId, razorpayOrderId, errorCode, errorDescription } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const idStr = String(orderId).trim();
    if (idStr.startsWith('ORD-') || idStr.startsWith('local-ord-')) {
      return res.status(200).json({
        recorded:      true,
        paymentStatus: 'failed',
        canRetry:      true,
        orderId,
      });
    }

    await dbPatch('payments', 'order_id', orderId, {
      payment_status:      'failed',
      failure_code:        errorCode        || 'PAYMENT_FAILED',
      failure_description: errorDescription || 'Transaction declined',
      failed_at:           new Date().toISOString(),
    });

    await dbPatch('orders', 'id', orderId, { payment_status: 'failed' });

    await dbInsert('payment_events', {
      order_id:          orderId,
      payment_id:        paymentId || null,
      event_type:        'failed',
      gateway_mode:      paymentMode,
      razorpay_order_id: razorpayOrderId || null,
      error_code:        errorCode        || 'PAYMENT_FAILED',
      error_description: errorDescription || 'Transaction declined',
    });

    return res.status(200).json({
      recorded:      true,
      paymentStatus: 'failed',
      canRetry:      true,
      orderId,
    });
  } catch (err) {
    console.error('[record-failure error]:', err);
    return res.status(500).json({ error: 'Failed to record payment failure' });
  }
}
