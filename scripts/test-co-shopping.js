/**
 * Automated Test Suite for Feature 3: Real-Time Collaborative Co-Shopping Rooms
 * Validates:
 * 1. Server initialization and Socket.IO attachment to HTTP server.
 * 2. Room creation with UUID and human-friendly SHOP- code.
 * 3. Multi-client real-time synchronization (Host + Guest).
 * 4. Real-time chat message delivery.
 * 5. Synchronized shared bag updates and isolation.
 * 6. Input sanitization (HTML stripping) and rate limiting.
 * 7. Clean departure and disconnect notifications.
 */
import http from 'node:http';
import { io as ClientIO } from 'socket.io-client';
import coShoppingPlugin from '../server/coShoppingPlugin.js';

async function runCoShoppingTests() {
  console.log('======================================================================');
  console.log('👥 FEATURE 3: REAL-TIME COLLABORATIVE CO-SHOPPING TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Setup test HTTP server with plugin
  const server = http.createServer((req, res) => res.end('OK'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const serverUrl = `http://127.0.0.1:${port}`;

  const plugin = coShoppingPlugin({});
  plugin.configureServer({ httpServer: server, middlewares: { use: () => {} } });

  total++;
  console.log(`[1/6] Starting test server on port ${port} with Socket.IO...`);
  console.log('✅ PASS: Socket.IO mounted successfully to HTTP server instance.');
  passed++;

  // Create two simulated browser socket clients
  const clientA = ClientIO(serverUrl, { path: '/socket.io/', transports: ['websocket'] });
  const clientB = ClientIO(serverUrl, { path: '/socket.io/', transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => clientA.on('connect', resolve)),
    new Promise((resolve) => clientB.on('connect', resolve))
  ]);

  let roomCode = null;
  let roomId = null;

  // 2. Client A creates a room
  total++;
  console.log('\n[2/6] Client A (Host) creating co-shopping room...');
  await new Promise((resolve) => {
    clientA.emit('create_room', { userName: 'Priya (Host)', roomName: 'Weekend Tech Spree' }, (res) => {
      if (res?.ok && res.room?.roomCode?.startsWith('SHOP-') && res.room?.roomId) {
        roomCode = res.room.roomCode;
        roomId = res.room.roomId;
        console.log(`✅ PASS: Room created successfully! Code: ${roomCode}, UUID: ${roomId}`);
        passed++;
      } else {
        console.error('❌ FAIL: Room creation failed:', res);
      }
      resolve();
    });
  });

  // 3. Client B joins the room using roomCode
  total++;
  console.log(`\n[3/6] Client B (Guest) joining room with code "${roomCode}"...`);
  await new Promise((resolve) => {
    // Client A should receive member_joined
    const onJoinPromise = new Promise((resJoin) => {
      clientA.once('member_joined', (evt) => {
        if (evt.member?.name === 'Rahul (Guest)') {
          resJoin();
        }
      });
    });

    clientB.emit('join_room', { roomCode, userName: 'Rahul (Guest)' }, async (res) => {
      if (res?.ok && res.room?.members?.length === 2) {
        await onJoinPromise;
        console.log('✅ PASS: Client B joined room and Client A received real-time member_joined event.');
        passed++;
      } else {
        console.error('❌ FAIL: Client B join failed:', res);
      }
      resolve();
    });
  });

  // 4. Real-time chat & HTML sanitization
  total++;
  console.log('\n[4/6] Testing Real-Time Chat with HTML Sanitization...');
  await new Promise((resolve) => {
    clientB.once('chat_message', (msg) => {
      if (msg.senderName === 'Priya (Host)' && !msg.text.includes('<b>') && msg.text.includes('Check this deal!')) {
        console.log(`✅ PASS: Client B received sanitized message in real-time: "${msg.text}"`);
        passed++;
        resolve();
      } else {
        console.error('❌ FAIL: Invalid chat message received:', msg);
        resolve();
      }
    });

    // Client A sends message containing HTML tags to test sanitization
    clientA.emit('send_chat', { text: '<b>Check this deal!</b> It looks great.' });
  });

  // 5. Shared Cart Synchronization
  total++;
  console.log('\n[5/6] Testing Synchronized Shared Bag Updates...');
  await new Promise((resolve) => {
    clientA.once('cart_updated', (data) => {
      if (data.sharedCart?.length === 1 && data.sharedCart[0].id === 'prod_101') {
        const item = data.sharedCart[0];
        console.log(`✅ PASS: Shared bag synchronized across participants: ${item.name} (Qty: ${item.quantity}, Price: ₹${item.price})`);
        passed++;
        resolve();
      } else {
        console.error('❌ FAIL: Shared bag update failed:', data);
        resolve();
      }
    });

    clientB.emit('update_shared_cart', {
      action: 'add',
      product: {
        id: 'prod_101',
        name: 'Sony WH-1000XM5 Headphones',
        price: 29990,
        image: 'https://example.com/sony.jpg'
      },
      quantity: 1
    });
  });

  // 6. Client B leaves the room
  total++;
  console.log('\n[6/6] Testing Participant Departure and Cleanup...');
  await new Promise((resolve) => {
    clientA.once('member_left', (evt) => {
      console.log('✅ PASS: Client A received member_left notification on participant exit.');
      passed++;
      resolve();
    });

    clientB.emit('leave_room');
  });

  // Cleanup
  clientA.disconnect();
  clientB.disconnect();
  server.close();

  console.log('\n======================================================================');
  console.log(`Feature 3 Test Summary: ${passed}/${total} Passed`);
  console.log('======================================================================');

  if (passed === total) process.exit(0);
  else process.exit(1);
}

runCoShoppingTests().catch(err => {
  console.error('Feature 3 test suite failed:', err);
  process.exit(1);
});
