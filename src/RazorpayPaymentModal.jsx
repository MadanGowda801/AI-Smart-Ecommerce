import React, { useState } from 'react';
import {
  CreditCard, Smartphone, Building, ShieldCheck,
  AlertTriangle, X, Check, ArrowRight, Loader, Info
} from 'lucide-react';
import { formatINR } from './productsService';
import paymentGatewayService from './paymentGatewayService';

export default function RazorpayPaymentModal({
  isOpen,
  orderData,
  onSuccess,
  onFailure,
  onCancel
}) {
  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [upiId, setUpiId] = useState('success@razorpay');
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen || !orderData) return null;

  const amount = orderData.amount ? orderData.amount / 100 : 0;
  const razorpayOrderId = orderData.razorpayOrderId;
  const orderId = orderData.orderId;

  // Simulate payment success with server-verified signature
  const handleSimulateSuccess = async () => {
    setIsProcessing(true);
    setStatusMessage('Contacting payment gateway...');

    try {
      // 1. Generate payment reference
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setStatusMessage('Authorizing transaction with bank...');

      // 2. Obtain cryptographic signature from server
      const { razorpaySignature } = await paymentGatewayService.getSimulatedSignature({
        razorpayOrderId,
        razorpayPaymentId: paymentId
      });

      setStatusMessage('Payment approved! Finalizing order...');

      setTimeout(() => {
        setIsProcessing(false);
        onSuccess({
          razorpay_payment_id: paymentId,
          razorpay_order_id: razorpayOrderId,
          razorpay_signature: razorpaySignature
        });
      }, 700);
    } catch (err) {
      console.error('[PaymentModal] Error during simulation:', err);
      setIsProcessing(false);
      onFailure({
        code: 'SIMULATION_ERROR',
        description: err.message || 'Payment simulation failed'
      });
    }
  };

  // Simulate payment failure
  const handleSimulateFailure = (reason = 'Card declined by issuing bank (Insufficient funds)') => {
    setIsProcessing(true);
    setStatusMessage('Simulating gateway decline...');

    setTimeout(() => {
      setIsProcessing(false);
      onFailure({
        code: 'PAYMENT_DECLINED',
        description: reason
      });
    }, 600);
  };

  const hasOfficialCheckout = typeof window !== 'undefined' && Boolean(window.Razorpay);

  const handleLaunchOfficialRazorpay = () => {
    if (!hasOfficialCheckout) {
      alert('Razorpay Checkout.js is not loaded. Using Sandbox Simulator.');
      return;
    }
    try {
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: orderData.name || 'SmartShop India',
        description: orderData.description || 'Payment for Order',
        order_id: razorpayOrderId,
        prefill: orderData.prefill || {},
        notes: orderData.notes || {},
        theme: { color: '#6366f1' },
        handler: function (response) {
          onSuccess(response);
        },
        modal: {
          ondismiss: function () {
            onCancel();
          }
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        onFailure(resp.error || { code: 'PAYMENT_FAILED', description: 'Transaction declined' });
      });
      rzp.open();
    } catch (err) {
      console.warn('[RazorpayPaymentModal] Official checkout error:', err);
      alert(`Could not launch official popup (${err.message}). Please use the Sandbox Simulator below.`);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div
        className="card-glass"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.25)',
          background: '#0f172a',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff' }}>SmartShop</span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '4px',
                background: '#fbbf24',
                color: '#000',
                letterSpacing: '0.05em'
              }}>
                TEST MODE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Razorpay Gateway Sandbox · Order #{orderId ? orderId.slice(0, 8).toUpperCase() : ''}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Amount Payable</span>
            <div style={{ fontWeight: 900, fontSize: '1.35rem', color: '#38bdf8' }}>
              {formatINR(amount)}
            </div>
          </div>
        </div>

        {/* Test Notice Banner */}
        <div style={{
          padding: '0.55rem 1rem',
          background: 'rgba(56, 189, 248, 0.08)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          fontSize: '0.78rem',
          color: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={14} style={{ flexShrink: 0 }} />
            <span>Sandbox Mode: No real money is charged.</span>
          </div>
          {hasOfficialCheckout && (
            <button
              type="button"
              onClick={handleLaunchOfficialRazorpay}
              style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#a5b4fc',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Launch Official Checkout.js ↗
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
          <button
            onClick={() => setActiveTab('upi')}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: activeTab === 'upi' ? 'rgba(56, 189, 248, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'upi' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'upi' ? '#38bdf8' : 'var(--text-muted)',
              fontWeight: activeTab === 'upi' ? 700 : 500,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <Smartphone size={16} /> UPI
          </button>

          <button
            onClick={() => setActiveTab('card')}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: activeTab === 'card' ? 'rgba(56, 189, 248, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'card' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'card' ? '#38bdf8' : 'var(--text-muted)',
              fontWeight: activeTab === 'card' ? 700 : 500,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <CreditCard size={16} /> Cards
          </button>

          <button
            onClick={() => setActiveTab('netbanking')}
            style={{
              flex: 1,
              padding: '0.85rem 0.5rem',
              background: activeTab === 'netbanking' ? 'rgba(56, 189, 248, 0.12)' : 'none',
              border: 'none',
              borderBottom: activeTab === 'netbanking' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'netbanking' ? '#38bdf8' : 'var(--text-muted)',
              fontWeight: activeTab === 'netbanking' ? 700 : 500,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              cursor: 'pointer'
            }}
          >
            <Building size={16} /> NetBanking
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '1.5rem' }}>
          {isProcessing ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <Loader size={36} className="spin" style={{ color: '#38bdf8', margin: '0 auto 1rem' }} />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{statusMessage}</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-subtle)' }}>
                Communicating with Razorpay Sandbox & banking network...
              </p>
            </div>
          ) : (
            <>
              {/* UPI Tab */}
              {activeTab === 'upi' && (
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    Enter Virtual Payment Address (VPA) / UPI ID:
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@okhdfcbank"
                    className="form-input"
                    style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', fontSize: '0.9rem' }}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setUpiId('success@razorpay')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}
                    >
                      ✓ success@razorpay
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpiId('failure@razorpay')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                    >
                      ✗ failure@razorpay
                    </button>
                  </div>
                </div>
              )}

              {/* Cards Tab */}
              {activeTab === 'card' && (
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    Card Number:
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4111 1111 1111 1111"
                    className="form-input"
                    style={{ width: '100%', marginBottom: '0.85rem', padding: '0.75rem', fontSize: '0.9rem' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                        Expiry (MM/YY):
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="form-input"
                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                        CVV:
                      </label>
                      <input
                        type="password"
                        maxLength={3}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        className="form-input"
                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setCardNumber('4111 1111 1111 1111')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}
                    >
                      ✓ Valid Test Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardNumber('4000 0000 0000 0002')}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                    >
                      ✗ Declined Card
                    </button>
                  </div>
                </div>
              )}

              {/* NetBanking Tab */}
              {activeTab === 'netbanking' && (
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.65rem' }}>
                    Select Popular Bank:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    {['HDFC', 'ICICI', 'SBI', 'Axis Bank'].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: selectedBank === bank ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                          background: selectedBank === bank ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                          color: selectedBank === bank ? '#fff' : 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (upiId === 'failure@razorpay' || cardNumber.endsWith('0002')) {
                      handleSimulateFailure('Card/UPI declined by customer bank in test mode');
                    } else {
                      handleSimulateSuccess();
                    }
                  }}
                  style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700 }}
                >
                  <ShieldCheck size={18} /> Pay {formatINR(amount)} (Simulate Approval)
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSimulateFailure('User account has insufficient funds')}
                    style={{
                      padding: '0.65rem',
                      fontSize: '0.8rem',
                      color: '#f87171',
                      borderColor: 'rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)'
                    }}
                  >
                    Simulate Failure
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onCancel}
                    style={{ padding: '0.65rem', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}
                  >
                    Cancel / Dismiss
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '0.75rem 1.5rem',
          background: 'rgba(0,0,0,0.4)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'var(--text-subtle)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            🔒 Secured by 256-bit encryption
          </span>
          <span>Gateway Ref: {razorpayOrderId}</span>
        </div>
      </div>
    </div>
  );
}
