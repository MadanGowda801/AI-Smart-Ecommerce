import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, X, Send, Sparkles, ShoppingCart, Heart, ExternalLink,
  Star, Package, ChevronRight, Loader2, MessageSquare, Zap, Mic, MicOff,
  Shield, Scale, CheckCircle2, AlertTriangle, ArrowRightLeft, RotateCcw
} from 'lucide-react';
import aiChatService from './aiChatService';
import trustCartAgentService from './trustCartAgentService';
import voiceService from './voiceService';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import { useOrders } from './OrdersContext';
import { useCompare } from './CompareContext';
import { formatINR } from './productsService';

// ─── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.6rem 0.9rem',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px 12px 12px 2px',
      maxWidth: '80px',
      alignSelf: 'flex-start',
    }}>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-primary, #6366f1)',
              animation: `chatDot 1.2s ${i * 0.2}s ease-in-out infinite`,
              display: 'block',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Message text renderer (supports newlines + bold) ─────────────────────────

function MessageText({ text }) {
  const parts = (text || '').split('\n').map((line, i) => {
    const segments = line.split(/\*\*(.*?)\*\*/g).map((seg, j) =>
      j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg
    );
    return (
      <React.Fragment key={i}>
        {segments}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    );
  });
  return <>{parts}</>;
}

// ─── Mini product card with TrustCart Intelligence ───────────────────────────

function MiniProductCard({ product, onNavigate, onPrepareCart, onToggleWishlist, onToggleCompare, isAdded, inWishlist, inCompare }) {
  const [imgError, setImgError] = useState(false);

  const fallback =
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=80';

  return (
    <div
      id={`chat-product-${product.id}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '165px',
        maxWidth: '175px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={() => onNavigate('product-details', { params: { id: product.id } })}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = '1px solid rgba(99,102,241,0.4)';
        e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Image & Badges */}
      <div style={{ position: 'relative', aspectRatio: '1.05', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
        <img
          src={imgError ? fallback : (product.image || fallback)}
          alt={product.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Match Score Badge */}
        {product.matchScore && (
          <span style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'rgba(16, 185, 129, 0.92)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}>
            {product.matchScore}% Match
          </span>
        )}
        {product.discountPercent > 0 && (
          <span style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: '4px',
          }}>
            -{product.discountPercent}%
          </span>
        )}
        {!product.inStock && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            color: '#f87171',
            fontWeight: 700,
          }}>
            OUT OF STOCK
          </div>
        )}
      </div>

      {/* Info & Trade-off snippet */}
      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--text-primary, #f1f5f9)',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            marginBottom: '0.25rem',
          }}>
            {product.name}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#818cf8' }}>
              {formatINR(product.price)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Star size={9} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{product.rating}</span>
            </div>
          </div>

          {/* Trade-off preview snippet */}
          {product.tradeOffs && product.tradeOffs.length > 0 && (
            <div style={{
              fontSize: '0.62rem',
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: '4px',
              padding: '2px 4px',
              marginBottom: '0.4rem',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              ⚠️ {product.tradeOffs[0]}
            </div>
          )}
        </div>

        {/* Action Buttons: Prepare Cart + Compare + Wishlist */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {product.inStock !== false && (
            <button
              id={`prep-cart-${product.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onPrepareCart(product);
              }}
              style={{
                flex: 1,
                background: isAdded ? 'rgba(16,185,129,0.2)' : 'var(--accent-soft)',
                border: `1px solid ${isAdded ? 'rgba(16,185,129,0.45)' : 'var(--accent-border)'}`,
                color: isAdded ? '#34d399' : 'var(--text-accent)',
                borderRadius: '5px',
                padding: '4px 4px',
                fontSize: '0.64rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShoppingCart size={10} />
              {isAdded ? 'Added' : 'Cart'}
            </button>
          )}
          {onToggleCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(product);
              }}
              title={inCompare ? 'Remove from AI Compare' : 'Add to AI Compare'}
              style={{
                background: inCompare ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${inCompare ? 'transparent' : 'rgba(255,255,255,0.14)'}`,
                color: inCompare ? '#fff' : '#cbd5e1',
                borderRadius: '5px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={11} />
            </button>
          )}
          {onToggleWishlist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWishlist(product);
              }}
              title={inWishlist ? 'Remove from Wishlist' : 'Save to Wishlist'}
              style={{
                background: inWishlist ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${inWishlist ? '#ec4899' : 'rgba(255,255,255,0.14)'}`,
                color: inWishlist ? '#ec4899' : '#cbd5e1',
                borderRadius: '5px',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={11} fill={inWishlist ? '#ec4899' : 'none'} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ChatMessage ───────────────────────────────────────────────────────────────

function ChatMessage({
  message,
  onNavigate,
  onPrepareCart,
  onToggleWishlist,
  onToggleCompare,
  isInWishlist,
  isInCompare,
  onSuggestionClick,
  onCompare,
  onOpenSmartCompare,
  onConfirmCartAction,
  onCancelCartAction,
  addedToCart
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <div style={{
          maxWidth: '80%',
          padding: '0.6rem 0.9rem',
          borderRadius: '12px 12px 2px 12px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
        }}>
          {message.text}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.6rem' }}>
      {/* Bot icon + text */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px',
          boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
        }}>
          <Bot size={14} color="#fff" />
        </div>
        <div style={{
          flex: 1,
          padding: '0.65rem 0.95rem',
          borderRadius: '2px 12px 12px 12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--text-primary, #f1f5f9)',
          fontSize: '0.82rem',
          lineHeight: 1.55,
        }}>
          {/* Structured filter chips if present */}
          {message.structuredFilters && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {message.structuredFilters.corrections?.length > 0 && (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'var(--gold-soft)', color: 'var(--accent-gold-light)', border: '1px solid var(--gold-border)', fontWeight: 700 }}>
                  Auto-fixed: {message.structuredFilters.corrections.map((c) => `${c.from}→${c.to}`).join(', ')}
                </span>
              )}
              {(message.structuredFilters.subTypeKey || message.structuredFilters.category) && (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--text-accent)', border: '1px solid var(--accent-border)', fontWeight: 600 }}>
                  {message.structuredFilters.subTypeKey ? `Type: ${message.structuredFilters.subTypeKey.replace('_', ' ')}` : `Category: ${message.structuredFilters.category}`}
                </span>
              )}
              {message.structuredFilters.budget?.min && message.structuredFilters.budget?.max ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                  Budget: {message.structuredFilters.budget.formattedMin} – {message.structuredFilters.budget.formattedMax}
                </span>
              ) : message.structuredFilters.budget?.max ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                  Budget: ≤ {message.structuredFilters.budget.formattedMax}
                </span>
              ) : message.structuredFilters.budget?.min ? (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                  Min Price: ≥ {message.structuredFilters.budget.formattedMin}
                </span>
              ) : null}
              {message.structuredFilters.requiredSpecs?.map((spec) => (
                <span key={spec} style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(56,189,248,0.16)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)', fontWeight: 600 }}>
                  {spec}
                </span>
              ))}
              {message.structuredFilters.brand && (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontWeight: 600 }}>
                  Brand: {message.structuredFilters.brand}
                </span>
              )}
              {message.structuredFilters.sortReason && (
                <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.14)', fontWeight: 600 }}>
                  Sort: {message.structuredFilters.sortReason}
                </span>
              )}
            </div>
          )}

          <MessageText text={message.text} />
        </div>
      </div>

      {/* Explicit Cart Confirmation Card (Strict safety: requires explicit authorization) */}
      {message.action?.type === 'confirm_add_to_cart' && message.action.product && (
        <div style={{
          marginLeft: '34px',
          background: 'rgba(99,102,241,0.09)',
          border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: '12px',
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
            <Shield size={14} /> Explicit Customer Authorization Required
          </div>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: '8px', lineHeight: 1.4 }}>
            Would you like to confirm adding <strong>{message.action.product.name}</strong> ({formatINR(message.action.product.price)}) to your cart?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onConfirmCartAction(message.action.product)}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={13} /> Confirm & Add to Cart
            </button>
            <button
              onClick={() => onCancelCartAction()}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product cards with Reasons & Trade-offs */}
      {message.products && message.products.length > 0 && (
        <div style={{ paddingLeft: '34px' }}>
          <div style={{
            display: 'flex',
            gap: '0.6rem',
            overflowX: 'auto',
            paddingBottom: '6px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(99,102,241,0.3) transparent',
          }}>
            {message.products.map((product) => (
              <MiniProductCard
                key={product.id}
                product={product}
                onNavigate={(path, opts) => onNavigate(path, opts)}
                onPrepareCart={onPrepareCart}
                onToggleWishlist={onToggleWishlist}
                onToggleCompare={onToggleCompare}
                isAdded={Boolean(addedToCart[product.id])}
                inWishlist={isInWishlist ? isInWishlist(product.id) : false}
                inCompare={isInCompare ? isInCompare(product.id) : false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action button (Compare or Navigation) */}
      {message.action && message.action.type !== 'confirm_add_to_cart' && (
        <div style={{ paddingLeft: '34px', display: 'flex', gap: '8px' }}>
          {message.action.type === 'compare_available' && (
            <>
              <button
                onClick={() => onOpenSmartCompare(message.action.products || message.products)}
                style={{
                  background: 'var(--accent-gradient)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <Scale size={13} />
                Open in AI Compare Products
              </button>
              <button
                onClick={() => onCompare(message.action.products || message.products)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.7rem',
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                Quick Spec Card
              </button>
            </>
          )}

          {message.action.type === 'navigate' && (
            <button
              onClick={() => onNavigate(message.action.path, { query: message.action.query, params: message.action.params })}
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--text-accent)',
                borderRadius: '8px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {message.action.label || 'View Results'}
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Suggestion chips */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div style={{ paddingLeft: '34px', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {message.suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSuggestionClick(s)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                borderRadius: '20px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.12)';
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                e.currentTarget.style.color = '#a5b4fc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              ↳ {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ChatbotModal ─────────────────────────────────────────────────────────

const INITIAL_SUGGESTIONS = [
  'Laptops under 60 k',
  'Best laptops for coding',
  '5G phones under 35k with good camera',
  'ANC headphones',
  'Active discount coupons',
];

const WELCOME_MESSAGE = {
  role: 'assistant',
  text: `Hello! I am **TrustCart AI**, your Intelligent Shopping Assistant.\n\nAsk me naturally — even with typos, budgets, or specific features:\n• "Laptops under 60 k" or "Best laptops for coding"\n• "5G phones with 6000mAh battery"\n• "ANC headphones under 7000"\n• "Compare AeroBook 14 and CreatorBook 16"\n• "Active discount coupons" or "Track my orders"`,
  suggestions: INITIAL_SUGGESTIONS,
  products: [],
};

export function ChatbotModal({ isOpen, onClose, onOpenVoice }) {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { items: cartItems, getLatestItems, addItem, removeItem, clearCart } = useCart();
  const { items: wishlistItems, isInWishlist, toggleWishlist } = useWishlist();
  const { orders } = useOrders();
  const { isInCompare, toggleCompare, addToCompare, openCompare } = useCompare();

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [addedToCart, setAddedToCart] = useState({});
  const [pendingConfirmProduct, setPendingConfirmProduct] = useState(null);
  const [comparisonModalProducts, setComparisonModalProducts] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voiceSessionRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = useCallback(async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || isTyping) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsTyping(true);

    try {
      const response = await aiChatService.sendMessageEnhanced(text, messages, {
        user,
        cartItems: getLatestItems ? getLatestItems() : cartItems,
        getLatestItems,
        addItem,
        removeItem,
        clearCart,
        wishlistItems,
        isInWishlist,
        toggleWishlist,
        orders,
        onNavigateBackground: (path, opts) => navigate(path, opts),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.text,
          suggestions: response.suggestions || [],
          products: response.products || [],
          structuredFilters: response.structuredFilters || null,
          action: response.action || null,
          type: response.type,
        },
      ]);
    } catch (err) {
      console.error('[ChatbotModal] Error:', err);
      // Requirement: Handle network failures without losing the customer's typed query
      setInput(text);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Unable to reach the shopping assistant. Your query has been preserved so you can retry.',
          suggestions: ['Laptops under 60 k', 'Show popular products', 'Browse categories'],
          products: [],
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, messages, user, cartItems, getLatestItems, addItem, removeItem, clearCart, wishlistItems, isInWishlist, toggleWishlist, orders, navigate]);

  // Cleanup voice session on unmount or close
  useEffect(() => {
    if (!isOpen && voiceSessionRef.current) {
      voiceSessionRef.current.stop();
      setIsListening(false);
    }
  }, [isOpen]);

  const toggleVoiceListening = useCallback(() => {
    if (isListening) {
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setIsListening(false);
      return;
    }

    if (!voiceService.isSpeechRecognitionSupported()) {
      alert('Speech recognition is not supported in this browser. Try Chrome/Edge or use keyboard input.');
      return;
    }

    // Set listening immediately so the UI responds on click
    setIsListening(true);
    setInput('');

    const session = voiceService.createRecognitionSession({
      lang: 'en-IN',
      continuous: true,
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: ({ transcript: text }) => {
        setInput(text);
      },
      onFinal: (finalText) => {
        setIsListening(false);
        voiceSessionRef.current = null;
        if (finalText.trim()) {
          setInput(finalText.trim());
          handleSend(finalText.trim());
        }
      },
      onError: (err) => {
        console.warn('[ChatbotModal] Speech error:', err);
        if (err.code === 'no_speech') {
          return;
        }
        setIsListening(false);
        voiceSessionRef.current = null;
        if (err.code === 'permission_denied') {
          alert('Microphone access was denied. Please allow microphone permission in your browser settings.');
        }
      },
      onEnd: () => {
        setIsListening(false);
        voiceSessionRef.current = null;
      },
    });

    voiceSessionRef.current = session;
    session.start();
  }, [isListening, handleSend]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleSuggestionClick = useCallback((suggestion) => {
    handleSend(suggestion);
  }, [handleSend]);

  const handleNavigate = useCallback((path, opts = {}) => {
    navigate(path, opts);
    onClose();
  }, [navigate, onClose]);

  const handlePrepareCart = useCallback((product) => {
    setPendingConfirmProduct(product);
  }, []);

  const handleConfirmAddToCart = useCallback(async (product) => {
    try {
      await addItem(product, 1);
      setAddedToCart((prev) => ({ ...prev, [product.id]: true }));
      setPendingConfirmProduct(null);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✅ **Customer Authorization Confirmed:** **${product.name}** (${formatINR(product.price)}) has been added to your shopping cart.\n\nReady to proceed to checkout when you are!`,
          suggestions: ['View my cart', 'Continue shopping', 'Track my order'],
          action: { type: 'navigate', path: 'cart', label: 'View Shopping Cart' },
        },
      ]);
      setTimeout(() => {
        setAddedToCart((prev) => {
          const next = { ...prev };
          delete next[product.id];
          return next;
        });
      }, 3000);
    } catch (err) {
      console.error('[ChatbotModal] confirmAddToCart error:', err);
    }
  }, [addItem]);

  const handleCancelCart = useCallback(() => {
    setPendingConfirmProduct(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: `ℹ️ Cart preparation cancelled. No modifications were made to your shopping cart.`,
        suggestions: ['Browse more products', 'Compare other options'],
      },
    ]);
  }, []);

  const handleCompare = useCallback(async (productsToCompare) => {
    if (!productsToCompare || productsToCompare.length < 2) return;
    const ids = productsToCompare.slice(0, 2).map((p) => p.id);
    const res = await trustCartAgentService.compareProducts(ids);
    if (res && !res.error) {
      setComparisonModalProducts(res);
    }
  }, []);

  const handleOpenSmartCompare = useCallback((productsToCompare) => {
    if (!Array.isArray(productsToCompare) || productsToCompare.length < 2) return;
    productsToCompare.slice(0, 5).forEach((p) => {
      if (p?.id && !isInCompare(p.id)) {
        addToCompare(p);
      }
    });
    onClose();
    openCompare();
  }, [isInCompare, addToCompare, onClose, openCompare]);

  const handleResetChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setPendingConfirmProduct(null);
    setComparisonModalProducts(null);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* CSS keyframes */}
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.96); }
        }
      `}</style>

      <div
        id="ai-chatbot-modal"
        role="dialog"
        aria-modal="true"
        aria-label="TrustCart AI Shopping Assistant"
        style={{
          position: 'fixed',
          bottom: '5.5rem',
          right: '1.5rem',
          width: 'min(410px, calc(100vw - 2rem))',
          maxHeight: 'min(620px, calc(100vh - 7.5rem))',
          background: 'rgba(13, 17, 30, 0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '18px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatSlideIn 0.25s ease-out',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '0.85rem 1rem',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))',
          borderBottom: '1px solid rgba(99,102,241,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <span>TrustCart AI</span>
                <span style={{ fontSize: '0.62rem', background: '#6366f1', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>Agent</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80' }} />
                Online · Real InsForge Catalog
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {onOpenVoice && (
              <button
                onClick={() => {
                  onClose();
                  onOpenVoice();
                }}
                title="Switch to Voice Assistant"
                style={{
                  background: 'rgba(236, 72, 153, 0.12)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  borderRadius: '8px',
                  color: '#f472b6',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Mic size={12} />
                Voice
              </button>
            )}
            <button
              onClick={handleResetChat}
              title="Start new conversation"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '0.3rem 0.5rem',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={() => handleNavigate('products')}
              title="Browse Products"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '0.3rem 0.55rem',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Package size={12} />
              Catalog
            </button>
            <button
              id="chatbot-close-btn"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '0.3rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          id="chatbot-messages-area"
          style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(99,102,241,0.3) transparent',
            position: 'relative',
          }}
        >
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              message={m}
              onNavigate={handleNavigate}
              onPrepareCart={handlePrepareCart}
              onToggleWishlist={toggleWishlist}
              onToggleCompare={toggleCompare}
              isInWishlist={isInWishlist}
              isInCompare={isInCompare}
              onSuggestionClick={handleSuggestionClick}
              onCompare={handleCompare}
              onOpenSmartCompare={handleOpenSmartCompare}
              onConfirmCartAction={handleConfirmAddToCart}
              onCancelCartAction={handleCancelCart}
              addedToCart={addedToCart}
            />
          ))}

          {isTyping && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                <Bot size={13} color="#fff" />
              </div>
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick suggestions (shown when input is empty) ── */}
        {!input && messages.length <= 2 && (
          <div style={{
            padding: '0 1rem 0.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
          }}>
            {INITIAL_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: '#a5b4fc',
                  borderRadius: '20px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
                }}
              >
                <Zap size={10} />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Input form ── */}
        <form
          onSubmit={handleFormSubmit}
          style={{
            padding: '0.75rem',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.3)',
            flexShrink: 0,
          }}
        >
          <input
            id="chatbot-input"
            ref={inputRef}
            type="text"
            placeholder={isListening ? "Listening... speak now" : "Ask about products, budget, orders..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            aria-label="Chat message input"
            style={{
              flex: 1,
              background: isListening ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255,255,255,0.06)',
              border: isListening ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: '#f1f5f9',
              padding: '0.55rem 0.85rem',
              fontSize: '0.84rem',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = isListening ? '#f43f5e' : 'rgba(255,255,255,0.12)'; }}
          />

          {/* Microphone button in the AI Assistant input */}
          <button
            id="chatbot-mic-btn"
            type="button"
            onClick={toggleVoiceListening}
            title={isListening ? "Stop listening" : "Speak to AI Assistant"}
            aria-label={isListening ? "Stop listening" : "Speak to AI Assistant"}
            style={{
              background: isListening
                ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
                : 'rgba(255,255,255,0.06)',
              border: isListening ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: isListening ? '#fff' : '#cbd5e1',
              padding: '0.55rem 0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: isListening ? '0 0 15px rgba(244, 63, 94, 0.6)' : 'none',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            id="chatbot-send-btn"
            type="submit"
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            style={{
              background: input.trim() && !isTyping
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '10px',
              color: input.trim() && !isTyping ? '#fff' : '#475569',
              padding: '0.55rem 0.75rem',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: input.trim() && !isTyping ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
            }}
          >
            {isTyping ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
          </button>
        </form>

        {/* Footer note */}
        <div style={{
          padding: '0.4rem 1rem',
          background: 'rgba(0,0,0,0.2)',
          fontSize: '0.65rem',
          color: '#64748b',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          TrustCart AI · Live verified catalog data · Explicit confirmation required
        </div>

        {/* ── Side-by-Side Comparison Modal Overlay ── */}
        {comparisonModalProducts && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.98)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem',
            overflowY: 'auto',
            animation: 'chatSlideIn 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 700, color: '#a5b4fc' }}>
                <Scale size={16} color="#818cf8" />
                TrustCart Spec Comparison
              </div>
              <button
                onClick={() => setComparisonModalProducts(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Verdict Box */}
            <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '8px 10px', marginBottom: '10px', fontSize: '0.72rem', color: '#e2e8f0', lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '3px' }}>💡 AI Analysis Verdict:</div>
              <div>{comparisonModalProducts.verdict?.priceComparison}</div>
              <div style={{ marginTop: '3px', color: '#cbd5e1' }}>{comparisonModalProducts.verdict?.recommendation}</div>
            </div>

            {/* Side-by-Side Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              {comparisonModalProducts.products?.map((p) => (
                <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <img src={p.image} alt={p.name} style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fff', marginBottom: '2px', lineHeight: 1.2 }}>{p.name}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#818cf8', marginBottom: '6px' }}>{formatINR(p.price)}</div>

                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong style={{ color: '#cbd5e1' }}>Camera:</strong> {p.camera}</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Battery:</strong> {p.battery}</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Display:</strong> {p.display}</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Processor:</strong> {p.processor}</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Warranty:</strong> {p.warranty}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setComparisonModalProducts(null);
                      handlePrepareCart(p);
                    }}
                    style={{
                      marginTop: '8px',
                      background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a5b4fc',
                      borderRadius: '6px',
                      padding: '5px 0',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Prepare Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending Cart Confirmation Modal Overlay ── */}
        {pendingConfirmProduct && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.96)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.2rem',
            animation: 'chatSlideIn 0.2s ease-out',
          }}>
            <div style={{
              background: 'rgba(20, 26, 46, 0.98)',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '16px',
              padding: '1.2rem',
              width: '100%',
              boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.88rem', fontWeight: 800 }}>
                <Shield size={18} />
                Explicit Authorization Required
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <img
                  src={pendingConfirmProduct.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}
                  alt={pendingConfirmProduct.name}
                  style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{pendingConfirmProduct.name}</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#818cf8', marginTop: '2px' }}>{formatINR(pendingConfirmProduct.price)}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.45, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', padding: '8px', borderRadius: '8px' }}>
                ⚠️ <strong>Safety Policy:</strong> TrustCart AI requires explicit confirmation before modifying your active cart. Unauthorized purchases or unconfirmed checkouts are strictly disallowed.
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  id="confirm-cart-modal-btn"
                  onClick={() => handleConfirmAddToCart(pendingConfirmProduct)}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 0',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  <CheckCircle2 size={15} /> Confirm & Add
                </button>
                <button
                  id="cancel-cart-modal-btn"
                  onClick={handleCancelCart}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ChatbotModal;
