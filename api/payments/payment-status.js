import { dbSelect } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.query || {};
    if (!orderId) {
      return res.status(400).json({ error: 'orderId required' });
    }

    const rows = await dbSelect('orders', 'id', orderId, 'id,user_id,payment_status,order_status,status');
    if (!rows || !rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = rows[0];
    return res.status(200).json({
      orderId,
      paymentStatus: order.payment_status,
      orderStatus:   order.order_status || order.status,
    });
  } catch (err) {
    console.error('[payment-status error]:', err);
    return res.status(500).json({ error: 'Failed to fetch payment status' });
  }
}
