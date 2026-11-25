import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debuggingPort = 9225;

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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[BROWSER ${msg.params.type}]`, text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      console.error(`[BROWSER EXCEPTION]`, desc);
    }
  });

  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  // Step 1: Navigate to Home Page
  console.log('Navigating to Home Page...');
  await send('Page.navigate', { url: 'http://localhost:5173/#/' });
  await new Promise(r => setTimeout(r, 2000));

  const homeProductCount = await evaluate(`document.querySelectorAll('.product-card').length`);
  console.log('Product cards on home page:', homeProductCount);

  // Step 2: Click the first product card
  console.log('Clicking the first product card on Home page...');
  const clickedProductTitle = await evaluate(`(() => {
    const firstCard = document.querySelector('.product-card');
    if (!firstCard) return 'No card found';
    const title = firstCard.querySelector('h3')?.innerText || firstCard.innerText.slice(0, 30);
    firstCard.click();
    return title;
  })()`);
  console.log('Clicked product:', clickedProductTitle);

  await new Promise(r => setTimeout(r, 2000));

  const currentUrlAfterClick = await evaluate(`window.location.hash`);
  console.log('URL after clicking product:', currentUrlAfterClick);

  const productDetailHeader = await evaluate(`document.querySelector('h1')?.innerText`);
  console.log('H1 on Product Details page:', productDetailHeader);

  const productPrice = await evaluate(`(() => {
    const el = document.querySelector('.product-detail-grid') || document.body;
    return el ? el.innerText.slice(0, 300) : 'Not found';
  })()`);
  console.log('Product page snippet:\n', productPrice);

  // Step 3: Test Add to Cart on Product Details Page
  console.log('\nTesting Add to Cart on Product Details page...');
  const addToCartResult = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.innerText.includes('Add to Cart'));
    if (!addBtn) return 'Add to Cart button not found';
    addBtn.click();
    return 'Clicked Add to Cart';
  })()`);
  console.log('Add to cart result:', addToCartResult);
  await new Promise(r => setTimeout(r, 1000));

  const cartBadge = await evaluate(`(() => {
    const badge = document.querySelector('.cart-count, [data-count], nav span');
    return document.querySelector('nav')?.innerText;
  })()`);
  console.log('Nav state snippet after add to cart:\n', cartBadge);

  // Step 4: Navigate to Products Catalog Page
  console.log('\nNavigating to Products Catalog Page (#/products)...');
  await send('Page.navigate', { url: 'http://localhost:5173/#/products' });
  await new Promise(r => setTimeout(r, 2000));

  const catalogCount = await evaluate(`document.querySelectorAll('.product-card').length`);
  console.log('Products displayed on Catalog Page:', catalogCount);

  const catalogTitle = await evaluate(`document.querySelector('h1')?.innerText`);
  console.log('Catalog H1:', catalogTitle);

  // Check if any error banner is displayed
  const errorBanner = await evaluate(`(() => {
    const el = document.querySelector('[style*="rgba(239, 68, 68"]');
    return el ? el.innerText : 'No error banner';
  })()`);
  console.log('Error banner on catalog:', errorBanner);

} catch (err) {
  console.error('Test error:', err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}

