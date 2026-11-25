import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, X, Sparkles, ShoppingCart, Check,
  AlertCircle, ArrowRight, CornerDownLeft, Loader2, RefreshCw,
  ShoppingBag, Headphones, Laptop, Keyboard, ExternalLink,
  Star, ChevronRight, Package, ShieldCheck, Trash2
} from 'lucide-react';
import voiceService from './voiceService';
import aiChatService from './aiChatService';
import productsService, { formatINR } from './productsService';
import { useNavigation } from './NavigationContext';
import { useCart } from './CartContext';
import { useAuth } from './AuthContext';

// Suggested commands for quick test
const EXAMPLE_COMMANDS = [
  { label: 'Select #1', icon: Star },
  { label: 'Add #1 to cart', icon: Check },
  { label: 'Display cart', icon: ShoppingCart },
  { label: 'Remove from cart', icon: Trash2 },
  { label: 'Show wireless headphones', icon: Headphones },
  { label: 'Show laptops under 60000 rupees', icon: Laptop },
  { label: 'Show my orders', icon: Package },
  { label: 'Search gaming keyboard', icon: Keyboard },
  { label: 'Show electronics', icon: ShoppingBag },
];

export function VoiceAssistantModal({ isOpen, onClose, onNavigate }) {
  const { currentPath, params, navigate } = useNavigation();
  const { items: cartItems, getLatestItems, addItem, removeItem, clearCart } = useCart();
  const { user } = useAuth();

  // Primary States: 'idle' | 'permission' | 'listening' | 'processing' | 'result' | 'error' | 'fallback'
  const [modalState, setModalState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorDetails, setErrorDetails] = useState({ code: '', message: '' });
  const [resultData, setResultData] = useState(null);
  const [textFallbackInput, setTextFallbackInput] = useState('');
  const [isMuted, setIsMuted] = useState(voiceService.isMuted());
  const [addedProductIds, setAddedProductIds] = useState(new Set());
  const [activeProduct, setActiveProduct] = useState(null);

  const recognitionSessionRef = useRef(null);
  const fallbackInputRef = useRef(null);
  const isListeningRef = useRef(false);
  const lastShownProductsRef = useRef([]);
  const lastAddedProductRef = useRef(null);

  const isSpeechSupported = voiceService.isSpeechRecognitionSupported();

  // Fetch active product context when on product-details page
  useEffect(() => {
    if (isOpen && currentPath === 'product-details' && params?.id) {
      productsService.getProductById(params.id).then(({ data }) => {
        if (data) setActiveProduct(data);
      });
    } else if (isOpen && currentPath !== 'product-details') {
      setActiveProduct(null);
    }
  }, [isOpen, currentPath, params?.id]);

  // Focus fallback input when entering fallback state
  useEffect(() => {
    if (modalState === 'fallback') {
      setTimeout(() => fallbackInputRef.current?.focus(), 100);
    }
  }, [modalState]);

  // Handle action navigation helper
  const handleActionClick = useCallback((action) => {
    if (!action) return;
    if (action.type === 'navigate') {
      if (typeof onNavigate === 'function') {
        onNavigate(action.path);
      } else {
        navigate(action.path, { query: action.query });
      }
      onClose();
    }
  }, [navigate, onNavigate, onClose]);

  // Add product to cart handler
  const handleAddToCart = useCallback(async (product, e) => {
    e?.stopPropagation();
    if (!product?.id) return;
    try {
      const res = await addItem(product, 1);
      if (res?.success !== false) {
        lastAddedProductRef.current = product;
        setAddedProductIds((prev) => new Set([...prev, product.id]));
        setTimeout(() => {
          setAddedProductIds((prev) => {
            const next = new Set(prev);
            next.delete(product.id);
            return next;
          });
        }, 2500);
      }
    } catch (err) {
      console.error('[VoiceAssistantModal] Cart add error:', err);
    }
  }, [addItem]);

  // Remove product from cart handler
  const handleRemoveFromCart = useCallback(async (product, e) => {
    e?.stopPropagation();
    const pid = product?.id || product?.productId;
    if (!pid) return;
    try {
      const res = await removeItem(pid);
      const remaining = res?.items || (getLatestItems ? getLatestItems() : []);
      setResultData((prev) => {
        if (!prev) return prev;
        if (prev.isCartView) {
          return {
            ...prev,
            products: remaining,
            voiceText:
              remaining.length > 0
                ? `Removed ${product.name || 'item'} from your cart. ${remaining.length} item(s) remaining.`
                : `Removed ${product.name || 'item'} from your cart. Your cart is now empty.`,
          };
        }
        return prev;
      });
    } catch (err) {
      console.error('[VoiceAssistantModal] Cart remove error:', err);
    }
  }, [removeItem, getLatestItems]);

  // Process finalized transcript through AI Shopping Engine
  const processTranscript = useCallback(async (text) => {
    if (!text || !text.trim()) {
      setModalState('error');
      setErrorDetails({
        code: 'no_speech',
        message: 'No speech was detected. Please tap the microphone and speak your request.',
      });
      return;
    }

    setModalState('processing');
    setTranscript(text);

    try {
      // Pass shopping context (user, active viewed product, cart hooks, last products)
      const context = {
        user,
        currentProduct: activeProduct,
        activeProduct,
        lastProducts: lastShownProductsRef.current,
        lastAddedProduct: lastAddedProductRef.current,
        cartItems: getLatestItems ? getLatestItems() : cartItems,
        getLatestItems,
        addItem,
        removeItem,
        clearCart,
        currentPath,
        onNavigateBackground: (path, opts) => {
          if (typeof onNavigate === 'function') {
            onNavigate(path);
          } else {
            navigate(path, opts);
          }
        },
      };

      const result = await aiChatService.processVoiceCommand(text, context);
      setResultData(result);

      if (result.actionType === 'show_products' && Array.isArray(result.products) && result.products.length > 0) {
        lastShownProductsRef.current = result.products;
      }
      if (result.actionType === 'add_to_cart' && result.product) {
        lastAddedProductRef.current = result.product;
        setAddedProductIds((prev) => new Set([...prev, result.product.id]));
      }

      if (result.status === 'error') {
        setModalState('error');
        setErrorDetails({
          code: result.errorReason || 'command_error',
          message: result.voiceText || 'Could not execute the requested action.',
        });
        if (!voiceService.isMuted()) {
          voiceService.speak(result.spokenText || result.voiceText);
        }
        return;
      }

      setModalState('result');

      // Speech Output (TTS)
      if (!voiceService.isMuted()) {
        const spoken = result.spokenText || result.voiceText;
        if (spoken) {
          voiceService.speak(spoken);
        }
      }

      // If auto-navigation was specifically required and no products to display
      if (result.actionType === 'navigate' && (!result.products || result.products.length === 0)) {
        setTimeout(() => {
          handleActionClick(result.action);
        }, 1600);
      }
    } catch (err) {
      console.error('[VoiceAssistantModal] Processing failed:', err);
      setModalState('error');
      setErrorDetails({
        code: 'process_failed',
        message: 'Failed to process voice request. Please check your network and try again.',
      });
    }
  }, [user, activeProduct, cartItems, getLatestItems, addItem, removeItem, clearCart, currentPath, navigate, onNavigate, handleActionClick]);

  // Stop Voice Recognition
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionSessionRef.current) {
      try {
        recognitionSessionRef.current.stop();
      } catch {}
      recognitionSessionRef.current = null;
    }
  }, []);

  // Start Voice Recognition
  const startListening = useCallback(() => {
    if (!voiceService.isSpeechRecognitionSupported()) {
      setModalState('fallback');
      return;
    }

    // Guard against multiple rapid calls or double clicks
    if (recognitionSessionRef.current) {
      try {
        recognitionSessionRef.current.stop();
      } catch {}
      recognitionSessionRef.current = null;
    }

    voiceService.stopSpeaking();
    setErrorDetails({ code: '', message: '' });
    setTranscript('');
    setInterimTranscript('');
    setModalState('listening');
    isListeningRef.current = true;

    const browserLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-IN';
    const session = voiceService.createRecognitionSession({
      lang: browserLang || 'en-IN',
      continuous: false,
      onStart: () => {
        setModalState('listening');
        isListeningRef.current = true;
      },
      onTranscript: ({ transcript: text }) => {
        setInterimTranscript(text);
      },
      onFinal: (finalText) => {
        isListeningRef.current = false;
        setInterimTranscript('');
        recognitionSessionRef.current = null;
        processTranscript(finalText);
      },
      onError: (err) => {
        console.warn('[VoiceAssistantModal] Session error:', err);
        // If it was just silence (no speech detected yet), stay in listening mode!
        if (err.code === 'no_speech') {
          return;
        }

        isListeningRef.current = false;
        recognitionSessionRef.current = null;

        if (err.code === 'unsupported' || err.code === 'permission_denied') {
          setModalState('fallback');
          setErrorDetails({
            code: err.code,
            message: err.message || 'Microphone unavailable. You can type commands below.',
          });
          return;
        }

        setModalState('error');
        setErrorDetails({
          code: err.code || 'recognition_error',
          message: err.message || 'Speech recognition encountered an issue. Tap the mic to try again.',
        });
      },
      onEnd: () => {
        // If recognition stopped but we still intend to listen (and user didn't speak or stop),
        // restart cleanly
        if (isListeningRef.current) {
          try {
            const nextSession = voiceService.createRecognitionSession({
              lang: browserLang || 'en-IN',
              continuous: false,
              onStart: () => {
                setModalState('listening');
                isListeningRef.current = true;
              },
              onTranscript: ({ transcript: text }) => {
                setInterimTranscript(text);
              },
              onFinal: (finalText) => {
                isListeningRef.current = false;
                setInterimTranscript('');
                recognitionSessionRef.current = null;
                processTranscript(finalText);
              },
              onError: () => {
                isListeningRef.current = false;
                recognitionSessionRef.current = null;
                setModalState('idle');
              },
              onEnd: () => {
                isListeningRef.current = false;
                recognitionSessionRef.current = null;
                setModalState((prev) => (prev === 'listening' ? 'idle' : prev));
              },
            });
            recognitionSessionRef.current = nextSession;
            nextSession.start();
            return;
          } catch {}
        }
        recognitionSessionRef.current = null;
        isListeningRef.current = false;
        setModalState((prev) => (prev === 'listening' ? 'idle' : prev));
        setInterimTranscript('');
      },
    });

    recognitionSessionRef.current = session;
    session.start();
  }, [processTranscript]);

  // Toggle listening button — stop and process whatever was captured
  const handleToggleMic = useCallback(() => {
    if (modalState === 'listening') {
      const captured = interimTranscript.trim();
      stopListening();
      if (captured) {
        processTranscript(captured);
      } else {
        setModalState('idle');
      }
    } else {
      startListening();
    }
  }, [modalState, interimTranscript, stopListening, startListening, processTranscript]);

  // Auto-activate voice listening immediately when modal opens from floating mic icon!
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimTranscript('');
      setErrorDetails({ code: '', message: '' });
      setResultData(null);
      setIsMuted(voiceService.isMuted());

      if (!isSpeechSupported) {
        setModalState('fallback');
      } else {
        const timer = setTimeout(() => {
          startListening();
        }, 120);
        return () => clearTimeout(timer);
      }
    } else {
      stopListening();
      voiceService.stopSpeaking();
      setModalState('idle');
    }
  }, [isOpen, isSpeechSupported, startListening, stopListening]);

  // Handle fallback text submission
  const handleFallbackSubmit = (e) => {
    e.preventDefault();
    if (!textFallbackInput.trim()) return;
    const text = textFallbackInput.trim();
    setTextFallbackInput('');
    processTranscript(text);
  };

  // Toggle TTS Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    voiceService.setMuted(nextMuted);
  };

  if (!isOpen) return null;

  return (
    <>
    {/* Inject required CSS animations for voice UI */}
    <style>{`
      @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.95)} }
      @keyframes ping { 0%{transform:scale(1);opacity:0.8} 75%,100%{transform:scale(1.9);opacity:0} }
      @keyframes soundwave { 0%{transform:scaleY(0.35)} 100%{transform:scaleY(1.5)} }
      @keyframes fadeInScale { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
    `}</style>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-assistant-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 10, 19, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card-glass"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          borderRadius: '24px',
          background: 'linear-gradient(180deg, rgba(20, 24, 40, 0.95) 0%, rgba(12, 16, 28, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '1.1rem 1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)',
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <h2 id="voice-assistant-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.01em' }}>
                Voice Shopping Assistant
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {modalState === 'listening' ? 'Listening...' : modalState === 'processing' ? 'Searching catalog...' : 'Live Voice Commerce'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Audio Speech Output Toggle */}
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute speech output' : 'Mute speech output'}
              aria-label={isMuted ? 'Unmute speech output' : 'Mute speech output'}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: isMuted ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                border: isMuted ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isMuted ? '#f87171' : '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close Voice Assistant"
              aria-label="Close"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '1.5rem 1.25rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>
          {/* Active Product Banner if user is currently looking at an item */}
          {activeProduct && modalState !== 'result' && (
            <div style={{
              width: '100%',
              marginBottom: '1rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>Active Product:</span>
                <span style={{ fontSize: '0.75rem', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeProduct.name || activeProduct.title}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#818cf8', flexShrink: 0 }}>
                Say "Add this to cart"
              </span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 1: IDLE / READY STATE
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'idle' && (
            <>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem', maxWidth: '380px' }}>
                Tap the microphone and ask for headphones, laptops under your budget, to open your cart, or track orders.
              </p>

              {/* Big Glowing Microphone Orb */}
              <div style={{ position: 'relative', margin: '1rem 0 1.75rem' }}>
                <div style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%)',
                  animation: 'pulse 2.5s infinite',
                }} />
                <button
                  id="voice-mic-main-btn"
                  onClick={startListening}
                  aria-label="Start voice recognition"
                  style={{
                    width: '92px',
                    height: '92px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 30px rgba(236, 72, 153, 0.5), 0 0 20px rgba(139, 92, 246, 0.4)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Mic size={40} />
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                Tap to speak in English / Hinglish
              </div>

              {/* Example Commands */}
              <div style={{ width: '100%', textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                  Supported Commands:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {EXAMPLE_COMMANDS.map((cmd, i) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => processTranscript(cmd.label)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          borderRadius: '10px',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(236, 72, 153, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.4)';
                          e.currentTarget.style.color = '#f472b6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.color = '#e2e8f0';
                        }}
                      >
                        <Icon size={13} />
                        "{cmd.label}"
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 2: PERMISSION REQUESTING
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'permission' && (
            <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Loader2 size={30} color="#818cf8" style={{ animation: 'spin 1.2s linear infinite' }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Allow Microphone Access</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '320px', lineHeight: 1.5 }}>
                Please allow microphone permission when prompted by your browser so Aura can hear your voice.
              </p>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 3: LISTENING STATE (Soundwave & live transcript)
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'listening' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Pulsing Active Mic */}
              <div style={{ position: 'relative', margin: '1rem 0 1.25rem' }}>
                {/* Ripple ring 1 */}
                <div style={{
                  position: 'absolute',
                  inset: '-18px',
                  borderRadius: '50%',
                  border: '2px solid rgba(244, 63, 94, 0.6)',
                  animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                }} />
                {/* Ripple ring 2 */}
                <div style={{
                  position: 'absolute',
                  inset: '-32px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(244, 63, 94, 0.2) 0%, transparent 70%)',
                  animation: 'pulse 1.8s infinite',
                }} />

                <button
                  id="voice-mic-stop-btn"
                  onClick={handleToggleMic}
                  aria-label="Stop listening"
                  style={{
                    width: '92px',
                    height: '92px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 35px rgba(244, 63, 94, 0.7)',
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <MicOff size={38} />
                </button>
              </div>

              {/* Sound wave bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '24px', margin: '0.5rem 0 1.25rem' }}>
                {[14, 24, 18, 28, 12, 22, 16].map((h, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: '4px',
                      height: `${h}px`,
                      borderRadius: '2px',
                      background: 'linear-gradient(to top, #ec4899, #f43f5e)',
                      animation: `soundwave 0.8s ${idx * 0.12}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>

              <div style={{ fontSize: '0.85rem', color: '#f43f5e', fontWeight: 600, marginBottom: '0.5rem' }}>
                Listening to your shopping request...
              </div>

              {/* Live interim transcript display */}
              <div style={{
                width: '100%',
                minHeight: '70px',
                padding: '0.85rem 1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: '0.5rem',
              }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.2rem' }}>Live Transcript:</span>
                <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 500, fontStyle: interimTranscript ? 'normal' : 'italic' }}>
                  {interimTranscript ? `"${interimTranscript}"` : 'Speak now... (e.g. "Show laptops under 60000 rupees")'}
                </span>
              </div>

              <button
                onClick={handleToggleMic}
                style={{
                  marginTop: '0.85rem',
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: '20px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Done Speaking / Process
              </button>

              {/* Quick clickable command chips */}
              <div style={{ marginTop: '1.2rem', width: '100%', textAlign: 'left' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Or tap any command:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {EXAMPLE_COMMANDS.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        stopListening();
                        processTranscript(cmd.label);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        borderRadius: '8px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(236, 72, 153, 0.15)';
                        e.currentTarget.style.color = '#f472b6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = '#cbd5e1';
                      }}
                    >
                      "{cmd.label}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 4: PROCESSING STATE
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'processing' && (
            <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Loader2 size={32} color="#ec4899" style={{ animation: 'spin 1s linear infinite' }} />
              </div>

              <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '0.35rem' }}>
                Interpreting Shopping Action...
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '1rem' }}>
                "{transcript}"
              </p>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Searching catalog & querying database...
              </span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 5: RESULT STATE (Displays products, status, spoken text)
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'result' && resultData && (
            <div style={{ width: '100%', textAlign: 'left' }}>
              {/* Transcript badge */}
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <Mic size={14} color="#ec4899" />
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    "{transcript}"
                  </span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: resultData.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: resultData.status === 'success' ? '#34d399' : '#f87171',
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {resultData.actionType ? resultData.actionType.replace('_', ' ').toUpperCase() : 'EXECUTED'}
                </span>
              </div>

              {/* Voice Spoken Response Message */}
              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
              }}>
                <Sparkles size={16} color="#818cf8" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', color: '#f1f5f9', lineHeight: 1.45, fontWeight: 500 }}>
                    {resultData.voiceText}
                  </div>
                </div>
              </div>

              {/* Products Grid / Cards if products returned */}
              {resultData.products && resultData.products.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                      {resultData.isCartView ? `Cart Items (${resultData.products.length})` : `Products (${resultData.products.length})`}
                    </span>
                    {resultData.action?.type === 'navigate' && (
                      <button
                        onClick={() => handleActionClick(resultData.action)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#818cf8',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: 0,
                        }}
                      >
                        {resultData.action.label || 'View in store'} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}>
                    {resultData.products.map((p, idx) => {
                      const pid = p.id || p.productId;
                      const isAdded = addedProductIds.has(pid);
                      const inCart = resultData.isCartView || cartItems.some((ci) => String(ci.id || ci.productId) === String(pid));
                      return (
                        <div
                          key={pid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                            <img
                              src={p.image || p.image_url}
                              alt={p.name || p.title}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                background: 'rgba(0,0,0,0.3)',
                              }}
                            />
                            {!resultData.isCartView && (
                              <span style={{
                                position: 'absolute',
                                top: '-5px',
                                left: '-5px',
                                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                                color: '#fff',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                minWidth: '17px',
                                height: '17px',
                                borderRadius: '9px',
                                padding: '0 3px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                              }}>
                                #{idx + 1}
                              </span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              onClick={() => {
                                navigate('product-details', { params: { id: pid } });
                                onClose();
                              }}
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: '#f1f5f9',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer',
                              }}
                              title={p.name || p.title}
                            >
                              {p.name || p.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>
                                {formatINR(p.price)}
                              </span>
                              {p.quantity && (
                                <span style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 600 }}>
                                  ×{p.quantity}
                                </span>
                              )}
                              {p.rating && (
                                <span style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Star size={10} fill="#fbbf24" /> {p.rating}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            {!resultData.isCartView && (
                              <button
                                onClick={(e) => handleAddToCart(p, e)}
                                disabled={isAdded || (p.stock !== undefined && Number(p.stock) <= 0)}
                                style={{
                                  background: isAdded
                                    ? 'rgba(16, 185, 129, 0.25)'
                                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                  border: isAdded ? '1px solid #10b981' : 'none',
                                  color: isAdded ? '#34d399' : '#fff',
                                  borderRadius: '8px',
                                  padding: '0.4rem 0.7rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: p.stock !== undefined && Number(p.stock) <= 0 ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {isAdded ? (
                                  <>
                                    <Check size={12} /> Added
                                  </>
                                ) : p.stock !== undefined && Number(p.stock) <= 0 ? (
                                  'Out of stock'
                                ) : (
                                  <>
                                    <ShoppingCart size={12} /> Add
                                  </>
                                )}
                              </button>
                            )}

                            {inCart && (
                              <button
                                onClick={(e) => handleRemoveFromCart(p, e)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  color: '#f87171',
                                  borderRadius: '8px',
                                  padding: '0.4rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!resultData.isCartView && resultData.products.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.55rem', padding: '0.35rem 0.65rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <Sparkles size={12} color="#ec4899" />
                      <span>Voice shortcut: Say <strong>"One"</strong> or <strong>"Add #1 to cart"</strong> to control items</span>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Action Buttons if direct navigation */}
              {resultData.action?.type === 'navigate' && (!resultData.products || resultData.products.length === 0) && (
                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <button
                    onClick={() => handleActionClick(resultData.action)}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '12px',
                      padding: '0.65rem 1.4rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    {resultData.action.label || 'Go to Page'} <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Bottom Actions: Speak Again / Close */}
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={startListening}
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Mic size={14} /> Speak Another Command
                </button>
                <button
                  onClick={() => setModalState('fallback')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#cbd5e1',
                    borderRadius: '10px',
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Type Command
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 6: ERROR STATE (Permission denied, network, unsupported)
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'error' && (
            <div style={{ width: '100%', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <AlertCircle size={28} />
              </div>

              <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.4rem', fontWeight: 600 }}>
                {errorDetails.code === 'permission_denied'
                  ? 'Microphone Permission Needed'
                  : errorDetails.code === 'unsupported'
                  ? 'Command Not Supported'
                  : errorDetails.code === 'no_product_selected'
                  ? 'No Product Selected'
                  : 'Voice Command Issue'}
              </h3>

              <p style={{ fontSize: '0.84rem', color: '#94a3b8', maxWidth: '340px', margin: '0 auto 1.25rem', lineHeight: 1.45 }}>
                {errorDetails.message}
              </p>

              {transcript && (
                <div style={{
                  padding: '0.5rem 0.8rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  marginBottom: '1.25rem',
                  display: 'inline-block',
                }}>
                  You said: "{transcript}"
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                <button
                  onClick={startListening}
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={14} /> Try Speaking Again
                </button>
                <button
                  onClick={() => setModalState('fallback')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#cbd5e1',
                    borderRadius: '10px',
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Type Command
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STATE 7: FALLBACK TO TEXT INPUT (Always available)
              ───────────────────────────────────────────────────────────── */}
          {modalState === 'fallback' && (
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={{
                padding: '0.6rem 0.85rem',
                borderRadius: '12px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                color: '#fde047',
                fontSize: '0.78rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertCircle size={14} />
                {!isSpeechSupported
                  ? 'Browser voice recognition unavailable. Type your shopping command below:'
                  : 'Text input mode. Enter your shopping command below:'}
              </div>

              {/* Text Form */}
              <form onSubmit={handleFallbackSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input
                  ref={fallbackInputRef}
                  type="text"
                  placeholder="e.g. 'Show laptops under 60000 rupees' or 'Open my cart'"
                  value={textFallbackInput}
                  onChange={(e) => setTextFallbackInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '0.65rem 0.9rem',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!textFallbackInput.trim()}
                  style={{
                    background: textFallbackInput.trim()
                      ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '10px',
                    color: textFallbackInput.trim() ? '#fff' : '#64748b',
                    padding: '0 1rem',
                    cursor: textFallbackInput.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}
                >
                  Execute
                </button>
              </form>

              {/* Suggested Pills */}
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Quick Test Commands:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                {EXAMPLE_COMMANDS.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => processTranscript(cmd.label)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    "{cmd.label}"
                  </button>
                ))}
              </div>

              {isSpeechSupported && (
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={startListening}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ec4899',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Mic size={14} /> Switch back to Microphone
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Info */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: '#64748b',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} color="#10b981" /> InsForge Live Catalog Connected
          </span>
          {isSpeechSupported ? (
            <button
              onClick={() => setModalState(modalState === 'fallback' ? 'idle' : 'fallback')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.72rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {modalState === 'fallback' ? 'Use Microphone' : 'Keyboard Input'}
            </button>
          ) : (
            <span style={{ color: '#f59e0b' }}>Text Fallback Active</span>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default VoiceAssistantModal;
