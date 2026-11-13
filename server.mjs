import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4397);
const upstream = 'https://floatmine.xyz';
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.map': 'application/json; charset=utf-8',
};

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = normalize(join(root, decoded));
  return target.startsWith(normalize(root)) ? target : null;
}

async function sendFile(res, path, cache = false) {
  const body = await readFile(path);
  res.writeHead(200, {
    'content-type': mime[extname(path).toLowerCase()] || 'application/octet-stream',
    'cache-control': cache ? 'public, max-age=3600' : 'no-cache',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

async function proxyApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/coins') {
    try {
      const snapshot = JSON.parse(await readFile(join(root, 'snapshots', 'coins.json'), 'utf8'));
      for (const coin of snapshot.coins || []) {
        const match = String(coin.image || '').match(/\/i\/([^/?#]+)/);
        if (match) coin.image = `/assets/coins/${match[1]}.png`;
      }
      const body = JSON.stringify(snapshot);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(body);
    } catch {}
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = {};
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    const response = await fetch(upstream + url.pathname + url.search, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(45_000),
    });
    const body = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Upstream API unavailable: ${error.message}` }));
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname.startsWith('/api/')) return proxyApi(req, res, url);

  try {
    const target = safePath(url.pathname === '/' ? '/index.html' : url.pathname);
    if (target && (await stat(target)).isFile()) return sendFile(res, target, true);
  } catch {}

  if (!extname(url.pathname)) {
    try { return await sendFile(res, join(root, 'index.html')); } catch {}
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Floatmine local mirror: http://127.0.0.1:${port}/`);
});
