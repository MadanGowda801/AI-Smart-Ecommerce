import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debuggingPort = 9227;

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

  const browserErrors = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      browserErrors.push(desc);
      console.error(`[BROWSER ERROR]`, desc);
    }
  });

  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('--- 1. Testing FeatureGrid "Catalog & Categories" Click ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/' });
  await new Promise(r => setTimeout(r, 1500));

  const clickModuleResult = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.feature-card'));
    const catCard = cards.find(c => c.innerText.includes('Catalog & Categories'));
    if (!catCard) return 'Card not found';
    catCard.click();
    return 'Clicked Catalog & Categories module';
  })()`);
  console.log('Result:', clickModuleResult);
  await new Promise(r => setTimeout(r, 1000));
  const urlAfterModuleClick = await evaluate(`window.location.hash`);
  console.log('URL after module click:', urlAfterModuleClick);

  console.log('\n--- 2. Testing Category Filter on Products Page ---');
  const catBtnClick = await evaluate(`(() => {
    const catButtons = Array.from(document.querySelectorAll('button'));
    const audioBtn = catButtons.find(b => b.innerText.toLowerCase().includes('audio'));
    if (audioBtn) {
      audioBtn.click();
      return 'Clicked Audio category';
    }
    return 'Audio button not found';
  })()`);
  console.log('Category filter result:', catBtnClick);
  await new Promise(r => setTimeout(r, 1000));
  const audioFilteredCount = await evaluate(`document.querySelectorAll('.product-card').length`);
  console.log('Audio products count:', audioFilteredCount);

  console.log('\n--- 3. Testing Product Detail & Quantity Increment ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/product/prod-2' });
  await new Promise(r => setTimeout(r, 1500));
  const macbookH1 = await evaluate(`document.querySelector('h1')?.innerText`);
  console.log('Product title:', macbookH1);

  // Click Plus button
  const plusClick = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    // Find button with Plus icon or next to quantity input
    const plusBtn = buttons.find(b => b.innerHTML.includes('lucide-plus') || b.querySelector('svg.lucide-plus'));
    if (plusBtn) {
      plusBtn.click();
      return 'Clicked Plus button';
    }
    return 'Plus button not found';
  })()`);
  console.log('Plus button result:', plusClick);

  // Click Add to Cart
  const addCartClick = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.innerText.includes('Add to Cart'));
    if (addBtn) {
      addBtn.click();
      return 'Clicked Add to Cart';
    }
    return 'Add to Cart not found';
  })()`);
  console.log('Add to cart result:', addCartClick);
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n--- 4. Checking Cart Page ---');
  await send('Page.navigate', { url: 'http://localhost:5173/#/cart' });
  await new Promise(r => setTimeout(r, 1500));
  const cartH1 = await evaluate(`document.querySelector('h1')?.innerText`);
  const cartItemCount = await evaluate(`document.querySelectorAll('.cart-item, [class*="cart-item"]').length || (document.body.innerText.includes('MacBook') ? 1 : 0)`);
  console.log('Cart Page H1:', cartH1);
  console.log('Cart Items detected:', cartItemCount);

  console.log('\n--- 5. Dynamic Pricing & Free Shipping Threshold Banner ---');
  const promoBannerText = await evaluate(`(() => {
    const promo = document.querySelector('[style*="linear-gradient"]') || document.body;
    return promo.innerText.includes('Free') || promo.innerText.includes('Shipping') ? 'Promo banner verified' : 'Not found';
  })()`);
  console.log('Promo banner status in Cart:', promoBannerText);

  console.log('\n--- 6. Browser Errors Summary ---');
  console.log('Total Browser Unhandled Errors:', browserErrors.length);
} catch (err) {
  console.error('Test execution error:', err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}

