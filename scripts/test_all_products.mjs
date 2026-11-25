import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debuggingPort = 9226;

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

  const errors = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(desc);
      console.error(`[BROWSER ERROR]`, desc);
    }
  });

  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  for (let i = 1; i <= 12; i++) {
    const id = `prod-${i}`;
    await send('Page.navigate', { url: `http://localhost:5173/#/product/${id}` });
    await new Promise(r => setTimeout(r, 800));
    const title = await evaluate(`document.querySelector('h1')?.innerText`);
    const isBlank = await evaluate(`document.body.innerText.trim().length === 0`);
    console.log(`Product ${id}: title="${title}", isBlank=${isBlank}`);
  }

  console.log('Total browser errors across all 12 products:', errors.length);
} catch (err) {
  console.error('Test error:', err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}

