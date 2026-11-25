import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin, Truck, CreditCard, Check, ArrowRight, Tag, X,
  Plus, Home, Briefcase, Edit3, Loader, AlertTriangle, RefreshCw, ShieldCheck
} from 'lucide-react';
import { useCart } from './CartContext';
import { useOrders } from './OrdersContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { useNotifications } from './NotificationContext';
import Breadcrumb from './Breadcrumb';
import EmptyState from './EmptyState';
import PromotionBanner from './PromotionBanner';
import { formatINR } from './productsService';
import RazorpayPaymentModal from './RazorpayPaymentModal';
import paymentGatewayService, { loadRazorpayScript } from './paymentGatewayService';
import {
  calculatePricing,
  STANDARD_SHIPPING_FEE,
  EXPRESS_SHIPPING_FEE,
  SAMEDAY_SHIPPING_FEE
} from './dynamicPricingEngine';
import pricingService from './pricingService';
import { sanitizeMobileInput, validateMobileNumber, formatMobileDisplay } from './phoneUtils';
import { computeEstimatedDeliveryDate, formatEstimatedDate } from './deliveryConstants';

const SHIPPING_METHODS = [
  { id: 'standard', label: 'Standard Delivery', time: '3-5 business days', fee: STANDARD_SHIPPING_FEE, badge: 'STANDARD', badgeColor: 'var(--success)' },
  { id: 'express', label: 'Express Delivery', time: '1-2 business days', fee: EXPRESS_SHIPPING_FEE, badge: 'FAST', badgeColor: 'var(--accent-gold-light)' },
  { id: 'sameday', label: 'Same-Day Delivery', time: 'Before 8 PM today', fee: SAMEDAY_SHIPPING_FEE, badge: 'TODAY', badgeColor: 'var(--accent-primary)' }
];

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI (GPay / PhonePe / Paytm)', icon: '📱', desc: 'Instant payment via any UPI app' },
  { id: 'card', label: 'Credit / Debit Card (Visa, RuPay)', icon: '💳', desc: 'All major cards accepted' },
  { id: 'netbanking', label: 'Net Banking', icon: '🏦', desc: '50+ banks supported' },
  { id: 'cod', label: 'Cash on Delivery (COD)', icon: '💵', desc: 'Pay at your doorstep' }
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];

const blankAddress = {
  fullName: '',
  phone: '',
  houseNumber: '',
  street: '',
  landmark: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Karnataka',
  pincode: '',
  label: 'Home'
};

export function CheckoutPage() {
  const {
    items,
    availableItems,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon,
    priceAdjustments,
    dismissPriceAdjustments,
    isPricingLoading: cartPricingLoading,
    pricingError: cartPricingError,
    refreshPricing,
    clearCart,
    isLoading: cartLoading
  } = useCart();
  const {
    placeOrder,
    addresses,
    fetchAddresses,
    saveAddress,
    isPlacingOrder,
    getOrderById,
    fetchOrders,
    updateLocalOrderPayment
  } = useOrders();
  const { user } = useAuth();
  const { navigate, params } = useNavigation();
  const { addNotification } = useNotifications();

  // ── Step management ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1: Address, 2: Shipping, 3: Payment, 4: Review
  const [checkoutCouponInput, setCheckoutCouponInput] = useState('');

  // ── Address state ──────────────────────────────────────────────────────────
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [address, setAddress] = useState({
    ...blankAddress,
    fullName: user?.name || user?.user_metadata?.name || '',
    phone: user?.phone || ''
  });
  const [addressError, setAddressError] = useState('');

  // ── Shipping & Payment ─────────────────────────────────────────────────────
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');

  // ── Submission lock & Order error ─────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');

  // ── Gateway & Failure States ──────────────────────────────────────────────
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [gatewayOrderData, setGatewayOrderData] = useState(null);
  const [failedPaymentState, setFailedPaymentState] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  // DB payment row UUID returned from the server's create-order endpoint
  const [pendingPaymentId, setPendingPaymentId] = useState(null);

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // ── Authoritative Checkout Pricing (per selected shipping method) ──────────
  const [serverCheckoutState, setServerCheckoutState] = useState({ signature: '', data: null });
  const [isCheckoutPricingLoading, setIsCheckoutPricingLoading] = useState(false);
  const [checkoutPricingError, setCheckoutPricingError] = useState(null);
  const [checkoutPricingNonce, setCheckoutPricingNonce] = useState(0);

  const localCheckoutPricing = useMemo(
    () =>
      calculatePricing({
        items: availableItems,
        couponCode: appliedCoupon?.code || null,
        shippingMethod,
        userContext: { isAuthenticated: Boolean(user?.id) }
      }),
    [availableItems, appliedCoupon, shippingMethod, user?.id]
  );

  const checkoutSig = useMemo(() => {
    const itemSig = (availableItems || [])
      .map((i) => `${i.productId || i.id}:${Number(i.price || 0)}:${Number(i.quantity || 1)}`)
      .sort()
      .join('|');
    return `${user?.id || 'guest'}::${shippingMethod}::${appliedCoupon?.code || ''}::${itemSig}`;
  }, [availableItems, shippingMethod, appliedCoupon, user?.id]);

  useEffect(() => {
    if (!availableItems || availableItems.length === 0) {
      setIsCheckoutPricingLoading(false);
      setCheckoutPricingError(null);
      return;
    }

    const controller = new AbortController();
    setIsCheckoutPricingLoading(true);
    setCheckoutPricingError(null);

    pricingService
      .calculateCartPricing({
        items: availableItems,
        couponCode: appliedCoupon?.code || null,
        shippingMethod,
        userContext: { isAuthenticated: Boolean(user?.id) },
        signal: controller.signal
      })
      .then((res) => {
        if (res.aborted || controller.signal.aborted) return;
        if (res.error) {
          setCheckoutPricingError(res.error);
        } else if (res.data) {
          setServerCheckoutState({ signature: checkoutSig, data: res.data });
        }
        setIsCheckoutPricingLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setIsCheckoutPricingLoading(false);
      });

    return () => controller.abort();
  }, [checkoutSig, availableItems, appliedCoupon, shippingMethod, user?.id, checkoutPricingNonce]);

  const checkoutPricing =
    serverCheckoutState.signature === checkoutSig && serverCheckoutState.data
      ? serverCheckoutState.data
      : localCheckoutPricing;

  const subtotal = checkoutPricing.subtotal;
  const tierDiscount = checkoutPricing.tierDiscount;
  const activeTier = checkoutPricing.activeTier;
  const couponDiscount = checkoutPricing.couponDiscount;
  const discountAmount = checkoutPricing.totalDiscount;
  const shippingFee = checkoutPricing.shippingFee;
  const tax = checkoutPricing.tax;
  const finalTotal = checkoutPricing.grandTotal;

  const shippingOptions = useMemo(
    () =>
      SHIPPING_METHODS.map((m) => {
        if (m.id !== 'standard') return m;
        const isFree = Boolean(checkoutPricing.qualifiesForFreeShipping);
        return {
          ...m,
          fee: isFree ? 0 : STANDARD_SHIPPING_FEE,
          badge: isFree ? 'FREE' : 'STANDARD',
          badgeColor: isFree ? 'var(--success)' : '#94a3b8',
          time: isFree
            ? '3-5 business days'
            : checkoutPricing.freeShippingEnabled && checkoutPricing.freeShippingThreshold
              ? `3-5 business days (Free on orders ₹${checkoutPricing.freeShippingThreshold.toLocaleString('en-IN')}+)`
              : '3-5 business days'
        };
      }),
    [checkoutPricing.qualifiesForFreeShipping, checkoutPricing.freeShippingEnabled, checkoutPricing.freeShippingThreshold]
  );

  const selectedShipping = shippingOptions.find((m) => m.id === shippingMethod) || shippingOptions[0];

  // Handle retryOrderId navigation parameter
  useEffect(() => {
    async function loadRetryOrder() {
      if (!params?.retryOrderId) return;
      try {
        const order = await getOrderById(params.retryOrderId);
        if (order) {
          setPendingOrderId(order.id);
          setStep(4);
          setFailedPaymentState({
            orderId: order.id,
            reason: 'Payment attempt was not completed. Click Retry Payment to finalize order.',
            amount: order.pricing?.total || finalTotal
          });
        }
      } catch (err) {
        console.warn('Failed to load retry order:', err);
      }
    }
    loadRetryOrder();
  }, [params?.retryOrderId, getOrderById]);

  // Pre-populate from saved addresses
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId && !showNewAddressForm) {
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
      setAddress({
        fullName: defaultAddr.full_name || defaultAddr.fullName || '',
        phone: sanitizeMobileInput(defaultAddr.phone || ''),
        houseNumber: defaultAddr.house_number || defaultAddr.houseNumber || defaultAddr.line1 || '',
        street: defaultAddr.street || defaultAddr.line2 || '',
        landmark: defaultAddr.landmark || '',
        line1: defaultAddr.line1 || defaultAddr.house_number || '',
        line2: defaultAddr.line2 || defaultAddr.street || '',
        city: defaultAddr.city || '',
        state: defaultAddr.state || 'Karnataka',
        pincode: defaultAddr.pincode || '',
        label: defaultAddr.label || 'Home'
      });
    } else if (addresses.length === 0) {
      setShowNewAddressForm(true);
    }
  }, [addresses]);

  // Handle saved address selection
  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setShowNewAddressForm(false);
    setAddress({
      fullName: addr.full_name || addr.fullName || '',
      phone: sanitizeMobileInput(addr.phone || ''),
      houseNumber: addr.house_number || addr.houseNumber || addr.line1 || '',
      street: addr.street || addr.line2 || '',
      landmark: addr.landmark || '',
      line1: addr.line1 || addr.house_number || '',
      line2: addr.line2 || addr.street || '',
      city: addr.city || '',
      state: addr.state || 'Karnataka',
      pincode: addr.pincode || '',
      label: addr.label || 'Home'
    });
  };

  // Validate all required delivery address fields
  const validateAddress = () => {
    if (!address.fullName?.trim()) return 'Full name is required';
    if (!address.phone?.trim()) return 'Mobile number is required';
    const phoneErr = validateMobileNumber(address.phone, true);
    if (phoneErr) return phoneErr;
    if (!address.houseNumber?.trim() && !address.line1?.trim()) return 'House / Flat number is required';
    if (!address.street?.trim()) return 'Street / Road name is required';
    if (!address.city?.trim()) return 'City is required';
    if (!address.state?.trim()) return 'State is required';
    if (!address.pincode?.trim()) return 'PIN Code is required';
    if (!/^\d{6}$/.test(address.pincode.trim())) return 'Enter a valid 6-digit PIN Code';
    return '';
  };

  const handleContinueToShipping = async () => {
    const err = validateAddress();
    if (err) { setAddressError(err); return; }
    setAddressError('');

    // Save new address to DB / saved address book
    if (showNewAddressForm && saveNewAddress && user?.id) {
      const { error: saveErr } = await saveAddress({
        ...address,
        line1: address.houseNumber || address.line1,
        line2: [address.street, address.landmark ? `Near ${address.landmark}` : ''].filter(Boolean).join(', '),
        is_default: addresses.length === 0
      });
      if (!saveErr) await fetchAddresses();
    }
    setStep(2);
  };

  const handlePlaceOrder = async (retryOrderId = null) => {
    if (isSubmitting || isPlacingOrder) return;
    setIsSubmitting(true);
    setOrderError('');
    setFailedPaymentState(null);

    const houseNum = (address.houseNumber || address.line1 || '').trim();
    const streetStr = (address.street || address.line2 || '').trim();
    const landmarkStr = (address.landmark || '').trim();
    const shippingAddr = {
      fullName: address.fullName.trim(),
      mobile: sanitizeMobileInput(address.phone),
      houseNumber: houseNum,
      street: streetStr,
      landmark: landmarkStr,
      addressLine: [houseNum, streetStr, landmarkStr ? `Landmark: ${landmarkStr}` : ''].filter(Boolean).join(', '),
      city: address.city.trim(),
      state: address.state,
      pincode: address.pincode.trim()
    };

    const paymentLabel = PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label || 'Online';
    const isOnline = paymentMethod !== 'cod';

    try {
      let currentOrder = null;

      if (retryOrderId && typeof retryOrderId === 'string') {
        const existingRetry = await getOrderById(retryOrderId);
        currentOrder = existingRetry || { id: retryOrderId, pricing: { total: finalTotal } };
      } else {
        currentOrder = await placeOrder({
          items,
          shippingAddress: shippingAddr,
          paymentMethod: paymentLabel,
          shippingMethod,
          couponCode: appliedCoupon?.code || null
        });

        if (!currentOrder) {
          setOrderError('Failed to create order. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      setPendingOrderId(currentOrder.id);

      // Cash on Delivery flow (no online gateway needed)
      if (!isOnline) {
        await clearCart({ silent: true });
        const orderNumber = currentOrder.id.slice(0, 8).toUpperCase();
        const orderTotal = currentOrder.pricing?.total ?? finalTotal;

        addNotification({
          title: 'Order Confirmed! 🎉',
          message: `Order #${orderNumber} placed successfully! Pay ₹${orderTotal.toLocaleString('en-IN')} upon delivery.`,
          type: 'order',
          link: `#/order-confirmation/${currentOrder.id}`
        });

        navigate('order-confirmation', { params: { id: currentOrder.id } });
        return;
      }

      // Online Gateway Payment Flow:
      const orderTotal = currentOrder.pricing?.total ?? finalTotal;
      const gatewayItems =
        Array.isArray(availableItems) && availableItems.length > 0
          ? availableItems
          : Array.isArray(currentOrder.items)
            ? currentOrder.items
            : [];
      const gwOrder = await paymentGatewayService.initiateOrder({
        orderId: currentOrder.id,
        amount: orderTotal,
        customerName: address.fullName || currentOrder.shippingAddress?.fullName || user?.name || 'Valued Customer',
        customerEmail: user?.email || 'customer@smartshop.in',
        paymentMethod: paymentLabel,
        items: gatewayItems,
        couponCode: appliedCoupon?.code || currentOrder.couponCode || null,
        shippingMethod: shippingMethod || currentOrder.shippingMethod || 'standard'
      });

      // Store the DB payment row UUID for downstream lifecycle calls
      setPendingPaymentId(gwOrder.paymentId || null);
      setGatewayOrderData(gwOrder);
      setIsPaymentModalOpen(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error('[CheckoutPage] placeOrder error:', err);
      setOrderError(err.message || 'An error occurred while preparing your order.');
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (response) => {
    setIsPaymentModalOpen(false);
    setIsSubmitting(true);
    setOrderError('');

    try {
      // Authoritative Server-Side Verification:
      // (Verifies cryptographic HMAC signature AND server-calculated checkout amount)
      const verifyResult = await paymentGatewayService.verifyPayment({
        orderId: pendingOrderId,
        paymentId: pendingPaymentId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
        amountInPaise: gatewayOrderData?.amount,
        checkoutToken: gatewayOrderData?.checkoutToken
      });

      if (!verifyResult?.verified) {
        throw new Error(verifyResult?.error || 'Server payment verification rejected');
      }

      // Persist verified paid status for catalog orders and refresh orders list
      updateLocalOrderPayment(pendingOrderId, {
        paymentStatus: 'paid',
        status: 'order_confirmed',
        transactionReference: verifyResult.transactionReference || response.razorpay_payment_id
      });
      await fetchOrders();

      await clearCart({ silent: true });

      const orderNumber = pendingOrderId ? pendingOrderId.slice(0, 8).toUpperCase() : '';
      const orderTotal = gatewayOrderData ? gatewayOrderData.amount / 100 : finalTotal;

      addNotification({
        title: 'Payment Successful! 💳',
        message: `Payment of ₹${orderTotal.toLocaleString('en-IN')} verified for Order #${orderNumber}. Txn: ${response.razorpay_payment_id}`,
        type: 'order',
        link: `#/order-confirmation/${pendingOrderId}`
      });

      navigate('order-confirmation', { params: { id: pendingOrderId } });
    } catch (err) {
      console.error('[CheckoutPage] Payment verification error:', err);
      setOrderError(`Payment verification failed: ${err.message}. Order status is pending.`);
      setFailedPaymentState({
        orderId: pendingOrderId,
        reason: err.message,
        amount: gatewayOrderData?.amount ? gatewayOrderData.amount / 100 : finalTotal
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentFailure = async (errorObj) => {
    setIsPaymentModalOpen(false);
    const reason = errorObj?.description || 'Transaction was declined by payment gateway or bank';

    await paymentGatewayService.recordFailure({
      orderId: pendingOrderId,
      paymentId: pendingPaymentId,
      razorpayOrderId: gatewayOrderData?.razorpayOrderId,
      errorCode: errorObj?.code || 'PAYMENT_FAILED',
      errorDescription: reason
    });

    updateLocalOrderPayment(pendingOrderId, { paymentStatus: 'failed' });

    setFailedPaymentState({
      orderId: pendingOrderId,
      reason,
      amount: gatewayOrderData?.amount ? gatewayOrderData.amount / 100 : finalTotal
    });

    addNotification({
      title: 'Payment Failed ⚠️',
      message: `Payment attempt failed for Order #${pendingOrderId ? pendingOrderId.slice(0, 8).toUpperCase() : ''}: ${reason}`,
      type: 'order'
    });
  };

  const handlePaymentCancel = async () => {
    setIsPaymentModalOpen(false);
    await paymentGatewayService.recordCancellation({
      orderId: pendingOrderId,
      paymentId: pendingPaymentId,
      razorpayOrderId: gatewayOrderData?.razorpayOrderId,
      reason: 'User dismissed checkout modal'
    });

    setFailedPaymentState({
      orderId: pendingOrderId,
      reason: 'Payment process was cancelled by user. You can retry anytime.',
      amount: gatewayOrderData?.amount ? gatewayOrderData.amount / 100 : finalTotal
    });
  };

  // ── Empty cart guard ───────────────────────────────────────────────────────
  if (!cartLoading && items.length === 0 && !params?.retryOrderId && !pendingOrderId) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
        <Breadcrumb items={[{ label: 'Checkout' }]} />
        <EmptyState
          title="Nothing to Checkout"
          description="Add items to your cart before proceeding to checkout."
          actionLabel="Browse Products"
          actionPath="products"
        />
      </div>
    );
  }

  // ── Step label helper ──────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: 'Delivery Address' },
    { n: 2, label: 'Shipping Method' },
    { n: 3, label: 'Payment' },
    { n: 4, label: 'Review & Place' }
  ];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      <Breadcrumb items={[{ label: 'Secure Checkout' }]} />

      <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '2rem' }}>
        Secure <span className="gradient-text">Checkout</span>
      </h1>

      {/* Step Progress Indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div
              onClick={() => step > s.n - 1 && setStep(s.n)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                cursor: step >= s.n ? 'pointer' : 'default', minWidth: '80px'
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: step >= s.n ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.07)',
                border: step >= s.n ? 'none' : '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700,
                color: step >= s.n ? '#fff' : 'var(--text-subtle)', flexShrink: 0,
                transition: 'all 0.2s ease'
              }}>
                {step > s.n ? <Check size={16} /> : s.n}
              </div>
              <span style={{
                fontSize: '0.72rem', color: step >= s.n ? 'var(--text-main)' : 'var(--text-subtle)',
                fontWeight: step === s.n ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap'
              }}>
                {s.label}
              </span>
            </div>
            {i < 3 && (
              <div style={{
                flex: 1, height: '2px',
                background: step > s.n ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'var(--border-subtle)',
                margin: '16px 4px 0', borderRadius: '1px', minWidth: '20px', transition: 'all 0.3s ease'
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'flex-start' }} className="checkout-layout">
        {/* ── LEFT: Steps ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── STEP 1: Delivery Address ───────────────────────────────── */}
          <div className="card-glass" style={{
            padding: '1.5rem',
            border: step === 1 ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)',
            transition: 'border-color 0.2s ease'
          }}>
            <div
              onClick={() => setStep(1)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: step === 1 ? '1.5rem' : '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <MapPin size={18} color="#818cf8" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Delivery Address</span>
              </div>
              {step !== 1 && (
                <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>
                  {address.city ? `${address.city}, ${address.pincode}` : 'Not set'}
                </span>
              )}
            </div>

            {step === 1 && (
              <>
                {/* Saved Addresses */}
                {addresses.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                      📍 Saved Addresses
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                            padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                            border: selectedAddressId === addr.id && !showNewAddressForm
                              ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
                            background: selectedAddressId === addr.id && !showNewAddressForm
                              ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleSelectSavedAddress(addr)}
                        >
                          <input
                            type="radio"
                            name="saved_address"
                            checked={selectedAddressId === addr.id && !showNewAddressForm}
                            onChange={() => handleSelectSavedAddress(addr)}
                            style={{ accentColor: '#6366f1', marginTop: '2px', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                                {addr.label || 'Home'}
                              </span>
                              {addr.is_default && (
                                <span style={{ fontSize: '0.67rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                                  DEFAULT
                                </span>
                              )}
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{addr.full_name}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', lineHeight: 1.5 }}>
                              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} — {addr.pincode}
                              {addr.phone && <><br />📞 {formatMobileDisplay(addr.phone)}</>}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <button
                      onClick={() => { setShowNewAddressForm(true); setSelectedAddressId(null); }}
                      style={{
                        marginTop: '0.75rem', background: 'none', border: '1px dashed rgba(99,102,241,0.4)',
                        color: '#818cf8', borderRadius: 'var(--radius-md)', padding: '0.55rem 1rem',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Plus size={15} /> Add New Address
                    </button>
                  </div>
                )}

                {/* New Address Form */}
                {(showNewAddressForm || addresses.length === 0) && (
                  <div style={{ borderTop: addresses.length > 0 ? '1px solid var(--border-subtle)' : 'none', paddingTop: addresses.length > 0 ? '1.25rem' : 0 }}>
                    {addresses.length > 0 && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Plus size={14} /> Enter New Address
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {[
                        { key: 'fullName', label: 'Full Name *', placeholder: 'Rohan Verma', type: 'text', colSpan: 1 },
                        { key: 'phone', label: 'Mobile Number (10 digits only) *', placeholder: '10 digits only (e.g. 9876543210)', type: 'tel', colSpan: 1 },
                        { key: 'houseNumber', label: 'House / Flat Number *', placeholder: 'Flat 402, Prestige Palms', type: 'text', colSpan: 1 },
                        { key: 'street', label: 'Street / Locality *', placeholder: 'Whitefield Main Road', type: 'text', colSpan: 1 },
                        { key: 'landmark', label: 'Landmark (Optional)', placeholder: 'Near Forum Value Mall', type: 'text', colSpan: 2 },
                        { key: 'city', label: 'City *', placeholder: 'Bengaluru', type: 'text', colSpan: 1 },
                        { key: 'pincode', label: 'PIN Code (6 digits) *', placeholder: '560066', type: 'text', colSpan: 1 }
                      ].map((field) => (
                        <div key={field.key} style={{ gridColumn: `span ${field.colSpan}` }}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                            <span>{field.label}</span>
                            {field.key === 'phone' && address.phone && (
                              <span style={{ fontSize: '0.72rem', color: address.phone.length === 10 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                                {address.phone.length}/10 digits
                              </span>
                            )}
                          </label>
                          <input
                            type={field.type}
                            inputMode={field.key === 'phone' || field.key === 'pincode' ? 'numeric' : undefined}
                            maxLength={field.key === 'phone' ? 10 : field.key === 'pincode' ? 6 : undefined}
                            value={address[field.key]}
                            onKeyDown={(e) => {
                              if (field.key === 'phone' && (address.phone || '').length >= 10 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                                if (/^\d$/.test(e.key)) {
                                  e.preventDefault();
                                }
                              }
                            }}
                            onChange={(e) => {
                              const val = field.key === 'phone'
                                ? sanitizeMobileInput(e.target.value)
                                : field.key === 'pincode'
                                ? e.target.value.replace(/\D/g, '').slice(0, 6)
                                : e.target.value;
                              setAddress((p) => ({ ...p, [field.key]: val }));
                            }}
                            placeholder={field.placeholder}
                            style={{
                              width: '100%', padding: '0.65rem 0.85rem',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)',
                              borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          State *
                        </label>
                        <select
                          value={address.state}
                          onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                          style={{
                            width: '100%', padding: '0.65rem 0.85rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none'
                          }}
                        >
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          Address Label
                        </label>
                        <select
                          value={address.label}
                          onChange={(e) => setAddress((p) => ({ ...p, label: e.target.value }))}
                          style={{
                            width: '100%', padding: '0.65rem 0.85rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none'
                          }}
                        >
                          <option value="Home">🏠 Home</option>
                          <option value="Work">🏢 Work</option>
                          <option value="Other">📍 Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Save address checkbox */}
                    {user?.id && addresses.length > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={saveNewAddress}
                          onChange={(e) => setSaveNewAddress(e.target.checked)}
                          style={{ accentColor: '#6366f1' }}
                        />
                        Save this address for future orders
                      </label>
                    )}
                  </div>
                )}

                {/* Address validation error */}
                {addressError && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.6rem 0.8rem',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#f87171',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}>
                    <AlertTriangle size={14} /> {addressError}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleContinueToShipping}
                  style={{ marginTop: '1.25rem', padding: '0.7rem 1.5rem' }}
                >
                  Continue to Shipping <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* ── STEP 2: Shipping Method ────────────────────────────────── */}
          <div className="card-glass" style={{
            padding: '1.5rem',
            border: step === 2 ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)',
            opacity: step < 2 ? 0.5 : 1, transition: 'all 0.2s ease'
          }}>
            <div
              onClick={() => step >= 2 && setStep(2)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: step >= 2 ? 'pointer' : 'default', marginBottom: step === 2 ? '1.25rem' : '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Truck size={18} color="#10b981" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Shipping Method</span>
              </div>
              {step > 2 && <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>{selectedShipping?.label}</span>}
            </div>

            {step === 2 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {shippingOptions.map((method) => (
                    <label
                      key={method.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: shippingMethod === method.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
                        background: shippingMethod === method.id ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      <input type="radio" name="shipping" value={method.id} checked={shippingMethod === method.id} onChange={() => setShippingMethod(method.id)} style={{ accentColor: '#6366f1', width: '16px', height: '16px', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
                          {method.label}
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: `${method.badgeColor}22`, color: method.badgeColor, padding: '0.15rem 0.45rem', borderRadius: '3px' }}>
                            {method.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>{method.time}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: method.fee === 0 ? 'var(--success)' : '#fff', flexShrink: 0 }}>
                        {method.fee === 0 ? 'FREE' : `+${formatINR(method.fee)}`}
                      </div>
                    </label>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => setStep(3)} style={{ marginTop: '1.25rem', padding: '0.7rem 1.5rem' }}>
                  Continue to Payment <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* ── STEP 3: Payment ───────────────────────────────────────── */}
          <div className="card-glass" style={{
            padding: '1.5rem',
            border: step === 3 ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)',
            opacity: step < 3 ? 0.5 : 1, transition: 'all 0.2s ease'
          }}>
            <div
              onClick={() => step >= 3 && setStep(3)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: step >= 3 ? 'pointer' : 'default', marginBottom: step === 3 ? '1.25rem' : '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <CreditCard size={18} color="#ec4899" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Payment Method</span>
              </div>
              {step > 3 && <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label?.split('(')[0]}</span>}
            </div>

            {step === 3 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {PAYMENT_METHODS.map((method) => (
                    <label
                      key={method.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: paymentMethod === method.id ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
                        background: paymentMethod === method.id ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} style={{ accentColor: '#6366f1', width: '16px', height: '16px', flexShrink: 0 }} />
                      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{method.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{method.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>{method.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {paymentMethod === 'upi' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      UPI ID (optional — for demo)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi or 9876543210@gpay"
                      style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.4rem' }}>
                      This is a demo environment — no real payment is processed.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.8rem', color: '#fbbf24' }}>
                  ⚠️ Demo environment — all payments are simulated. No real charges occur.
                </div>

                <button className="btn btn-primary" onClick={() => setStep(4)} style={{ marginTop: '1.25rem', padding: '0.7rem 1.5rem' }}>
                  Review Order <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* ── STEP 4: Review Summary (mobile only — shown below on desktop) */}
          {step === 4 && (
            <div className="card-glass" style={{ padding: '1.5rem', border: '1px solid rgba(99,102,241,0.4)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={18} color="#10b981" /> Order Review
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginBottom: '0.3rem' }}>📍 Delivering to</div>
                  <div style={{ fontWeight: 600 }}>{address.fullName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>{address.city}, {address.state} — {address.pincode}</div>
                </div>
                <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginBottom: '0.3rem' }}>🚚 Shipping</div>
                  <div style={{ fontWeight: 600 }}>{selectedShipping?.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>{selectedShipping?.time}</div>
                </div>
                <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gridColumn: 'span 2' }}>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginBottom: '0.3rem' }}>💳 Payment</div>
                  <div style={{ fontWeight: 600 }}>{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</div>
                </div>
              </div>

              {/* Order error */}
              {orderError && (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#f87171', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={15} /> {orderError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Order Summary ──────────────────────────────────────────── */}
        <div className="card-glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '90px' }}>
          <h3 style={{ fontWeight: 700 }}>Order Summary</h3>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '260px', overflowY: 'auto' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop'; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-subtle)' }}>Qty: {item.quantity}</div>
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, flexShrink: 0 }}>{formatINR(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Responsive Promotion & Personalized Discount Banner */}
          <PromotionBanner
            compact
            pricing={checkoutPricing}
            isLoading={isCheckoutPricingLoading || cartPricingLoading}
            error={checkoutPricingError || cartPricingError}
            onRetry={() => {
              refreshPricing();
              setCheckoutPricingNonce((n) => n + 1);
            }}
            priceAdjustments={priceAdjustments}
            onDismissPriceAdjustments={dismissPriceAdjustments}
            appliedCoupon={appliedCoupon}
            onApplyCode={(code) => {
              setCheckoutCouponInput('');
              applyCoupon(code);
            }}
          />

          {/* Coupon Control */}
          <div>
            {appliedCoupon ? (
              <div style={{ padding: '0.6rem 0.8rem', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={13} /> {appliedCoupon.code} applied
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  title="Remove coupon"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (checkoutCouponInput.trim()) {
                    applyCoupon(checkoutCouponInput);
                  }
                }}
                style={{ display: 'flex', gap: '0.45rem' }}
              >
                <input
                  type="text"
                  placeholder="Promo code (e.g. SMART10)"
                  value={checkoutCouponInput}
                  onChange={(e) => setCheckoutCouponInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.7rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.8rem'
                  }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}>
                  Apply
                </button>
              </form>
            )}
            {couponError && (
              <div style={{ fontSize: '0.73rem', color: 'var(--error)', marginTop: '0.35rem' }}>
                {couponError}
              </div>
            )}
          </div>

          {/* Pricing Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.855rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Subtotal ({availableItems.length} {availableItems.length === 1 ? 'item' : 'items'})</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {tierDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                <span>{activeTier?.label?.split('(')[0]?.trim() || 'Tier Discount'}</span>
                <span>−{formatINR(tierDiscount)}</span>
              </div>
            )}
            {(couponDiscount > 0 || checkoutPricing.freeShippingFromCoupon) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>Coupon ({appliedCoupon?.code || checkoutPricing.validatedCoupon?.code})</span>
                <span>
                  {checkoutPricing.freeShippingFromCoupon && couponDiscount === 0
                    ? 'FREE Shipping'
                    : `−${formatINR(couponDiscount)}`}
                </span>
              </div>
            )}
            {checkoutPricing.discountCapped && (
              <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                Maximum 35% combined discount cap applied.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Shipping ({selectedShipping?.label})</span>
              <span style={{ color: shippingFee === 0 ? 'var(--success)' : '#fff', fontWeight: 600 }}>
                {shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Applicable Taxes (GST 5%)</span>
              <span>{formatINR(tax)}</span>
            </div>
          </div>

          {/* Total */}
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem' }}>Final Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                {isCheckoutPricingLoading ? <span style={{ opacity: 0.75 }}>{formatINR(finalTotal)}</span> : formatINR(finalTotal)}
              </div>
              {discountAmount > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
                  Total savings: {formatINR(discountAmount)}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {orderError && (
            <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
              <AlertTriangle size={14} style={{ marginTop: '1px', flexShrink: 0 }} /> {orderError}
            </div>
          )}

          {/* Failed / Incomplete Payment Card */}
          {failedPaymentState && (
            <div style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm, 10px)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                <AlertTriangle size={18} /> Payment Action Required
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {failedPaymentState.reason}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handlePlaceOrder(failedPaymentState.orderId)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.9rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <RefreshCw size={14} /> Retry Payment
                </button>
                <button
                  type="button"
                  onClick={() => { setFailedPaymentState(null); setStep(3); }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.9rem' }}
                >
                  Change Method
                </button>
              </div>
            </div>
          )}

          {/* Place Order */}
          {step === 4 && (
            <button
              className="btn btn-primary"
              onClick={() => handlePlaceOrder()}
              disabled={isSubmitting || isPlacingOrder || !address.fullName || !(address.houseNumber || address.line1) || !address.city || !address.pincode}
              style={{ padding: '1rem', fontSize: '1rem', fontWeight: 700, position: 'relative', overflow: 'hidden' }}
            >
              {isSubmitting || isPlacingOrder ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader size={18} className="spin" /> {paymentMethod === 'cod' ? 'Placing Order...' : 'Connecting to Gateway...'}
                </span>
              ) : (
                <>
                  {paymentMethod === 'cod' ? <Check size={18} /> : <ShieldCheck size={18} />}
                  <span>{paymentMethod === 'cod' ? 'Place Order' : 'Proceed to Pay'} · {formatINR(finalTotal)}</span>
                </>
              )}
            </button>
          )}

          {step < 4 && (
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
              Complete {4 - step} more step{4 - step !== 1 ? 's' : ''} to place your order.
            </div>
          )}

          <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textAlign: 'center', margin: 0 }}>
            🔒 256-bit SSL encrypted. Your payment credentials are never stored.
          </p>
        </div>
      </div>

      {/* Razorpay Sandbox Payment Modal */}
      <RazorpayPaymentModal
        isOpen={isPaymentModalOpen}
        orderData={gatewayOrderData}
        onSuccess={handlePaymentSuccess}
        onFailure={handlePaymentFailure}
        onCancel={handlePaymentCancel}
      />
    </div>
  );
}

export default CheckoutPage;
