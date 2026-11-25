import { Server } from 'socket.io';
import crypto from 'node:crypto';

/**
 * Vite Dev Server Plugin: Real-Time Collaborative Co-Shopping Rooms
 *
 * Attaches Socket.IO directly to Vite's existing HTTP server instance (server.httpServer)
 * to avoid spawning conflicting servers or port collisions.
 *
 * Features & Security:
 * - Room Creation with secure UUIDs and human-friendly short codes (e.g. SHOP-A1B2C3).
 * - Room TTL Expiration (2 hours automatic cleanup).
 * - Participant state tracking (Host, Members, live presence).
 * - Per-socket rate limiting (max 30 events per 10 seconds).
 * - Sanitized real-time chat with message length limits and HTML stripping.
 * - Synchronized Shared Cart isolated from individual personal carts.
 * - Live Co-Browsing Indicator ("Friend is currently viewing...").
 * - Graceful disconnect and reconnect handling.
 */

// In-memory active rooms store: roomId -> RoomState
const activeRooms = new Map();

// Rate limiting map: socketId -> { count, windowStart }
const socketRateLimits = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 10_000;

function isSocketFlooding(socketId) {
  const now = Date.now();
  const entry = socketRateLimits.get(socketId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    socketRateLimits.set(socketId, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

function sanitizeText(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim()
    .slice(0, maxLen);
}

// Cleanup expired rooms periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    if (now > room.expiresAt || (room.members.size === 0 && now - room.lastActivity > 15 * 60 * 1000)) {
      activeRooms.delete(roomId);
      console.log(`[CoShopping] Room ${roomId} expired and cleaned up.`);
    }
  }
}, 10 * 60 * 1000).unref?.();

export function getRoomSummary(room) {
  return {
    roomId: room.id,
    roomCode: room.code,
    roomName: room.name,
    createdBy: room.createdBy,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    members: Array.from(room.members.values()).map(m => ({
      userId: m.userId,
      name: m.name,
      avatar: m.avatar,
      role: m.role,
      joinedAt: m.joinedAt
    })),
    sharedCart: room.sharedCart,
    activeProductView: room.activeProductView,
    recentMessages: room.messages.slice(-50)
  };
}

export default function coShoppingPlugin(env = {}) {
  let io = null;

  const setupServer = (server) => {
    if (!server.httpServer) {
      console.warn('[coShoppingPlugin] No httpServer available on Vite server instance.');
      return;
    }

    if (io) return;

    // Attach Socket.IO to the existing Vite dev server
    io = new Server(server.httpServer, {
      path: '/socket.io/',
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling']
    });

    console.log('[coShoppingPlugin] ✅ Socket.IO attached to existing Vite HTTP server.');

    io.on('connection', (socket) => {
        let currentRoomId = null;
        let currentUser = null;

        // 1. Create Room
        socket.on('create_room', (data, callback) => {
          if (isSocketFlooding(socket.id)) {
            return callback?.({ ok: false, error: 'Rate limit exceeded. Please slow down.' });
          }

          const userName = sanitizeText(data?.userName || 'Shopper', 40);
          const userId = sanitizeText(data?.userId || `guest_${socket.id.slice(0, 6)}`, 64);
          const roomName = sanitizeText(data?.roomName || `${userName}'s Shopping Room`, 60);

          const roomId = crypto.randomUUID();
          const roomCode = `SHOP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const now = Date.now();

          const newRoom = {
            id: roomId,
            code: roomCode,
            name: roomName,
            createdBy: { userId, name: userName },
            createdAt: now,
            expiresAt: now + 2 * 60 * 60 * 1000, // 2-hour TTL
            lastActivity: now,
            members: new Map(),
            sharedCart: [],
            messages: [
              {
                id: crypto.randomUUID(),
                type: 'system',
                text: `🎉 Room "${roomName}" created by ${userName}. Invite code: ${roomCode}`,
                timestamp: now
              }
            ],
            activeProductView: null
          };

          const memberInfo = {
            socketId: socket.id,
            userId,
            name: userName,
            role: 'host',
            avatar: data?.avatar || null,
            joinedAt: now
          };

          newRoom.members.set(socket.id, memberInfo);
          activeRooms.set(roomId, newRoom);
          activeRooms.set(roomCode, newRoom); // Allow lookup by roomCode too

          currentRoomId = roomId;
          currentUser = memberInfo;
          socket.join(roomId);

          console.log(`[CoShopping] Room created: ${roomCode} (${roomId}) by ${userName}`);
          callback?.({ ok: true, room: getRoomSummary(newRoom) });
        });

        // 2. Join Room
        socket.on('join_room', (data, callback) => {
          if (isSocketFlooding(socket.id)) {
            return callback?.({ ok: false, error: 'Rate limit exceeded. Please slow down.' });
          }

          const target = (data?.roomCode || data?.roomId || '').trim().toUpperCase();
          const userName = sanitizeText(data?.userName || 'Shopper', 40);
          const userId = sanitizeText(data?.userId || `guest_${socket.id.slice(0, 6)}`, 64);

          const room = activeRooms.get(target);
          if (!room) {
            return callback?.({ ok: false, error: 'Room not found or has expired. Please check the code.' });
          }

          if (Date.now() > room.expiresAt) {
            activeRooms.delete(room.id);
            activeRooms.delete(room.code);
            return callback?.({ ok: false, error: 'This co-shopping room has expired.' });
          }

          // Leave existing room if any
          if (currentRoomId && currentRoomId !== room.id) {
            socket.leave(currentRoomId);
            const oldRoom = activeRooms.get(currentRoomId);
            if (oldRoom) oldRoom.members.delete(socket.id);
          }

          const memberInfo = {
            socketId: socket.id,
            userId,
            name: userName,
            role: room.members.size === 0 ? 'host' : 'member',
            avatar: data?.avatar || null,
            joinedAt: Date.now()
          };

          room.members.set(socket.id, memberInfo);
          room.lastActivity = Date.now();
          currentRoomId = room.id;
          currentUser = memberInfo;
          socket.join(room.id);

          const joinMsg = {
            id: crypto.randomUUID(),
            type: 'system',
            text: `👋 ${userName} joined the room.`,
            timestamp: Date.now()
          };
          room.messages.push(joinMsg);

          // Broadcast member join to others in room
          socket.to(room.id).emit('member_joined', {
            member: memberInfo,
            systemMessage: joinMsg,
            room: getRoomSummary(room)
          });

          console.log(`[CoShopping] ${userName} joined room ${room.code}`);
          callback?.({ ok: true, room: getRoomSummary(room) });
        });

        // 3. Send Chat Message
        socket.on('send_chat', (data, callback) => {
          if (isSocketFlooding(socket.id)) {
            return callback?.({ ok: false, error: 'Chat rate limit exceeded.' });
          }

          if (!currentRoomId) return callback?.({ ok: false, error: 'Not in a room.' });
          const room = activeRooms.get(currentRoomId);
          if (!room) return callback?.({ ok: false, error: 'Room expired.' });

          const text = sanitizeText(data?.text, 500);
          if (!text) return callback?.({ ok: false, error: 'Message cannot be empty.' });

          const message = {
            id: crypto.randomUUID(),
            type: 'user',
            senderId: currentUser?.userId || socket.id,
            senderName: currentUser?.name || 'Shopper',
            text,
            timestamp: Date.now()
          };

          room.messages.push(message);
          if (room.messages.length > 100) room.messages.shift();
          room.lastActivity = Date.now();

          io.to(room.id).emit('chat_message', message);
          callback?.({ ok: true, message });
        });

        // 4. Update Shared Cart
        socket.on('update_shared_cart', (data, callback) => {
          if (isSocketFlooding(socket.id)) {
            return callback?.({ ok: false, error: 'Rate limit exceeded.' });
          }

          if (!currentRoomId) return callback?.({ ok: false, error: 'Not in a room.' });
          const room = activeRooms.get(currentRoomId);
          if (!room) return callback?.({ ok: false, error: 'Room expired.' });

          const { action, product, quantity = 1 } = data || {};
          const safeQty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));

          if (action === 'add' && product?.id) {
            const existingIdx = room.sharedCart.findIndex(item => item.id === product.id);
            if (existingIdx !== -1) {
              room.sharedCart[existingIdx].quantity += safeQty;
            } else {
              room.sharedCart.push({
                id: product.id,
                name: sanitizeText(product.name, 120),
                price: Number(product.price) || 0,
                image: product.image || product.imageUrl || '',
                quantity: safeQty,
                addedBy: {
                  userId: currentUser?.userId || 'unknown',
                  name: currentUser?.name || 'Shopper'
                }
              });
            }

            const sysMsg = {
              id: crypto.randomUUID(),
              type: 'system',
              text: `🛒 ${currentUser?.name || 'Someone'} added "${sanitizeText(product.name, 60)}" to the shared bag.`,
              timestamp: Date.now()
            };
            room.messages.push(sysMsg);
            io.to(room.id).emit('chat_message', sysMsg);
          } else if (action === 'remove' && product?.id) {
            const removedItem = room.sharedCart.find(i => i.id === product.id);
            room.sharedCart = room.sharedCart.filter(item => item.id !== product.id);
            if (removedItem) {
              const sysMsg = {
                id: crypto.randomUUID(),
                type: 'system',
                text: `🗑️ ${currentUser?.name || 'Someone'} removed "${removedItem.name}" from the shared bag.`,
                timestamp: Date.now()
              };
              room.messages.push(sysMsg);
              io.to(room.id).emit('chat_message', sysMsg);
            }
          } else if (action === 'update_qty' && product?.id) {
            const item = room.sharedCart.find(i => i.id === product.id);
            if (item) item.quantity = safeQty;
          } else if (action === 'clear') {
            room.sharedCart = [];
          }

          room.lastActivity = Date.now();
          io.to(room.id).emit('cart_updated', { sharedCart: room.sharedCart });
          callback?.({ ok: true, sharedCart: room.sharedCart });
        });

        // 5. Sync Co-Browsing Product View
        socket.on('sync_product_view', (product, callback) => {
          if (!currentRoomId) return;
          const room = activeRooms.get(currentRoomId);
          if (!room) return;

          if (product && product.id) {
            room.activeProductView = {
              id: product.id,
              name: sanitizeText(product.name, 100),
              price: Number(product.price) || 0,
              image: product.image || '',
              viewedBy: currentUser?.name || 'Friend',
              timestamp: Date.now()
            };
          } else {
            room.activeProductView = null;
          }

          socket.to(room.id).emit('product_view_synced', room.activeProductView);
          callback?.({ ok: true });
        });

        // 6. Leave Room
        socket.on('leave_room', (callback) => {
          if (currentRoomId) {
            const room = activeRooms.get(currentRoomId);
            if (room) {
              room.members.delete(socket.id);
              const leaveMsg = {
                id: crypto.randomUUID(),
                type: 'system',
                text: `👋 ${currentUser?.name || 'A participant'} left the room.`,
                timestamp: Date.now()
              };
              room.messages.push(leaveMsg);
              socket.to(room.id).emit('member_left', {
                memberId: socket.id,
                systemMessage: leaveMsg,
                room: getRoomSummary(room)
              });
            }
            socket.leave(currentRoomId);
            currentRoomId = null;
            currentUser = null;
          }
          callback?.({ ok: true });
        });

        // 7. Disconnection
        socket.on('disconnect', () => {
          socketRateLimits.delete(socket.id);
          if (currentRoomId) {
            const room = activeRooms.get(currentRoomId);
            if (room) {
              room.members.delete(socket.id);
              socket.to(room.id).emit('member_left', {
                memberId: socket.id,
                room: getRoomSummary(room)
              });
            }
          }
        });
      });

      // Optional REST status endpoint for room validation
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/co-shopping/status') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ok: true,
            activeRoomsCount: activeRooms.size / 2, // Map stores both id and code
            serverTime: Date.now()
          }));
          return;
        }
        next();
      });
  };

  return {
    name: 'co-shopping-plugin',
    configureServer(server) {
      setupServer(server);
    },
    configurePreviewServer(server) {
      setupServer(server);
    }
  };
}
