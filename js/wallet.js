/* HypeFloat · Solana wallets through Wallet Standard (Phantom / Solflare / Backpack fallbacks), silent reconnect,
 * sign-then-send with rebroadcast. ?mock=1 on a local host adds an in-memory wallet that signs nothing real. */
import { b58, unb58, toB64, rpc } from './sol.js';
const isWeb = /^https?:$/.test(location.protocol);
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)$/i.test(location.hostname || '');
export const MOCK = isWeb && LOCAL && new URLSearchParams(location.search).get('mock') === '1';
const CHAIN = 'solana:mainnet';
const wait = ms => new Promise(r => setTimeout(r, ms));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) { } }
};
const P = MOCK ? 'hf:mock:' : 'hf:', KW = P + 'wallet';
export class WErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (c, m) => { throw new WErr(c, m); };
const msgOf = e => String((e && (e.message || e.error || e)) || 'unknown error').slice(0, 180);
const isReject = e => !!e && (e.code === 4001 || /reject|denied|cancel|declin|closed|abort/i.test(msgOf(e)));
const toU8 = s => s instanceof Uint8Array ? s : s instanceof ArrayBuffer ? new Uint8Array(s) : s && s.data ? Uint8Array.from(s.data) : Array.isArray(s) ? Uint8Array.from(s) : null;
const tile = (l, bg, fg = '#fff') => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${bg}"/><text x="16" y="21.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="${fg}">${l}</text></svg>`);

const W = { list: [], std: null, acct: null, prov: null, address: null, name: '', icon: '', off: null, tried: false, subs: new Set(), wsubs: new Set() };
const emit = () => W.subs.forEach(f => { try { f(W.address); } catch (_) { } });
const isSol = a => a && (a.chains || []).some(c => String(c).startsWith('solana:'));
const pick = accs => (accs || []).find(isSol) || (accs || [])[0] || null;
function addW(w) {
  try {
    if (!w || !w.features || !Array.isArray(w.chains) || !w.chains.some(c => String(c).startsWith('solana:')) || !w.features['standard:connect']) return;
    if (W.list.some(x => x === w || x.name === w.name)) return;
    W.list.push(w); W.wsubs.forEach(f => f()); autoConnect();
  } catch (_) { }
}
function legacy() {
  if (MOCK) return [];
  const L = [], has = re => W.list.some(w => re.test(w.name));
  try { const p = window.phantom && window.phantom.solana; if (p && p.connect && !has(/phantom/i)) L.push({ name: 'Phantom', icon: tile('P', '#ab9ff2', '#1c1c33'), p }); } catch (_) { }
  try { const p = window.solflare; if (p && p.connect && !has(/solflare/i)) L.push({ name: 'Solflare', icon: tile('S', '#fc7227'), p }); } catch (_) { }
  try { const p = window.backpack; if (p && p.connect && !has(/backpack/i)) L.push({ name: 'Backpack', icon: tile('B', '#e33e3f'), p }); } catch (_) { }
  return L;
}
export const wallets = () => W.list.map(w => ({ name: w.name, icon: w.icon || tile('W', '#111') })).concat(legacy().map(l => ({ name: l.name, icon: l.icon })));
export const address = () => W.address;
export const walletName = () => W.name;
export const walletIcon = () => W.icon;
export const onChange = f => { W.subs.add(f); return () => W.subs.delete(f); };
export const onWallets = f => { W.wsubs.add(f); return () => W.wsubs.delete(f); };
function setAddr(a) { const prev = W.address; W.address = a || null; LS.set(KW, a ? { addr: a, name: W.name, std: !!W.std } : null); if (prev !== W.address) emit(); }
function watch() {
  if (W.off) { try { W.off(); } catch (_) { } } W.off = null;
  try {
    if (W.std && W.std.features['standard:events']) {
      W.off = W.std.features['standard:events'].on('change', p => {
        if (!p || !p.accounts) return; const a = pick(p.accounts);
        if (!a) { W.std = W.acct = null; W.name = ''; setAddr(null); return; }
        if (a.address !== W.address) { W.acct = a; setAddr(a.address); }
      });
    } else if (W.prov && W.prov.on) {
      const pv = W.prov, h = pk => { if (pk) setAddr(pk.toString()); else { W.prov = null; W.name = ''; setAddr(null); } };
      pv.on('accountChanged', h); W.off = () => { try { (pv.off || pv.removeListener).call(pv, 'accountChanged', h); } catch (_) { } };
    }
  } catch (_) { }
}
export function problem() {
  if (!isWeb) return { text: 'Wallets only work on the web address. Open the site from its URL, not as a file.' };
  if (wallets().length) return null;
  const here = location.href.split('#')[0];
  return {
    text: 'No Solana wallet found in this browser. Install Phantom or Solflare, or open this page inside your wallet app.',
    links: [
      { label: 'Open in Phantom', url: 'https://phantom.app/ul/browse/' + encodeURIComponent(here) + '?ref=' + encodeURIComponent(location.origin) },
      { label: 'Open in Solflare', url: 'https://solflare.com/ul/v1/browse/' + encodeURIComponent(here) + '?ref=' + encodeURIComponent(location.origin) },
      { label: 'Get Phantom', url: 'https://phantom.com/download' }]
  };
}
export async function connect(name) {
  const pr = problem(); if (pr) fail('noWallet', pr.text);
  const opts = wallets(), o = name ? opts.find(x => x.name === name) : opts[0];
  if (!o) fail('noWallet', 'That wallet is not available in this browser.');
  try {
    const w = W.list.find(x => x.name === o.name);
    if (w) {
      const r = await w.features['standard:connect'].connect(), a = pick((r && r.accounts) || w.accounts);
      if (!a) fail('wallet', 'The wallet did not share an account.');
      W.std = w; W.acct = a; W.prov = null; W.name = w.name; W.icon = w.icon || ''; setAddr(a.address);
    } else {
      const L = legacy().find(l => l.name === o.name), r = await L.p.connect(), pk = (r && r.publicKey) || L.p.publicKey;
      if (!pk) fail('wallet', 'The wallet did not share an account.');
      W.prov = L.p; W.std = W.acct = null; W.name = L.name; W.icon = L.icon; setAddr(pk.toString());
    }
  } catch (e) { if (e instanceof WErr) throw e; if (isReject(e)) fail('rejected', 'You cancelled in the wallet.'); fail('wallet', 'The wallet did not connect: ' + msgOf(e)); }
  watch(); return W.address;
}
export function disconnect() {
  try { if (W.std && W.std.features['standard:disconnect']) W.std.features['standard:disconnect'].disconnect(); else if (W.prov && W.prov.disconnect) W.prov.disconnect(); } catch (_) { }
  if (W.off) { try { W.off(); } catch (_) { } }
  W.std = W.acct = W.prov = W.off = null; W.name = ''; W.icon = ''; setAddr(null);
}
async function autoConnect() {
  if (W.address || W.tried || !isWeb) return;
  const s = LS.get(KW, null); if (!s || !s.addr) return;
  if (s.std) {
    const w = W.list.find(x => x.name === s.name); if (!w) return; W.tried = true;
    try { const r = await w.features['standard:connect'].connect({ silent: true }), a = ((r && r.accounts) || w.accounts || []).find(x => x.address === s.addr); if (a && !W.address) { W.std = w; W.acct = a; W.name = w.name; W.icon = w.icon || ''; setAddr(a.address); watch(); } } catch (_) { }
  } else {
    if (MOCK) return;
    const pv = /solflare/i.test(s.name) ? window.solflare : /backpack/i.test(s.name) ? window.backpack : (window.phantom && window.phantom.solana);
    if (!pv || !pv.connect) return; W.tried = true;
    try { const r = await pv.connect({ onlyIfTrusted: true }), pk = ((r && r.publicKey) || pv.publicKey || '').toString(); if (pk === s.addr && !W.address) { W.prov = pv; W.name = s.name; W.icon = tile(s.name[0], '#333'); setAddr(pk); watch(); } } catch (_) { }
  }
}

// sign a hand-built transaction (wallet signs first; nothing else signs), then the site sends it and repeats until it lands
export async function signAndSend(tx, onStep = () => { }) {
  if (!W.address) fail('needWallet', 'Connect a Solana wallet first.');
  const f = W.std && W.std.features;
  let signed = null, sig = null;
  try {
    if (f && f['solana:signTransaction']) {
      const out = await f['solana:signTransaction'].signTransaction({ account: W.acct, chain: CHAIN, transaction: tx }), r = Array.isArray(out) ? out[0] : out;
      signed = toU8(r && (r.signedTransaction || r));
    } else if (f && f['solana:signAndSendTransaction']) {
      const out = await f['solana:signAndSendTransaction'].signAndSendTransaction({ account: W.acct, chain: CHAIN, transaction: tx }), r = Array.isArray(out) ? out[0] : out, s = r && (r.signature || r);
      sig = typeof s === 'string' ? s : b58(toU8(s));
    } else if (W.prov && W.prov.request) {
      const r = await W.prov.request({ method: 'signTransaction', params: { message: b58(tx.subarray(65)) } });
      if (r && r.signature) { signed = tx.slice(); signed.set(unb58(r.signature), 1); }
    }
  } catch (e) { if (isReject(e)) fail('rejected', 'You cancelled in the wallet. Nothing was sent.'); fail('wallet', 'The wallet could not sign: ' + msgOf(e)); }
  if (!signed && !sig) fail('wallet', 'This wallet cannot sign here. Try Phantom, Solflare or Backpack.');
  onStep('sent');
  if (signed) {
    sig = b58(signed.subarray(1, 65));
    if (MOCK) return sig;
    for (let i = 0; ; i++) {
      try { await rpc('sendTransaction', [toB64(signed), { encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3 }]); break; }
      catch (e) {
        if (/already been processed/i.test(msgOf(e))) break;
        if (/insufficient|debit an account|0x1\b/i.test(msgOf(e))) fail('funds', 'Not enough SOL in this wallet for the launch and the network fee.');
        if (!/blockhash/i.test(msgOf(e)) || i >= 2) fail('send', 'Solana did not take the transaction: ' + msgOf(e));
        await wait(1500);
      }
    }
    (async () => { for (let i = 0; i < 20; i++) { await wait(4000); const v = await rpc('getSignatureStatuses', [[sig]]).then(r => r && r.value && r.value[0]).catch(() => null); if (v && (v.err || v.confirmationStatus)) return; rpc('sendTransaction', [toB64(signed), { encoding: 'base64', skipPreflight: true, maxRetries: 0 }]).catch(() => { }); } })();
  }
  return sig;
}
export async function confirmed(sig, tries = 60) {
  if (MOCK) { await wait(900); return 'ok'; }
  for (let i = 0; i < tries; i++) {
    try { const v = ((await rpc('getSignatureStatuses', [[sig]])) || {}).value || []; if (v[0] && v[0].err) return 'failed'; if (v[0] && /confirmed|finalized/.test(v[0].confirmationStatus || '')) return 'ok'; } catch (_) { }
    await wait(1500);
  }
  return 'unknown';
}

function mockWallet() {
  let addr = LS.get(P + 'addr', null);
  if (typeof addr !== 'string' || addr.length < 32) { addr = b58(crypto.getRandomValues(new Uint8Array(32))); LS.set(P + 'addr', addr); }
  const acct = { address: addr, publicKey: unb58(addr), chains: [CHAIN], features: ['solana:signTransaction'] };
  const w = {
    version: '1.0.0', name: 'Mock Wallet', icon: tile('M', '#3d8bff'), chains: [CHAIN], accounts: [],
    features: {
      'standard:connect': { version: '1.0.0', connect: async o => { if (o && o.silent && !LS.get(P + 'on', false)) return { accounts: [] }; await wait(250); LS.set(P + 'on', true); w.accounts = [acct]; return { accounts: w.accounts }; } },
      'standard:disconnect': { version: '1.0.0', disconnect: async () => { LS.set(P + 'on', null); w.accounts = []; } },
      'standard:events': { version: '1.0.0', on: () => () => { } },
      'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signTransaction: async ({ transaction }) => { await wait(800); const t = toU8(transaction).slice(); t.set(crypto.getRandomValues(new Uint8Array(64)), 1); return [{ signedTransaction: t }]; } },
    }
  };
  return w;
}
if (MOCK) addW(mockWallet());
else {
  try {
    addEventListener('wallet-standard:register-wallet', e => { try { if (typeof e.detail === 'function') e.detail({ register: (...ws) => { ws.forEach(addW); return () => { }; } }); } catch (_) { } });
    dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register: (...ws) => { ws.forEach(addW); return () => { }; } } }));
  } catch (_) { }
}
const go = () => { autoConnect(); setTimeout(autoConnect, 500); setTimeout(autoConnect, 1400); };
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
