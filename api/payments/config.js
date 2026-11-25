export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || '';
  const paymentMode = process.env.PAYMENT_GATEWAY_MODE || 'test';

  return res.status(200).json({
    keyId: razorpayKeyId,
    mode: paymentMode,
    currency: 'INR',
    provider: 'razorpay',
  });
}
