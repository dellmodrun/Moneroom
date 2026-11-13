import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const base = 'http://127.0.0.1:4397';
const port = 9538;
const profile = join(tmpdir(), `floatmine-qa-${Date.now()}`);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  '--use-angle=swiftshader', '--enable-webgl', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1440,1000', base + '/',
], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
const badResponses = [];
const exceptions = [];

try {
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      target = (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(item => item.type === 'page');
      if (target) break;
    } catch {}
    await sleep(250);
  }
  if (!target) throw new Error('Chrome target unavailable');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) failures.push(message.params.errorText);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) badResponses.push({ status: message.params.response.status, url: message.params.response.url });
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails?.text || 'Runtime exception');
  };
  const cdp = (method, params = {}) => new Promise(resolve => {
    const call = ++id;
    pending.set(call, resolve);
    socket.send(JSON.stringify({ id: call, method, params }));
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');

  const results = [];
  for (const path of ['/', '/create', '/tokens', '/mines', '/profile', '/docs', '/terms']) {
    if (path === '/') {
      await cdp('Page.navigate', { url: base + '/?qa=1' });
      await sleep(9000);
    } else {
      await cdp('Runtime.evaluate', { expression: `window.FMAPP.nav(${JSON.stringify(path)})` });
      await sleep(1800);
    }
    const response = await cdp('Runtime.evaluate', {
      expression: `JSON.stringify({path:location.pathname,title:document.title,heading:document.querySelector('h1,h2')?.innerText||'',textLength:document.body.innerText.length,viewLength:document.querySelector('#view')?.innerHTML.length||0,canvas:[...document.querySelectorAll('canvas')].map(c=>[c.width,c.height]),brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')).slice(0,20)})`,
      returnByValue: true,
    });
    results.push(JSON.parse(response.result.result.value));
    if (path === '/') {
      const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(new URL('../qa-home.png', import.meta.url), Buffer.from(shot.result.data, 'base64'));
    }
  }
  socket.close();
  const report = { results, failures: [...new Set(failures)], badResponses: badResponses.filter(item => item.url.startsWith(base)), exceptions: [...new Set(exceptions)] };
  await writeFile(new URL('../qa-report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  chrome.kill();
}
