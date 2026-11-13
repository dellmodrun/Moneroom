import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const origin = 'https://floatmine.xyz';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const textTypes = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.map']);
const assetExtensions = new Set(['.html', '.js', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.glb', '.gltf', '.bin', '.hdr', '.mp4', '.webm', '.wasm', '.map']);
const queue = [];
const queued = new Set();
const completed = new Set();
const failures = [];

function normalize(candidate, base = '/') {
  if (!candidate || /^(data:|blob:|mailto:|javascript:|#)/i.test(candidate)) return null;
  if (candidate.includes('${')) return null;
  if (/^(three(?:\/|$)|[a-z@][a-z0-9@_-]*$)/i.test(candidate)) return null;
  try {
    if (/^(?:assets|css|js|data|pairs)\//i.test(candidate)) candidate = '/' + candidate;
    const url = new URL(candidate, new URL(base, origin));
    if (url.origin !== origin) return null;
    url.hash = '';
    url.search = '';
    const ext = extname(url.pathname).toLowerCase();
    if (!assetExtensions.has(ext)) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function enqueue(candidate, base = '/') {
  const path = normalize(candidate, base);
  if (!path || queued.has(path)) return;
  queued.add(path);
  queue.push(path);
}

function discover(text, base) {
  const patterns = [
    /(?:src|href|poster|srcset)\s*=\s*["']([^"']+)["']/g,
    /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g,
    /url\(\s*["']?([^)'"\s]+)["']?\s*\)/g,
    /["'`](\/?(?:assets|css|js|data|pairs)\/[A-Za-z0-9_@%+.,~\-/]+\.(?:js|css|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|glb|gltf|bin|hdr|mp4|webm|wasm|map))["'`]/g,
    /["'`]([^"'`]+\.(?:js|css|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|glb|gltf|bin|hdr|mp4|webm|wasm|map))["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.split(/\s+/)[0];
      enqueue(value, base);
    }
  }
}

async function download(path) {
  const url = origin + path;
  const target = join(root, path.replace(/^\/+/, '').replaceAll('/', '\\'));
  try {
    await mkdir(dirname(target), { recursive: true });
    let bytes;
    try {
      bytes = await readFile(target);
      if (!bytes.length) throw new Error('empty');
    } catch {
      await run('curl.exe', [
        '--http1.1', '-A', userAgent, '-sS', '-L', '--fail', '--retry', '3',
        '--connect-timeout', '6', '--max-time', '20', url, '-o', target,
      ], { windowsHide: true, maxBuffer: 1024 * 1024 });
      bytes = await readFile(target);
    }
    completed.add(path);
    const ext = extname(path).toLowerCase();
    if (textTypes.has(ext)) {
      discover(new TextDecoder().decode(bytes), path);
    }
  } catch (error) {
    failures.push({ path, error: String(error?.message || error) });
  }
}

[
  '/index.html', '/css/app.css', '/css/mine.css', '/js/app.js', '/js/sol.js', '/js/wallet.js',
  '/js/island.js', '/js/filmmode.js', '/data/pairs.js',
  '/assets/brand/mark.svg', '/assets/brand/favicon-64.png', '/assets/brand/apple-icon.png',
  '/assets/brand/hero-poster.jpg', '/assets/brand/hero-poster-p.jpg', '/assets/brand/og.jpg',
].forEach(path => enqueue(path));

for (const pool of ['foundryusa', 'antpool', 'f2pool', 'viabtc', 'spiderpool', 'marapool', 'ocean', 'secpool', 'luxor', 'braiinspool', 'binancepool', 'cloverpool']) {
  enqueue(`/assets/mines/${pool}.svg`);
}

while (queue.length) {
  const batch = queue.splice(0, 12);
  await Promise.all(batch.map(download));
  if (completed.size % 60 < 12) process.stdout.write(`Mirrored ${completed.size} files\n`);
}

try {
  await mkdir(join(root, 'snapshots'), { recursive: true });
  await run('curl.exe', ['--http1.1', '-A', userAgent, '-sS', '-L', '--fail', '--retry', '3', '--max-time', '20', origin + '/api/coins', '-o', join(root, 'snapshots', 'coins.json')], { windowsHide: true });
} catch (error) {
  failures.push({ path: '/api/coins', error: String(error?.message || error) });
}

const report = {
  source: origin,
  mirroredAt: new Date().toISOString(),
  files: completed.size,
  failures,
};
await writeFile(join(root, 'mirror-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
