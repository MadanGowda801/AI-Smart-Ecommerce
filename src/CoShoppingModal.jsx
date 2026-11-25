import React, { useState, useEffect, useRef } from 'react';
import {
  Users, X, MessageSquare, ShoppingBag, Plus, Trash2, Send,
  Copy, Check, ExternalLink, LogOut, Sparkles, Eye, ShieldCheck
} from 'lucide-react';
import coShoppingService from './coShoppingService';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useNavigation } from './NavigationContext';
import { formatINR } from './productsService';

export function CoShoppingModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { navigate } = useNavigation();

  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'cart' | 'members'
  const [room, setRoom] = useState(() => coShoppingService.getCurrentRoom());
  const [userName, setUserName] = useState(user?.name || user?.email?.split('@')[0] || 'Shopper');
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedToCartMessage, setCopiedToCartMessage] = useState('');

  const chatEndRef = useRef(null);

  // Sync user name when user context changes
  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user]);

  // Subscribe to real-time events when modal is open
  useEffect(() => {
    const unsubJoin = coShoppingService.subscribe('member_joined', (data) => {
      if (data.room) setRoom({ ...data.room });
    });

    const unsubLeave = coShoppingService.subscribe('member_left', (data) => {
      if (data.room) setRoom({ ...data.room });
    });

    const unsubChat = coShoppingService.subscribe('chat_message', (msg) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.recentMessages?.some(m => m.id === msg.id);
        if (exists) return prev;
        return {
          ...prev,
          recentMessages: [...(prev.recentMessages || []), msg]
        };
      });
    });

    const unsubCart = coShoppingService.subscribe('cart_updated', (data) => {
      setRoom((prev) => (prev ? { ...prev, sharedCart: data.sharedCart } : prev));
    });

    const unsubProductView = coShoppingService.subscribe('product_view_synced', (productView) => {
      setRoom((prev) => (prev ? { ...prev, activeProductView: productView } : prev));
    });

    return () => {
      unsubJoin();
      unsubLeave();
      unsubChat();
      unsubCart();
      unsubProductView();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room?.recentMessages, activeTab]);

  if (!isOpen) return null;

  // Handle Room Creation
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await coShoppingService.createRoom({
        userName: userName.trim() || 'Shopper',
        userId: user?.id || `guest_${Date.now()}`,
        roomName: `${userName.trim()}'s Shopping Room`
      });
      if (res?.ok) {
        setRoom(res.room);
      } else {
        setErrorMessage(res?.error || 'Failed to create room.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Joining Room
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setErrorMessage('Please enter a room code.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await coShoppingService.joinRoom({
        roomCode: joinCode.trim().toUpperCase(),
        userName: userName.trim() || 'Shopper',
        userId: user?.id || `guest_${Date.now()}`
      });
      if (res?.ok) {
        setRoom(res.room);
        setJoinCode('');
      } else {
        setErrorMessage(res?.error || 'Invalid or expired room code.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Leaving Room
  const handleLeaveRoom = async () => {
    await coShoppingService.leaveRoom();
    setRoom(null);
  };

  // Handle Send Chat
  const handleSendChat = async (e) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    await coShoppingService.sendChat(text);
  };

  // Copy Room Invite Code
  const handleCopyCode = () => {
    if (!room?.roomCode) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy Shared Cart Items into User's Personal Cart
  const handleTransferSharedCartToPersonal = () => {
    if (!room?.sharedCart || room.sharedCart.length === 0) return;
    let addedCount = 0;
    room.sharedCart.forEach((item) => {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
      }, item.quantity || 1);
      addedCount += (item.quantity || 1);
    });
    setCopiedToCartMessage(`✅ Transferred ${addedCount} items to your personal shopping bag!`);
    setTimeout(() => setCopiedToCartMessage(''), 3000);
  };

  // Calculate shared cart subtotal
  const sharedTotal = (room?.sharedCart || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1),
    0
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(5, 7, 15, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(15, 23, 42, 0.96))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15)',
        overflow: 'hidden',
      }}>
        {/* Top Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Co-Shop Live
                <span style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}>
                  {room ? 'Room Connected' : 'Real-Time'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {room ? `Room: ${room.roomName || room.roomCode}` : 'Shop together with friends in real time'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Co-Browsing Live Banner */}
        {room?.activeProductView && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
            borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
            padding: '0.5rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#c7d2fe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={15} style={{ color: '#818cf8', animation: 'pulse 2s infinite' }} />
              <span>
                <strong>{room.activeProductView.viewedBy}</strong> is viewing{' '}
                <span style={{ color: '#fff', fontWeight: 600 }}>{room.activeProductView.name}</span>
                {' '}({formatINR(room.activeProductView.price)})
              </span>
            </div>
            <button
              onClick={() => {
                navigate('product-details', { params: { id: room.activeProductView.id } });
                onClose();
              }}
              style={{
                background: 'rgba(99, 102, 241, 0.3)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ExternalLink size={11} /> View Together
            </button>
          </div>
        )}

        {/* Body */}
        {!room ? (
          // View 1: Join or Create Room
          <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
              }}>
                {errorMessage}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Option A: Create */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
                    Host a Room
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '1rem' }}>
                    Generate a secure invite code and invite friends to shop, chat, and compare picks together.
                  </p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={15} /> {isLoading ? 'Creating...' : 'Create New Room'}
                </button>
              </div>

              {/* Option B: Join */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
                    Join with Code
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                    Enter an invitation code shared by your friend (e.g. SHOP-A1B2C3).
                  </p>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="SHOP-XXXXXX"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.82rem',
                      letterSpacing: '1px',
                      marginBottom: '0.75rem',
                    }}
                  />
                </div>
                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading || !joinCode.trim()}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Users size={15} /> {isLoading ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // View 2: Active Room Dashboard
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '480px', maxHeight: '550px' }}>
            {/* Room Toolbar */}
            <div style={{
              padding: '0.6rem 1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#a5b4fc',
                }}>
                  <span>Code: <strong>{room.roomCode}</strong></span>
                  <button
                    onClick={handleCopyCode}
                    title="Copy invite code"
                    style={{ background: 'none', border: 'none', color: '#c7d2fe', cursor: 'pointer', padding: 0 }}
                  >
                    {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  👥 {room.members?.length || 1} participant{room.members?.length !== 1 ? 's' : ''}
                </div>
              </div>

              <button
                onClick={handleLeaveRoom}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <LogOut size={12} /> Leave
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.1)',
            }}>
              <button
                onClick={() => setActiveTab('chat')}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: activeTab === 'chat' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'chat' ? '2px solid #6366f1' : '2px solid transparent',
                  color: activeTab === 'chat' ? '#fff' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <MessageSquare size={14} /> Live Chat
              </button>
              <button
                onClick={() => setActiveTab('cart')}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: activeTab === 'cart' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'cart' ? '2px solid #6366f1' : '2px solid transparent',
                  color: activeTab === 'cart' ? '#fff' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <ShoppingBag size={14} /> Shared Bag ({room.sharedCart?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('members')}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: activeTab === 'members' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'members' ? '2px solid #6366f1' : '2px solid transparent',
                  color: activeTab === 'members' ? '#fff' : '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Users size={14} /> Shoppers ({room.members?.length || 1})
              </button>
            </div>

            {/* Tab 1: Live Chat */}
            {activeTab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}>
                  {room.recentMessages?.map((msg) => {
                    if (msg.type === 'system') {
                      return (
                        <div key={msg.id} style={{
                          alignSelf: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          margin: '2px 0',
                        }}>
                          {msg.text}
                        </div>
                      );
                    }
                    const isMe = msg.senderName === userName;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: isMe
                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                            : 'rgba(255, 255, 255, 0.07)',
                          border: `1px solid ${isMe ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                          borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          padding: '0.5rem 0.8rem',
                        }}
                      >
                        {!isMe && (
                          <div style={{ fontSize: '0.65rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '2px' }}>
                            {msg.senderName}
                          </div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#fff', wordBreak: 'break-word' }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                <form
                  onSubmit={handleSendChat}
                  style={{
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    gap: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message or share an opinion..."
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.8rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '0.82rem',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}

            {/* Tab 2: Shared Cart */}
            {activeTab === 'cart' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '1rem' }}>
                {copiedToCartMessage && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    marginBottom: '0.75rem',
                    textAlign: 'center',
                  }}>
                    {copiedToCartMessage}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(!room.sharedCart || room.sharedCart.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                      <ShoppingBag size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.85rem' }}>The collaborative shopping bag is empty.</p>
                      <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Browse products in the store and click "Add to Shared Bag" to recommend them to the group.
                      </p>
                    </div>
                  ) : (
                    room.sharedCart.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '10px',
                          padding: '0.6rem 0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                        }}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', gap: '8px' }}>
                            <span>{formatINR(item.price)} × {item.quantity}</span>
                            <span style={{ color: '#818cf8' }}>Added by {item.addedBy?.name || 'Shopper'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
                            {formatINR(item.price * item.quantity)}
                          </span>
                          <button
                            onClick={() => coShoppingService.removeFromSharedCart(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#f87171',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                            title="Remove from shared bag"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {room.sharedCart?.length > 0 && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Shared Room Total</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                        {formatINR(sharedTotal)}
                      </div>
                    </div>
                    <button
                      onClick={handleTransferSharedCartToPersonal}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ShoppingBag size={14} /> Copy to My Personal Cart
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Members */}
            {activeTab === 'members' && (
              <div style={{ padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {room.members?.map((m, idx) => (
                  <div
                    key={m.userId || idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '0.6rem 0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: m.role === 'host' ? '#f59e0b' : '#6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#fff',
                      }}>
                        {m.name?.[0]?.toUpperCase() || 'S'}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                          {m.name} {m.name === userName && '(You)'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {m.role === 'host' ? '👑 Room Host' : 'Participant'}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 6px #10b981',
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoShoppingModal;
