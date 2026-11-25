import { io } from 'socket.io-client';

/**
 * Client Service for Real-Time Collaborative Co-Shopping
 *
 * Connects to the Vite/Node HTTP server over Socket.IO (using the same port / origin).
 * Manages room lifecycle, live presence, synchronized shared cart, and group chat.
 */

class CoShoppingService {
  constructor() {
    this.socket = null;
    this.currentRoom = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.isConnected = false;
  }

  /**
   * Initializes or reuses the Socket.IO client instance
   */
  getSocket() {
    if (!this.socket) {
      // Connect to same origin on /socket.io/
      this.socket = io({
        path: '/socket.io/',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this._notify('connection_change', { connected: true, socketId: this.socket.id });
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this._notify('connection_change', { connected: false, reason });
      });

      this.socket.on('chat_message', (msg) => this._notify('chat_message', msg));
      this.socket.on('member_joined', (data) => {
        if (data.room) this.currentRoom = data.room;
        this._notify('member_joined', data);
      });
      this.socket.on('member_left', (data) => {
        if (data.room) this.currentRoom = data.room;
        this._notify('member_left', data);
      });
      this.socket.on('cart_updated', (data) => {
        if (this.currentRoom) this.currentRoom.sharedCart = data.sharedCart;
        this._notify('cart_updated', data);
      });
      this.socket.on('product_view_synced', (productView) => {
        if (this.currentRoom) this.currentRoom.activeProductView = productView;
        this._notify('product_view_synced', productView);
      });
    }
    return this.socket;
  }

  _notify(event, payload) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => {
        try { cb(payload); }
        catch (err) { console.error(`[CoShoppingService] Callback error on "${event}":`, err); }
      });
    }
  }

  /**
   * Subscribes a listener to a co-shopping event
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscription function
    return () => {
      const set = this.listeners.get(event);
      if (set) set.delete(callback);
    };
  }

  /**
   * Create a new Co-Shopping Room
   */
  async createRoom({ userName, userId, roomName }) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('create_room', { userName, userId, roomName }, (res) => {
        if (res?.ok) {
          this.currentRoom = res.room;
        }
        resolve(res);
      });
    });
  }

  /**
   * Join an existing Co-Shopping Room by Code or UUID
   */
  async joinRoom({ roomCode, userName, userId }) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('join_room', { roomCode, userName, userId }, (res) => {
        if (res?.ok) {
          this.currentRoom = res.room;
        }
        resolve(res);
      });
    });
  }

  /**
   * Send a chat message within the active room
   */
  async sendChat(text) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('send_chat', { text }, resolve);
    });
  }

  /**
   * Add a product to the collaborative shared cart
   */
  async addToSharedCart(product, quantity = 1) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('update_shared_cart', { action: 'add', product, quantity }, resolve);
    });
  }

  /**
   * Remove a product from the collaborative shared cart
   */
  async removeFromSharedCart(productId) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('update_shared_cart', { action: 'remove', product: { id: productId } }, resolve);
    });
  }

  /**
   * Update quantity of a shared cart item
   */
  async updateSharedCartQty(productId, quantity) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('update_shared_cart', { action: 'update_qty', product: { id: productId }, quantity }, resolve);
    });
  }

  /**
   * Broadcast co-browsing activity (viewing a product page)
   */
  syncViewingProduct(product) {
    if (!this.currentRoom) return;
    const socket = this.getSocket();
    socket.emit('sync_product_view', product);
  }

  /**
   * Leave the current room
   */
  async leaveRoom() {
    if (!this.socket) return { ok: true };
    return new Promise((resolve) => {
      this.socket.emit('leave_room', (res) => {
        this.currentRoom = null;
        resolve(res);
      });
    });
  }

  getCurrentRoom() {
    return this.currentRoom;
  }
}

export const coShoppingService = new CoShoppingService();
export default coShoppingService;
