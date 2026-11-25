import { dbPatch, dbInsert, paymentMode } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, paymentId, razorpayOrderId, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const idStr = String(orderId).trim();
    if (idStr.startsWith('ORD-') || idStr.startsWith('local-ord-')) {
      return res.status(200).json({
        recorded:      true,
        paymentStatus: 'cancelled',
        canRetry:      true,
        orderId,
      });
    }

    await dbPatch('payments', 'order_id', orderId, { payment_status: 'cancelled' });

    await dbInsert('payment_events', {
      order_id:          orderId,
      payment_id:        paymentId || null,
      event_type:        'cancelled',
      gateway_mode:      paymentMode,
      razorpay_order_id: razorpayOrderId || null,
      metadata:          { reason: reason || 'Customer dismissed checkout' },
    });

    return res.status(200).json({
      recorded:      true,
      paymentStatus: 'cancelled',
      canRetry:      true,
      orderId,
    });
  } catch (err) {
    console.error('[cancel error]:', err);
    return res.status(500).json({ error: 'Failed to record cancellation' });
  }
}
