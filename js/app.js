/* Moneroom · the app: router, views (home with the island story, launch, explore, coin, mines, profile, docs),
 * live pool data (mempool.space) and live $FLOAT (DexScreener, GeckoTerminal), and the real Float launch:
 * one wallet signature, the coin's creator share of fees routed to its own mining vault. */
import { PAIRS } from '../data/pairs.js';
import * as S from './sol.js';
import * as WAL from './wallet.js';

const DEFAULT_CFG = window.FM || {};
const REMOTE_CONFIG_URL = 'https://api.github.com/repos/dellmodrun/Moneroom/contents/ca.json?ref=ca-config';

async function readRemoteConfig() {
  try {
    const response = await fetch(`${REMOTE_CONFIG_URL}&v=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`remote config ${response.status}`);
    const payload = await response.json();
    const remote = JSON.parse(atob(String(payload.content || '').replace(/\s/g, '')));
    return { ...DEFAULT_CFG, ...remote };
  } catch (error) {
    console.warn('Using embedded Moneroom config:', error);
    return { ...DEFAULT_CFG };
  }
}

const CFG = await readRemoteConfig();
window.FM = CFG;

// Keep already-open launch pages in sync when the published CA changes.
setInterval(async () => {
  const next = await readRemoteConfig();
  if ((next.ca || '') !== (CFG.ca || '') || (next.caLabel || '') !== (CFG.caLabel || '')) {
    location.reload();
  }
}, 60000);
const BASE_PATH = '/Moneroom';
const Q0 = new URLSearchParams(location.search);
const FILM = Q0.get('film') || '';
const FILM_ADDR = FILM ? '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' : '';
const wAddr = () => FILM_ADDR || WAL.address();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (a, n = 6) => a ? (a.length > 2 * n + 1 ? a.slice(0, n) + '…' + a.slice(-n) : a) : '';
const VIEW = $('#view');
const FMAPP = window.FMAPP = {};
const byId = new Map(PAIRS.map(p => [p.id, p]));
const byMint = new Map(); PAIRS.forEach(p => { if (!byMint.has(p.mint)) byMint.set(p.mint, p); });
const pairOf = c => byId.get(c.pair) || byMint.get(c.quoteMint) || null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const FLOAT_MINT = 'Bv1a7cEj5aRnJQhMw4kRQqAFesMSd5LwcDnUzq52BMmr';

// the twelve pools a Moneroom coin can mine with (slugs as mempool.space names them)
export const POOLS = [
  { s: 'foundryusa', n: 'Foundry USA', dark: 1 }, { s: 'antpool', n: 'AntPool' }, { s: 'f2pool', n: 'F2Pool' }, { s: 'viabtc', n: 'ViaBTC' },
  { s: 'spiderpool', n: 'SpiderPool' }, { s: 'marapool', n: 'MARA Pool' }, { s: 'ocean', n: 'OCEAN' }, { s: 'secpool', n: 'SECPOOL' },
  { s: 'luxor', n: 'Luxor' }, { s: 'braiinspool', n: 'Braiins' }, { s: 'binancepool', n: 'Binance Pool' }, { s: 'cloverpool', n: 'CloverPool' },
];
const poolOf = s => POOLS.find(p => p.s === s) || POOLS[0];

// ---------------------------------------------------------------- formatting
const usd = (n, d) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(2) + 'K';
  return s + '$' + a.toFixed(d ?? 2);
};
const price = n => {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (n >= 1) return '$' + n.toFixed(n >= 100 ? 2 : 3);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toPrecision(3);
};
const pct = (n, d = 2) => (n == null || !isFinite(n)) ? '—' : (n >= 0 ? '+' : '') + (n * 100).toFixed(d) + '%';
const cls = n => n > 0 ? 'good' : n < 0 ? 'bad' : 'muted';
const hashrate = h => { if (!h || !isFinite(h)) return '—'; const u = [['ZH/s', 1e21], ['EH/s', 1e18], ['PH/s', 1e15], ['TH/s', 1e12]]; for (const [k, v] of u) if (h >= v) return (h / v).toFixed(h / v >= 100 ? 0 : h / v >= 10 ? 1 : 2) + ' ' + k; return h.toFixed(0) + ' H/s'; };
const ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9h10v10H9zM5 15V5h10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.1 1.4 11.6c-1-.3-1-1 .2-1.5L20.5 2.9c.9-.3 1.6.2 1.4 1.4z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4.35-4.35"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};
const logo = (p, size = 26) => p && p.logo ? `<img src="${p.logo}" alt="" width="${size}" height="${size}" loading="lazy">` : `<span class="ini" style="width:${size}px;height:${size}px">${esc((p && p.t || '?').slice(0, 2))}</span>`;
const poolTile = (pl, size = 40) => `<span class="ptile${pl.dark ? ' dk' : ''}" style="width:${size}px;height:${size}px"><img src="assets/mines/${pl.s}.svg" alt="" loading="lazy"></span>`;
const floatTok = (size = 18) => `<img class="ftok" src="assets/brand/float-mark.png" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
const catLabel = th => ({ xStock: 'xStock', Sunrise: 'Sunrise', PreStock: 'PreStock', Crypto: 'Crypto', Leverage: 'Leverage', Commodity: 'Commodity', Basket: 'Basket', Tessera: 'Tessera', Custom: 'Custom' })[th] || th;

// ---------------------------------------------------------------- toast, modal, copy
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (_) { toast(t); } }
function modal(html, opts = {}) { const sc = $('#scrim'), m = $('#modal'); m.innerHTML = html; sc.classList.add('on'); sc.onclick = e => { if (e.target === sc && !opts.sticky) closeModal(); }; return m; }
function closeModal() { $('#scrim').classList.remove('on'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) { e.preventDefault(); e.stopPropagation(); copy(c.dataset.copy); } });

// ---------------------------------------------------------------- live data: coins, pools, $FLOAT
const live = { coins: [], pools: null, net: null, float: null, floatCs: null, own: null, ownK: '', subs: new Set() };
const emit = k => live.subs.forEach(f => { try { f(k); } catch (e) { console.warn(e); } });
async function refreshCoins() { try { const j = await fetch('/api/coins').then(r => r.json()); if (Array.isArray(j.coins)) { live.coins = j.coins; emit('coins'); } } catch (_) { } }
async function refreshPools() {
  try {
    const j = await fetch('https://mempool.space/api/v1/mining/pools/1w').then(r => r.json());
    const tot = j.blockCount || j.pools.reduce((s, p) => s + p.blockCount, 0), net = j.lastEstimatedHashrate || 0, m = {};
    for (const p of j.pools) m[p.slug] = { blocks: p.blockCount, share: p.blockCount / tot, rank: p.rank, hr: net * p.blockCount / tot, name: p.name };
    live.pools = { m, all: j.pools.map(p => ({ slug: p.slug, name: p.name, blocks: p.blockCount, share: p.blockCount / tot, hr: net * p.blockCount / tot, rank: p.rank })), tot, net };
    emit('pools');
  } catch (_) { }
}
async function refreshFloat() {
  try {
    const j = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + FLOAT_MINT).then(r => r.json());
    const ps = (j.pairs || []).filter(p => p.baseToken && p.baseToken.address === FLOAT_MINT).sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0));
    if (!ps.length) return; const p = ps[0];
    live.float = { price: +p.priceUsd, chg: (p.priceChange && p.priceChange.h24 != null) ? p.priceChange.h24 / 100 : null, mcap: p.marketCap || p.fdv, liq: (p.liquidity || {}).usd, vol: (p.volume || {}).h24, pair: p.pairAddress, url: p.url };
    emit('float');
    if (!live.floatCs) refreshFloatChart();
  } catch (_) { }
}
async function refreshFloatChart() {
  if (!live.float || !live.float.pair) return;
  try {
    const j = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${live.float.pair}/ohlcv/hour?aggregate=1&limit=168`).then(r => r.json());
    const L = (j.data && j.data.attributes && j.data.attributes.ohlcv_list) || []; live.floatCs = L.map(r => ({ t: r[0], c: +r[4] })).reverse(); emit('floatcs');
  } catch (_) { }
}
// the site's own coin (CFG.ca, a pump.fun coin): LAUNCHING until DexScreener lists a pair for it, then LIVE with its real data
async function refreshOwn() {
  if (!CFG.ca) return;
  let next;
  try {
    const j = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CFG.ca).then(r => r.json());
    const ps = (j.pairs || []).filter(p => p.baseToken && p.baseToken.address === CFG.ca).sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0) || (b.marketCap || 0) - (a.marketCap || 0));
    const p = ps[0];
    next = p ? { status: 'live', ticker: p.baseToken.symbol || '', name: p.baseToken.name || '', mcapS: usd(p.marketCap || p.fdv), image: (p.info && p.info.imageUrl) || '' } : { status: 'launching' };
  } catch (_) { if (live.own) return; next = { status: 'launching' }; }
  const k = JSON.stringify(next); if (k !== live.ownK) { live.own = next; live.ownK = k; emit('own'); }
}
refreshCoins(); refreshPools(); refreshFloat(); refreshOwn();
if (!FILM) { setInterval(refreshCoins, 20000); setInterval(refreshPools, 120000); setInterval(refreshFloat, 30000); setInterval(refreshFloatChart, 600000); setInterval(refreshOwn, 20000); }

// ---------------------------------------------------------------- wallet button + picker
function walletBtn() { const b = $('#wbtn'), a = wAddr(), ic = FILM ? 'assets/brand/moneroom-logo.png' : WAL.walletIcon(); b.innerHTML = a ? `${ic ? `<img src="${esc(ic)}" alt="">` : ''}${short(a, 4)}` : 'Select Wallet'; }
WAL.onChange(() => { walletBtn(); rerenderOnWallet(); });
WAL.onWallets(walletBtn);
$('#wbtn').onclick = () => wAddr() ? walletMenu() : pickWallet();
function walletMenu() {
  const a = wAddr();
  const m = modal(`<h3>Wallet</h3><p class="mono">${esc(short(a, 8))}</p><div class="wl"><button data-copy="${esc(a)}">Copy address</button><a href="/profile" data-link>Your coins</a><button id="wdis">Disconnect</button></div>`);
  $('#wdis', m).onclick = () => { WAL.disconnect(); closeModal(); };
  m.querySelectorAll('[data-link]').forEach(l => l.addEventListener('click', closeModal));
}
function pickWallet() {
  return new Promise(res => {
    const pr = WAL.problem();
    if (pr) { modal(`<h3>Connect a wallet</h3><p>${esc(pr.text)}</p><div class="wl">${(pr.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noreferrer">${esc(l.label)}</a>`).join('')}</div><button class="mx" id="mx">Close</button>`); $('#mx').onclick = () => { closeModal(); res(null); }; return; }
    const m = modal(`<h3>Connect a wallet</h3><p>Connecting shares your public address only.</p><div class="wl">${WAL.wallets().map(w => `<button data-w="${esc(w.name)}"><img src="${esc(w.icon)}" alt="">${esc(w.name)}<small>Solana</small></button>`).join('')}</div><button class="mx" id="mx">Cancel</button>`);
    $('#mx', m).onclick = () => { closeModal(); res(null); };
    m.querySelectorAll('[data-w]').forEach(b => b.onclick = async () => { try { await WAL.connect(b.dataset.w); closeModal(); res(wAddr()); } catch (e) { toast(e.message); } });
  });
}

// ---------------------------------------------------------------- router
let cleanup = [];
const onLeave = f => cleanup.push(f);
function nav(path, push = true) {
  const route = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) || '/' : path;
  if (push) history.pushState({}, '', `${BASE_PATH}${route === '/' ? '/' : route}`);
  render();
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const u = new URL(a.href, location.href); if (u.origin !== location.origin) return;
  e.preventDefault(); if (u.pathname + u.search !== location.pathname + location.search) nav(u.pathname + u.search); else window.scrollTo({ top: 0, behavior: 'smooth' });
});
addEventListener('popstate', () => render());
let rerenderOnWallet = () => { };
function render() {
  cleanup.forEach(f => { try { f(); } catch (_) { } }); cleanup = []; live.subs.clear(); rerenderOnWallet = () => { };
  const pathname = location.pathname.startsWith(BASE_PATH) ? location.pathname.slice(BASE_PATH.length) : location.pathname;
  const p = pathname.replace(/\/+$/, '') || '/';
  const tab = p === '/' ? 'home' : p.startsWith('/create') ? 'create' : p.startsWith('/tokens') ? 'tokens' : p.startsWith('/mines') ? 'mines' : p.startsWith('/profile') ? 'profile' : '';
  $$('.dock a').forEach(a => a.classList.toggle('on', a.dataset.nav === tab));
  document.body.classList.toggle('on-home', p === '/');
  if (p !== '/') window.scrollTo(0, 0);
  if (p === '/') return viewHome();
  if (p === '/create') return viewCreate();
  if (p === '/tokens') return viewExplore();
  if (p.startsWith('/tokens/')) return viewCoin(decodeURIComponent(p.slice(8)));
  if (p === '/mines') return viewMines();
  if (p === '/profile') return viewProfile();
  if (p === '/docs') return viewDocs();
  if (p === '/terms') return viewTerms();
  VIEW.innerHTML = `<div class="page"><h1 class="ph1">Not found</h1><p class="psub">This page does not exist. <a href="/" data-link class="lnk">Go home</a></p></div>`;
}
function reveal(root) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv', root).forEach(el => io.observe(el)); onLeave(() => io.disconnect());
}
function fitCanvas(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return { w, h, d }; }
function smooth(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); } }

// ---------------------------------------------------------------- shared pieces
function coinCard(c, extra = '') {
  const p = pairOf(c), pl = poolOf(c.mine), st = c.status === 'graduated' ? 'Graduated' : '';
  const prog = c.status !== 'graduated' && c.progress != null ? `<i class="bar" style="width:${Math.max(2, Math.min(100, c.progress * 100)).toFixed(1)}%"></i>` : '';
  return `<a class="cc ${extra}" href="/tokens/${esc(c.mint)}" data-link aria-label="$${esc(c.ticker)}">
    <span class="wmk" aria-hidden="true">${p && p.logo ? `<img src="${p.logo}" alt="">` : esc((p && p.t) || '')}</span>
    <img class="av" src="${esc(c.image || 'assets/brand/moneroom-logo.png')}" alt="" width="36" height="36" loading="lazy">
    <div style="position:relative"><div class="tk">$${esc(c.ticker)}</div><div class="fdv">${c.fdvUsd ? usd(c.fdvUsd) : usd(20000)}</div>
    <div class="anc">Paired with <span>${p && p.logo ? `<img src="${p.logo}" alt="">` : ''}${esc(p ? p.t : '')}</span></div></div>
    <span class="minechip">${poolTile(pl, 18)}${esc(pl.n)}</span>${extra.includes('live') ? '<span class="livechip"><i></i>LIVE</span>' : ''}${st ? `<span class="st">${st}</span>` : ''}${prog}</a>`;
}
// the project's own coin, pinned first: a pump.fun coin, so it links out to pump.fun (card) and DexScreener (Chart)
const PUMP_IMG = m => `https://images.pump.fun/coin-image/${m}?variant=86x86`;
function ownCard() {
  if (!CFG.ca || live.coins.some(c => c.mint === CFG.ca)) return '';
  const o = live.own || { status: 'launching' }, on = o.status === 'live', sol = byId.get('SOL');
  const tk = String(o.ticker || 'MONEROOM').replace(/^\$/, '').toUpperCase(), fb = 'assets/brand/moneroom-logo.png';
  const body = `<span class="wmk" aria-hidden="true"><img src="${fb}" alt=""></span>
    <img class="av" src="${esc(on ? (o.image || PUMP_IMG(CFG.ca)) : fb)}" alt="" width="36" height="36" onerror="this.onerror=null;this.src='${fb}'">
    <div style="position:relative"><div class="tk">$${esc(tk)}</div><div class="fdv">${on ? esc(o.mcapS || '—') : 'Launching'}</div>
    <div class="anc">Paired with <span>${sol && sol.logo ? `<img src="${sol.logo}" alt="">` : ''}SOL</span></div></div>
    <span class="minechip ownchip"><img src="assets/brand/moneroom-logo.png" alt="">Official</span>
    <span class="ownact">${on ? `<span class="ownchart" role="link" tabindex="0" data-ext="https://dexscreener.com/solana/${esc(CFG.ca)}">Chart</span>` : ''}<span class="livechip${on ? '' : ' soon'}"><i></i>${on ? 'LIVE' : 'LAUNCHING'}</span></span>`;
  return on ? `<a class="cc live own" href="https://pump.fun/coin/${esc(CFG.ca)}" target="_blank" rel="noreferrer" aria-label="$${esc(tk)} on pump.fun">${body}</a>`
    : `<div class="cc live own soon" aria-label="$${esc(tk)} is launching">${body}</div>`;
}
document.addEventListener('click', e => { const x = e.target.closest('[data-ext]'); if (x) { e.preventDefault(); e.stopPropagation(); window.open(x.dataset.ext, '_blank', 'noopener'); } }, true);
function openSlots(n) { return Array.from({ length: n }, () => `<a class="cc open" href="/create" data-link><span class="plus">${ICON.plus}</span><b>Open mine</b><small>Launch a coin to start it</small></a>`).join(''); }
function heroPill() {
  if (CFG.ca) return `<div class="capill"><img src="assets/brand/moneroom-logo.png" alt=""><b>$MONEROOM</b><button class="cpy" data-copy="${esc(CFG.ca)}" aria-label="Copy the contract address">${short(CFG.ca, 5)}<span style="width:13px;height:13px;display:inline-flex">${ICON.copy}</span></button><a class="chip" href="https://dexscreener.com/solana/${esc(CFG.ca)}" target="_blank" rel="noreferrer">Chart</a></div>`;
  return `<div class="capill"><img src="assets/brand/moneroom-logo.png" alt=""><b>$MONEROOM</b><span class="cpy" aria-label="Contract address to be announced">CA&nbsp;&nbsp;${esc(CFG.caLabel || 'TBA')}</span></div>`;
}
function hdrCa() { const r = $('.hdr-r'), label = CFG.ca || CFG.caLabel; if (!label || $('#hdrca')) return; const el = document.createElement(CFG.ca ? 'button' : 'span'); el.id = 'hdrca'; el.className = 'pill ca-hdr mono'; if (CFG.ca) el.dataset.copy = CFG.ca; el.innerHTML = `CA ${CFG.ca ? short(CFG.ca, 4) : esc(label)}`; r.insertBefore(el, r.firstChild); }
const poolLive = s => live.pools && live.pools.m[s];

// ================================================================ HOME
const STEPS = [
  { k: '01 · Launch', h: 'Launch on Float.', p: 'Every Moneroom coin is a real Float coin: launched through Float’s own program, paired with any Float asset, and graduated into a Raydium pool with liquidity locked forever.', x: 'pair' },
  { k: '02 · Rigs', h: 'Fees power real rigs.', p: 'Float sends each coin’s creator share of trading fees to the coin’s own mining vault. The vault rents hashrate from industrial rigs and points it at the pool chosen at launch.', x: 'pools' },
  { k: '03 · $FLOAT', h: 'Rewards become $FLOAT.', p: 'Everything the rigs earn is swapped to $FLOAT on the open market, every cycle.', x: 'float' },
  { k: '04 · Holders', h: 'Paid to holders, automatically.', p: 'The $FLOAT goes straight to the coin’s holders, pro rata to their bags. Nothing to claim and nothing to stake, on top of Float’s own holder rewards.', x: 'holders' },
];
function viewHome() {
  const hero = $('#home-hero'), heroHtml = hero ? hero.outerHTML : '';
  const stepX = x => x === 'pools' ? `<div class="mx-pools">${POOLS.slice(0, 6).map(p => poolTile(p, 30)).join('')}<span>+6 more</span></div>`
    : x === 'float' ? `<div class="mx-float">${floatTok(22)}<b>$FLOAT</b><span id="st-fp">—</span><span id="st-fc" class="muted">—</span></div>`
      : x === 'pair' ? `<div class="mx-pairs">${['SOL', 'HYPE', 'TSLA', 'NVDA', 'SPCX', 'ZEC'].map(t => PAIRS.find(p => p.t === t)).filter(Boolean).map(p => logo(p, 26)).join('')}<span>${PAIRS.length} Float pairs</span></div>`
        : `<div class="mx-hold"><span>${floatTok(20)}</span><b>$FLOAT</b><span class="muted">to every holder</span></div>`;
  VIEW.innerHTML = `<div class="mwrap" id="mwrap" style="--steps:${STEPS.length}">${heroHtml}</div>
  <section class="sec" id="pools">
    <div class="rv secrow"><div><div class="sec-k">The pools</div><h2 class="sec-h">Mining with the largest pools in the world.</h2><p class="sec-p">Each coin picks one pool at launch. Its rigs mine there, and every reward is converted to $FLOAT for its holders.</p></div><div class="netchip" id="netchip"><span class="dot"></span>Network <b id="net-hr">—</b></div></div>
    <div class="pgrid12 rv" id="pgrid">${POOLS.map(p => `<a class="poolc" href="/create?pool=${p.s}" data-link data-pool="${p.s}">${poolTile(p, 46)}<div class="pc-n"><b>${esc(p.n)}</b><small data-f="share">— of blocks this week</small></div><div class="pc-b"><span data-f="hr">—</span><span data-f="blocks">—</span></div></a>`).join('')}</div>
  </section>
  <section class="sec">
    <div class="flc grad rv" id="flc">
      <div class="flc-l">
        <div class="sec-k">Paid in $FLOAT</div>
        <h2 class="sec-h" style="margin-top:.5rem">Every reward lands as $FLOAT.</h2>
        <p class="sec-p">The rigs’ output is swapped to $FLOAT, Float’s own token, and sent to holders. A third of every Float fee already buys back and burns $FLOAT.</p>
        <div class="flc-px"><span>${floatTok(30)}</span><b id="fl-p">—</b><em id="fl-c" class="muted">—</em></div>
        <div class="flc-st"><div><small>Market cap</small><b id="fl-m">—</b></div><div><small>Liquidity</small><b id="fl-l">—</b></div><div><small>24h volume</small><b id="fl-v">—</b></div></div>
        <div class="flc-a"><a class="btn-ghost" id="fl-chart" href="https://dexscreener.com/solana/${FLOAT_MINT}" target="_blank" rel="noreferrer">Chart ${ICON.ext}</a><a class="btn-ghost" href="https://www.floatlaunch.xyz" target="_blank" rel="noreferrer">Float ${ICON.ext}</a></div>
      </div>
      <div class="flc-r"><canvas id="fl-cv" aria-label="$FLOAT, last 7 days"></canvas><span class="flc-k">$FLOAT · 7 days</span></div>
    </div>
  </section>
  <section class="sec">
    <div class="rv secrow"><div><div class="sec-k">Live mines</div><h2 class="sec-h">Coins mining on Moneroom.</h2><p class="sec-p">Real Float coins whose fees run rigs for their holders.</p></div><a class="btn-ghost" href="/tokens" data-link>Explore</a></div>
    <div class="grid3 rv" id="home-coins"></div>
  </section>
  <section class="sec">
    <div class="rv"><div class="sec-k">Where the fees go</div><h2 class="sec-h">Float splits every fee. Moneroom mines with its share.</h2><p class="sec-p">The split is set by Float’s program and is the same for every Float coin. On Moneroom, the creator share runs the coin’s mine.</p></div>
    <div class="split2 card rv">
      <div class="sbar"><i style="flex:15" class="s1"></i><i style="flex:5" class="s2"></i><i style="flex:35" class="s3"></i><i style="flex:35" class="s4"></i><i style="flex:10" class="s5"></i></div>
      <div class="slegend">
        <div><b>15%</b><span>Holders</span><small>Paid by Float in the pair token.</small></div>
        <div class="hot"><b>5%</b><span>The mine</span><small>The coin’s mining vault. Rewards go to holders in $FLOAT.</small></div>
        <div><b>35%</b><span>$FLOAT burn</span><small>Float buys back and burns $FLOAT.</small></div>
        <div><b>35%</b><span>Traders</span><small>Float’s airdrop to top traders.</small></div>
        <div><b>10%</b><span>Treasury</span><small>Float’s treasury.</small></div>
      </div>
    </div>
  </section>
  <section class="sec">
    <div class="ctaband rv"><img src="assets/brand/cta-island.jpg" alt="" loading="lazy"><div><h2>Open your mine on Float.</h2><p>Pick a pair and a pool. Your wallet signs one Float launch, and the coin starts mining $FLOAT for its holders.</p><a class="cta" href="/create" data-link style="margin-top:1.25rem">START MINING</a></div></div>
  </section>
  <footer class="site-foot">
    <a class="pwr" style="margin:0" href="https://www.floatlaunch.xyz" target="_blank" rel="noreferrer">Built on <span><img src="assets/brand/float-mark.png" alt="">Float</span></a>
    <nav class="foot-links"><a href="/docs" data-link>Docs</a>·<a href="/terms" data-link>Terms of Use</a>·<a href="${CFG.x ? 'https://x.com/' + esc(CFG.x) : 'https://x.com'}" target="_blank" rel="noreferrer">X</a></nav>
    <p class="faint" style="font-size:.75rem;text-align:center">Memecoins are risky. Nothing here is financial advice.</p>
  </footer>`;
  // story panels go inside the pinned hero
  const hs = $('#home-hero');
  hs.insertAdjacentHTML('beforeend', STEPS.map((s, i) => `<div class="mstep" data-i="${i + 1}"><span class="mk">${esc(s.k)}</span><h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>${stepX(s.x)}</div>`).join('') + `<div class="mprog" aria-hidden="true">${STEPS.map((_, i) => `<i data-i="${i + 1}"></i>`).join('')}</div><a class="mscroll" href="#pools" aria-label="Scroll"><i></i></a>`);
  $('#hero-pill').innerHTML = heroPill(); hdrCa(); reveal(VIEW);
  islandStory();

  // pools
  const pools = () => {
    const P = live.pools; if (!P) return; $('#net-hr').textContent = hashrate(P.net);
    $$('#pgrid [data-pool]').forEach(a => { const d = P.m[a.dataset.pool]; const set = (f, v) => { const e = $(`[data-f="${f}"]`, a); if (e && e.textContent !== v) e.textContent = v; }; set('share', d ? (d.share * 100).toFixed(1) + '% of blocks this week' : 'Fewer than 1 block this week'); set('hr', d ? hashrate(d.hr) : '—'); set('blocks', d ? d.blocks + (d.blocks === 1 ? ' block' : ' blocks') : '0 blocks'); });
  };
  // $FLOAT
  const fl = () => {
    const f = live.float; if (!f) return;
    $('#fl-p').textContent = price(f.price); const c = $('#fl-c'); c.textContent = pct(f.chg) + ' 24h'; c.className = cls(f.chg);
    $('#fl-m').textContent = usd(f.mcap); $('#fl-l').textContent = usd(f.liq); $('#fl-v').textContent = usd(f.vol); if (f.url) $('#fl-chart').href = f.url;
    const sp = $('#st-fp'), sc = $('#st-fc'); if (sp) { sp.textContent = price(f.price); sc.textContent = pct(f.chg) + ' 24h'; sc.className = cls(f.chg); }
  };
  const flChart = () => {
    const cv = $('#fl-cv'), cs = live.floatCs; if (!cv) return; const { w, h, d } = fitCanvas(cv), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    if (!cs || cs.length < 3) return;
    const vs = cs.map(c => c.c), mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * .14 || mx * .05;
    const X = i => 8 * d + (w - 16 * d) * i / (cs.length - 1), Y = v => h - 28 * d - (h - 56 * d) * (v - mn + pad) / (mx - mn + 2 * pad);
    const pts = cs.map((c, i) => [X(i), Y(c.c)]);
    ctx.beginPath(); smooth(ctx, pts); ctx.lineTo(pts[pts.length - 1][0], h); ctx.lineTo(pts[0][0], h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,106,0,.28)'); g.addColorStop(1, 'rgba(255,106,0,0)'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.shadowColor = 'rgba(120,170,255,.8)'; ctx.shadowBlur = 12 * d; ctx.beginPath(); smooth(ctx, pts); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * d; ctx.stroke(); ctx.restore();
    const L = pts[pts.length - 1]; ctx.beginPath(); ctx.arc(L[0], L[1], 4.5 * d, 0, 7); ctx.fillStyle = '#ff6a00'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * d; ctx.stroke();
  };
  const ro = new ResizeObserver(flChart); ro.observe($('#fl-cv')); onLeave(() => ro.disconnect());
  // coins
  const coins = () => {
    const el = $('#home-coins'); if (!el) return;
    const own = ownCard(), mine = live.coins.filter(c => c.mint === CFG.ca), rest = live.coins.filter(c => c.mint !== CFG.ca), list = mine.concat(rest).slice(0, own ? 5 : 6);
    const key = (own ? live.ownK || 'launching' : '') + '|' + list.map(c => c.mint + (c.fdvUsd | 0)).join();
    if (el.dataset.k !== key) { el.innerHTML = own + list.map(c => coinCard(c, c.mint === CFG.ca ? 'live' : '')).join('') + openSlots(Math.max(0, 3 - list.length - (own ? 1 : 0))); el.dataset.k = key; }
  };
  pools(); fl(); flChart(); coins();
  live.subs.add(k => { if (k === 'pools') pools(); else if (k === 'float') fl(); else if (k === 'floatcs') flChart(); else if (k === 'coins' || k === 'own') coins(); });
}

// the island: pinned behind the hero; scrolling flies the camera through launch, rigs, $FLOAT and holders
async function islandStory() {
  const cv = $('#isl'), wrap = $('#mwrap'), hero = $('#home-hero'), poster = $('#mposter');
  if (!cv || !wrap) return;
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch (_) { return false; } })();
  if (!gl) return;
  let st, alive = true; onLeave(() => { alive = false; });
  await new Promise(r => setTimeout(r, FILM ? 0 : 60));
  try { const m = await import('./island.js'); st = await m.createIsland(cv, { dpr: Math.min(devicePixelRatio || 1, 1.35), shadowSize: 2048, samples: 4, base: `${BASE_PATH}/`, shadowEvery: 3, beamH: 120, night: !/[?&]day/.test(location.search), lamps: false, bloom: .5, bloomT: 1.05 }); }
  catch (e) { console.warn('island', e); return; }
  if (!alive || !document.body.contains(cv)) { try { st.renderer.dispose(); } catch (_) { } return; }
  const THREE = await import('three');
  const K = ['sHero', 'sLaunch', 'sRigs', 'sCore', 'sHolders'].map(k => st.shots[k]);
  const C0 = new THREE.Vector3(102, 50, 102);
  let cur = 0, want = 0, last = performance.now(), mx = 0, my = 0, fr = 0, slow = 0, dpr = Math.min(devicePixelRatio || 1, 1.35), vis = true;
  const size = () => { const w = cv.clientWidth, h = cv.clientHeight; if (w && h) st.resize(w, h); };
  size(); const ro = new ResizeObserver(size); ro.observe(cv);
  const onScroll = () => { const r = wrap.getBoundingClientRect(), span = wrap.offsetHeight - innerHeight; want = clamp(-r.top / Math.max(1, span), 0, 1) * STEPS.length; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const onMove = e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; }; addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }); io.observe(wrap);
  onLeave(() => { removeEventListener('scroll', onScroll); removeEventListener('pointermove', onMove); ro.disconnect(); io.disconnect(); try { st.renderer.dispose(); st.renderer.forceContextLoss(); } catch (_) { } });
  const P = new THREE.Vector3(), T = new THREE.Vector3(), tmp = new THREE.Vector3();
  const panels = $$('.mstep', hero), dots = $$('.mprog i', hero), heroC = $('.mhero-c', hero), scrollCue = $('.mscroll', hero);
  const t0 = performance.now();
  const frame = now => {
    if (!alive) return; requestAnimationFrame(frame);
    if (!vis || document.hidden) { last = now; return; }
    const dt = clamp((now - last) / 1000, 0, .1); last = now;
    cur += (want - cur) * (1 - Math.exp(-dt / .32));
    const t = (now - t0) / 1000, portrait = cv.clientWidth < cv.clientHeight * .9;
    // camera between keyframes, with a lift on the way so it never cuts through the rim
    cur = clamp(cur, 0, STEPS.length); const i = clamp(Math.floor(cur), 0, K.length - 2), f = clamp(cur - i, 0, 1), e = f * f * (3 - 2 * f), a = K[i], b = K[i + 1];
    P.copy(a.p).lerp(b.p, e); T.copy(a.t).lerp(b.t, e); P.y += Math.sin(Math.PI * e) * 26;
    const fov = a.fov + (b.fov - a.fov) * e;
    // hero: a slow orbit; everywhere: a little mouse parallax
    const orb = (1 - clamp(cur, 0, 1)) * t * .028; if (orb) { tmp.copy(P).sub(C0); tmp.applyAxisAngle(new THREE.Vector3(0, 1, 0), orb); P.copy(C0).add(tmp); }
    P.x += mx * 2.2; P.y -= my * 1.4;
    if (portrait) { const hk = clamp(1 - cur, 0, 1); T.y += 34 * hk; tmp.copy(P).sub(T).multiplyScalar(1.25 + .62 * hk); P.copy(T).add(tmp); }
    st.setCam(P, T, portrait ? fov + 8 : fov);
    // desktop: steps sit on the left, so the subject moves right
    const w = cv.clientWidth, h = cv.clientHeight, shift = portrait ? 0 : clamp(cur, 0, 1) * .17;
    if (shift > .001) st.camera.setViewOffset(w, h, -w * shift, 0, w, h); else if (st.camera.view) st.camera.clearViewOffset();
    st.update(t); st.render();
    // poster -> live picture
    if (++fr === 2) { cv.classList.add('on'); if (poster) setTimeout(() => poster.remove(), 900); }
    // text
    heroC.style.opacity = String(clamp(1 - cur * 2.2, 0, 1)); heroC.style.transform = `translateY(${-cur * 60}px)`; heroC.style.pointerEvents = cur > .3 ? 'none' : '';
    if (scrollCue) scrollCue.style.opacity = String(clamp(1 - cur * 3, 0, 1));
    panels.forEach(p => { const k = +p.dataset.i, v = clamp(1 - Math.abs(cur - k) / .55, 0, 1); p.style.opacity = String(v); p.style.setProperty('--dy', ((cur - k) * -40).toFixed(1) + 'px'); p.style.visibility = v > .01 ? 'visible' : 'hidden'; });
    dots.forEach(d => d.classList.toggle('on', Math.round(cur) === +d.dataset.i));
    // keep it smooth: drop resolution if frames stay slow
    if (dt > .028) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 45 && dpr > .7) { dpr = Math.max(.7, dpr - .2); st.renderer.setPixelRatio(dpr); size(); slow = 0; }
  };
  if (st.precompile) await st.precompile(); if (!alive) return;
  requestAnimationFrame(frame);
  FMAPP.island = st;
}

// ================================================================ CREATE
const CATS = ['All', 'Crypto', 'xStock', 'Sunrise', 'PreStock', 'Basket', 'Leverage', 'Commodity', 'Custom'];
function viewCreate() {
  const q = new URLSearchParams(location.search);
  const F = FMAPP.F = { pair: byId.get(q.get('pair')) || null, mine: POOLS.some(p => p.s === q.get('pool')) ? q.get('pool') : 'foundryusa', ticker: '', name: '', file: null, preview: '', web: '', x: '', tg: '', desc: '', tier: 0, buy: '', cat: 'All', find: '' };
  VIEW.innerHTML = `<div class="page">
  <h1 class="ph1">Launch a mine on Float</h1>
  <p class="psub">A real Float coin, paired with a Float asset. Its fees run mining rigs, and every reward goes to holders in $FLOAT.</p>
  <div class="cgrid"><div>
    <section class="card step"><div class="step-h"><span class="num-c">1</span><div><h2>Pick your pairing asset</h2><p>Your token trades against it on Float. Float pays holders in it too.</p></div></div>
      <input class="inp" id="c-find" style="margin-top:1rem" placeholder="Search ${PAIRS.length} markets, or paste a token address">
      <div class="chips" id="c-cats">${CATS.filter(c => c === 'All' || PAIRS.some(p => p.th === c)).map(c => `<button class="${c === 'All' ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
      <div class="assets" id="c-assets"></div>
    </section>
    <section class="card step"><div class="step-h"><span class="num-c">2</span><div><h2>Choose the mining pool</h2><p>Your coin’s rigs mine with this pool. Every reward is converted to $FLOAT.</p></div></div>
      <div class="pools" id="c-pools" style="margin-top:1rem">${POOLS.map(p => `<button class="pchoice ${p.s === F.mine ? 'on' : ''}" data-m="${p.s}">${poolTile(p, 34)}<div style="min-width:0"><b>${esc(p.n)}</b><small data-f="share">—</small></div><span class="pck">${ICON.check}</span></button>`).join('')}</div>
    </section>
    <section class="card step"><div class="step-h"><span class="num-c">3</span><div><h2>Name your token</h2><p>This is how it shows up everywhere.</p></div></div>
      <div class="two" style="margin-top:1rem"><div><label class="lbl" for="c-tk">Ticker</label><input class="inp mono" id="c-tk" maxlength="10" placeholder="TICKER" autocomplete="off"></div><div><label class="lbl" for="c-nm">Name</label><input class="inp" id="c-nm" maxlength="32" placeholder="My Coin" autocomplete="off"></div></div>
      <div style="margin-top:.9rem"><span class="lbl">Image</span><label class="drop" id="c-drop"><input type="file" id="c-img" accept="image/png,image/jpeg,image/gif,image/webp" hidden><span id="c-imgl">Upload image (PNG, JPG, GIF, WebP)</span></label></div>
      <div style="margin-top:.9rem"><span class="lbl">Social links (optional)</span><div class="two three"><div><span class="lbl2">Website</span><input class="inp" id="c-web" placeholder="the coin's page if empty"></div><div><span class="lbl2">X</span><input class="inp" id="c-x" placeholder="x.com/… or @handle"></div><div><span class="lbl2">Telegram</span><input class="inp" id="c-tg" placeholder="t.me/… or @group"></div></div></div>
      <div style="margin-top:.9rem"><label class="lbl" for="c-desc">Description (optional)</label><textarea class="inp" id="c-desc" maxlength="100"></textarea><div class="cnt" id="c-cnt">0/100</div></div>
      <div class="err" id="c-err1"></div>
    </section>
    <section class="card step"><div class="step-h"><span class="num-c">4</span><div><h2>Rewards</h2><p>Where the mine pays out. Set for every Moneroom coin.</p></div></div>
      <div class="rwd" style="margin-top:1rem"><span class="rwd-i">${floatTok(28)}</span><div><b>$FLOAT to holders</b><small>Pro rata to each holder’s bag, sent automatically. Nothing to claim.</small></div><span class="rwd-k">${ICON.lock}Fixed</span></div>
      <div class="wrow" id="c-wrow"></div>
    </section>
    <section class="card step"><div class="step-h"><span class="num-c">5</span><div><h2>Trading fee</h2><p>What traders pay on every buy and sell. A higher fee runs a bigger mine.</p></div></div>
      <div class="fees" id="c-fee" style="margin-top:1rem"><button class="on" data-f="0">1%<small>Default</small></button><button data-f="1">2%</button><button data-f="2">2.5%</button></div>
    </section>
    <section class="card step"><div class="step-h"><span class="num-c">6</span><div><h2>First buy (optional)</h2><p>Buy your own coin with SOL right after the launch transaction. Up to 3% of the supply.</p></div></div>
      <div class="solin" style="margin-top:1rem"><input class="inp" id="c-buy" inputmode="decimal" placeholder="0"><span>SOL</span></div>
    </section>
  </div>
  <aside class="card review">
    <div class="rv-k">REVIEW</div>
    <div class="rv-coin"><span class="ph" id="r-ph">?</span><div><b id="r-tk">$TICKER</b><small id="r-nm">Your token</small></div></div>
    <div class="rv-rows">
      <div><span>Paired with</span><b id="r-anc">—</b></div>
      <div><span>Mining pool</span><b id="r-pool">—</b></div>
      <div><span>Rewards</span><b>${floatTok(14)}$FLOAT to holders</b></div>
      <div><span>Launch market cap</span><b>≈ $20.00K</b></div>
      <div><span>Supply</span><b>1,000,000,000</b></div>
      <div><span>Trading fee</span><b id="r-fee">1%</b></div>
      <div><span>First buy</span><b id="r-buy">—</b></div>
      <div><span>Liquidity</span><b class="good">Locked forever</b></div>
    </div>
    <button class="rv-btn" id="r-go">Connect wallet</button>
    <p class="rv-note" id="r-note">The coin launches on Float with its mine set.</p>
  </aside></div></div>`;
  const el = id => $('#' + id);
  // 1 · assets
  const drawAssets = () => {
    const f = F.find.trim().toLowerCase();
    let list = PAIRS.filter(p => F.cat === 'All' || p.th === F.cat);
    if (f) list = list.filter(p => p.t.toLowerCase().includes(f) || p.n.toLowerCase().includes(f) || p.mint === F.find.trim());
    el('c-assets').innerHTML = list.length ? list.slice(0, 160).map(p => `<button class="asset ${F.pair && F.pair.id === p.id ? 'on' : ''}" data-p="${esc(p.id)}">${logo(p, 32)}<div style="min-width:0"><div><span class="at">${esc(p.t)}</span><span class="ac">${esc(catLabel(p.th))}</span></div><div class="an">${p.fee ? `<span class="tf">${p.fee / 100}% transfer fee</span> · ` : ''}${esc(p.n)}</div></div></button>`).join('')
      : `<p class="hint" style="grid-column:1/-1">${S.isAddr(F.find.trim()) ? 'That token is not a Float pair yet. Pick one from the list.' : 'No market matches.'}</p>`;
  };
  el('c-find').oninput = e => { F.find = e.target.value; drawAssets(); };
  el('c-cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; F.cat = b.dataset.c; $$('#c-cats button').forEach(x => x.classList.toggle('on', x === b)); drawAssets(); };
  el('c-assets').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; F.pair = byId.get(b.dataset.p); $$('#c-assets .asset').forEach(x => x.classList.toggle('on', x === b)); sync(); };
  // 2 · pool
  const poolShares = () => $$('#c-pools [data-m]').forEach(b => { const d = poolLive(b.dataset.m), e = $('[data-f="share"]', b); const v = d ? (d.share * 100).toFixed(1) + '% of blocks this week' : live.pools ? 'Under 1% this week' : '—'; if (e.textContent !== v) e.textContent = v; });
  el('c-pools').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; F.mine = b.dataset.m; $$('#c-pools [data-m]').forEach(x => x.classList.toggle('on', x === b)); sync(); };
  // 3 · token
  el('c-tk').oninput = e => { F.ticker = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10); e.target.value = F.ticker; sync(); };
  el('c-nm').oninput = e => { F.name = e.target.value.slice(0, 32); sync(); };
  el('c-web').oninput = e => { F.web = e.target.value; }; el('c-x').oninput = e => { F.x = e.target.value; }; el('c-tg').oninput = e => { F.tg = e.target.value; };
  el('c-desc').oninput = e => { F.desc = e.target.value.slice(0, 100); el('c-cnt').textContent = F.desc.length + '/100'; };
  const setFile = f => {
    if (!f) return; if (!/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) { el('c-err1').textContent = 'Use a PNG, JPG, GIF or WebP image.'; return; }
    if (f.size > 8 * 1024 * 1024) { el('c-err1').textContent = 'The image can be up to 8 MB.'; return; }
    el('c-err1').textContent = ''; F.file = f; if (F.preview) URL.revokeObjectURL(F.preview); F.preview = URL.createObjectURL(f);
    el('c-drop').classList.add('has'); el('c-imgl').innerHTML = `<span style="display:flex;align-items:center;gap:.6rem"><img src="${F.preview}" alt="">${esc(f.name.slice(0, 40))}</span>`; sync();
  };
  el('c-img').onchange = e => setFile(e.target.files[0]);
  const dz = el('c-drop');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); setFile(e.dataTransfer.files[0]); });
  el('c-fee').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; F.tier = +b.dataset.f; $$('#c-fee button').forEach(x => x.classList.toggle('on', x === b)); sync(); };
  el('c-buy').oninput = e => { F.buy = e.target.value.replace(/[^0-9.]/g, '').slice(0, 8); e.target.value = F.buy; sync(); };
  const sync = () => {
    const a = wAddr(), pl = poolOf(F.mine);
    el('r-tk').textContent = '$' + (F.ticker ? F.ticker.toUpperCase() : 'TICKER'); el('r-nm').textContent = F.name || 'Your token';
    const ph = el('r-ph'); if ((ph.dataset.src || '') !== F.preview) { ph.dataset.src = F.preview; ph.innerHTML = F.preview ? `<img src="${F.preview}" alt="">` : '?'; }
    el('r-anc').innerHTML = F.pair ? `${F.pair.logo ? `<img src="${F.pair.logo}" alt="">` : ''}${esc(F.pair.t)}` : '—';
    el('r-pool').innerHTML = `${poolTile(pl, 18)}${esc(pl.n)}`;
    el('r-fee').textContent = ['1%', '2%', '2.5%'][F.tier];
    el('r-buy').textContent = +F.buy > 0 ? F.buy + ' SOL' : '—';
    el('c-wrow').innerHTML = a ? `Creator <span class="tag mono">${short(a, 6)}</span>` : `Connect a wallet <span class="tag">Connected wallet</span>`;
    el('r-go').textContent = a ? 'Launch' : 'Connect wallet';
  };
  rerenderOnWallet = sync;
  el('r-go').onclick = async () => {
    if (FILM) return;
    if (!wAddr()) { await pickWallet(); return; }
    const errs = [];
    if (!F.pair) errs.push('Pick a pairing asset.');
    if (!S.TICKER_RE.test(F.ticker)) errs.push('Ticker: 1 to 10 letters or numbers.');
    if (!F.name.trim()) errs.push('Give the coin a name.');
    if (!F.file) errs.push('Add a coin image.');
    if (F.buy && !(+F.buy >= 0 && +F.buy <= 50)) errs.push('First buy: a SOL amount up to 50.');
    if (errs.length) { el('r-note').innerHTML = `<span class="bad">${esc(errs[0])}</span>`; return; }
    el('r-note').textContent = 'The coin launches on Float with its mine set.';
    launchFlow(F);
  };
  drawAssets(); poolShares(); sync();
  live.subs.add(k => { if (k === 'pools') poolShares(); });
  if (F.pair) setTimeout(() => { const b = $(`#c-assets [data-p="${CSS.escape(F.pair.id)}"]`); if (b) b.scrollIntoView({ block: 'nearest' }); }, 50);
}
async function prepImage(file) {
  if (file.size <= 600 * 1024 && file.type !== 'image/gif') return file;
  if (file.type === 'image/gif' && file.size <= 900 * 1024) return file;
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h);
    for (const [type, q] of [['image/webp', 0.9], ['image/webp', 0.8], ['image/jpeg', 0.82], ['image/jpeg', 0.7]]) { const b = await new Promise(r => cv.toBlob(r, type, q)); if (b && b.size <= 900 * 1024) return new File([b], 'coin.' + (type === 'image/webp' ? 'webp' : 'jpg'), { type }); }
  } catch (_) { } finally { URL.revokeObjectURL(url); }
  throw new Error('This image is too large. Use one under 900 KB.');
}
// the launch: prepare (image + metadata + the coin's mining vault) -> build -> dry run -> wallet signs -> confirm -> register
const LSTEPS = [['prep', 'Uploading image and metadata'], ['build', 'Preparing the Float launch'], ['sign', 'Sign in your wallet'], ['send', 'Launching on Float'], ['mine', 'Starting the mine']];
const launchHtml = F => `<h3>Launching $${esc(F.ticker.toUpperCase())}</h3><p>Paired with ${esc(F.pair.t)} · mining with ${esc(poolOf(F.mine).n)}</p><div class="steps">${LSTEPS.map(([k, t]) => `<div data-k="${k}"><i></i>${t}</div>`).join('')}</div><p class="err" id="lf-err"></p><button class="mx" id="lf-x" hidden>Close</button>`;
const doneHtml = (F, mint, tweet) => `<h3>$${esc(F.ticker.toUpperCase())} is live</h3><p>A real Float coin, paired with ${esc(F.pair.t)}. Its fees now mine $FLOAT for holders with ${esc(poolOf(F.mine).n)}.</p>
  <div class="done-coin"><img src="${esc(F.preview)}" alt=""><div style="min-width:0"><b>${esc(F.name)}</b><div class="mono muted" style="font-size:.75rem">${short(mint, 6)}</div></div><button class="cp" style="margin-left:auto" data-copy="${esc(mint)}">${ICON.copy}</button></div>
  <div class="mbtns"><a class="p" href="/tokens/${esc(mint)}" data-link>View coin</a><a class="s" href="https://x.com/intent/tweet?text=${encodeURIComponent(tweet || '')}" target="_blank" rel="noreferrer">Share on X</a></div>
  <button class="mx" id="lf-buy" ${+F.buy > 0 ? '' : 'hidden'}>First buy ${esc(F.buy)} SOL</button>`;
async function launchFlow(F) {
  const m = modal(launchHtml(F), { sticky: true });
  const step = k => { let past = true; $$('.steps div', m).forEach(d => { if (d.dataset.k === k) { d.className = 'now'; past = false; } else d.className = past ? 'ok' : ''; }); };
  const allOk = () => $$('.steps div', m).forEach(d => d.className = 'ok');
  const failUI = msg => { $('#lf-err', m).textContent = msg; const x = $('#lf-x', m); x.hidden = false; x.onclick = closeModal; $$('.steps div.now', m).forEach(d => d.className = ''); };
  try {
    step('prep');
    const fd = new FormData();
    fd.set('image', await prepImage(F.file)); fd.set('meta', JSON.stringify({ name: F.name.trim(), ticker: F.ticker, desc: F.desc.trim(), web: F.web.trim(), x: F.x.trim(), tg: F.tg.trim(), pair: F.pair.id, quote: F.pair.mint, mine: F.mine, tier: F.tier, creator: wAddr() }));
    const pr = await fetch('/api/prepare', { method: 'POST', body: fd }).then(r => r.json().then(j => ({ ok: r.ok, j }))).catch(() => ({ ok: false, j: { error: 'The connection dropped.' } }));
    if (!pr.ok) throw new Error(pr.j.error || 'The site did not answer.');
    step('build');
    const pair = { ...F.pair, tp: F.pair.tp, cfg: F.pair.cfg };
    const t = await S.launchTx({ creator: wAddr(), pair, name: F.name.trim(), ticker: F.ticker, uri: pr.j.uri, feeReceiver: pr.j.vault, tier: F.tier });
    if (t.takeover && !confirm(`$${F.ticker.toUpperCase()} already exists on Float. Launching it again costs ${t.takeover / 1e9} SOL, paid to Float's treasury. Continue?`)) throw new Error('Launch cancelled. Pick another ticker.');
    if (!WAL.MOCK) {
      const sim = await S.simulate(t.tx).catch(() => null);
      if (sim && sim.err) { const logs = (sim.logs || []).join(' '); if (/insufficient|debit an account|0x1\b/i.test(logs + JSON.stringify(sim.err))) throw new Error('Not enough SOL in this wallet for the launch (about 0.03 SOL with rent and fees).'); throw new Error('This launch would fail on Solana right now, so your wallet was not asked to sign. Nothing was sent.'); }
    }
    step('sign');
    const sig = await WAL.signAndSend(t.tx, () => step('send'));
    step('send');
    await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: pr.j.id, mint: t.mint, sig, pool: t.pool }) }).catch(() => { });
    const ok = await WAL.confirmed(sig);
    if (ok === 'failed') throw new Error('The launch transaction failed on Solana. Nothing was created.');
    step('mine');
    const rg = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: pr.j.id, mint: t.mint, sig, pool: t.pool, confirmed: ok === 'ok' }) }).then(r => r.json()).catch(() => ({}));
    allOk(); refreshCoins();
    const tweet = `$${F.ticker.toUpperCase()} is live on ${CFG.x ? '@' + CFG.x : 'Moneroom'}: a Float coin paired with $${F.pair.t} that mines $FLOAT for its holders.\n\n${location.origin}/tokens/${t.mint}`;
    m.innerHTML = doneHtml(F, t.mint, tweet);
    m.querySelectorAll('[data-link]').forEach(a => a.addEventListener('click', closeModal));
    const fb = $('#lf-buy', m); if (fb && +F.buy > 0) fb.onclick = () => firstBuy(t.mint, +F.buy, fb);
    if (rg && rg.error) toast(rg.error);
  } catch (e) { failUI(e.message || String(e)); }
}
async function firstBuy(mint, sol, btn) {
  btn.disabled = true; btn.textContent = 'Finding a route…';
  try {
    const amount = Math.round(sol * 1e9); let quote = null;
    for (let i = 0; i < 6 && !quote; i++) { const r = await fetch(`https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${amount}&slippageBps=1500`).then(r => r.json()).catch(() => null); if (r && r.outAmount) quote = r; else await sleep(2500); }
    if (!quote) throw new Error('No route yet. Open the coin page and buy there in a minute.');
    btn.textContent = 'Sign in your wallet';
    const sw = await fetch('https://lite-api.jup.ag/swap/v1/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: quote, userPublicKey: wAddr(), dynamicComputeUnitLimit: true, prioritizationFeeLamports: 'auto' }) }).then(r => r.json());
    if (!sw.swapTransaction) throw new Error('Jupiter did not build the swap.');
    const sig = await WAL.signAndSend(S.fromB64(sw.swapTransaction));
    btn.textContent = 'Buying…'; const ok = await WAL.confirmed(sig); btn.textContent = ok === 'ok' ? 'First buy done' : 'Check your wallet';
  } catch (e) { btn.disabled = false; btn.textContent = e.message.slice(0, 80); }
}

// ================================================================ EXPLORE
function viewExplore() {
  const st = { q: '', sort: 'fdv', pool: 'all' };
  VIEW.innerHTML = `<div class="page" style="padding-top:1.25rem">
    <section class="grad xhero xh-mine"><img class="xh-img" src="assets/brand/explore.jpg" alt=""><div class="in"><h2>Every coin here mines $FLOAT.</h2><p>Real Float coins whose fees run mining rigs with the pool picked at launch. Holders are paid in $FLOAT, automatically.</p><a class="btn" href="/create" data-link>Launch a coin</a></div></section>
    <div class="xbar"><form class="xsearch" id="x-f"><input id="x-q" placeholder="Type token name or address" aria-label="Search coins">${ICON.search}</form>
      <div class="xctl"><span class="xbrand"><b>MONEROOM</b><span class="muted">Coins</span></span><span class="muted hide-sm" style="font-size:.875rem">Sort</span><div class="seg" id="x-sort"><button class="on" data-s="fdv">FDV</button><button data-s="recent">Recent</button></div></div></div>
    <div class="tabs" id="x-tabs"><button class="on" data-t="all">All</button>${POOLS.map(p => `<button data-t="${p.s}">${esc(p.n)}</button>`).join('')}</div>
    <div class="grid3" id="x-grid"></div></div>`;
  const draw = () => {
    let L = live.coins.slice(); const q = st.q.trim().toLowerCase();
    if (q) L = L.filter(c => (c.ticker || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || c.mint === st.q.trim());
    if (st.pool !== 'all') L = L.filter(c => c.mine === st.pool);
    L.sort((a, b) => st.sort === 'recent' ? (b.createdAt || 0) - (a.createdAt || 0) : (b.fdvUsd || 0) - (a.fdvUsd || 0));
    const g = $('#x-grid'); if (!g) return;
    const o = live.own || {}, ownHit = !!CFG.ca && st.pool === 'all' && (!q || 'moneroom'.includes(q) || String(o.ticker || '').toLowerCase().includes(q) || String(o.name || '').toLowerCase().includes(q) || st.q.trim() === CFG.ca);
    const own = ownHit ? ownCard() : '', n = L.length + (own ? 1 : 0);
    g.innerHTML = own + L.map(c => coinCard(c, c.mint === CFG.ca ? 'live' : '')).join('') + (q || st.pool !== 'all' ? (n ? '' : `<p class="empty" style="grid-column:1/-1">No coins match.</p>`) : openSlots(Math.max(3 - n, n % 3 ? 3 - n % 3 : 0)));
  };
  $('#x-f').onsubmit = e => e.preventDefault();
  $('#x-q').oninput = e => { st.q = e.target.value; draw(); };
  $('#x-sort').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; st.sort = b.dataset.s; $$('#x-sort button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  $('#x-tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; st.pool = b.dataset.t; $$('#x-tabs button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  draw(); live.subs.add(k => { if (k === 'coins' || k === 'own') draw(); });
}

// ================================================================ COIN
async function viewCoin(mint) {
  VIEW.innerHTML = `<div class="cpage"><div class="cbar"><button onclick="history.length>1?history.back():null">${ICON.back}</button><span>${esc(short(mint, 6))} <button class="cp" data-copy="${esc(mint)}" style="display:inline-flex;vertical-align:middle">${ICON.copy}</button></span><span></span></div><div class="cstack" id="cp"><div class="card card-p muted">Loading…</div></div></div>`;
  let c = live.coins.find(x => x.mint === mint);
  if (!c) { try { const r = await fetch('/api/coin/' + encodeURIComponent(mint)); if (r.ok) c = (await r.json()).coin; } catch (_) { } }
  const box = $('#cp'); if (!box) return;
  if (!c) { box.innerHTML = `<div class="card card-p"><b>Not a Moneroom coin</b><p class="psub">This address was not launched on Moneroom. <a class="lnk" href="https://www.floatlaunch.xyz/tokens/${esc(mint)}" target="_blank" rel="noreferrer">Open it on Float</a></p></div>`; return; }
  const p = pairOf(c), pl = poolOf(c.mine);
  const soc = [c.x && `<a href="${esc(c.x)}" target="_blank" rel="noreferrer" aria-label="X">${ICON.x}</a>`, c.tg && `<a href="${esc(c.tg)}" target="_blank" rel="noreferrer" aria-label="Telegram">${ICON.tg}</a>`, c.web && `<a href="${esc(c.web)}" target="_blank" rel="noreferrer" aria-label="Website">${ICON.link}</a>`].filter(Boolean).join('');
  box.innerHTML = `
    <div class="card chead"><img class="av" src="${esc(c.image)}" alt=""><div style="min-width:0"><h1>$${esc(c.ticker)} <small>${esc(c.name)}</small></h1><span class="anchip">Paired with <b>${p && p.logo ? `<img src="${p.logo}" alt="">` : ''}${esc(p ? p.t : '')}</b></span> <span class="minechip inl">${poolTile(pl, 16)}${esc(pl.n)}</span>${soc ? `<div class="soc">${soc}</div>` : ''}</div></div>
    <div class="card chart-card"><div class="chart-top"><div class="tf" id="cp-tf"><button data-r="3600">1H</button><button data-r="14400">4H</button><button class="on" data-r="86400">1D</button><button data-r="604800">7D</button><button data-r="0">ALL</button></div><div class="chart-v" id="cp-fdv">${c.fdvUsd ? usd(c.fdvUsd) : usd(20000)}</div></div><div class="chart"><canvas id="cp-cv"></canvas></div></div>
    <div class="card minec"><div class="kk"><span class="dt"></span>The mine <em>· running</em></div>
      <div class="mine-h">${poolTile(pl, 44)}<div><b>${esc(pl.n)}</b><small id="cp-ps">—</small></div><span class="mine-to">${floatTok(18)}$FLOAT to holders</span></div>
      <div class="pgrid4"><div><small>Pool share · 7d</small><b id="cp-sh">—</b></div><div><small>Pool hashrate</small><b id="cp-hr">—</b></div><div><small>$FLOAT</small><b id="cp-fp">—</b></div><div><small>Paid to</small><b>Holders</b></div></div>
      <p class="pnote">The coin’s creator share of fees goes to its mining vault, which runs rigs with ${esc(pl.n)}. Rewards are swapped to $FLOAT and sent to holders pro rata.</p></div>
    <div class="card grad-card">${c.status === 'graduated' ? `<div><b>Graduated to Raydium</b><div class="gs">${ICON.lock}Liquidity locked forever on Raydium</div></div>` : `<div><b>Bonding curve</b><div class="prog"><i style="width:${Math.max(2, Math.min(100, (c.progress || 0) * 100)).toFixed(1)}%"></i></div></div><div class="muted" style="font-size:.875rem">${((c.progress || 0) * 100).toFixed(1)}% to graduation</div>`}</div>
    <div class="card about"><div class="about-h">About</div>
      <div class="about-r"><span>Name</span><div>${esc(c.name)}</div></div>
      <div class="about-r"><span>Ticker</span><div>$${esc(c.ticker)}</div></div>
      <div class="about-r"><span>CA</span><div class="mono" style="font-size:.8125rem">${esc(short(c.mint, 6))}<button class="cp" data-copy="${esc(c.mint)}">${ICON.copy}</button></div></div>
      <div class="about-r"><span>Paired with</span><div>${p && p.logo ? `<img src="${p.logo}" alt="">` : ''}${esc(p ? p.t : '')} <span class="mono muted" style="font-size:.75rem;font-weight:500">${esc(short(c.quoteMint || (p && p.mint), 6))}</span></div></div>
      <div class="about-r"><span>Mining pool</span><div>${esc(pl.n)}</div></div>
      <div class="about-r"><span>Rewards</span><div>$FLOAT to holders</div></div>
      <div class="about-r"><span>Mining vault</span><div class="mono" style="font-size:.8125rem">${esc(short(c.vault, 6))}<button class="cp" data-copy="${esc(c.vault)}">${ICON.copy}</button></div></div>
      <div class="about-r"><span>Description</span><div style="font-weight:500">${esc(c.desc || '-')}</div></div>
      <div class="about-r"><span>Supply</span><div>1,000,000,000</div></div>
      <div class="about-r"><span>Mint</span><div>Fixed supply · no freeze authority</div></div>
      <div class="about-r"><span>Float</span><div><a href="https://www.floatlaunch.xyz/tokens/${esc(c.mint)}" target="_blank" rel="noreferrer">View on Float ${ICON.ext}</a></div></div>
      <div class="about-r"><span>DexScreener</span><div><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noreferrer">View chart ${ICON.ext}</a></div></div>
    </div>`;
  const mineLive = () => { const d = poolLive(pl.s); if ($('#cp-sh')) { $('#cp-sh').textContent = d ? (d.share * 100).toFixed(1) + '%' : '—'; $('#cp-hr').textContent = d ? hashrate(d.hr) : '—'; $('#cp-ps').textContent = d ? d.blocks + ' blocks found this week' : 'Mining pool'; } if (live.float && $('#cp-fp')) $('#cp-fp').textContent = price(live.float.price); };
  mineLive(); live.subs.add(k => { if (k === 'pools' || k === 'float') mineLive(); });
  // chart (Float's indexer through the site)
  const cv = $('#cp-cv'); let pts = [], range = 86400;
  const loadChart = async () => {
    const from = 60 * Math.floor(((range ? Date.now() / 1000 - range : (c.createdAt || Date.now() / 1000 - 86400))) / 60);
    try { const j = await fetch(`/api/chart/${encodeURIComponent(mint)}?from=${from}`).then(r => r.json()); pts = (j.points || []).map(p => ({ t: p.t, v: p.price * p.stockUsd * 1e9 })); if (j.before) pts.unshift({ t: from, v: j.before.price * j.before.stockUsd * 1e9 }); } catch (_) { pts = []; }
    if (pts.length) $('#cp-fdv').textContent = usd(pts[pts.length - 1].v);
  };
  const drawChart = () => {
    const { w, h, d } = fitCanvas(cv), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    if (pts.length < 2) { ctx.fillStyle = '#51617f'; ctx.font = `${13 * d}px Geist`; ctx.fillText('Chart fills in with the first trades.', 8 * d, h / 2); return; }
    const vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.15 || mx * 0.05;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const X = t => 6 * d + (w - 100 * d) * (t - t0) / Math.max(1, t1 - t0), Y = v => h - 22 * d - (h - 40 * d) * (v - mn + pad) / (mx - mn + 2 * pad);
    ctx.beginPath(); pts.forEach((p, i) => { const x = X(p.t), y = Y(p.v); if (i) { ctx.lineTo(x, Y(pts[i - 1].v)); ctx.lineTo(x, y); } else ctx.moveTo(x, y); });
    ctx.strokeStyle = '#ff9a3d'; ctx.lineWidth = 2 * d; ctx.stroke();
    const last = pts[pts.length - 1], lx = X(last.t), ly = Y(last.v);
    ctx.lineTo(lx, h - 22 * d); ctx.lineTo(X(t0), h - 22 * d); ctx.closePath(); const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,106,0,.24)'); g.addColorStop(1, 'rgba(255,106,0,0)'); ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([3 * d, 4 * d]); ctx.strokeStyle = 'rgba(141,156,186,.35)'; ctx.lineWidth = 1 * d; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `700 ${11 * d}px Geist`; const txt = usd(last.v), tw = ctx.measureText(txt).width; ctx.fillStyle = '#ff9a3d'; ctx.beginPath(); ctx.roundRect(w - tw - 22 * d, ly - 10 * d, tw + 18 * d, 20 * d, 10 * d); ctx.fill(); ctx.fillStyle = '#1a0901'; ctx.fillText(txt, w - tw - 13 * d, ly + 4 * d);
  };
  $('#cp-tf').onclick = async e => { const b = e.target.closest('[data-r]'); if (!b) return; range = +b.dataset.r; $$('#cp-tf button').forEach(x => x.classList.toggle('on', x === b)); await loadChart(); drawChart(); };
  await loadChart(); drawChart();
  const ro = new ResizeObserver(drawChart); ro.observe(cv); onLeave(() => ro.disconnect());
  const it = setInterval(async () => { await loadChart(); drawChart(); }, 15000); onLeave(() => clearInterval(it));
}

// ================================================================ MINES (live pools)
function viewMines() {
  VIEW.innerHTML = `<div class="page"><h1 class="ph1">Mines</h1><p class="psub">The pools Moneroom coins mine with, live from the network over the last seven days.</p>
    <div class="stats4"><div class="card stat"><small>Network hashrate</small><b id="mn-hr">—</b><p>Estimated, last 7 days</p></div><div class="card stat"><small>Blocks this week</small><b id="mn-b">—</b><p>Across every pool</p></div><div class="card stat"><small>Moneroom pools</small><b id="mn-s">—</b><p>Share of blocks this week</p></div><div class="card stat"><small>$FLOAT</small><b id="mn-f">—</b><p id="mn-fc">Price, live</p></div></div>
    <div class="tbl"><div class="tbl-scroll"><table><thead><tr><th>#</th><th>Pool</th><th class="r">Share · 7d</th><th class="r">Blocks · 7d</th><th class="r col-hide">Hashrate</th><th class="r"></th></tr></thead><tbody id="mn-b2"></tbody></table></div></div></div>`;
  const draw = () => {
    const P = live.pools; if (!P) { $('#mn-b2').innerHTML = `<tr><td colspan="6" class="muted">Loading the network…</td></tr>`; return; }
    $('#mn-hr').textContent = hashrate(P.net); $('#mn-b').textContent = String(P.tot);
    const ours = new Set(POOLS.map(p => p.s)); $('#mn-s').textContent = (P.all.filter(p => ours.has(p.slug)).reduce((s, p) => s + p.share, 0) * 100).toFixed(1) + '%';
    $('#mn-b2').innerHTML = P.all.filter(p => p.slug !== 'unknown').slice(0, 24).map((p, i) => { const pl = POOLS.find(x => x.s === p.slug); return `<tr class="${pl ? 'ours' : ''}"><td class="muted">${i + 1}</td><td><div class="tas">${pl ? poolTile(pl, 28) : `<span class="ptile gen" style="width:28px;height:28px">${esc(p.name.slice(0, 1))}</span>`}<div><b>${esc(p.name)}</b>${pl ? '<small>Moneroom pool</small>' : ''}</div></div></td><td class="r num">${(p.share * 100).toFixed(2)}%</td><td class="r num">${p.blocks}</td><td class="r num col-hide">${hashrate(p.hr)}</td><td class="r">${pl ? `<a class="minebtn" href="/create?pool=${p.slug}" data-link>Mine</a>` : ''}</td></tr>`; }).join('');
  };
  const fl = () => { if (!live.float) return; $('#mn-f').textContent = price(live.float.price); const e = $('#mn-fc'); e.textContent = pct(live.float.chg) + ' in 24h'; e.className = cls(live.float.chg); };
  draw(); fl(); live.subs.add(k => { if (k === 'pools') draw(); if (k === 'float') fl(); });
}

// ================================================================ PROFILE
function viewProfile() {
  const draw = () => {
    const a = wAddr();
    if (!a) { VIEW.innerHTML = `<div class="page"><h1 class="ph1">Profile</h1><p class="psub">Connect a wallet to see the coins you launched.</p><button class="btn" style="margin-top:1.25rem" id="pf-c">Connect wallet</button></div>`; $('#pf-c').onclick = pickWallet; return; }
    const mine = live.coins.filter(c => c.creator === a);
    VIEW.innerHTML = `<div class="page"><h1 class="ph1">Profile</h1><div class="card card-p" style="margin-top:1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap"><div><div class="sec-k">Wallet</div><div class="mono" style="margin-top:.25rem">${esc(short(a, 8))}</div></div><button class="btn-ghost" style="margin-left:auto" data-copy="${esc(a)}">Copy</button><button class="btn-ghost" id="pf-d">Disconnect</button></div>
      <h2 class="sec-h" style="margin-top:2rem;font-size:1.25rem">Your mines</h2><div class="grid3">${mine.map(c => coinCard(c)).join('') || openSlots(1)}</div></div>`;
    $('#pf-d').onclick = () => WAL.disconnect();
  };
  draw(); rerenderOnWallet = draw; live.subs.add(k => { if (k === 'coins') draw(); });
}

// ================================================================ DOCS + TERMS
function viewDocs() {
  VIEW.innerHTML = `<article class="docs"><h1>Docs</h1><p class="lead">How Moneroom works, where the fees go, and what to know before you trade.</p>
  <nav class="toc"><a href="#how">How it works</a><a href="#mine">The mine</a><a href="#rewards">Rewards</a><a href="#fees">Fees</a><a href="#pools">Pools</a><a href="#tickers">Tickers</a><a href="#risks">Risks</a><a href="#contracts">Contracts</a></nav>
  <h2 id="how">How it works</h2>
  <p>Every Moneroom coin is a real Float coin. It launches through the Float program on Raydium LaunchLab, paired with a token from Float’s list: a crypto asset like SOL or HYPE, a tokenized stock like Tesla or NVIDIA, a pre-IPO name, gold or a basket. Float pays the coin’s holders their share of fees in that pair token.</p>
  <p>Moneroom adds the mine. The coin’s creator share of fees is routed to the coin’s own mining vault, and the vault funds hashrate from industrial mining rigs at the pool chosen at launch. Rewards are converted to $FLOAT and paid to the coin’s holders.</p>
  <p>Coins launch with a fixed supply of 1,000,000,000, no mint or freeze authority, and a starting market cap of about $20,000. At about 7.5x the coin graduates and its liquidity is locked forever in a Raydium pool. Your wallet signs one transaction; nobody else signs it.</p>
  <h2 id="mine">The mine</h2>
  <p>Each coin has its own mining vault, set as the coin’s fee receiver in the Float program. The vault is a Solana address whose key is sealed inside Moneroom’s server; Moneroom uses it to run the coin’s mining cycle and nothing else. Each cycle claims the vault’s fees, rents SHA-256 hashrate on the open market and points it at the coin’s pool. Larger fees rent more hashrate.</p>
  <h2 id="rewards">Rewards</h2>
  <p>Pool payouts are swapped to $FLOAT, Float’s own token, and sent to the coin’s holders pro rata to their balances. There is nothing to claim and nothing to stake. This comes on top of Float’s own holder rewards in the pair token.</p>
  <h2 id="fees">Fees</h2>
  <p>Creators pick a trading fee of 1%, 2% or 2.5%. Raydium keeps part of it while a coin is on its curve. The Float program splits the rest the same way for every Float coin:</p>
  <div class="card split"><div><b>15%</b><span>Holders<small>Paid by Float to the coin’s holders in the pair token.</small></span></div><div><b>5%</b><span>The mine<small>Sent to the coin’s Moneroom mining vault. Rewards go to holders in $FLOAT.</small></span></div><div><b>35%</b><span>$FLOAT burn<small>Float buys back and burns $FLOAT.</small></span></div><div><b>35%</b><span>Traders<small>Airdropped by Float to the top traders by volume.</small></span></div><div><b>10%</b><span>Treasury<small>Float’s treasury.</small></span></div></div>
  <h2 id="pools">Pools</h2>
  <p>A coin mines with one of twelve of the largest mining pools: ${POOLS.map(p => esc(p.n)).join(', ')}. Pool shares on the site come live from mempool.space.</p>
  <h2 id="tickers">Tickers</h2>
  <p>Tickers are 1 to 10 letters or numbers and live in Float’s ticker list, shared with every Float coin. Launching a ticker that already exists costs 1 SOL, paid to Float’s treasury; a ticker that was just claimed is protected for a while. The launch form tells you before you sign.</p>
  <h2 id="risks">Risks</h2>
  <ul><li>Coins are highly speculative. Most lose value, and you can lose everything you put in.</li><li>Mining rewards depend on network difficulty, pool luck and the coin’s trading volume. They can be small, and they vary.</li><li>Tokenized stocks are issued by third parties, who keep powers over their tokens. A coin is not a share and gives no rights in any company.</li><li>Moneroom is not affiliated with Float or with any mining pool. It launches through Float’s public program.</li></ul>
  <h2 id="contracts">Contracts</h2>
  <p>Float program <code>${S.FLOAT.program}</code></p><p>Raydium LaunchLab <code>${S.FLOAT.launchlab}</code></p><p>$FLOAT <code>${FLOAT_MINT}</code></p>
  </article>`;
}
function viewTerms() {
  VIEW.innerHTML = `<article class="docs"><h1>Terms of Use</h1><p class="lead">Short version: you launch and trade at your own risk.</p><h2>Use</h2><p>Moneroom is a front end for Float’s public launch program on Solana and a mining service for the coins launched through it. You are responsible for what you launch and for every transaction your wallet signs.</p><h2>No advice</h2><p>Nothing on this site is financial advice. Memecoins are risky and can go to zero. Mining rewards are not guaranteed.</p><h2>No affiliation</h2><p>Moneroom is not affiliated with Float, Raydium, any mining pool, or any company whose token a coin is paired with.</p></article>`;
}

// ---------------------------------------------------------------- boot
Object.assign(FMAPP, { FILM, live, modal, closeModal, launchHtml, doneHtml, nav, render, PAIRS, byId, POOLS, refreshCoins });
walletBtn();
render();
if (FILM) { document.body.classList.add('fm-film'); import('./filmmode.js').then(m => m.start && m.start(FILM, FMAPP)).catch(() => { }); }
