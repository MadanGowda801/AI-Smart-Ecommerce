import { spawn } from 'node:child_process';
import fs from 'node:fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debuggingPort = 9224;

console.log('Launching headless Edge for diagnostics...');
const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1400,900',
  'about:blank'
]);

await new Promise(r => setTimeout(r, 1500));

try {
  const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page');

  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const logs = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      console.log(`[BROWSER ${msg.params.type}]`, text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      logs.push(`[EXCEPTION] ${desc}`);
      console.error(`[BROWSER EXCEPTION]`, desc);
    }
  });

  await new Promise(r => ws.on('open', r));

  await send('Page.enable');
  await send('Runtime.enable');

  // Test 1: Home page
  console.log('\n--- 1. Testing Home Page ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/' });
  await new Promise(r => setTimeout(r, 2000));

  // Test 2: Products Page
  console.log('\n--- 2. Testing Products Page (#/products) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/products' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Capture screenshot of products page
  const ssProducts = await send('Page.captureScreenshot', { format: 'png' });
  if (ssProducts?.data) {
    fs.writeFileSync('scripts/diag_products.png', Buffer.from(ssProducts.data, 'base64'));
  }

  // Test 3: Product Detail prod-1
  console.log('\n--- 3. Testing Product Detail (#/product/prod-1) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/product/prod-1' });
  await new Promise(r => setTimeout(r, 2000));
  
  const ssProd1 = await send('Page.captureScreenshot', { format: 'png' });
  if (ssProd1?.data) {
    fs.writeFileSync('scripts/diag_prod1.png', Buffer.from(ssProd1.data, 'base64'));
  }

  // Test 4: Product Detail prod-2 (or another product)
  console.log('\n--- 4. Testing Product Detail (#/product/prod-2) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/product/prod-2' });
  await new Promise(r => setTimeout(r, 2000));

  // Test 5: Categories Page
  console.log('\n--- 5. Testing Categories Page (#/categories) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/categories' });
  await new Promise(r => setTimeout(r, 2000));

  // Test 6: Admin Products Page
  console.log('\n--- 6. Testing Admin Products Page (#/admin-products) ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/admin-products' });
  await new Promise(r => setTimeout(r, 2000));

  const ssAdmin = await send('Page.captureScreenshot', { format: 'png' });
  if (ssAdmin?.data) {
    fs.writeFileSync('scripts/diag_admin.png', Buffer.from(ssAdmin.data, 'base64'));
  }

  console.log('\n--- All diagnostic routes tested successfully ---');
  console.log(`Total captured logs/exceptions: ${logs.length}`);
} catch (err) {
  console.error('Diagnostic error:', err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}

