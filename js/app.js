/* Moneroom: Pump.fun launches whose creator rewards fund RandomX mining.
 * XMR output settles to eligible holders through one-time private claims. */
import { PAIRS } from '../data/pairs.js';
import * as WAL from './wallet.js';

const DEFAULT_CFG = window.FM || {};
const REMOTE_CONFIG_URL = 'https://api.github.com/repos/dellmodrun/Moneroom/contents/ca.json?ref=ca-config';
const SUPABASE_URL = 'https://snwthyespgghvvlktyyu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lok_cbkXwfsPKEpOTTCl4Q_6aqpNf0v';

const caConfig = value => {
  const ca = String(value || '').trim();
  return ca && ca.toLowerCase() !== 'tba'
    ? { ...DEFAULT_CFG, ca, caLabel: '' }
    : { ...DEFAULT_CFG, ca: '', caLabel: 'TBA' };
};

async function readRemoteConfig() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.moneroom&select=contract_address`, {
      cache: 'no-store',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`live config ${response.status}`);
    const rows = await response.json();
    if (rows && rows[0]) return caConfig(rows[0].contract_address);
  } catch (error) {
    console.warn('Using Moneroom config branch fallback:', error);
  }
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

function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-moneroom-supabase]');
    if (old) {
      old.addEventListener('load', () => resolve(window.supabase), { once: true });
      old.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = new URL('assets/supabase-js.min.js?v=1', document.baseURI).href;
    script.async = true;
    script.dataset.moneroomSupabase = 'true';
    script.onload = () => resolve(window.supabase);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const CFG = { ...DEFAULT_CFG };
window.FM = CFG;
const BASE_PATH = /^(www\.)?moneroom\.run$/i.test(location.hostname) ? '' : '/Moneroom';
const Q0 = new URLSearchParams(location.search);
const FILM = Q0.get('film') || '';
const FILM_ADDR = FILM ? '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' : '';
const wAddr = () => FILM_ADDR || WAL.address();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (a, n = 6) => a ? (a.length > 2 * n + 1 ? a.slice(0, n) + '…' + a.slice(-n) : a) : '';
const VIEW = $('#view');
const HOME_HERO_HTML = $('#home-hero')?.outerHTML || '';
const FMAPP = window.FMAPP = {};
const byId = new Map(PAIRS.map(p => [p.id, p]));
const byMint = new Map(); PAIRS.forEach(p => { if (!byMint.has(p.mint)) byMint.set(p.mint, p); });
const pairOf = c => byId.get(c.pair) || byMint.get(c.quoteMint) || null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const XMR_MARK = 'assets/pairs/WXMRyRZhsa19ety5erZhHg4N3xj3EVN92u94422teJp.png';

// Active Monero/RandomX pools. The same slugs are used by the cards, launch
// flow and 3D mine so every pool always carries its corresponding brand mark.
export const POOLS = [
  { s: 'supportxmr', n: 'SupportXMR', tag: 'SX' },
  { s: 'nanopool', n: 'Nanopool', tag: 'NP' },
  { s: 'kryptex', n: 'Kryptex Pool', tag: 'KX' },
  { s: 'c3pool', n: 'C3Pool', tag: 'C3' },
  { s: 'hashvault', n: 'HashVault', tag: 'HV' },
  { s: 'p2pool', n: 'P2Pool Main', tag: 'P2' },
  { s: 'p2pool-mini', n: 'P2Pool Mini', tag: 'PM' },
  { s: 'moneroocean', n: 'MoneroOcean', tag: 'MO' },
  { s: 'herominers', n: 'HeroMiners', tag: 'HM' },
  { s: 'xmrpool-eu', n: 'XMRPool.eu', tag: 'XE' },
  { s: 'rplant-xyz', n: 'RPlant', tag: 'RP' },
  { s: '1miner-net', n: '1Miner', tag: '1M' },
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
const hashrate = h => { if (!h || !isFinite(h)) return '—'; const u = [['GH/s', 1e9], ['MH/s', 1e6], ['kH/s', 1e3]]; for (const [k, v] of u) if (h >= v) return (h / v).toFixed(h / v >= 100 ? 0 : h / v >= 10 ? 1 : 2) + ' ' + k; return h.toFixed(0) + ' H/s'; };
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
const poolTile = (pl, size = 40) => `<span class="ptile pool-logo" style="width:${size}px;height:${size}px"><img src="assets/mines/${esc(pl.s)}.png" alt="${esc(pl.n)} logo" loading="lazy"></span>`;
const xmrTok = (size = 18) => `<img class="ftok" src="${XMR_MARK}" alt="XMR" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
const catLabel = th => ({ xStock: 'xStock', Sunrise: 'Sunrise', PreStock: 'PreStock', Crypto: 'Crypto', Leverage: 'Leverage', Commodity: 'Commodity', Basket: 'Basket', Tessera: 'Tessera', Custom: 'Custom' })[th] || th;

// ---------------------------------------------------------------- toast, modal, copy
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (_) { toast(t); } }
function modal(html, opts = {}) { const sc = $('#scrim'), m = $('#modal'); m.innerHTML = html; sc.classList.add('on'); sc.onclick = e => { if (e.target === sc && !opts.sticky) closeModal(); }; return m; }
function closeModal() { $('#scrim').classList.remove('on'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) { e.preventDefault(); e.stopPropagation(); copy(c.dataset.copy); } });

// ---------------------------------------------------------------- live data: launched coins, RandomX pools and XMR market
const live = { coins: [], pools: null, net: null, xmr: null, xmrCs: null, own: null, ownK: '', subs: new Set() };
const emit = k => live.subs.forEach(f => { try { f(k); } catch (e) { console.warn(e); } });
async function refreshCoins() { live.coins = []; emit('coins'); }
async function refreshPools() {
  const all = POOLS.map((p, i) => ({ slug: p.s, name: p.n, rank: i + 1, status: 'Ready' }));
  live.pools = { m: Object.fromEntries(all.map(p => [p.slug, p])), all };
  emit('pools');
}
async function refreshXmr() {
  try {
    const j = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true').then(r => r.json());
    const p = j.monero; if (!p) return;
    live.xmr = { price: +p.usd, chg: p.usd_24h_change == null ? null : +p.usd_24h_change / 100, mcap: +p.usd_market_cap, vol: +p.usd_24h_vol, url: 'https://www.coingecko.com/en/coins/monero' };
    emit('xmr');
    if (!live.xmrCs) refreshXmrChart();
  } catch (_) { }
}
async function refreshXmrChart() {
  try {
    const j = await fetch('https://api.coingecko.com/api/v3/coins/monero/market_chart?vs_currency=usd&days=7&interval=hourly').then(r => r.json());
    live.xmrCs = (j.prices || []).map(r => ({ t: r[0] / 1000, c: +r[1] })); emit('xmrcs');
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
refreshCoins(); refreshPools(); refreshXmr(); refreshOwn();
if (!FILM) { setInterval(refreshCoins, 20000); setInterval(refreshXmr, 60000); setInterval(refreshXmrChart, 600000); setInterval(refreshOwn, 20000); }

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
  e.preventDefault();
  if (a.hasAttribute('data-home')) { nav('/', location.pathname !== `${BASE_PATH}/`); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); return; }
  if (u.pathname + u.search !== location.pathname + location.search) nav(u.pathname + u.search); else window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (p === '/create') return viewCreateV2();
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
  const pl = poolOf(c.mine), st = c.status === 'graduated' ? 'Graduated' : '';
  const prog = c.status !== 'graduated' && c.progress != null ? `<i class="bar" style="width:${Math.max(2, Math.min(100, c.progress * 100)).toFixed(1)}%"></i>` : '';
  return `<a class="cc ${extra}" href="/tokens/${esc(c.mint)}" data-link aria-label="$${esc(c.ticker)}">
    <span class="wmk" aria-hidden="true"><img src="assets/brand/moneroom-logo.png" alt=""></span>
    <img class="av" src="${esc(c.image || 'assets/brand/moneroom-logo.png')}" alt="" width="36" height="36" loading="lazy">
    <div style="position:relative"><div class="tk">$${esc(c.ticker)}</div><div class="fdv">${c.fdvUsd ? usd(c.fdvUsd) : usd(20000)}</div>
    <div class="anc">Market <span>Pump.fun</span></div></div>
    <span class="minechip">${poolTile(pl, 18)}${esc(pl.n)}</span>${extra.includes('live') ? '<span class="livechip"><i></i>LIVE</span>' : ''}${st ? `<span class="st">${st}</span>` : ''}${prog}</a>`;
}
// the project's own coin, pinned first: a pump.fun coin, so it links out to pump.fun (card) and DexScreener (Chart)
const PUMP_IMG = m => `https://images.pump.fun/coin-image/${m}?variant=86x86`;
function ownCard() {
  if (CFG.ca && live.coins.some(c => c.mint === CFG.ca)) return '';
  const announced = !!CFG.ca, o = live.own || { status: 'launching' }, on = announced && o.status === 'live';
  const tk = String(o.ticker || 'MONEROOM').replace(/^\$/, '').toUpperCase(), fb = 'assets/brand/moneroom-logo.png';
  const body = `<span class="wmk" aria-hidden="true"><img src="${fb}" alt=""></span>
    <img class="av" src="${esc(on ? (o.image || PUMP_IMG(CFG.ca)) : fb)}" alt="" width="36" height="36" onerror="this.onerror=null;this.src='${fb}'">
    <div style="position:relative"><div class="tk">$${esc(tk)}</div><div class="fdv">${on ? esc(o.mcapS || '—') : announced ? 'Launching' : 'CA TBA'}</div>
    <div class="anc">Market <span>Pump.fun</span></div></div>
    <span class="minechip ownchip"><img src="assets/brand/moneroom-logo.png" alt="">Official</span>
    <span class="ownact">${on ? `<span class="ownchart" role="link" tabindex="0" data-ext="https://dexscreener.com/solana/${esc(CFG.ca)}">Chart</span>` : ''}<span class="livechip${on ? '' : ' soon'}"><i></i>${on ? 'LIVE' : announced ? 'LAUNCHING' : 'UPCOMING'}</span></span>`;
  return on ? `<a class="cc live own" href="https://pump.fun/coin/${esc(CFG.ca)}" target="_blank" rel="noreferrer" aria-label="$${esc(tk)} on pump.fun">${body}</a>`
    : `<div class="cc live own soon" aria-label="$${esc(tk)} is launching">${body}</div>`;
}
document.addEventListener('click', e => { const x = e.target.closest('[data-ext]'); if (x) { e.preventDefault(); e.stopPropagation(); window.open(x.dataset.ext, '_blank', 'noopener'); } }, true);
function openSlots(n) { return Array.from({ length: n }, () => `<a class="cc open" href="/create" data-link><span class="plus">${ICON.plus}</span><b>Launch coin + mine</b><small>Create the market and its private mine together</small></a>`).join(''); }
function heroPill() {
  if (CFG.ca) return `<div class="capill"><img src="assets/brand/moneroom-logo.png" alt=""><b>$MONEROOM</b><button class="cpy" data-copy="${esc(CFG.ca)}" aria-label="Copy the contract address">${short(CFG.ca, 5)}<span style="width:13px;height:13px;display:inline-flex">${ICON.copy}</span></button><a class="chip" href="https://dexscreener.com/solana/${esc(CFG.ca)}" target="_blank" rel="noreferrer">Chart</a></div>`;
  return `<div class="capill"><img src="assets/brand/moneroom-logo.png" alt=""><b>$MONEROOM</b><span class="cpy" aria-label="Contract address to be announced">CA&nbsp;&nbsp;${esc(CFG.caLabel || 'TBA')}</span></div>`;
}
function hdrCa() { const r = $('.hdr-r'), label = CFG.ca || CFG.caLabel; if (!label || $('#hdrca')) return; const el = document.createElement(CFG.ca ? 'button' : 'span'); el.id = 'hdrca'; el.className = 'pill ca-hdr mono'; if (CFG.ca) el.dataset.copy = CFG.ca; el.innerHTML = `CA ${CFG.ca ? short(CFG.ca, 4) : esc(label)}`; r.insertBefore(el, r.firstChild); }
const poolLive = s => live.pools && live.pools.m[s];

// ================================================================ HOME
const STEPS = [
  { k: '01 · Launch', h: 'Launch on Pump.fun.', p: 'Create a public Solana market. The coin becomes the funding surface for its own private mine.', x: 'pair' },
  { k: '02 · RandomX', h: 'Creator rewards buy compute.', p: 'Claimed creator rewards flow into the coin’s mining vault and purchase RandomX hashrate through the mining pool chosen at launch.', x: 'pools' },
  { k: '03 · XMR', h: 'The mine produces native XMR.', p: 'The selected pool pays the mine in Monero. A view-only treasury makes incoming rewards auditable without exposing a spend key.', x: 'xmr' },
  { k: '04 · Private claim', h: 'Holders settle privately.', p: 'Each epoch turns a public holder snapshot into one-time claim rights. XMR is sent to a fresh Monero address, outside the public Solana graph.', x: 'holders' },
];
function viewHome() {
  const stepX = x => x === 'pools' ? `<div class="mx-pools">${POOLS.slice(0, 6).map(p => poolTile(p, 30)).join('')}<span>+6 more</span></div>`
    : x === 'xmr' ? `<div class="mx-float">${xmrTok(22)}<b>XMR</b><span id="st-fp">—</span><span id="st-fc" class="muted">—</span></div>`
      : x === 'pair' ? `<div class="mx-pairs"><span aria-hidden="true" style="width:9px;height:9px;border-radius:50%;background:#62d84e;box-shadow:0 0 12px #62d84e"></span><b>Pump.fun</b><span>public market</span></div>`
        : `<div class="mx-hold"><span>${xmrTok(20)}</span><b>Private XMR claim</b><span class="muted">one epoch at a time</span></div>`;
  VIEW.innerHTML = `<div class="mwrap" id="mwrap" style="--steps:${STEPS.length}">${HOME_HERO_HTML}</div>
  <section class="sec" id="pools">
    <div class="rv secrow"><div><div class="sec-k">Monero mining pools</div><h2 class="sec-h">One mine, your choice of active pool.</h2><p class="sec-p">Choose decentralized P2Pool or another established RandomX pool. The pool can change without changing the coin or its native XMR settlement policy.</p></div><div class="netchip" id="netchip"><span class="dot"></span>Algorithm <b id="net-hr">RandomX</b></div></div>
    <div class="pgrid12 rv" id="pgrid">${POOLS.map(p => `<a class="poolc" href="/create?pool=${p.s}" data-link data-pool="${p.s}">${poolTile(p, 46)}<div class="pc-n"><b>${esc(p.n)}</b><small data-f="share">Ready</small></div><div class="pc-b"><span data-f="hr">XMR</span><span data-f="blocks">Pool</span></div></a>`).join('')}</div>
  </section>
  <section class="sec">
    <div class="flc grad rv" id="flc">
      <div class="flc-l">
        <div class="sec-k">Paid in native XMR</div>
        <h2 class="sec-h" style="margin-top:.5rem">Public activity funds private settlement.</h2>
        <p class="sec-p">The token trades publicly on Solana. The mine produces native XMR, and eligible holders claim to fresh Monero addresses. No wrapped reward token and no public recipient graph.</p>
        <div class="flc-px"><span>${xmrTok(30)}</span><b id="fl-p">—</b><em id="fl-c" class="muted">—</em></div>
        <div class="flc-st"><div><small>Market cap</small><b id="fl-m">—</b></div><div><small>24h volume</small><b id="fl-v">—</b></div><div><small>Mining</small><b>RandomX</b></div></div>
        <div class="flc-a"><a class="btn-ghost" id="fl-chart" href="https://www.coingecko.com/en/coins/monero" target="_blank" rel="noreferrer">XMR market ${ICON.ext}</a><a class="btn-ghost" href="https://www.getmonero.org" target="_blank" rel="noreferrer">Monero ${ICON.ext}</a></div>
      </div>
      <div class="flc-r"><canvas id="fl-cv" aria-label="XMR, last 7 days"></canvas><span class="flc-k">XMR · 7 days</span></div>
    </div>
  </section>
  <section class="sec">
    <div class="rv secrow"><div><div class="sec-k">Live mines</div><h2 class="sec-h">Pump.fun coins with private output.</h2><p class="sec-p">Creator rewards fund RandomX compute; completed epochs settle in native XMR.</p></div><a class="btn-ghost" href="/tokens" data-link>Explore</a></div>
    <div class="grid3 rv" id="home-coins"></div>
  </section>
  <section class="sec">
    <div class="rv"><div class="sec-k">Creator reward policy</div><h2 class="sec-h">Most of every claimed reward buys compute.</h2><p class="sec-p">This allocation applies after Pump.fun creator rewards reach the Moneroom vault. It does not change Pump.fun’s own fee schedule.</p></div>
    <div class="split2 card rv">
      <div class="sbar"><i style="flex:85" class="s1"></i><i style="flex:5" class="s2"></i><i style="flex:5" class="s3"></i><i style="flex:3" class="s4"></i><i style="flex:2" class="s5"></i></div>
      <div class="slegend">
        <div class="hot"><b>85%</b><span>RandomX compute</span><small>Purchases hashrate for the coin’s mine.</small></div>
        <div><b>5%</b><span>Pool overhead</span><small>Pool, node and routing costs.</small></div>
        <div><b>5%</b><span>Private settlement</span><small>Builds and broadcasts XMR claim batches.</small></div>
        <div><b>3%</b><span>Operations</span><small>Monitoring, indexing and failover.</small></div>
        <div><b>2%</b><span>Protocol</span><small>Maintains Moneroom infrastructure.</small></div>
      </div>
    </div>
  </section>
  <section class="sec">
    <div class="ctaband rv"><img src="assets/brand/cta-island-moneroom.jpg" alt="Moneroom mining island" loading="lazy"><div><h2>Open a private mine on Pump.fun.</h2><p>Launch the public market, choose a RandomX pool, then bind creator rewards to native XMR settlement.</p><a class="cta" href="/create" data-link style="margin-top:1.25rem">LAUNCH COIN + MINE</a></div></div>
  </section>
  <footer class="site-foot">
    <a class="pwr" style="margin:0" href="https://pump.fun" target="_blank" rel="noreferrer">Launch market <span>Pump.fun</span></a>
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
    const P = live.pools; if (!P) return;
    $$('#pgrid [data-pool]').forEach(a => { const d = P.m[a.dataset.pool]; const set = (f, v) => { const e = $(`[data-f="${f}"]`, a); if (e && e.textContent !== v) e.textContent = v; }; set('share', d ? d.status : 'Ready'); set('hr', 'XMR'); set('blocks', 'Pool'); });
  };
  // XMR market
  const fl = () => {
    const f = live.xmr; if (!f) return;
    $('#fl-p').textContent = price(f.price); const c = $('#fl-c'); c.textContent = pct(f.chg) + ' 24h'; c.className = cls(f.chg);
    $('#fl-m').textContent = usd(f.mcap); $('#fl-v').textContent = usd(f.vol); if (f.url) $('#fl-chart').href = f.url;
    const sp = $('#st-fp'), sc = $('#st-fc'); if (sp) { sp.textContent = price(f.price); sc.textContent = pct(f.chg) + ' 24h'; sc.className = cls(f.chg); }
  };
  const flChart = () => {
    const cv = $('#fl-cv'), cs = live.xmrCs; if (!cv) return; const { w, h, d } = fitCanvas(cv), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, h);
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
  live.subs.add(k => { if (k === 'pools') pools(); else if (k === 'xmr') fl(); else if (k === 'xmrcs') flChart(); else if (k === 'coins' || k === 'own') coins(); });
}

// the island: pinned behind the hero; scrolling flies the camera through launch, RandomX, XMR and claims
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
  const F = FMAPP.F = { pair: byId.get(q.get('pair')) || null, mine: POOLS.some(p => p.s === q.get('pool')) ? q.get('pool') : 'p2pool', ticker: '', name: '', file: null, preview: '', web: '', x: '', tg: '', desc: '', tier: 0, buy: '', cat: 'All', find: '' };
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

// ================================================================ PUMP.FUN LAUNCH + MINE CONFIGURATION
function viewCreateV2() {
  const q = new URLSearchParams(location.search);
  const F = { mine: POOLS.some(p => p.s === q.get('pool')) ? q.get('pool') : 'p2pool', ticker: '', name: '', desc: '', web: '', x: '', tg: '', xmr: '', buy: '', file: null, preview: '' };
  VIEW.innerHTML = `<div class="page">
    <h1 class="ph1">Launch a coin and its mine</h1>
    <p class="psub">Create the Pump.fun coin inside Moneroom. The same launch binds its creator rewards to a RandomX pool and native XMR settlement.</p>
    <div class="cgrid"><div>
      <section class="card step"><div class="step-h"><span class="num-c">1</span><div><h2>Name your coin</h2><p>This is the public identity shown on Pump.fun and across Solana.</p></div></div>
        <div class="two" style="margin-top:1rem"><div><label class="lbl" for="lc-tk">Ticker</label><input class="inp mono" id="lc-tk" maxlength="13" placeholder="TICKER" autocomplete="off"></div><div><label class="lbl" for="lc-name">Name</label><input class="inp" id="lc-name" maxlength="32" placeholder="Coin name" autocomplete="off"></div></div>
        <label class="lbl" for="lc-desc" style="margin-top:1rem">Description</label><textarea class="inp" id="lc-desc" maxlength="500" rows="4" placeholder="What is this coin for?"></textarea>
      </section>
      <section class="card step media-step"><div class="step-h"><span class="num-c">2</span><div><h2>Add artwork and project links</h2><p>Your image becomes the public coin artwork. Links are optional and can be added before launch.</p></div></div>
        <label class="launch-upload" id="lc-drop"><input type="file" id="lc-img" accept="image/png,image/jpeg,image/gif,image/webp"><span class="launch-upload-icon" id="lc-img-preview">${ICON.plus}</span><span class="launch-upload-copy" id="lc-imgl"><b>Upload coin artwork</b><small>PNG, JPG, GIF or WebP · up to 8 MB</small></span><span class="launch-upload-action">Choose file</span></label>
        <div class="project-links"><label><span>Website</span><input class="inp" id="lc-web" type="url" placeholder="https://yourproject.com"></label><label><span>X</span><input class="inp" id="lc-x" type="url" placeholder="https://x.com/project"></label><label><span>Telegram</span><input class="inp" id="lc-tg" type="url" placeholder="https://t.me/project"></label></div>
      </section>
      <section class="card step"><div class="step-h"><span class="num-c">3</span><div><h2>Choose the mining pool</h2><p>Pick decentralized P2Pool or another active Monero pool. Every option settles mining output in native XMR.</p></div></div>
        <div class="pools" id="c-pools" style="margin-top:1rem">${POOLS.map(p => `<button class="pchoice ${p.s === F.mine ? 'on' : ''}" data-m="${p.s}">${poolTile(p, 34)}<div style="min-width:0"><b>${esc(p.n)}</b><small>RandomX · XMR</small></div><span class="pck">${ICON.check}</span></button>`).join('')}</div>
      </section>
      <section class="card step"><div class="step-h"><span class="num-c">4</span><div><h2>Set the private settlement address</h2><p>Use a fresh Monero address. It is used for XMR settlement only and is never placed in the token metadata.</p></div></div>
        <label class="lbl" for="c-xmr" style="margin-top:1rem">Monero address</label><input class="inp mono" id="c-xmr" placeholder="4... or 8..." autocomplete="off">
      </section>
      <section class="card step"><div class="step-h"><span class="num-c">5</span><div><h2>Choose the initial buy</h2><p>Optional. The buy is signed by your connected wallet after the coin is created.</p></div></div>
        <label class="lbl" for="lc-buy" style="margin-top:1rem">Initial buy in SOL</label><input class="inp mono" id="lc-buy" inputmode="decimal" placeholder="0.00">
      </section>
      <section class="card step"><div class="step-h"><span class="num-c">6</span><div><h2>Launch and start the mine</h2><p>Your wallet signs the Pump.fun creation. Moneroom records the new mint and starts its mining policy from the same configuration.</p></div></div>
        <div class="rwd" style="margin-top:1rem"><span class="rwd-i">${xmrTok(28)}</span><div><b>Native XMR output</b><small>No wrapped reward token. No public recipient graph.</small></div><span class="rwd-k">${ICON.lock}Private</span></div>
      </section>
    </div><aside class="launch-review">
      <div class="card review-in"><div class="review-title"><div><div class="rv-k">REVIEW LAUNCH</div><p>Confirm the configuration before signing.</p></div><span>DRAFT</span></div>
        <div class="rv-coin"><span class="ph" id="lr-ph">?</span><div><b id="lr-tk">$TICKER</b><small id="lr-name">Your coin</small></div></div>
        <div class="rv-rows"><div><span>Market</span><b>Pump.fun</b></div>
        <div><span>Funding</span><b>Creator rewards</b></div>
        <div><span>Pool</span><b id="r-pool">${esc(poolOf(F.mine).n)}</b></div>
        <div><span>Algorithm</span><b>RandomX</b></div>
        <div><span>Output</span><b>${xmrTok(14)} Native XMR</b></div>
        <div><span>Initial buy</span><b id="lr-buy">—</b></div>
        <div><span>Creator</span><b class="mono" id="lr-wallet">Not connected</b></div></div>
        <p class="rv-note" id="r-note">The coin and its private mine are created together.</p>
        <button class="rv-btn" id="lr-go">SELECT WALLET</button>
      </div>
    </aside></div>
  </div>`;
  $('#c-pools').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; F.mine = b.dataset.m; $$('#c-pools [data-m]').forEach(x => x.classList.toggle('on', x === b)); $('#r-pool').textContent = poolOf(F.mine).n; };
  const sync = () => { $('#lr-tk').textContent = '$' + (F.ticker || 'TICKER'); $('#lr-name').textContent = F.name || 'Your coin'; $('#lr-buy').textContent = +F.buy > 0 ? `${F.buy} SOL` : '—'; const a = wAddr(); $('#lr-wallet').textContent = a ? short(a, 5) : 'Not connected'; $('#lr-go').textContent = a ? 'LAUNCH COIN' : 'SELECT WALLET'; };
  $('#lc-tk').oninput = e => { F.ticker = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 13); e.target.value = F.ticker; sync(); };
  $('#lc-name').oninput = e => { F.name = e.target.value.slice(0, 32); sync(); };
  $('#lc-desc').oninput = e => { F.desc = e.target.value.slice(0, 500); };
  $('#lc-web').oninput = e => { F.web = e.target.value; }; $('#lc-x').oninput = e => { F.x = e.target.value; }; $('#lc-tg').oninput = e => { F.tg = e.target.value; };
  $('#c-xmr').oninput = e => { F.xmr = e.target.value.trim(); };
  $('#lc-buy').oninput = e => { F.buy = e.target.value.replace(/[^0-9.]/g, '').slice(0, 10); e.target.value = F.buy; sync(); };
  $('#lc-img').onchange = e => { const f = e.target.files[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return toast('Image must be under 8 MB'); F.file = f; if (F.preview) URL.revokeObjectURL(F.preview); F.preview = URL.createObjectURL(f); $('#lc-drop').classList.add('has'); $('#lc-img-preview').innerHTML = `<img src="${F.preview}" alt="Coin artwork preview">`; $('#lc-imgl').innerHTML = `<b>${esc(f.name.slice(0, 36))}</b><small>Artwork ready · click to replace</small>`; $('#lr-ph').innerHTML = `<img src="${F.preview}" alt="">`; };
  rerenderOnWallet = sync;
  $('#lr-go').onclick = async () => {
    if (!wAddr()) { await pickWallet(); sync(); return; }
    const err = !F.ticker ? 'Enter a ticker.' : !F.name.trim() ? 'Enter the coin name.' : !F.file ? 'Upload the coin image.' : !/^[48][1-9A-HJ-NP-Za-km-z]{90,105}$/.test(F.xmr) ? 'Enter a valid primary Monero address or subaddress.' : null;
    if (err) { $('#r-note').innerHTML = `<span class="bad">${esc(err)}</span>`; return; }
    localStorage.setItem('moneroom:launch-draft', JSON.stringify({ ...F, file: undefined, preview: undefined, creator: wAddr(), savedAt: Date.now() }));
    $('#r-note').textContent = 'Launch configuration ready. Preparing the Pump.fun creation transaction…';
    toast('Launch configuration saved');
  };
  sync();
}

// ================================================================ EXPLORE
function viewExplore() {
  const st = { q: '', sort: 'fdv', pool: 'all' };
  VIEW.innerHTML = `<div class="page" style="padding-top:1.25rem">
    <section class="grad xhero xh-mine"><img class="xh-img" src="assets/brand/explore.jpg" alt=""><div class="in"><h2>Public coins. Private mining output.</h2><p>Every listed coin uses Pump.fun creator rewards to fund RandomX compute and settles completed epochs in native XMR.</p><a class="btn" href="/create" data-link>Launch coin + mine</a></div></section>
    <div class="xbar"><form class="xsearch" id="x-f"><input id="x-q" placeholder="Type token name or address" aria-label="Search coins">${ICON.search}</form>
      <div class="xctl"><span class="xbrand"><b>MONEROOM</b><span class="muted">Mines</span></span><span class="muted hide-sm" style="font-size:.875rem">Sort</span><div class="seg" id="x-sort"><button class="on" data-s="fdv">FDV</button><button data-s="recent">Recent</button></div></div></div>
    <div class="tabs" id="x-tabs"><button class="on" data-t="all">All</button>${POOLS.map(p => `<button data-t="${p.s}">${esc(p.n)}</button>`).join('')}</div>
    <div class="grid3" id="x-grid"></div></div>`;
  const draw = () => {
    let L = live.coins.filter(c => c.protocol === 'moneroom-v2' || c.settlement === 'xmr'); const q = st.q.trim().toLowerCase();
    if (q) L = L.filter(c => (c.ticker || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || c.mint === st.q.trim());
    if (st.pool !== 'all') L = L.filter(c => c.mine === st.pool);
    L.sort((a, b) => st.sort === 'recent' ? (b.createdAt || 0) - (a.createdAt || 0) : (b.fdvUsd || 0) - (a.fdvUsd || 0));
    const g = $('#x-grid'); if (!g) return;
    const o = live.own || {}, ownHit = st.pool === 'all' && (!q || 'moneroom official upcoming ca tba'.includes(q) || String(o.ticker || '').toLowerCase().includes(q) || String(o.name || '').toLowerCase().includes(q) || (!!CFG.ca && st.q.trim() === CFG.ca));
    const own = ownHit ? ownCard() : '', n = L.length + (own ? 1 : 0);
    g.innerHTML = own + L.map(c => coinCard(c, c.mint === CFG.ca ? 'live' : '')).join('') + (q || st.pool !== 'all' ? (n ? '' : `<p class="empty" style="grid-column:1/-1">No mines match.</p>`) : openSlots(Math.max(3 - n, n % 3 ? 3 - n % 3 : 0)));
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
  if (!c) { box.innerHTML = `<div class="card card-p"><b>Mine not registered</b><p class="psub">This address is not in the Moneroom registry. <a class="lnk" href="https://pump.fun/coin/${esc(mint)}" target="_blank" rel="noreferrer">Open it on Pump.fun</a></p></div>`; return; }
  const p = pairOf(c), pl = poolOf(c.mine);
  const soc = [c.x && `<a href="${esc(c.x)}" target="_blank" rel="noreferrer" aria-label="X">${ICON.x}</a>`, c.tg && `<a href="${esc(c.tg)}" target="_blank" rel="noreferrer" aria-label="Telegram">${ICON.tg}</a>`, c.web && `<a href="${esc(c.web)}" target="_blank" rel="noreferrer" aria-label="Website">${ICON.link}</a>`].filter(Boolean).join('');
  box.innerHTML = `
    <div class="card chead"><img class="av" src="${esc(c.image)}" alt=""><div style="min-width:0"><h1>$${esc(c.ticker)} <small>${esc(c.name)}</small></h1><span class="anchip">Market <b>Pump.fun</b></span> <span class="minechip inl">${poolTile(pl, 16)}${esc(pl.n)}</span>${soc ? `<div class="soc">${soc}</div>` : ''}</div></div>
    <div class="card chart-card"><div class="chart-top"><div class="tf" id="cp-tf"><button data-r="3600">1H</button><button data-r="14400">4H</button><button class="on" data-r="86400">1D</button><button data-r="604800">7D</button><button data-r="0">ALL</button></div><div class="chart-v" id="cp-fdv">${c.fdvUsd ? usd(c.fdvUsd) : usd(20000)}</div></div><div class="chart"><canvas id="cp-cv"></canvas></div></div>
    <div class="card minec"><div class="kk"><span class="dt"></span>The mine <em>· running</em></div>
      <div class="mine-h">${poolTile(pl, 44)}<div><b>${esc(pl.n)}</b><small id="cp-ps">RandomX pool ready</small></div><span class="mine-to">${xmrTok(18)}Native XMR output</span></div>
      <div class="pgrid4"><div><small>Algorithm</small><b>RandomX</b></div><div><small>Pool</small><b id="cp-hr">${esc(pl.tag)}</b></div><div><small>XMR</small><b id="cp-fp">—</b></div><div><small>Settlement</small><b>Private claim</b></div></div>
      <p class="pnote">Claimed creator rewards fund this coin’s RandomX pool. Completed mining epochs settle as native XMR to fresh Monero addresses.</p></div>
    <div class="card grad-card">${c.status === 'graduated' ? `<div><b>Graduated on Pump.fun</b><div class="gs">Market liquidity has migrated to PumpSwap</div></div>` : `<div><b>Pump.fun bonding curve</b><div class="prog"><i style="width:${Math.max(2, Math.min(100, (c.progress || 0) * 100)).toFixed(1)}%"></i></div></div><div class="muted" style="font-size:.875rem">${((c.progress || 0) * 100).toFixed(1)}% to graduation</div>`}</div>
    <div class="card about"><div class="about-h">About</div>
      <div class="about-r"><span>Name</span><div>${esc(c.name)}</div></div>
      <div class="about-r"><span>Ticker</span><div>$${esc(c.ticker)}</div></div>
      <div class="about-r"><span>CA</span><div class="mono" style="font-size:.8125rem">${esc(short(c.mint, 6))}<button class="cp" data-copy="${esc(c.mint)}">${ICON.copy}</button></div></div>
      <div class="about-r"><span>Market</span><div>Pump.fun</div></div>
      <div class="about-r"><span>Mining pool</span><div>${esc(pl.n)}</div></div>
      <div class="about-r"><span>Rewards</span><div>Native XMR private claims</div></div>
      <div class="about-r"><span>Mining vault</span><div class="mono" style="font-size:.8125rem">${esc(short(c.vault, 6))}<button class="cp" data-copy="${esc(c.vault)}">${ICON.copy}</button></div></div>
      <div class="about-r"><span>Description</span><div style="font-weight:500">${esc(c.desc || '-')}</div></div>
      <div class="about-r"><span>Supply</span><div>1,000,000,000</div></div>
      <div class="about-r"><span>Mint</span><div>Fixed supply · no freeze authority</div></div>
      <div class="about-r"><span>Pump.fun</span><div><a href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noreferrer">Open market ${ICON.ext}</a></div></div>
      <div class="about-r"><span>DexScreener</span><div><a href="https://dexscreener.com/solana/${esc(c.mint)}" target="_blank" rel="noreferrer">View chart ${ICON.ext}</a></div></div>
    </div>`;
  const mineLive = () => { if (live.xmr && $('#cp-fp')) $('#cp-fp').textContent = price(live.xmr.price); };
  mineLive(); live.subs.add(k => { if (k === 'xmr') mineLive(); });
  // public Solana market chart
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
  VIEW.innerHTML = `<div class="page"><h1 class="ph1">Mines</h1><p class="psub">Active Monero mining pools available to Moneroom coins. Pool selection can change without changing the token or its XMR settlement rules.</p>
    <div class="stats4"><div class="card stat"><small>Algorithm</small><b>RandomX</b><p>CPU-friendly proof of work</p></div><div class="card stat"><small>Settlement asset</small><b>XMR</b><p>Native Monero output</p></div><div class="card stat"><small>Preferred route</small><b>P2Pool</b><p>Decentralized pool mining</p></div><div class="card stat"><small>XMR market</small><b id="mn-f">—</b><p id="mn-fc">Price, live</p></div></div>
    <div class="tbl"><div class="tbl-scroll"><table><thead><tr><th>#</th><th>Pool</th><th>Model</th><th>Output</th><th class="r col-hide">Audit</th><th class="r"></th></tr></thead><tbody>${POOLS.map((p, i) => `<tr class="ours"><td class="muted">${i + 1}</td><td><div class="tas">${poolTile(p, 28)}<div><b>${esc(p.n)}</b><small>RandomX pool</small></div></div></td><td>${p.s.startsWith('p2pool') ? 'Decentralized' : 'Mining pool'}</td><td>Native XMR</td><td class="r col-hide">View-only treasury</td><td class="r"><a class="minebtn" href="/create?pool=${p.s}" data-link>Select</a></td></tr>`).join('')}</tbody></table></div></div></div>`;
  const xmr = () => { if (!live.xmr) return; $('#mn-f').textContent = price(live.xmr.price); const e = $('#mn-fc'); e.textContent = pct(live.xmr.chg) + ' in 24h'; e.className = cls(live.xmr.chg); };
  xmr(); live.subs.add(k => { if (k === 'xmr') xmr(); });
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
  VIEW.innerHTML = `<article class="docs"><h1>Docs</h1><p class="lead">Moneroom turns the public creator economy of a Pump.fun coin into privately settled mining output.</p>
  <nav class="toc"><a href="#how">How it works</a><a href="#launch">Public launch</a><a href="#mine">RandomX mine</a><a href="#claim">Private claims</a><a href="#audit">Audit</a><a href="#fees">Allocation</a><a href="#boundary">Privacy boundary</a><a href="#risks">Risks</a></nav>
  <h2 id="how">How it works</h2>
  <p>Moneroom connects two different systems without pretending they are the same. Pump.fun supplies a public Solana market and creator rewards. Monero supplies RandomX proof of work and private native settlement. Moneroom is the policy layer between them.</p>
  <p>A launched coin receives its own mining configuration: creator-reward vault, RandomX pool, epoch schedule and settlement policy. Claimed creator rewards purchase compute. Mining output arrives as XMR. Eligible holders then exercise one-time claims to fresh Monero addresses.</p>
  <h2 id="launch">Public launch</h2>
  <p>The coin is created and traded on Pump.fun. Its contract address, trades and holder balances are public Solana data. Moneroom indexes those public facts to calculate eligibility; it does not make the Solana token private.</p>
  <h2 id="mine">RandomX mine</h2>
  <p>Each reward cycle allocates 85% of claimed creator rewards to RandomX compute. P2Pool provides a decentralized option, while established Monero pools provide additional operating choices. The mining output remains native XMR.</p>
  <h2 id="claim">Private claims</h2>
  <p>At an epoch boundary, Moneroom commits to an eligibility snapshot derived from public holder balances. Each eligible allocation becomes a one-time claim. The holder supplies a fresh Monero address; after settlement, the claim is nullified so it cannot be used twice.</p>
  <p>The recipient address is not written into token metadata or a public Solana transfer. Monero one-time addresses and confidential transaction data keep the XMR destination graph separate from the public market graph.</p>
  <h2 id="audit">Treasury audit</h2>
  <p>A published view-only treasury can verify incoming XMR without exposing the spend key. View-only access cannot sign transactions. Because Monero view-only wallets do not provide the same complete outgoing visibility as a transparent chain, epoch commitments and settlement receipts are published separately.</p>
  <h2 id="fees">Creator reward allocation</h2>
  <p>This policy applies only after Pump.fun creator rewards enter a Moneroom vault; it does not replace or modify Pump.fun’s own fee schedule.</p>
  <div class="card split"><div><b>85%</b><span>RandomX compute<small>Purchases hashrate for the coin’s mine.</small></span></div><div><b>5%</b><span>Pool overhead<small>Pool, node and routing costs.</small></span></div><div><b>5%</b><span>Private settlement<small>Builds and broadcasts XMR claim batches.</small></span></div><div><b>3%</b><span>Operations<small>Indexing, monitoring and failover.</small></span></div><div><b>2%</b><span>Protocol<small>Maintains Moneroom infrastructure.</small></span></div></div>
  <h2 id="boundary">Privacy boundary</h2>
  <p>Pump.fun trading is public. Holder snapshots are public. Claim eligibility can be independently recomputed. Privacy begins at the XMR settlement address: Moneroom does not claim to hide the existence of the Solana token, its trades or its holders.</p>
  <h2 id="risks">Risks</h2>
  <ul><li>Tokens are speculative and can lose all value.</li><li>Creator rewards depend on trading activity and may be too small to fund meaningful compute.</li><li>Mining output varies with RandomX difficulty, route performance and pool luck.</li><li>Cross-chain settlement introduces operational, custody and availability risk.</li><li>Never reuse a Monero address if unlinkability matters to you.</li></ul>
  <h2 id="references">Primary references</h2>
  <p><a class="lnk" href="https://pump.fun/docs/fees" target="_blank" rel="noreferrer">Pump.fun fee schedule ${ICON.ext}</a></p><p><a class="lnk" href="https://docs.getmonero.org/interacting/mining/" target="_blank" rel="noreferrer">Monero mining ${ICON.ext}</a></p><p><a class="lnk" href="https://web.getmonero.org/resources/user-guides/view_only.html" target="_blank" rel="noreferrer">Monero view-only wallets ${ICON.ext}</a></p><p><a class="lnk" href="https://web.getmonero.org/resources/moneropedia/stealthaddress.html" target="_blank" rel="noreferrer">Monero stealth addresses ${ICON.ext}</a></p>
  </article>`;
}
function viewTerms() {
  VIEW.innerHTML = `<article class="docs"><h1>Terms of Use</h1><p class="lead">Short version: public tokens, mining and cross-chain settlement all carry risk.</p><h2>Use</h2><p>Moneroom provides an interface for configuring Pump.fun creator rewards as funding for RandomX mining and native XMR settlement. You remain responsible for every token you launch, every address you submit and every transaction your wallet signs.</p><h2>No advice or guarantee</h2><p>Nothing on this site is financial advice. Tokens can go to zero. Creator rewards, hashrate, mining output and settlement timing are not guaranteed.</p><h2>Privacy</h2><p>Solana activity is public. Moneroom’s privacy claim applies to native XMR settlement, not to Pump.fun trading, holder balances or public eligibility snapshots.</p><h2>No affiliation</h2><p>Moneroom is not affiliated with Pump.fun, the Monero project, P2Pool or any mining provider.</p></article>`;
}

// ---------------------------------------------------------------- boot
Object.assign(FMAPP, { FILM, live, modal, closeModal, nav, render, PAIRS, byId, POOLS, refreshCoins });
walletBtn();
render();

// The page paints immediately from its embedded fallback. Remote CA state is
// applied after first paint so a slow config request can never hold up the UI.
async function syncRemoteConfig() {
  const next = await readRemoteConfig();
  applyRemoteConfig(next);
}
function applyRemoteConfig(next) {
  if ((next.ca || '') === (CFG.ca || '') && (next.caLabel || '') === (CFG.caLabel || '')) return;
  Object.assign(CFG, next);
  $('#hdrca')?.remove();
  hdrCa();
  const pill = $('.capill');
  if (pill) pill.outerHTML = heroPill();
  refreshOwn();
}
syncRemoteConfig();
setInterval(syncRemoteConfig, 60000);
addEventListener('visibilitychange', () => { if (!document.hidden) syncRemoteConfig(); });
loadSupabase().then(library => {
  const client = library.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  client.channel('moneroom-ca-live')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'site_config', filter: 'id=eq.moneroom',
    }, payload => applyRemoteConfig(caConfig(payload.new?.contract_address)))
    .subscribe();
}).catch(error => console.warn('Moneroom realtime unavailable:', error));
if (FILM) { document.body.classList.add('fm-film'); import('./filmmode.js').then(m => m.start && m.start(FILM, FMAPP)).catch(() => { }); }
