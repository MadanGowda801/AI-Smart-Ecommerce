/**
 * Payment Gateway Service (Client-Side)
 *
 * Implements Razorpay Sandbox integration following official Razorpay documentation:
 *   https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 *
 * Security guarantees:
 *   - RAZORPAY_KEY_SECRET is NEVER present in this file or any browser bundle.
 *   - All verification and DB writes go through the Vite server plugin (server-side).
 *   - A frontend "payment succeeded" callback is NEVER trusted without server verification.
 *   - Orders are marked paid only after /api/payments/verify-payment succeeds.
 */

// ── Razorpay Checkout.js loader ───────────────────────────────────────────────

let _scriptPromise = null;

/**
 * Dynamically inject Razorpay Checkout.js exactly once.
 * Returns a promise that resolves to true on success, false if the CDN is
 * unreachable (sandbox simulator handles that case).
 */
export function loadRazorpayScript() {
  if (_scriptPromise) return _scriptPromise;

  _scriptPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src   = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload  = () => resolve(true);
    script.onerror = () => {
      console.warn('[PaymentGateway] checkout.js unavailable — using built-in sandbox simulator.');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return _scriptPromise;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const paymentGatewayService = {
  /**
   * Fetch public gateway config from the server.
   * Only safe/public values are returned (key ID, currency, mode).
   */
  async getConfig() {
    try {
      const res = await fetch('/api/payments/config');
      if (res.ok) return res.json();
    } catch { /* network error */ }
    // Fallback uses only the PUBLIC env var (VITE_* prefix, safe to ship)
    return {
      keyId:    import.meta.env.VITE_RAZORPAY_KEY_ID || '',
      mode:     'test',
      currency: 'INR',
      provider: 'razorpay',
    };
  },

  /**
   * Create a gateway order on the server.
   *
   * Returns:
   *   { orderId, paymentId, razorpayOrderId, amount (paise), currency, keyId,
   *     name, description, prefill, notes }
   *
   * The returned `paymentId` is the UUID of the row created in public.payments
   * and must be threaded through to verifyPayment / recordFailure / cancel.
   */
  async initiateOrder({ orderId, amount, customerName, customerEmail, paymentMethod, items, couponCode, shippingMethod }) {
    const res = await fetch('/api/payments/create-order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orderId, amount, customerName, customerEmail, paymentMethod, items, couponCode, shippingMethod }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate payment gateway order');
    }

    return res.json(); // includes paymentId
  },

  /**
   * Authoritative server-side HMAC-SHA256 signature & checkout amount verification.
   *
   * The server:
   *   1. Recomputes HMAC(razorpayOrderId|razorpayPaymentId) using the secret key
   *   2. Compares with timing-safe equal
   *   3. Recalculates the order total from trusted DB prices & promotion rules and
   *      verifies the payment amount matches the server-calculated checkout amount
   *   4. Only if valid: marks payments + orders rows as paid via SECURITY DEFINER RPC
   *
   * NEVER mark an order as paid based solely on this call returning on the frontend.
   * Always check verifyResult.verified === true before clearing the cart.
   */
  async verifyPayment({ orderId, paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, amountInPaise, checkoutToken }) {
    const res = await fetch('/api/payments/verify-payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        orderId, paymentId,
        razorpayOrderId, razorpayPaymentId, razorpaySignature,
        ...(amountInPaise !== undefined ? { amountInPaise } : {}),
        ...(checkoutToken ? { checkoutToken } : {}),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.verified) {
      throw new Error(data.error || 'Server-side payment verification failed');
    }

    return data; // { verified, paymentStatus, orderStatus, transactionReference, message }
  },

  /**
   * Notify the server of a payment failure.
   * Server updates payments + orders rows to payment_status='failed' and
   * sends a notification to the user. Order remains retryable.
   */
  async recordFailure({ orderId, paymentId, razorpayOrderId, errorCode, errorDescription }) {
    try {
      const res = await fetch('/api/payments/record-failure', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          orderId,
          paymentId:        paymentId        || null,
          razorpayOrderId:  razorpayOrderId  || null,
          errorCode:        errorCode        || 'PAYMENT_FAILED',
          errorDescription: errorDescription || 'Transaction was declined',
        }),
      });
      return res.json();
    } catch (err) {
      console.warn('[PaymentGateway] recordFailure network error:', err);
      return { recorded: false };
    }
  },

  /**
   * Notify the server that the user dismissed the checkout modal.
   * Order stays in pending state and is retryable.
   */
  async recordCancellation({ orderId, paymentId, razorpayOrderId, reason }) {
    try {
      const res = await fetch('/api/payments/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          orderId,
          paymentId:       paymentId       || null,
          razorpayOrderId: razorpayOrderId || null,
          reason:          reason          || 'Customer dismissed checkout modal',
        }),
      });
      return res.json();
    } catch (err) {
      console.warn('[PaymentGateway] recordCancellation network error:', err);
      return { recorded: false };
    }
  },

  /**
   * Poll server-side payment status for an order.
   * Use this to confirm status after returning from an external redirect,
   * or to verify a pending order on page load.
   */
  async getPaymentStatus(orderId) {
    const res = await fetch(`/api/payments/payment-status?orderId=${encodeURIComponent(orderId)}`);
    if (!res.ok) throw new Error('Failed to fetch payment status');
    return res.json(); // { orderId, paymentStatus, orderStatus }
  },

  /**
   * Sandbox helper — request a server-generated valid HMAC signature.
   *
   * Used ONLY in the sandbox simulator modal (RazorpayPaymentModal).
   * In production with real Razorpay, Checkout.js provides the signature
   * directly in the handler callback — this endpoint is unnecessary.
   */
  async getSimulatedSignature({ razorpayOrderId, razorpayPaymentId }) {
    const res = await fetch('/api/payments/simulate-signature', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ razorpayOrderId, razorpayPaymentId }),
    });
    if (!res.ok) throw new Error('Signature simulation endpoint failed');
    return res.json(); // { razorpayOrderId, razorpayPaymentId, razorpaySignature }
  },
};

export default paymentGatewayService;
