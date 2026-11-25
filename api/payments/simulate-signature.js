import crypto from 'node:crypto';
import { razorpaySecret, paymentMode } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (paymentMode === 'live') {
    return res.status(403).json({ error: 'Signature simulation is strictly forbidden in live mode' });
  }

  try {
    const { razorpayOrderId, razorpayPaymentId } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ error: 'razorpayOrderId and razorpayPaymentId required' });
    }

    const signature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return res.status(200).json({
      success: true,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: signature,
    });
  } catch (err) {
    console.error('[simulate-signature error]:', err);
    return res.status(500).json({ error: 'Signature simulation failed' });
  }
}
