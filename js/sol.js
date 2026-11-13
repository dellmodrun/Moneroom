/* HypeFloat · Solana primitives + the Float launch, no dependencies (browser + Node 20+).
 * base58, sha256 PDAs with an ed25519 curve check, borsh, a hand-built legacy transaction, JSON-RPC,
 * and the Float program's `launch` instruction (3KguFi7…): the creator is the only signer, the coin mint is a PDA,
 * fee_receiver is the coin's HypeFloat perp vault.
 */
export const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const b58 = b => { let z = 0; while (z < b.length && b[z] === 0) z++; let n = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } return '1'.repeat(z) + s; };
export const unb58 = s => { s = String(s); let n = 0n; for (const ch of s) { const v = B58.indexOf(ch); if (v < 0) throw new Error('base58'); n = n * 58n + BigInt(v); } const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; } for (const ch of s) { if (ch !== '1') break; out.unshift(0); } return Uint8Array.from(out); };
export const cat = (...a) => { const o = new Uint8Array(a.reduce((n, b) => n + b.length, 0)); let i = 0; for (const b of a) { o.set(b, i); i += b.length; } return o; };
const te = new TextEncoder();
export const utf8 = s => te.encode(s);
export const key = s => { const b = typeof s === 'string' ? unb58(s) : s; if (!b || b.length !== 32) throw new Error('bad address ' + s); return b; };
export const isAddr = s => { try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && unb58(s).length === 32; } catch (_) { return false; } };
export const toB64 = u8 => { let bin = ''; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]); return btoa(bin); };
export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------------------------------------------------------------- ed25519 curve check + PDAs
const P = 2n ** 255n - 19n;
const pw = (b, e) => { let r = 1n; b %= P; while (e > 0n) { if (e & 1n) r = r * b % P; b = b * b % P; e >>= 1n; } return r; };
const D = (-121665n * pw(121666n, P - 2n)) % P + P;
export function onCurve(bytes) {
  let y = 0n; for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  if (y >= P) return false;
  const y2 = y * y % P, u = (y2 - 1n + P) % P, v = (D % P * y2 + 1n) % P;
  const x2 = u * pw(v, P - 2n) % P;
  if (x2 === 0n) return (bytes[31] & 0x80) === 0;
  return pw(x2, (P - 1n) / 2n) === 1n;
}
const sha = async u8 => new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
const PDA_TAG = utf8('ProgramDerivedAddress');
const pdaCache = new Map();
export async function pda(seeds, program) {
  const pk = key(program), ck = b58(pk) + '|' + seeds.map(s => b58(s instanceof Uint8Array ? s : utf8(s))).join(',');
  if (pdaCache.has(ck)) return pdaCache.get(ck);
  const parts = seeds.map(s => (s instanceof Uint8Array ? s : utf8(s)));
  for (let bump = 255; bump >= 0; bump--) {
    const h = await sha(cat(...parts, Uint8Array.of(bump), pk, PDA_TAG));
    if (!onCurve(h)) { const r = b58(h); pdaCache.set(ck, r); return r; }
  }
  throw new Error('no PDA');
}
export const u8 = v => Uint8Array.of(v & 255);
export const u16 = v => { const d = new Uint8Array(2); new DataView(d.buffer).setUint16(0, v, true); return d; };
export const u32 = v => { const d = new Uint8Array(4); new DataView(d.buffer).setUint32(0, v, true); return d; };
export const u64 = v => { const d = new Uint8Array(8); new DataView(d.buffer).setBigUint64(0, BigInt(v), true); return d; };
export const str = s => { const b = utf8(s); return cat(u32(b.length), b); };
export const rd = {
  pk: (d, o) => b58(d.subarray(o, o + 32)),
  u64: (d, o) => new DataView(d.buffer, d.byteOffset).getBigUint64(o, true),
  i64: (d, o) => new DataView(d.buffer, d.byteOffset).getBigInt64(o, true),
  u16: (d, o) => new DataView(d.buffer, d.byteOffset).getUint16(o, true),
};

// ---------------------------------------------------------------- legacy transaction (one signer: the payer)
// ix = { program, keys: [{ pubkey, w, s }], data: Uint8Array }
export function buildTx(payer, ixs, blockhash) {
  const metas = new Map();
  const add = (k, w, s) => { const m = metas.get(k) || { k, w: false, s: false }; m.w = m.w || w; m.s = m.s || s; metas.set(k, m); };
  add(payer, true, true);
  for (const ix of ixs) { for (const a of ix.keys) add(a.pubkey, !!a.w, !!a.s); add(ix.program, false, false); }
  const all = [...metas.values()];
  const sw = all.filter(m => m.s && m.w), sr = all.filter(m => m.s && !m.w), uw = all.filter(m => !m.s && m.w), ur = all.filter(m => !m.s && !m.w);
  const payerM = sw.find(m => m.k === payer); const ordered = [payerM, ...sw.filter(m => m !== payerM), ...sr, ...uw, ...ur];
  if (sw.length + sr.length !== 1) throw new Error('only the payer may sign');
  const idx = new Map(ordered.map((m, i) => [m.k, i]));
  const cu = n => { const o = []; let v = n; do { let b = v & 0x7f; v >>= 7; if (v) b |= 0x80; o.push(b); } while (v); return Uint8Array.from(o); };
  const body = ixs.map(ix => cat(u8(idx.get(ix.program)), cu(ix.keys.length), Uint8Array.from(ix.keys.map(a => idx.get(a.pubkey))), cu(ix.data.length), ix.data));
  const msg = cat(Uint8Array.of(1, sr.length, ur.length), cu(ordered.length), ...ordered.map(m => key(m.k)), key(blockhash), cu(ixs.length), ...body);
  return { msg, tx: cat(Uint8Array.of(1), new Uint8Array(64), msg), size: 1 + 64 + msg.length };
}
export const CB = 'ComputeBudget111111111111111111111111111111';
export const cuLimit = n => ({ program: CB, keys: [], data: cat(u8(2), u32(n)) });
export const cuPrice = micro => ({ program: CB, keys: [], data: cat(u8(3), u64(micro)) });
export const loadedLimit = bytes => ({ program: CB, keys: [], data: cat(u8(4), u32(bytes)) });
export const SYS = '11111111111111111111111111111111';
export const transfer = (from, to, lamports) => ({ program: SYS, keys: [{ pubkey: from, w: 1, s: 1 }, { pubkey: to, w: 1 }], data: cat(u32(2), u64(lamports)) });

// ---------------------------------------------------------------- RPC (the site's relay by default; Node tests pass a URL)
let RPC_URL = '/api/rpc';
export const setRpc = u => { RPC_URL = u; };
export async function rpc(method, params) {
  const r = await fetch(RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  let j = {}; try { j = await r.json(); } catch (_) { }
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  if (!r.ok) throw new Error('RPC HTTP ' + r.status);
  return j.result;
}
export async function accounts(list) {
  const r = await rpc('getMultipleAccounts', [list, { encoding: 'base64', commitment: 'confirmed' }]);
  return (r && r.value || []).map(v => (v ? { owner: v.owner, lamports: v.lamports, data: fromB64(v.data[0]) } : null));
}

// ---------------------------------------------------------------- Float program
export const FLOAT = {
  program: '3KguFi7YYzLgttG46fRism16CfcuNCkDh6U7td9JTqxX',
  launchlab: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token22: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  metadata: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  rent: 'SysvarRent111111111111111111111111111111111',
  flagship: 'Bv1a7cEj5aRnJQhMw4kRQqAFesMSd5LwcDnUzq52BMmr',
  disc: { launch: Uint8Array.of(153, 241, 93, 225, 22, 69, 74, 61) },
  supply: 1_000_000_000,
};
const F = FLOAT.program, LL = FLOAT.launchlab;
export const fpda = {
  config: () => pda(['config'], F),
  quote: m => pda(['quote', key(m)], F),
  ticker: t => pda(['ticker', utf8(String(t).toUpperCase())], F),
  launch: m => pda(['launch', key(m)], F),
  platform: tier => pda(['platform', Uint8Array.of(tier)], F),
  coinVault: m => pda(['coin', key(m)], F),
  coinMint: (creator, nonce) => pda(['mint', key(creator), u64(nonce)], F),
  llAuthority: () => pda(['vault_auth_seed'], LL),
  llEvent: () => pda(['__event_authority'], LL),
  llGlobal: q => pda(['global_config', key(q), Uint8Array.of(0), Uint8Array.of(0, 0)], LL),
  llPlatform: p => pda(['platform_config', key(p)], LL),
  llPool: (base, q) => pda(['pool', key(base), key(q)], LL),
  llVault: (pool, m) => pda(['pool_vault', key(pool), key(m)], LL),
  metadata: m => pda(['metadata', key(FLOAT.metadata), key(m)], FLOAT.metadata),
};
// Config layout (offsets after the 8-byte discriminator), from the program's IDL
export function readConfig(d) {
  return {
    treasury: rd.pk(d, 40),
    tierRates: [rd.u64(d, 82), rd.u64(d, 90), rd.u64(d, 98)].map(Number),
    tierCount: d[106],
    takeoverLamports: Number(rd.u64(d, 245)),
    protectSecs: Number(rd.i64(d, 253)),
    coinSupply: rd.u64(d, 261),
    curveSellBps: rd.u16(d, 269),
    paused: d[271] === 1,
  };
}
export function readTicker(d) { return { coinMint: rd.pk(d, 8), creator: rd.pk(d, 40), claimedAt: Number(rd.i64(d, 72)) }; }
export function readLaunch(d) { return { creator: rd.pk(d, 8), feeReceiver: rd.pk(d, 40), coinMint: rd.pk(d, 72), quoteMint: rd.pk(d, 104), pool: rd.pk(d, 136), feeTier: d[168], createdAt: Number(rd.i64(d, 169)) }; }

export const randomNonce = () => crypto.getRandomValues(new BigUint64Array(1))[0];
export const TICKER_RE = /^[A-Za-z0-9]{1,10}$/;

// Everything the launch needs that lives on chain: config, the ticker record, the pair's quote asset.
export async function launchContext(pair, ticker) {
  const [cfgA, tkA, qaA] = await Promise.all([fpda.config(), fpda.ticker(ticker), fpda.quote(pair.mint)]);
  const [cfg, tk, qa] = await accounts([cfgA, tkA, qaA]);
  if (!cfg) throw new Error('Float config not found');
  const config = readConfig(cfg.data);
  const ctx = { config, tickerTaken: null, quoteListed: !!qa };
  if (tk && tk.data && tk.data.length >= 80) {
    const t = readTicker(tk.data), now = Math.floor(Date.now() / 1000);
    ctx.tickerTaken = { ...t, protectedUntil: t.claimedAt + config.protectSecs, isProtected: now < t.claimedAt + config.protectSecs, cost: config.takeoverLamports };
  }
  return ctx;
}

// The Float `launch` instruction (accounts in IDL order).
export async function launchIx({ creator, pair, name, ticker, uri, feeReceiver, tier = 0, nonce }) {
  if (!TICKER_RE.test(ticker)) throw new Error('ticker');
  const mint = await fpda.coinMint(creator, nonce);
  const quote = pair.mint, quoteProg = pair.tp || FLOAT.token;
  const platform = await fpda.platform(tier);
  const pool = await fpda.llPool(mint, quote);
  const [config, quoteAsset, tickerRec, launch, coinVault, platformConfig, llAuth, baseVault, quoteVault, metadata, event, globalConfig] = await Promise.all([
    fpda.config(), fpda.quote(quote), fpda.ticker(ticker), fpda.launch(mint), fpda.coinVault(mint), fpda.llPlatform(platform), fpda.llAuthority(),
    fpda.llVault(pool, mint), fpda.llVault(pool, quote), fpda.metadata(mint), fpda.llEvent(), pair.cfg ? Promise.resolve(pair.cfg) : fpda.llGlobal(quote)]);
  const treasury = pair._treasury;
  if (!treasury) throw new Error('treasury unknown');
  const data = cat(FLOAT.disc.launch, str(name), str(ticker), str(uri), key(feeReceiver), u8(tier), u64(nonce));
  const keys = [
    { pubkey: creator, w: 1, s: 1 }, { pubkey: config }, { pubkey: treasury, w: 1 }, { pubkey: quoteAsset }, { pubkey: quote },
    { pubkey: tickerRec, w: 1 }, { pubkey: mint, w: 1 }, { pubkey: launch, w: 1 }, { pubkey: coinVault }, { pubkey: globalConfig },
    { pubkey: platformConfig }, { pubkey: llAuth }, { pubkey: pool, w: 1 }, { pubkey: baseVault, w: 1 }, { pubkey: quoteVault, w: 1 },
    { pubkey: metadata, w: 1 }, { pubkey: event }, { pubkey: LL }, { pubkey: FLOAT.token }, { pubkey: quoteProg },
    { pubkey: FLOAT.metadata }, { pubkey: SYS }, { pubkey: FLOAT.rent },
  ];
  return { ix: { program: F, keys, data }, mint, pool, launch, coinVault };
}

// Full launch transaction: compute budget + launch (+ an optional SOL seed for the perp vault, sent in the same transaction).
export const LAUNCH_CU = 600000, LAUNCH_MICRO = 120000, LAUNCH_LOADED = 32 * 1024 * 1024;
export async function launchTx(o) {
  const ctx = o.ctx || await launchContext(o.pair, o.ticker);
  if (ctx.config.paused) throw Object.assign(new Error('Launches on Float are paused right now.'), { code: 'paused' });
  if (!ctx.quoteListed) throw Object.assign(new Error('This pair is not open on Float.'), { code: 'pair' });
  if (ctx.tickerTaken && ctx.tickerTaken.isProtected) throw Object.assign(new Error(`$${o.ticker.toUpperCase()} is protected on Float right now.`), { code: 'ticker' });
  const pair = { ...o.pair, _treasury: ctx.config.treasury };
  const nonce = o.nonce ?? randomNonce();
  const L = await launchIx({ ...o, pair, nonce });
  const ixs = [cuLimit(LAUNCH_CU), cuPrice(LAUNCH_MICRO), loadedLimit(LAUNCH_LOADED), L.ix];
  if (o.seedLamports > 0) ixs.push(transfer(o.creator, o.feeReceiver, o.seedLamports));
  const bh = o.blockhash || (await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])).value.blockhash;
  const t = buildTx(o.creator, ixs, bh);
  if (t.size > 1232) throw Object.assign(new Error('The name, ticker or link is too long for one transaction.'), { code: 'size' });
  return { ...t, ...L, nonce, ctx, takeover: ctx.tickerTaken ? ctx.config.takeoverLamports : 0 };
}
export async function simulate(tx) {
  const r = await rpc('simulateTransaction', [toB64(tx), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' }]);
  return r && r.value;
}
