import { spawn } from 'node:child_process';
import fs from 'node:fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const debuggingPort = 9223;

console.log('Launching headless Edge for screenshot...');
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

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  });

  await new Promise(r => ws.on('open', r));

  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/' });

  // Wait 3 seconds for full load and animations
  await new Promise(r => setTimeout(r, 3000));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshot?.data) {
    fs.writeFileSync('scripts/live_view.png', Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot saved to scripts/live_view.png');
  } else {
    console.log('No screenshot data returned');
  }
} catch (err) {
  console.error('Error:', err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}
