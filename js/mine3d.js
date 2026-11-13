// HyperHash voxel engine: pixel-art blocks that are lit like real objects.
// Every block texture is drawn in code at 16x16, then baked to 64x64 with per-pixel relief (normals),
// roughness, metal and glow. Light comes from three sources: the real sun with shadows (three.js),
// a baked light field (sky light + coloured light from lamps, ore and crystals) stored in a 3D texture,
// and voxel ambient occlusion per corner. Props and figures sample the same light field, so they darken in tunnels.
import * as THREE from 'three';

// ---------- random + noise ----------
export function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash2(x, z, s = 0) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1013, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function hash3(x, y, z, s = 0) { return hash2(x ^ Math.imul(y | 0, 0x27d4eb2d), z, s); }
const sm = t => t * t * (3 - 2 * t);
export function vnoise(x, z, s = 0) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); const u = sm(xf), v = sm(zf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, z, s = 0, oct = 4) { let f = 0, amp = .5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, z * fr, s + i * 17); n += amp; amp *= .5; fr *= 2.03; } return f / n; }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const mix = (a, b, t) => a + (b - a) * t;

// ---------- pixel painter ----------
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function canvas16() { return { c: new Uint8ClampedArray(1024).fill(255), h: new Float32Array(256).fill(.5), r: new Float32Array(256).fill(.86), m: new Float32Array(256), e: new Float32Array(256), cav: new Float32Array(256).fill(1), bevel: .55, depth: 1, edge: 0 }; }
function put(t, x, y, col, o = {}) {
  const i = ((y & 15) << 4) | (x & 15), c = typeof col === 'string' ? hex(col) : col;
  t.c[i * 4] = c[0]; t.c[i * 4 + 1] = c[1]; t.c[i * 4 + 2] = c[2]; t.c[i * 4 + 3] = o.a != null ? o.a : 255;
  if (o.h != null) t.h[i] = o.h; if (o.r != null) t.r[i] = o.r; if (o.m != null) t.m[i] = o.m; if (o.e != null) t.e[i] = o.e; if (o.cav != null) t.cav[i] = o.cav;
}
const pick = (pal, v) => pal[Math.min(pal.length - 1, Math.max(0, Math.floor(v * pal.length)))];
function shade(col, k) { const c = typeof col === 'string' ? hex(col) : col; return [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)]; }

// ---------- block textures (original pixel art) ----------
const P = {
  grass: ['#3f6d28', '#47792c', '#518531', '#5a9036', '#649a3b', '#6ea442'],
  dirt: ['#5c3f27', '#6a4a2e', '#775536', '#82603d', '#6e4d30'],
  stone: ['#686b70', '#74777c', '#7e8187', '#888b91', '#93969b'],
  deep: ['#3c4049', '#454a54', '#4d525d', '#555b66'],
  clay: ['#8a4a33', '#99553a', '#a86242', '#b3704d', '#93503a'],
  sand: ['#b88d55', '#c69c62', '#d1aa71', '#dcb87f', '#c3965d'],
  lime: ['#a59e8e', '#b1aa9a', '#bdb6a6', '#c8c1b1', '#b8b0a0'],
  granite: ['#8f6f69', '#9c7b74', '#a8877f', '#b5938a', '#a0817a'],
  slate: ['#3d434f', '#464d5a', '#4f5664', '#59606e'],
  wood: ['#74502f', '#805a36', '#8c653d', '#987045', '#a47b4d'],
  bark: ['#4a3420', '#553c25', '#61452b', '#6c4d30'],
  leaf: ['#2f6420', '#386f25', '#417b2b', '#4b8731', '#346a23'],
  btc: ['#c9650a', '#e27a10', '#f7931a', '#ffaa3c', '#ffc46e'],
  mint: ['#2bb59a', '#4fd3b8', '#7aeed6', '#97fce4', '#d6fff4'],
  steel: ['#6f757c', '#7c838a', '#899098', '#969ea6', '#a5adb5'],
  hlg: ['#06302a', '#083a32', '#0a443a', '#0c4e43'],
};
function noiseFill(t, pal, s, sc = .3, jit = .35) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * sc, y * sc, s, 3) * (1 - jit) + hash2(x, y, s + 9) * jit, 0, .999); put(t, x, y, pick(pal, v), { h: .35 + v * .4 }); } }
function cracks(t, s, n, col, len = 6) { const r = mulberry(s); for (let k = 0; k < n; k++) { let x = r() * 16 | 0, y = r() * 16 | 0, dx = r() < .5 ? 1 : -1; for (let j = 0; j < len; j++) { put(t, x, y, col, { h: .08, cav: .55, r: .95 }); if (r() < .55) x += dx; else y += 1; } } }
function specks(t, s, n, cols, o = {}) { const r = mulberry(s); for (let k = 0; k < n; k++) { const x = r() * 16 | 0, y = r() * 16 | 0; put(t, x, y, cols[r() * cols.length | 0], Object.assign({ h: .8 }, o)); } }
function strata(t, pal, s, band = 4) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const b = Math.floor((y + Math.floor(vnoise(x * .3, 0, s) * 2)) / band); const v = clamp((hash2(b, 0, s) * .55 + fbm(x * .35, y * .5, s + 3, 3) * .45), 0, .999); put(t, x, y, pick(pal, v), { h: .3 + v * .45 }); } }

function rock(t, pal, s, o = {}) {
  // natural stone: soft blotches, a faint layering, one or two thin cracks, a few pebbles. No grid, no joints.
  const r = mulberry(s), lay = o.band || 4;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const layer = Math.sin((y + vnoise(x * .25, 3, s) * 2.2) / lay * Math.PI) * .12 * (o.layers ?? 1);
    const v = clamp(fbm(x * .19, y * .21, s + 7, 4) * .8 + layer + (hash2(x, y, s + 3) - .5) * (o.jit ?? .12) + .1, 0, .999);
    put(t, x, y, pick(pal, v), { h: .38 + v * .38 });
  }
  const nc = o.cracks ?? 1;
  for (let k = 0; k < nc; k++) { let x = r() * 16, y = r() * 16; const ang = (r() - .5) * 1.4 + (r() < .5 ? 0 : Math.PI), len = 4 + r() * 6; for (let j = 0; j < len; j++) { put(t, x | 0, y | 0, shade(pick(pal, .1), .72), { h: .1, cav: .62 }); x += Math.cos(ang) + (r() - .5) * .8; y += Math.sin(ang) * .5 + (r() - .5) * .9; } }
  const np = o.pebbles ?? 3; for (let k = 0; k < np; k++) { const x = r() * 15 | 0, y = r() * 15 | 0, col = pick(pal, .75 + r() * .24); put(t, x, y, shade(col, 1.08), { h: .8 }); put(t, x + 1, y + 1, shade(col, .8), { h: .55 }); }
}
function oreBlobs(t, s, pal, n, o) {
  const r = mulberry(s), pts = [];
  for (let k = 0; k < n; k++) { let x, y, tries = 0; do { x = 3 + r() * 10; y = 3 + r() * 10; tries++; } while (tries < 40 && pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 5.6)); pts.push([x, y, 1.5 + r() * .8]); }
  for (const [cx, cy, rad] of pts) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    const px = Math.round(cx + x), py = Math.round(cy + y), d = Math.hypot(px + .5 - cx - .5, py + .5 - cy - .5);
    if (d <= rad + .35) { const lit = clamp(.62 - (x + y) * .12 + (rad - d) * .18, 0, .999); put(t, px, py, pick(pal, lit), Object.assign({ h: .7 + (rad - d) * .2 }, o.mat)); }
    else if (d <= rad + 1.1 && x + y > 0) put(t, px, py, o.rim, { h: .3, cav: .72 });
  }
  for (const [cx, cy] of pts) put(t, Math.round(cx - .7), Math.round(cy - .7), o.hi, Object.assign({ h: .98 }, o.mat, { r: .12, e: (o.mat.e || 0) * 2 }));
}
function blades(t, s, pal, n, tall) { const r = mulberry(s); for (let k = 0; k < n; k++) { const x0 = 1 + r() * 14 | 0, h = (tall ? 7 : 5) + (r() * (tall ? 8 : 6) | 0), lean = (r() - .5) * 3; for (let j = 0; j < h; j++) { const x = clamp(Math.round(x0 + lean * (j / h) * (j / h)), 0, 15), y = 15 - j; put(t, x, y, pick(pal, clamp(.15 + j / h * .8, 0, .999)), { h: .5 + j / h * .4, r: .8 }); } } }
function clearA(t) { for (let i = 0; i < 256; i++) { t.c[i * 4] = 72; t.c[i * 4 + 1] = 110; t.c[i * 4 + 2] = 44; t.c[i * 4 + 3] = 0; } }
const Q = {
  grass: ['#226e58', '#257660', '#297e67', '#2c856d', '#308d74'],
  soil: ['#2b443d', '#2f4a42', '#334f47', '#37554c'],
  sage: ['#5a7c6e', '#5f8374', '#64897a', '#698f7f'],
  pale: ['#b3c0b8', '#bac6be', '#c1ccc4', '#c8d2ca'],
  teal: ['#3a6a61', '#3e7067', '#42766c', '#467c72'],
  pine: ['#22504a', '#25554e', '#285a53', '#2b5f57'],
  abyss: ['#153a35', '#173e39', '#19423c', '#1b4640'],
  night: ['#0d2925', '#0f2d29', '#11312c', '#133530'],
  pearl: ['#d3d8d0', '#d7dbd4', '#dbdfd8', '#dfe2dc'],
  tile: ['#c5ccc4', '#c9d0c8', '#cdd3cc', '#d1d7d0'],
  floor: ['#cfd3c8', '#d4d8cd', '#d9ddd2', '#dee1d7'],
  leaf: ['#25745f', '#2a7d66', '#2f866d', '#349075', '#3a997d'],
};
function clean(t, pal, s, o = {}) {
  // calm, designed surfaces: a soft large-scale tone drift, faint layer lines, nothing noisy
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = clamp(fbm(x * (o.sc || .07), y * (o.sc || .07), s, 3) * .7 + (hash2(x, y, s + 1) - .5) * (o.jit ?? .05) * .5 + .15, 0, .999);
    const line = false;
    put(t, x, y, line ? shade(pick(pal, v), .9) : pick(pal, v), { h: line ? .38 : .5, r: (o.r ?? .82) * .62 });
  }
  t.bevel = 0; t.edge = o.edge ?? .8;
}
const GEN = {
  g_top(t) { clean(t, Q.grass, 401, { sc: .11, jit: .06, r: .9 }); },
  g_side(t) { clean(t, Q.soil, 403, { sc: .12, jit: .05 }); for (let x = 0; x < 16; x++) { const d = 3 + (hash2(x >> 1, 0, 404) < .4 ? 1 : 0); for (let y = 0; y < d; y++) put(t, x, y, pick(Q.grass, .3 + hash2(x, y, 405) * .6), { h: .62 }); put(t, x, d, '#2a6f5b', { h: .55 }); } },
  soil(t) { clean(t, Q.soil, 406, { sc: .12, jit: .05 }); },
  sage(t) { clean(t, Q.sage, 407, { lines: 6, jit: .05 }); },
  pale(t) { clean(t, Q.pale, 408, { lines: 8, jit: .04, r: .7 }); },
  teal_s(t) { clean(t, Q.teal, 409, { lines: 5, jit: .05 }); },
  pine(t) { clean(t, Q.pine, 410, { lines: 4, jit: .05 }); },
  abyss(t) { clean(t, Q.abyss, 411, { lines: 6, jit: .05, r: .75 }); },
  night(t) { clean(t, Q.night, 412, { lines: 7, jit: .04, r: .7 }); },
  pearl(t) { clean(t, Q.pearl, 413, { sc: .07, jit: .02, r: .55, edge: .9 }); },
  pearl_tile(t) { clean(t, Q.tile, 414, { sc: .07, jit: .02, r: .45, edge: .5 }); for (let i = 0; i < 16; i++) { put(t, i, 7, '#b4bcb3', { h: .3, cav: .8 }); put(t, 7, i, '#b4bcb3', { h: .3, cav: .8 }); } },
  floor_s(t) { clean(t, Q.floor, 415, { sc: .1, jit: .06, r: .9, edge: .5 }); },
  leaf_hl(t) { const r = mulberry(416); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * .2, y * .2, 417, 2) * .8 + r() * .2, 0, .999); put(t, x, y, pick(Q.leaf, v), { h: .4 + v * .4, r: .7 }); } t.bevel = .15; t.edge = .7; },
  trunk(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, pick(['#4a3a2c', '#54422f', '#5e4a35'], clamp(fbm(x * .5, y * .1, 418, 2), 0, .999)), { h: .5 }); t.bevel = 0; t.edge = .6; },
  glass_mint(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fr = x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || x === 8; put(t, x, y, fr ? '#dfe3dc' : pick(['#2f9f88', '#3aae95', '#46bba1'], clamp(.3 + (15 - y) / 22 + hash2(x, y, 419) * .1, 0, .999)), fr ? { h: .8, r: .5 } : { h: .45, r: .06, e: .22 }); } t.bevel = 0; t.edge = .6; },
  lamp_hl(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const frame = x < 2 || y < 2 || x > 13 || y > 13; put(t, x, y, frame ? '#e9ece6' : pick(['#a9ffe9', '#c9fff2', '#97fce4'], hash2(x, y, 420)), frame ? { h: .8, r: .4 } : { h: .45, e: .62, r: .2 }); } t.bevel = 0; t.edge = .6; },

  grass_top(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * .17, y * .17, 11, 3) * .72 + hash2(x, y, 12) * .28, 0, .999); put(t, x, y, pick(P.grass, v), { h: .4 + v * .3 }); } const r = mulberry(13); for (let k = 0; k < 16; k++) { const x = r() * 16 | 0, y = r() * 16 | 0; put(t, x, y, shade(pick(P.grass, .9), 1.06), { h: .85 }); put(t, x, (y + 1) & 15, pick(P.grass, .55), { h: .7 }); } t.bevel = .2; t.r.fill(.9); },
  grass_side(t) { noiseFill(t, P.dirt, 21, .35, .4); specks(t, 22, 6, ['#9a7b58', '#8c6c49'], { h: .85 }); for (let x = 0; x < 16; x++) { const d = 2 + (hash2(x, 0, 23) * 3 | 0); for (let y = 0; y < d; y++) put(t, x, y, pick(P.grass, .25 + hash2(x, y, 24) * .7), { h: .75, r: .92 }); put(t, x, d, shade(pick(P.grass, .3), .72), { h: .6 }); } t.bevel = .35; },
  dirt(t) { noiseFill(t, P.dirt, 31, .35, .4); specks(t, 32, 10, ['#9a7b58', '#8c6c49', '#4e3520'], { h: .85 }); t.bevel = .35; },
  path(t) { noiseFill(t, ['#7d6447', '#8a7050', '#957b59', '#a08662'], 35, .3, .5); specks(t, 36, 8, ['#b29c7a', '#6a533a']); t.bevel = .2; t.r.fill(.95); },
  stone(t) { rock(t, P.stone, 41, { band: 5, jit: .14, cracks: 2, pebbles: 3 }); t.bevel = .5; },
  deep(t) { rock(t, P.deep, 51, { band: 3, jit: .1, cracks: 2, layers: 1.6 }); t.bevel = .5; t.r.fill(.8); },
  clay(t) { rock(t, P.clay, 61, { band: 3, jit: .12, cracks: 1, layers: 1.4 }); t.bevel = .4; },
  sand(t) { rock(t, P.sand, 71, { band: 4, jit: .18, cracks: 0, pebbles: 4, layers: 1.5 }); t.bevel = .3; t.r.fill(.93); },
  lime(t) { rock(t, P.lime, 81, { band: 5, jit: .1, cracks: 2, layers: 1.2 }); t.bevel = .5; },
  granite(t) { rock(t, P.granite, 91, { band: 6, jit: .2, cracks: 1, layers: .5 }); const r = mulberry(92); for (let k = 0; k < 9; k++) { const x = r() * 15 | 0, y = r() * 15 | 0, c = r() < .5 ? '#3a3031' : '#e9ddd6'; put(t, x, y, c, { h: .7, r: .35 }); if (r() < .5) put(t, x + 1, y, c, { h: .7, r: .35 }); } t.bevel = .5; t.r.fill(.62); },
  slate(t) { rock(t, P.slate, 101, { band: 2, jit: .08, cracks: 2, layers: 2 }); t.bevel = .5; t.r.fill(.68); },
  gravel(t) { const r = mulberry(111); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, pick(['#6f6b66', '#7d7873', '#8b8680', '#5f5b57', '#9a948d', '#7a6a5a'], r()), { h: .2 + r() * .8, r: .9 }); t.bevel = .8; },
  cobble(t) { voronoiStones(t, 121, P.stone, '#45474b', 9); t.bevel = .9; },
  planks(t) { for (let row = 0; row < 4; row++) { const seam = 3 + (hash2(row, 0, 131) * 10 | 0), base = hash2(row, 1, 132); for (let yy = 0; yy < 4; yy++) for (let x = 0; x < 16; x++) { const y = row * 4 + yy, edge = yy === 3, sm2 = x === seam, grain = hash2(x >> 2, y, 133 + row) < .22; const v = clamp(base * .45 + fbm(x * .25, y * .9, 134 + row, 2) * .45 + (grain ? -.22 : 0), 0, .999); put(t, x, y, edge || sm2 ? '#4a321f' : pick(P.wood, v), { h: edge || sm2 ? .1 : .55 + v * .15, cav: edge || sm2 ? .62 : 1, r: .82 }); } put(t, (seam + 1) & 15, row * 4 + 1, '#2e2a27', { h: .85, m: .8, r: .35 }); } t.bevel = .45; },
  log_side(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const st = (x + (hash2(x, 0, 141) * 2 | 0)) % 3 === 0; const v = hash2(x, y >> 1, 142); put(t, x, y, st ? shade(pick(P.bark, v), .78) : pick(P.bark, v), { h: st ? .2 : .6 + v * .3 }); } t.bevel = .6; },
  log_top(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); const ring = (d | 0) % 2; put(t, x, y, d > 6.6 ? pick(P.bark, hash2(x, y, 151)) : ring ? '#b08250' : '#c4965f', { h: d > 6.6 ? .7 : .5 }); } t.bevel = .4; },
  leaves(t) { const r = mulberry(161); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = r(), hole = hash2(x, y, 162) < .17; put(t, x, y, pick(P.leaf, v), { h: .3 + v * .6, a: hole ? 0 : 255, r: .7 }); } specks(t, 163, 6, ['#5c9a3a'], { h: 1 }); t.bevel = .7; },
  btc_ore(t) { rock(t, P.stone, 171, { band: 5, jit: .12, cracks: 1, pebbles: 0 }); oreBlobs(t, 173, P.btc, 3, { rim: '#4b3b2b', hi: '#ffe6b0', mat: { m: 1, r: .26, e: .2 } }); t.bevel = .7; },
  btc_pale(t) { clean(t, Q.pale, 421, { lines: 8, jit: .04, r: .7 }); oreBlobs(t, 422, P.btc, 3, { rim: '#7d7466', hi: '#ffe6b0', mat: { m: 1, r: .24, e: .25 } }); t.edge = .7; },
  hype_ore(t) { rock(t, P.deep, 181, { band: 3, jit: .08, cracks: 1, pebbles: 0, layers: 1.5 }); oreBlobs(t, 182, P.mint, 3, { rim: '#22303a', hi: '#f2fffb', mat: { m: 0, r: .1, e: .6 } }); t.bevel = .7; },
  hype_block(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = fbm(x * .3, y * .3, 191, 3); const edge = x === 0 || y === 0 || x === 15 || y === 15; put(t, x, y, edge ? '#2bb59a' : pick(P.mint, .25 + v * .75), { h: edge ? .4 : .6 + v * .3, r: .12, e: edge ? .4 : .55 + v * .35, m: 0 }); } t.bevel = .5; },
  hl_dots(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ox = (y >> 2) & 1 ? 2 : 0; const dot = ((x + ox) % 4 === 1 || (x + ox) % 4 === 2) && (y % 4 === 1 || y % 4 === 2); put(t, x, y, dot ? '#7fe3cb' : pick(P.hlg, hash2(x, y, 201)), { h: dot ? .85 : .4, e: dot ? .1 : 0, r: dot ? .3 : .55 }); } t.bevel = .6; },
  steel(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const seam = x === 0 || y === 0 || x === 15 || y === 15; const v = fbm(x * .2, y * .2, 211, 2); put(t, x, y, seam ? '#4a4f55' : pick(P.steel, v), { h: seam ? .15 : .5, m: seam ? .5 : .9, r: .35 + v * .15, cav: seam ? .7 : 1 }); } for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) put(t, x, y, '#c5ccd3', { h: .95, m: 1, r: .2 }); t.bevel = .45; },
  asic_front(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy); const frame = x === 0 || y === 0 || x === 15 || y === 15; let col = '#1d2024', o = { h: .3, m: .6, r: .45 }; if (frame) { col = '#9aa2aa'; o = { h: .6, m: .9, r: .3 }; } else if (d < 6.3) { const a = Math.atan2(dy, dx) * 3 / Math.PI; const blade = ((a + d * .35) % 1 + 1) % 1 < .5; col = d < 1.6 ? '#3a3f45' : blade ? '#2b2f34' : '#15171a'; o = { h: d < 1.6 ? .8 : blade ? .5 : .1, m: .5, r: .5 }; } else if ((x + y) % 2 === 0) { col = '#272b30'; } put(t, x, y, col, o); } put(t, 2, 13, '#4dff9d', { h: .9, e: 1, r: .2 }); put(t, 3, 13, '#4dff9d', { h: .9, e: 1, r: .2 }); put(t, 13, 13, '#ff9b2e', { h: .9, e: 1, r: .2 }); t.bevel = .5; },
  asic_side(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fin = x % 2 === 0; put(t, x, y, fin ? '#b8bfc6' : '#7d858d', { h: fin ? .8 : .2, m: .95, r: fin ? .28 : .45 }); } t.bevel = .5; },
  concrete(t) { noiseFill(t, ['#a9a49b', '#b2ada4', '#bbb6ad', '#c4bfb6'], 221, .2, .25); specks(t, 222, 5, ['#8f8a81']); t.bevel = .15; t.r.fill(.9); },
  lamp(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8; put(t, x, y, frame ? '#2f2f33' : pick(['#ffd892', '#ffcb6e', '#ffe2a8'], hash2(x, y, 231)), frame ? { h: .8, m: .9, r: .35 } : { h: .45, e: 1, r: .25 }); } t.bevel = .6; },
  furnace(t) { voronoiStones(t, 241, P.stone, '#3f4145', 8); for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) { const hot = y > 9; put(t, x, y, y === 8 || x === 4 || x === 11 ? '#1c1c1e' : hot ? pick(['#ff7a1a', '#ffb347', '#ffd27a'], hash2(x, y, 242)) : '#2a2a2c', { h: .2, e: hot ? 1 : 0, r: .5 }); } t.bevel = .8; },
  rail_x(t) { rail(t, true); }, rail_z(t) { rail(t, false); },
  hay(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, y % 5 === 2 ? '#7d6420' : pick(['#c9a43a', '#d6b24a', '#e2c15a', '#bf9a33'], hash2(x, y >> 1, 251)), { h: y % 5 === 2 ? .2 : .6, r: .9 }); t.bevel = .4; },
  wool_mint(t) { wool(t, P.mint.slice(1, 4), 261); }, wool_ink(t) { wool(t, ['#062a24', '#073229', '#0a3a30'], 262); }, wool_orange(t) { wool(t, ['#d9760f', '#e8851a', '#f39a35'], 263); }, wool_white(t) { wool(t, ['#e6e8e4', '#f1f2ee', '#dadcd6'], 264); },
  beam(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = y === 0 || y === 15, grain = Math.sin(y * 1.9 + vnoise(x * .18, y, 301) * 3) > .55, v = clamp(fbm(x * .12, y * .7, 302, 3) * .7 + (grain ? -.28 : 0) + .15, 0, .999); put(t, x, y, edge ? '#2f2116' : pick(['#3e2a1a', '#4a3320', '#563c26', '#62452c', '#6e4e33'], v), { h: edge ? .15 : .5 + v * .2 - (grain ? .15 : 0), cav: edge ? .65 : 1, r: .85 }); } for (const x of [2, 13]) { put(t, x, 4, '#9aa0a6', { h: .9, m: 1, r: .3 }); put(t, x, 11, '#9aa0a6', { h: .9, m: 1, r: .3 }); } t.bevel = .35; },
  tuft(t) { clearA(t); blades(t, 281, Q.grass, 9, false); t.bevel = .1; },
  tall(t) { clearA(t); blades(t, 282, Q.grass, 7, true); t.bevel = .1; },
  flower_mint(t) { clearA(t); blades(t, 283, P.grass, 3, false); for (let y = 7; y < 16; y++) put(t, 7, y, '#3d6b27', { h: .5 }); put(t, 8, 11, '#4a7c2e'); put(t, 6, 12, '#4a7c2e'); for (const [x, y] of [[7, 4], [6, 5], [8, 5], [7, 6], [6, 4], [8, 6], [6, 6], [8, 4]]) put(t, x, y, x === 7 || y === 5 ? '#7aeed6' : '#4fd3b8', { h: .8, r: .5, e: .25 }); put(t, 7, 5, '#ffe9a8', { h: .9, e: .3 }); t.bevel = .1; },
  flower_orange(t) { clearA(t); blades(t, 284, P.grass, 3, false); for (let y = 8; y < 16; y++) put(t, 8, y, '#3d6b27', { h: .5 }); for (const [x, y] of [[8, 5], [7, 6], [9, 6], [8, 7], [7, 5], [9, 7]]) put(t, x, y, '#f7931a', { h: .8, r: .5 }); put(t, 8, 6, '#fff1c4', { h: .9 }); t.bevel = .1; },
  lake_bed(t) { rock(t, ['#8a7a5c', '#958566', '#a09070', '#7e6f53'], 291, { band: 4, jit: .25, cracks: 0, pebbles: 6 }); t.bevel = .4; },
  glass(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fr = x === 0 || y === 0 || x === 15 || y === 15; put(t, x, y, fr ? '#c9d8d4' : '#bfe9e0', { a: fr ? 255 : 60, h: fr ? .7 : .5, r: .05 }); } put(t, 4, 3, '#ffffff', { a: 160 }); put(t, 5, 4, '#ffffff', { a: 120 }); t.bevel = .3; },
};
function wool(t, pal, s) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = (hash2(x, y, s) * .5 + ((x + y) % 4 < 2 ? .3 : 0)); put(t, x, y, pick(pal, clamp(v, 0, .999)), { h: .4 + v * .3, r: .97 }); } t.bevel = .3; }
function rail(t, along) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = along ? x : y, b = along ? y : x; let col = null, o = {}; if (b === 3 || b === 12) { col = '#a3a8ad'; o = { h: .95, m: 1, r: .25 }; } else if (b === 2 || b === 13) { col = '#5b5f63'; o = { h: .6, m: .9, r: .4 }; } else if (a % 4 === 1 || a % 4 === 2) { col = pick(['#6e4a2a', '#7b5532', '#664427'], hash2(a >> 2, b, 271)); o = { h: .45, r: .85 }; } if (col) put(t, x, y, col, o); else put(t, x, y, '#000000', { a: 0 }); } t.bevel = .5; }
function voronoiStones(t, s, pal, mortar, n) { const r = mulberry(s); const pts = []; for (let i = 0; i < n; i++) pts.push([r() * 16, r() * 16, r()]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let d1 = 1e9, d2 = 1e9, k = 0; for (let i = 0; i < n; i++) for (let oy = -16; oy <= 16; oy += 16) for (let ox = -16; ox <= 16; ox += 16) { const d = Math.hypot(x + .5 - pts[i][0] - ox, y + .5 - pts[i][1] - oy); if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d; } const edge = d2 - d1 < 1.1; put(t, x, y, edge ? mortar : shade(pick(pal, pts[k][2]), 1.05 - d1 * .03), { h: edge ? .05 : clamp(.95 - d1 * .09, .3, .95), cav: edge ? .5 : 1 }); } }
function nuggets(t, s, pal, n, o) { const r = mulberry(s); for (let k = 0; k < n; k++) { const cx = 2 + r() * 12 | 0, cy = 2 + r() * 12 | 0, sz = 1 + r() * 1.8; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = Math.hypot(x, y); if (d <= sz) { const v = clamp(.75 - d / sz * .55 + r() * .25, 0, .999); put(t, cx + x, cy + y, pick(pal, v), Object.assign({ h: .7 + (1 - d / sz) * .3 }, o)); } } } }
function shards(t, s, pal, n) { const r = mulberry(s); for (let k = 0; k < n; k++) { const cx = 2 + r() * 12 | 0, cy = 3 + r() * 11 | 0, len = 2 + r() * 3 | 0, dir = r() < .5 ? 1 : -1; for (let j = 0; j < len; j++) for (let w = 0; w < 2; w++) { const x = cx + w + (j * dir >> 1), y = cy - j; const v = clamp(.35 + j / len * .6 + (w ? -.2 : 0), 0, .999); put(t, x, y, pick(pal, v), { h: .8 + j / len * .2, r: .1, e: .55 + v * .4, m: 0 }); } } }

// Block registry. tex: one layer for all faces or {top, side, bottom}. emit: coloured light level 0..15 per channel.
export const BLOCKS = [];
export const B = {};
function def(name, o) { const id = BLOCKS.length; BLOCKS.push(Object.assign({ id, name, opaque: true, cutout: false, decal: false, emit: null, metal: 0 }, o)); B[name] = id; return id; }
def('air', { opaque: false, tex: null });
def('grass', { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } });
def('dirt', { tex: 'dirt' }); def('path', { tex: { top: 'path', side: 'dirt', bottom: 'dirt' } });
def('stone', { tex: 'stone' }); def('deep', { tex: 'deep' }); def('clay', { tex: 'clay' }); def('sand', { tex: 'sand' }); def('lime', { tex: 'lime' });
def('granite', { tex: 'granite' }); def('slate', { tex: 'slate' }); def('gravel', { tex: 'gravel' }); def('cobble', { tex: 'cobble' });
def('planks', { tex: 'planks' }); def('log', { tex: { top: 'log_top', side: 'log_side', bottom: 'log_top' } });
def('leaves', { tex: 'leaves', opaque: false, cutout: true });
def('btc_ore', { tex: 'btc_ore', emit: [5, 2, 0] }); def('hype_ore', { tex: 'hype_ore', emit: [0, 5, 4] }); def('hype_block', { tex: 'hype_block', emit: [3, 13, 11] }); def('btc_pale', { tex: 'btc_pale', emit: [5, 2, 0] });
def('hl_dots', { tex: 'hl_dots' }); def('steel', { tex: 'steel' }); def('asic', { tex: { top: 'steel', side: 'asic_side', bottom: 'steel', front: 'asic_front' }, emit: [1, 3, 1] });
def('concrete', { tex: 'concrete' }); def('lamp', { tex: 'lamp', emit: [15, 13, 8] }); def('furnace', { tex: { top: 'cobble', side: 'cobble', bottom: 'cobble', front: 'furnace' }, emit: [14, 7, 2] });
def('rail_x', { tex: 'rail_x', opaque: false, cutout: true, decal: true }); def('rail_z', { tex: 'rail_z', opaque: false, cutout: true, decal: true });
def('hay', { tex: 'hay' }); def('beam', { tex: { top: 'beam', side: 'beam', bottom: 'beam' } }); def('wool_mint', { tex: 'wool_mint' }); def('wool_ink', { tex: 'wool_ink' }); def('wool_orange', { tex: 'wool_orange' }); def('wool_white', { tex: 'wool_white' });
def('glass', { tex: 'glass', opaque: false, cutout: true });
def('hlgrass', { tex: { top: 'g_top', side: 'g_side', bottom: 'soil' } }); def('soil', { tex: 'soil' }); def('sage', { tex: 'sage' }); def('pale', { tex: 'pale' }); def('teal_s', { tex: 'teal_s' }); def('pine', { tex: 'pine' }); def('abyss', { tex: 'abyss' }); def('night', { tex: 'night' });
def('pearl', { tex: 'pearl' }); def('pearl_tile', { tex: 'pearl_tile' }); def('floor_s', { tex: 'floor_s' }); def('leaf_hl', { tex: 'leaf_hl', opaque: false, cutout: true }); def('trunk', { tex: { top: 'log_top', side: 'trunk', bottom: 'log_top' } });
def('glass_mint', { tex: 'glass_mint', emit: [1, 6, 5] }); def('lamp_hl', { tex: 'lamp_hl', emit: [5, 13, 11] });
def('tuft', { tex: 'tuft', opaque: false, cutout: true, cross: true }); def('tall', { tex: 'tall', opaque: false, cutout: true, cross: true });
def('flower_mint', { tex: 'flower_mint', opaque: false, cutout: true, cross: true }); def('flower_orange', { tex: 'flower_orange', opaque: false, cutout: true, cross: true });
def('water', { tex: null, opaque: false, liquid: true }); def('lake_bed', { tex: 'lake_bed' });
// "front" faces (asic, furnace) look toward -Z unless the world stores a facing; the scene sets FACING per cell.

// ---------- Floatmine palette: vivid daylight Minecraft colours, Float white/blue strata, glowing Float crystal ----------
const FP = {
  grass: ['#276b3d', '#2c7543', '#317f49', '#36894f', '#3c9356'],
  grass2: ['#2a7238', '#307c3e', '#368645', '#3d904b'],
  dirt: ['#5e4330', '#684a35', '#72523a', '#7c5a40'],
  stone: ['#3a4456', '#414c60', '#48546a', '#505d74', '#58667e'],
  slate: ['#262e3f', '#2b3446', '#30394d', '#353f54'],
  roofNavy: ['#13254b', '#172b55', '#1c325f', '#213969'],
  roofSlate: ['#39445a', '#414c63', '#49556c', '#515e76'],
  roofWhite: ['#d9e1ef', '#e1e8f3', '#e9eef7', '#f1f4fa'],
  spruce: ['#173f33', '#1c473a', '#215042', '#27594a', '#2d6252'],
  floatW: ['#c9d3e3', '#d0d9e8', '#d7dfec', '#dee5f0'],
  floatB: ['#b4cbef', '#bdd2f1', '#c6d9f3', '#cfdff5'],
  blue: ['#3b62ad', '#4169b6', '#4871bf', '#4f79c7'],
  navy: ['#1d2c4d', '#223358', '#283a62', '#2e416c'],
  cherry: ['#9dbdf2', '#abc8f4', '#b9d2f6', '#c7dcf8', '#d5e6fb'],
  oak: ['#2a6f34', '#30793a', '#368340', '#3d8d47', '#45984e'],
  autumn: ['#e6782a', '#ee8a34', '#f49c40', '#f9ae4e', '#fdc062'],
  planks: ['#b3824f', '#be8c57', '#c9965f', '#d3a067', '#ddab70'],
  path: ['#5f6676', '#676e7f', '#6f7788', '#788091'],
  crystal: ['#2a63d6', '#3779f2', '#4a8cff', '#6aa4ff', '#96c0ff', '#d4e6ff'],
  gold: ['#d99a1e', '#eaad2a', '#f6c03a', '#ffd458', '#ffe58c'],
  amethyst: ['#7a4fc8', '#8c60d9', '#a073e8', '#b78bf5', '#d2b2ff'],
  emerald: ['#139a5c', '#1cae6a', '#2bc27b', '#47d690', '#7eeab2'],
  cloud: ['#eef3fb', '#f2f6fc', '#f6f9fd', '#e8eef9'],
  sandF: ['#e3c98f', '#e8d098', '#edd7a2', '#dcc086'],
};
function vivid(t, pal, s, o = {}) {
  // pixel texture with a calm large-scale drift: reads as Minecraft up close, as clean colour from afar
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = clamp(fbm(x * (o.sc || .16), y * (o.sc || .16), s, 3) * (1 - (o.jit ?? .3)) + hash2(x, y, s + 7) * (o.jit ?? .3), 0, .999);
    put(t, x, y, pick(pal, v), { h: .38 + v * .32, r: o.r ?? .86 });
  }
  t.bevel = o.bevel ?? .28; t.edge = o.edge ?? .55;
}
function leafy(t, pal, s, holes = .12, blossom = null) {
  const r = mulberry(s);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * .2, y * .2, s, 2) * .72 + r() * .2 + .06, 0, .999), hole = hash2(x, y, s + 3) < holes; put(t, x, y, pick(pal, v), { h: .35 + v * .45, a: hole ? 0 : 255, r: .62 }); }
  if (blossom) specks(t, s + 9, 9, blossom, { h: 1, r: .5 });
  t.bevel = .55; t.edge = .35;
}
function plant(t, s, petal, centre, stemCol = '#3f8f2c') {
  clearA(t); blades(t, s, FP.grass2, 3, false);
  for (let y = 7; y < 16; y++) put(t, 7, y, stemCol, { h: .5 }); put(t, 8, 11, '#4c9d33'); put(t, 6, 12, '#4c9d33');
  for (const [x, y] of [[7, 4], [6, 5], [8, 5], [7, 6], [6, 4], [8, 6], [6, 6], [8, 4], [7, 3], [5, 5], [9, 5]]) put(t, x, y, (x + y) % 2 ? petal[0] : petal[1], { h: .85, r: .5 });
  put(t, 7, 5, centre, { h: .95 }); t.bevel = .1;
}
function tiles(t, pal, s) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, off = row % 2 ? 2 : 0, joint = y % 4 === 3 || (x + off) % 4 === 3; const v = hash2((x + off) >> 2, row, s); put(t, x, y, joint ? shade(pick(pal, v), .78) : pick(pal, clamp(v * .7 + (3 - y % 4) * .08, 0, .999)), { h: joint ? .2 : .55 + (3 - y % 4) * .08, r: .55 }); } t.bevel = .4; t.edge = .4; }
Object.assign(GEN, {
  f_grass_top(t) { vivid(t, FP.grass, 501, { sc: .2, jit: .32, r: .9 }); specks(t, 502, 10, ['#58b36a', '#2a6f37'], { h: .8 }); },
  f_slate(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const j = x % 8 === 7 || y % 8 === 7; const v = clamp(fbm(x * .12, y * .12, 560, 2) * .6 + hash2(x >> 3, y >> 3, 561) * .4, 0, .999); put(t, x, y, j ? '#1b2231' : pick(FP.slate, v), { h: j ? .15 : .55 + v * .1, r: j ? .7 : .4 }); } t.bevel = .25; t.edge = .5; },
  f_glow(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)), fr = d > 5.6; put(t, x, y, fr ? pick(FP.slate, hash2(x, y, 562)) : d > 4.6 ? '#7d97c4' : pick(['#cfe0ff', '#dbe8ff', '#e8f1ff'], hash2(x, y, 568)), fr ? { h: .45, r: .4 } : d > 4.6 ? { h: .6, r: .3, m: .4 } : { h: .7, e: .9 - d * .07, r: .2 }); } t.bevel = .35; t.edge = .5; },
  f_rack_front(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fr = x === 0 || y === 0 || x === 15 || y === 15; let col = fr ? '#5d6675' : (y % 4 === 0 ? '#151a23' : '#1c222d'), o = fr ? { h: .6, m: .8, r: .3 } : { h: .3, m: .4, r: .5 }; if (!fr && y % 4 === 2 && x > 1 && x < 14) { const on = hash2(x, y, 563) < .78; col = on ? (x % 5 === 0 ? '#ffffff' : '#4a8cff') : '#23324d'; o = on ? { h: .7, e: 1, r: .2 } : { h: .5, r: .3 }; } put(t, x, y, col, o); } t.bevel = .4; },
  f_rack_side(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fin = x % 2 === 0; put(t, x, y, fin ? '#59616e' : '#2f353f', { h: fin ? .8 : .2, m: .9, r: fin ? .3 : .45 }); } t.bevel = .5; },
  f_post(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const e = x < 3 || x > 12; put(t, x, y, e ? '#1d2330' : pick(['#2a3242', '#30394b', '#363f52'], hash2(x, y >> 2, 564)), { h: e ? .3 : .6, m: .7, r: .4 }); } t.bevel = .5; t.edge = .5; },
  roof_navy(t) { tiles(t, FP.roofNavy, 565); }, roof_slate(t) { tiles(t, FP.roofSlate, 566); }, roof_white(t) { tiles(t, FP.roofWhite, 567); },
  f_grass_side(t) { vivid(t, FP.dirt, 503, { sc: .25, jit: .35 }); specks(t, 504, 6, ['#a77c52', '#6a4527'], { h: .8 }); for (let x = 0; x < 16; x++) { const d = 3 + (hash2(x, 0, 505) * 3 | 0); for (let y = 0; y < d; y++) put(t, x, y, pick(FP.grass, .25 + hash2(x, y, 506) * .7), { h: .72, r: .9 }); put(t, x, d, shade(pick(FP.grass, .2), .78), { h: .6 }); } },
  f_dirt(t) { vivid(t, FP.dirt, 507, { sc: .25, jit: .35 }); specks(t, 508, 9, ['#a77c52', '#6a4527', '#5c3c22'], { h: .85 }); },
  f_stone(t) { rock(t, FP.stone, 509, { band: 5, jit: .12, cracks: 1, pebbles: 3 }); t.bevel = .42; t.edge = .45; },
  f_floatw(t) { vivid(t, FP.floatW, 510, { sc: .1, jit: .12, r: .55, bevel: .2, edge: .6 }); },
  f_floatb(t) { vivid(t, FP.floatB, 511, { sc: .1, jit: .14, r: .6, bevel: .2, edge: .6 }); },
  f_blue(t) { rock(t, FP.blue, 512, { band: 4, jit: .1, cracks: 1, pebbles: 2, layers: 1.2 }); t.bevel = .4; t.edge = .45; t.r.fill(.7); },
  f_navy(t) { rock(t, FP.navy, 513, { band: 3, jit: .08, cracks: 1, pebbles: 1, layers: 1.5 }); t.bevel = .45; t.edge = .45; t.r.fill(.72); },
  f_ore(t) { rock(t, FP.navy, 514, { band: 3, jit: .08, cracks: 0, pebbles: 0, layers: 1.2 }); shards(t, 515, FP.crystal, 5); t.bevel = .6; t.edge = .45; },
  f_ore_w(t) { vivid(t, FP.floatW, 516, { sc: .1, jit: .12, r: .55, bevel: .2, edge: .6 }); shards(t, 517, FP.crystal, 4); t.bevel = .5; },
  f_crystal(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * .28, y * .28, 518, 3) * .8 + (15 - y) / 60, 0, .999); const edge = x === 0 || y === 0 || x === 15 || y === 15; put(t, x, y, edge ? '#2a63d6' : pick(FP.crystal, .2 + v * .8), { h: edge ? .35 : .55 + v * .35, r: .08, e: edge ? .35 : .5 + v * .45, m: 0 }); } for (let x = 1; x < 15; x++) { const yy = Math.round(7.5 - 2.4 * Math.tanh((x - 7.5) / 3.2)); put(t, x, yy, '#eaf3ff', { h: .95, e: 1, r: .05 }); put(t, x, yy + 1, '#d4e6ff', { h: .9, e: .9, r: .05 }); } t.bevel = .45; t.edge = .7; },
  f_gold(t) { rock(t, FP.stone, 519, { band: 5, jit: .12, cracks: 0, pebbles: 0 }); oreBlobs(t, 520, FP.gold, 3, { rim: '#5a5f6a', hi: '#fff4c8', mat: { m: 1, r: .25, e: .12 } }); t.bevel = .6; t.edge = .45; },
  f_amethyst(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = clamp(fbm(x * .3, y * .3, 521, 3) * .7 + hash2(x, y, 522) * .3, 0, .999); put(t, x, y, pick(FP.amethyst, v), { h: .45 + v * .4, r: .12, e: .18 + v * .2 }); } shards(t, 523, FP.amethyst.slice(2), 3); t.bevel = .55; t.edge = .5; },
  f_emerald(t) { rock(t, FP.stone, 524, { band: 5, jit: .12, cracks: 0, pebbles: 0 }); oreBlobs(t, 525, FP.emerald, 3, { rim: '#4f5663', hi: '#d9ffe9', mat: { m: 0, r: .1, e: .3 } }); t.bevel = .6; t.edge = .45; },
  f_cherry(t) { leafy(t, FP.cherry, 526, .1, ['#ffffff', '#b9d4ff']); specks(t, 529, 6, ['#a9cdff'], { h: 1, r: .3, e: .55 }); },
  f_oak(t) { leafy(t, FP.oak, 527, .12, ['#5aa863']); },
  f_autumn(t) { leafy(t, FP.spruce, 528, .08, ['#3a7a63']); },
  f_birch(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, pick(['#ecebe4', '#f3f2ec', '#e3e2da', '#f7f6f1'], hash2(x, y >> 1, 529)), { h: .6, r: .8 }); const r = mulberry(530); for (let k = 0; k < 7; k++) { const x = r() * 13 | 0, y = r() * 16 | 0, w = 2 + (r() * 3 | 0); for (let i = 0; i < w; i++) put(t, x + i, y, '#2d2a26', { h: .2, cav: .7 }); } t.bevel = .4; t.edge = .4; },
  f_planks(t) { for (let row = 0; row < 4; row++) { const seam = 3 + (hash2(row, 0, 531) * 10 | 0), base = hash2(row, 1, 532); for (let yy = 0; yy < 4; yy++) for (let x = 0; x < 16; x++) { const y = row * 4 + yy, edge = yy === 3, sm2 = x === seam; const v = clamp(base * .45 + fbm(x * .25, y * .9, 533 + row, 2) * .45, 0, .999); put(t, x, y, edge || sm2 ? shade(pick(FP.planks, v), .7) : pick(FP.planks, v), { h: edge || sm2 ? .15 : .55, r: .8 }); } } t.bevel = .3; t.edge = .45; },
  f_path(t) { vivid(t, FP.path, 534, { sc: .3, jit: .45, r: .9, bevel: .25, edge: .4 }); specks(t, 535, 8, ['#8a92a3', '#4e5463']); },
  f_sand(t) { vivid(t, FP.sandF, 536, { sc: .3, jit: .45, r: .95, bevel: .2, edge: .35 }); },
  f_cloud(t) { vivid(t, FP.cloud, 537, { sc: .08, jit: .06, r: .95, bevel: .05, edge: .95 }); },
  roof_red(t) { tiles(t, ['#c43c35', '#d0453d', '#db5046', '#e45c50'], 538); }, roof_blue(t) { tiles(t, ['#2f6fe0', '#3779f2', '#4485ff', '#5a95ff'], 539); },
  roof_yellow(t) { tiles(t, ['#e2ae2a', '#ecbb35', '#f4c843', '#fbd65a'], 540); }, roof_teal(t) { tiles(t, ['#1f9e93', '#25ab9f', '#2db8ab', '#3cc5b8'], 541); },
  roof_orange(t) { tiles(t, ['#dd6f24', '#e87d2e', '#f18c3a', '#f89c4a'], 542); }, roof_pink(t) { tiles(t, ['#e07aa6', '#ea88b2', '#f297be', '#f8a8ca'], 543); },
  wall_white(t) { vivid(t, ['#f1efe8', '#f5f3ed', '#ebe8e0', '#f8f7f2'], 544, { sc: .1, jit: .1, r: .8, bevel: .15, edge: .5 }); },
  f_window(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fr = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8; put(t, x, y, fr ? '#f6f4ee' : pick(['#ffd087', '#ffc263', '#ffd99c'], hash2(x, y, 545)), fr ? { h: .8, r: .5 } : { h: .4, e: .55, r: .15 }); } t.bevel = .2; t.edge = .5; },
  f_tuft(t) { clearA(t); blades(t, 546, FP.grass, 9, false); t.bevel = .1; },
  f_tall(t) { clearA(t); blades(t, 547, FP.grass, 7, true); t.bevel = .1; },
  fl_red(t) { plant(t, 548, ['#e4362f', '#f2493f'], '#2a1a12'); }, fl_yellow(t) { plant(t, 549, ['#ffd23a', '#ffe166'], '#d98a1a'); },
  fl_blue(t) { plant(t, 550, ['#3d8bff', '#6aa4ff'], '#fff4c4'); }, fl_pink(t) { plant(t, 551, ['#ff8fc2', '#ffb0d4'], '#ffe9a8'); },
  fl_white(t) { plant(t, 552, ['#ffffff', '#eef2f8'], '#ffd23a'); },
  f_fblock(t) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; put(t, x, y, edge ? '#16306a' : pick(['#1b3a80', '#1f418c', '#234898'], hash2(x, y, 553)), { h: edge ? .3 : .5, r: .3, e: .05 }); } for (const yc of [4.5, 10.5]) for (let x = 1; x < 15; x++) { const yy = Math.round(yc - 1.6 * Math.tanh((x - 7.5) / 3)); put(t, x, yy, '#ffffff', { h: .9, e: .9, r: .1 }); put(t, x, yy + 1, '#cfe2ff', { h: .85, e: .7, r: .1 }); } t.bevel = .3; t.edge = .7; },
});
def('f_grass', { tex: { top: 'f_grass_top', side: 'f_grass_side', bottom: 'f_dirt' } }); def('f_dirt', { tex: 'f_dirt' }); def('f_stone', { tex: 'f_stone' });
def('f_floatw', { tex: 'f_floatw' }); def('f_floatb', { tex: 'f_floatb' }); def('f_blue', { tex: 'f_blue' }); def('f_navy', { tex: 'f_navy' });
def('f_ore', { tex: 'f_ore', emit: [1, 4, 12] }); def('f_ore_w', { tex: 'f_ore_w', emit: [1, 3, 10] }); def('f_crystal', { tex: 'f_crystal', emit: [3, 8, 15] });
def('f_gold', { tex: 'f_gold', emit: [4, 3, 0] }); def('f_amethyst', { tex: 'f_amethyst', emit: [5, 2, 8] }); def('f_emerald', { tex: 'f_emerald', emit: [0, 4, 2] });
def('f_cherry', { tex: 'f_cherry', opaque: false, cutout: true }); def('f_oak', { tex: 'f_oak', opaque: false, cutout: true }); def('f_autumn', { tex: 'f_autumn', opaque: false, cutout: true });
def('f_birch', { tex: { top: 'log_top', side: 'f_birch', bottom: 'log_top' } }); def('f_planks', { tex: 'f_planks' }); def('f_path', { tex: { top: 'f_path', side: 'f_dirt', bottom: 'f_dirt' } }); def('f_sand', { tex: 'f_sand' });
def('f_cloud', { tex: 'f_cloud' });
def('roof_red', { tex: 'roof_red' }); def('roof_blue', { tex: 'roof_blue' }); def('roof_yellow', { tex: 'roof_yellow' }); def('roof_teal', { tex: 'roof_teal' }); def('roof_orange', { tex: 'roof_orange' }); def('roof_pink', { tex: 'roof_pink' });
def('wall_white', { tex: 'wall_white' }); def('f_window', { tex: 'f_window', emit: [12, 8, 3] });
def('f_slate', { tex: 'f_slate' }); def('f_glow', { tex: 'f_glow', emit: [3, 7, 13] }); def('f_post', { tex: 'f_post' });
def('f_rack', { tex: { top: 'steel', side: 'f_rack_side', bottom: 'steel', front: 'f_rack_front' }, emit: [1, 4, 12] });
def('roof_navy', { tex: 'roof_navy' }); def('roof_slate', { tex: 'roof_slate' }); def('roof_white', { tex: 'roof_white' });
def('f_tuft', { tex: 'f_tuft', opaque: false, cutout: true, cross: true }); def('f_tall', { tex: 'f_tall', opaque: false, cutout: true, cross: true });
def('fl_red', { tex: 'fl_red', opaque: false, cutout: true, cross: true }); def('fl_yellow', { tex: 'fl_yellow', opaque: false, cutout: true, cross: true }); def('fl_blue', { tex: 'fl_blue', opaque: false, cutout: true, cross: true });
def('fl_pink', { tex: 'fl_pink', opaque: false, cutout: true, cross: true }); def('fl_white', { tex: 'fl_white', opaque: false, cutout: true, cross: true });
def('f_fblock', { tex: 'f_fblock', emit: [2, 6, 13] });

// ---------- bake 16x16 art to 64x64 layers with relief ----------
const S = 4, N = 16 * S;
function bake(t) {
  const alb = new Uint8Array(N * N * 4), nrm = new Uint8Array(N * N * 4), ext = new Uint8Array(N * N * 4), H = new Float32Array(N * N), H2 = new Float32Array(N * N);
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const tx = (px / S) | 0, ty = (py / S) | 0, i = ty * 16 + tx;
    const lx = (px % S + .5) / S, ly = (py % S + .5) / S, d = Math.min(lx, 1 - lx, ly, 1 - ly);
    const pillow = sm(clamp(d / .5, 0, 1));
    const db = Math.min(px, N - 1 - px, py, N - 1 - py) + .5, ex = clamp(db / 15, 0, 1), edgeH = t.edge ? -t.edge * .95 * (1 - Math.sqrt(Math.max(0, 1 - (1 - ex) * (1 - ex)))) : 0;
    H[py * N + px] = t.h[i] * t.depth + pillow * .14 * t.bevel + edgeH;
  }
  // soften texel steps so every pixel reads as a bevelled tile
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) { let s = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) s += H[((py + oy + N) % N) * N + ((px + ox + N) % N)]; H2[py * N + px] = s / 9; }
  const k = 2.2 + t.bevel * 2.4;
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const tx = (px / S) | 0, ty = (py / S) | 0, i = ty * 16 + tx, row = N - 1 - py, o = (row * N + px) * 4;
    const dx = (H2[py * N + (px + 1) % N] - H2[py * N + (px - 1 + N) % N]) * k * S * .5;
    const dy = (H2[((py + 1) % N) * N + px] - H2[((py - 1 + N) % N) * N + px]) * k * S * .5;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const lx = (px % S + .5) / S, ly = (py % S + .5) / S, d = Math.min(lx, 1 - lx, ly, 1 - ly);
    const dbb = Math.min(px, N - 1 - px, py, N - 1 - py) + .5, rim = t.edge ? (1 - sm(clamp(dbb / 3, 0, 1))) : 0;
    const edgeDark = (1 - (1 - sm(clamp(d / .5, 0, 1))) * .07 * t.bevel) * (1 + rim * .07 * t.edge);
    alb[o] = t.c[i * 4] * edgeDark; alb[o + 1] = t.c[i * 4 + 1] * edgeDark; alb[o + 2] = t.c[i * 4 + 2] * edgeDark; alb[o + 3] = t.c[i * 4 + 3];
    nrm[o] = (nx * .5 + .5) * 255; nrm[o + 1] = (ny * .5 + .5) * 255; nrm[o + 2] = clamp(t.r[i], .04, 1) * 255; nrm[o + 3] = 255;
    ext[o] = t.m[i] * 255; ext[o + 1] = t.e[i] * 255; ext[o + 2] = clamp(t.cav[i] * (.86 + .14 * sm(clamp(d / .5, 0, 1))), 0, 1) * 255; ext[o + 3] = 255;
  }
  // pull colour into fully transparent texels from opaque neighbours (no white fringes in the mips)
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < N * N; i++) { if (alb[i * 4 + 3] > 0) continue; const x = i % N, y = (i / N) | 0; let r = 0, g = 0, b = 0, n = 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = ((y + oy + N) % N) * N + ((x + ox + N) % N); if (alb[j * 4 + 3] > 0 || alb[j * 4 + 3] === 0 && alb[j * 4] + alb[j * 4 + 1] + alb[j * 4 + 2] < 600 && pass > 0) { r += alb[j * 4]; g += alb[j * 4 + 1]; b += alb[j * 4 + 2]; n++; } } if (n) { alb[i * 4] = r / n; alb[i * 4 + 1] = g / n; alb[i * 4 + 2] = b / n; } }
  return { alb, nrm, ext };
}
export function buildTextures() {
  const names = Object.keys(GEN), layers = {}, L = names.length;
  const A = new Uint8Array(N * N * 4 * L), Nn = new Uint8Array(N * N * 4 * L), E = new Uint8Array(N * N * 4 * L);
  names.forEach((nm, li) => { const t = canvas16(); GEN[nm](t); const b = bake(t); A.set(b.alb, li * N * N * 4); Nn.set(b.nrm, li * N * N * 4); E.set(b.ext, li * N * N * 4); layers[nm] = li; });
  const mk = (data, srgb) => { const tx = new THREE.DataArrayTexture(data, N, N, L); tx.format = THREE.RGBAFormat; tx.type = THREE.UnsignedByteType; tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true; tx.anisotropy = 8; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; if (srgb) tx.colorSpace = THREE.SRGBColorSpace; tx.needsUpdate = true; return tx; };
  for (const b of BLOCKS) if (b.tex) { const t = typeof b.tex === 'string' ? { top: b.tex, side: b.tex, bottom: b.tex } : b.tex; b.L = [layers[t.side], layers[t.side], layers[t.top], layers[t.bottom], layers[t.side], layers[t.side]]; b.Lfront = t.front != null ? layers[t.front] : null; }
  return { alb: mk(A, true), nrm: mk(Nn, false), ext: mk(E, false), layers, count: L, N };
}

// ---------- faces: +X, -X, +Y, -Y, +Z, -Z ----------
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FT = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
const FB = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const FO = [[1, 0, 1], [0, 0, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1], [1, 0, 0]];

// ---------- world ----------
export class VoxelWorld {
  constructor(W, H, D) { this.W = W; this.H = H; this.D = D; this.b = new Uint8Array(W * H * D); this.face = new Uint8Array(W * H * D); this.chunk = 32; this.meshes = new Map(); }
  idx(x, y, z) { return x + this.W * (z + this.D * y); }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D; }
  get(x, y, z) { return this.in(x, y, z) ? this.b[x + this.W * (z + this.D * y)] : 0; }
  set(x, y, z, id, facing) { if (!this.in(x, y, z)) return; const i = x + this.W * (z + this.D * y); this.b[i] = id; if (facing != null) this.face[i] = facing; }
  opaque(x, y, z) { if (!this.in(x, y, z)) return y < 0; const id = this.b[x + this.W * (z + this.D * y)]; return id !== 0 && BLOCKS[id].opaque; }
  box(x0, y0, z0, x1, y1, z1, id) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, id); }
  top(x, z) { for (let y = this.H - 1; y >= 0; y--) { const id = this.get(x, y, z); if (id && BLOCKS[id].opaque) return y; } return -1; }

  // Sky light (0..15) flows down from the open sky and spreads sideways; block light carries colour from emitters.
  computeLight() {
    const { W, H, D } = this, n = W * H * D, sky = new Uint8Array(n), R = new Uint8Array(n), G = new Uint8Array(n), Bl = new Uint8Array(n);
    const tr = new Uint8Array(n); for (let i = 0; i < n; i++) { const id = this.b[i]; tr[i] = id === 0 || !BLOCKS[id].opaque ? 1 : 0; }
    const cap = n * 2, q = new Int32Array(cap); let qh = 0, qt = 0; const push = (i) => { q[qt] = i; qt = (qt + 1) % cap; }; const WD = W * D;
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { for (let y = H - 1; y >= 0; y--) { const i = x + W * (z + D * y); if (!tr[i]) break; const id = this.b[i]; sky[i] = id && BLOCKS[id].cutout && !BLOCKS[id].decal && !BLOCKS[id].cross ? 13 : 15; push(i); if (sky[i] < 15) break; } }
    const nb = (i, f) => { const x = i % W, z = ((i / W) | 0) % D, y = (i / WD) | 0; switch (f) { case 0: return x + 1 < W ? i + 1 : -1; case 1: return x > 0 ? i - 1 : -1; case 2: return y + 1 < H ? i + WD : -1; case 3: return y > 0 ? i - WD : -1; case 4: return z + 1 < D ? i + W : -1; default: return z > 0 ? i - W : -1; } };
    while (qh !== qt) { const i = q[qh]; qh = (qh + 1) % cap; const v = sky[i]; if (v <= 1) continue; for (let f = 0; f < 6; f++) { const j = nb(i, f); if (j < 0 || !tr[j]) continue; const nv = f === 3 && v === 15 ? 15 : v - 1; if (sky[j] < nv) { sky[j] = nv; push(j); } } }
    qh = qt = 0;
    for (let i = 0; i < n; i++) { const id = this.b[i]; if (id && BLOCKS[id].emit) { const e = BLOCKS[id].emit; R[i] = e[0]; G[i] = e[1]; Bl[i] = e[2]; push(i); } }
    while (qh !== qt) { const i = q[qh]; qh = (qh + 1) % cap; const r = R[i], g = G[i], b = Bl[i]; if (r <= 1 && g <= 1 && b <= 1) continue; for (let f = 0; f < 6; f++) { const j = nb(i, f); if (j < 0 || !tr[j]) continue; const nr = r - 1, ng = g - 1, nb2 = b - 1; let up = false; if (nr > R[j]) { R[j] = nr; up = true; } if (ng > G[j]) { G[j] = ng; up = true; } if (nb2 > Bl[j]) { Bl[j] = nb2; up = true; } if (up) push(j); } }
    // pack + dilate into solid cells so trilinear sampling near walls never reads black
    const out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { out[i * 4] = R[i] * 17; out[i * 4 + 1] = G[i] * 17; out[i * 4 + 2] = Bl[i] * 17; out[i * 4 + 3] = sky[i] * 17; }
    for (let i = 0; i < n; i++) { if (tr[i]) continue; let mr = out[i * 4], mg = out[i * 4 + 1], mb = out[i * 4 + 2], ms = 0, any = 0; for (let f = 0; f < 6; f++) { const j = nb(i, f); if (j < 0 || !tr[j]) continue; any = 1; mr = Math.max(mr, R[j] * 17); mg = Math.max(mg, G[j] * 17); mb = Math.max(mb, Bl[j] * 17); ms = Math.max(ms, sky[j] * 17); } if (any) { out[i * 4] = mr; out[i * 4 + 1] = mg; out[i * 4 + 2] = mb; out[i * 4 + 3] = ms; } }
    if (!this.lightTex) { const t = new THREE.Data3DTexture(out, W, D, H); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; this.lightTex = t; }
    else { this.lightTex.image.data = out; this.lightTex.needsUpdate = true; }
    this.lightTex.needsUpdate = true; this.light = out; this.sky = sky;
    return this.lightTex;
  }
  // light at a cell for CPU use (props): returns [r,g,b,sky] 0..1
  lightAt(x, y, z) { x = clamp(Math.floor(x), 0, this.W - 1); y = clamp(Math.floor(y), 0, this.H - 1); z = clamp(Math.floor(z), 0, this.D - 1); const i = (x + this.W * (z + this.D * y)) * 4, L = this.light; return L ? [L[i] / 255, L[i + 1] / 255, L[i + 2] / 255, L[i + 3] / 255] : [0, 0, 0, 1]; }

  // Mesh one chunk column: opaque faces + cutout faces (leaves, rails, glass).
  meshChunk(cx, cz) {
    const C = this.chunk, x0 = cx * C, z0 = cz * C, x1 = Math.min(this.W, x0 + C), z1 = Math.min(this.D, z0 + C);
    const bufs = [[], []];
    for (let y = 0; y < this.H; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const i = x + this.W * (z + this.D * y), id = this.b[i]; if (!id) continue; const bd = BLOCKS[id]; if (!bd.L) continue;
      const out = bufs[bd.cutout ? 1 : 0];
      if (bd.decal) { this.quad(out, x, y, z, 2, bd.L[2], .04 - 1); continue; }
      if (bd.cross) { this.cross(out, x, y, z, bd.L[0], hash3(x, y, z, 9)); continue; }
      for (let f = 0; f < 6; f++) {
        const n = FN[f], nx = x + n[0], ny = y + n[1], nz = z + n[2];
        const nid = this.get(nx, ny, nz);
        if (nid && BLOCKS[nid].opaque) continue; if (!this.in(nx, ny, nz) && ny < 0) continue;
        if (nid === id && bd.cutout && id !== B.leaves && id !== B.leaf_hl) continue;
        let layer = bd.L[f]; if (bd.Lfront != null && f === this.face[i]) layer = bd.Lfront;
        this.quad(out, x, y, z, f, layer, 0);
      }
    }
    return bufs.map(arr => {
      if (!arr.length) return null; const nq = arr.length / 4 / 6; const nv = nq * 4;
      const pos = new Float32Array(nv * 3), pack = new Uint8Array(nv), lay = new Uint8Array(nv), idx = new Uint32Array(nq * 6);
      // arr holds per vertex: x,y,z,pack,layer,flip
      for (let v = 0; v < nv; v++) { pos[v * 3] = arr[v * 6]; pos[v * 3 + 1] = arr[v * 6 + 1]; pos[v * 3 + 2] = arr[v * 6 + 2]; pack[v] = arr[v * 6 + 3]; lay[v] = arr[v * 6 + 4]; }
      for (let q = 0; q < nq; q++) { const b = q * 4, flip = arr[b * 6 + 5]; const o = q * 6; if (flip) { idx[o] = b + 1; idx[o + 1] = b + 2; idx[o + 2] = b + 3; idx[o + 3] = b + 1; idx[o + 4] = b + 3; idx[o + 5] = b; } else { idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPack', new THREE.BufferAttribute(pack, 1)); g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    });
  }
  quad(out, x, y, z, f, layer, lift) {
    const n = FN[f], T = FT[f], Bv = FB[f], O = FO[f];
    const fx = x + n[0], fy = y + n[1], fz = z + n[2];
    const ao = [], vs = [];
    for (let c = 0; c < 4; c++) {
      const u = c === 1 || c === 2 ? 1 : 0, v = c >= 2 ? 1 : 0;
      const px = x + O[0] + u * T[0] + v * Bv[0], py = y + O[1] + u * T[1] + v * Bv[1] + (lift ? lift + 1 : 0) * (f === 2 ? 1 : 0), pz = z + O[2] + u * T[2] + v * Bv[2];
      let a = 3;
      if (!lift) {
        const su = u ? 1 : -1, sv = v ? 1 : -1;
        const s1 = this.opaque(fx + su * T[0], fy + su * T[1], fz + su * T[2]) ? 1 : 0;
        const s2 = this.opaque(fx + sv * Bv[0], fy + sv * Bv[1], fz + sv * Bv[2]) ? 1 : 0;
        const cc = this.opaque(fx + su * T[0] + sv * Bv[0], fy + su * T[1] + sv * Bv[1], fz + su * T[2] + sv * Bv[2]) ? 1 : 0;
        a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
      }
      ao.push(a); vs.push([px, lift ? y + lift + 1 : py, pz, f | (u << 3) | (v << 4) | (a << 5)]);
    }
    if (lift) for (const p of vs) p[1] = y + .035; // rails sit just above the block below
    const flip = ao[0] + ao[2] < ao[1] + ao[3] ? 1 : 0;
    for (const p of vs) out.push(p[0], p[1], p[2], p[3], layer, flip);
  }
  cross(out, x, y, z, layer, j) {
    const a = .12 + j * .06, b = .88 - j * .06, hh = .82 + j * .3, ox = (j - .5) * .2;
    const qs = [[[x + a + ox, y, z + a], [x + b + ox, y, z + b], [x + b + ox, y + hh, z + b], [x + a + ox, y + hh, z + a]], [[x + b + ox, y, z + a], [x + a + ox, y, z + b], [x + a + ox, y + hh, z + b], [x + b + ox, y + hh, z + a]]];
    for (const q of qs) for (const back of [0, 1]) { const vs = back ? [q[1], q[0], q[3], q[2]] : q, uv = back ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]; for (let c = 0; c < 4; c++) out.push(vs[c][0], vs[c][1], vs[c][2], 2 | (uv[c][0] << 3) | (uv[c][1] << 4) | (3 << 5), layer, 0); }
  }
  buildAll(group, mats) {
    for (const [, m] of this.meshes) { for (const o of m) if (o) { group.remove(o); o.geometry.dispose(); } }
    this.meshes.clear();
    const C = this.chunk; for (let cz = 0; cz < Math.ceil(this.D / C); cz++) for (let cx = 0; cx < Math.ceil(this.W / C); cx++) this.buildChunk(group, mats, cx, cz);
  }
  buildChunk(group, mats, cx, cz) {
    const key = cx + ',' + cz, old = this.meshes.get(key); if (old) for (const o of old) if (o) { group.remove(o); o.geometry.dispose(); }
    const g = this.meshChunk(cx, cz), ms = g.map((geo, k) => { if (!geo) return null; const m = new THREE.Mesh(geo, k ? mats.cut : mats.solid); m.castShadow = true; m.receiveShadow = true; if (k) m.customDepthMaterial = mats.cutDepth; group.add(m); return m; });
    this.meshes.set(key, ms);
  }
  rebuildAround(group, mats, x, z) { const C = this.chunk, set = new Set(); for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) { const cx = Math.floor((x + dx) / C), cz = Math.floor((z + dz) / C); if (cx >= 0 && cz >= 0 && cx * C < this.W && cz * C < this.D) set.add(cx + ',' + cz); } for (const k of set) { const [cx, cz] = k.split(',').map(Number); this.buildChunk(group, mats, cx, cz); } }
}

// ---------- materials ----------
// Shared GLSL: sample the light field for any surface (world position + normal), scale indirect light, add block light.
const LIGHT_PARS = `
precision highp sampler3D;
uniform sampler3D uLight; uniform vec3 uDims; uniform float uBlockI; uniform vec3 uSkyTint; uniform float uSkyMin;
varying vec3 vWPos; varying vec3 vWNrm;
vec4 hmLight(vec3 wp, vec3 wn) { vec3 p = (wp + wn * 0.5) / uDims; return texture(uLight, p.xzy); }
vec3 hmBlock(vec3 c) { return pow(c, vec3(2.3)) * uBlockI; }
`;
function patchLight(shader, opts) {
  shader.uniforms.uLight = { value: opts.lightTex }; shader.uniforms.uDims = { value: opts.dims }; shader.uniforms.uBlockI = opts.blockI; shader.uniforms.uSkyMin = opts.skyMin;
  shader.uniforms.uSkyTint = { value: new THREE.Vector3(1, 1, 1) };
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + LIGHT_PARS);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;');
  shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
}
const LIGHT_APPLY = (aoExpr) => `
#include <lights_fragment_maps>
{ vec4 Lf = hmLight(vWPos, normalize(vWNrm)); float sky = max(pow(Lf.a, 1.7), uSkyMin); float ao = ${aoExpr};
  irradiance *= sky * ao; iblIrradiance *= sky * ao; radiance *= mix(sky, 1.0, 0.15) * mix(1.0, ao, 0.6);
  irradiance += hmBlock(Lf.rgb) * ao * PI; }
`;

export function voxelMaterials(tex, world, opts = {}) {
  const dims = new THREE.Vector3(world.W, world.H, world.D);
  const blockI = { value: opts.blockI ?? 1.6 }, skyMin = { value: opts.skyMin ?? 0.015 }, emisI = { value: opts.emisI ?? 1.7 }, nrmI = { value: opts.nrmI ?? 1.0 };
  const make = (cutout) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 1, alphaTest: cutout ? .5 : 0, side: THREE.FrontSide, envMapIntensity: opts.env ?? .75 });
    m.onBeforeCompile = (sh) => {
      patchLight(sh, { lightTex: world.lightTex, dims, blockI, skyMin });
      sh.uniforms.uAlb = { value: tex.alb }; sh.uniforms.uNrm = { value: tex.nrm }; sh.uniforms.uExt = { value: tex.ext }; sh.uniforms.uEmis = emisI; sh.uniforms.uNrmI = nrmI;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aPack; attribute float aLayer; varying vec2 vVUv; varying float vLayer; varying float vAO; varying vec3 vVT; varying vec3 vVB;
vec3 fN(int f){ return f==0?vec3(1,0,0):f==1?vec3(-1,0,0):f==2?vec3(0,1,0):f==3?vec3(0,-1,0):f==4?vec3(0,0,1):vec3(0,0,-1); }
vec3 fT(int f){ return f==0?vec3(0,0,-1):f==1?vec3(0,0,1):f==5?vec3(-1,0,0):vec3(1,0,0); }
vec3 fB(int f){ return f==2?vec3(0,0,-1):f==3?vec3(0,0,1):vec3(0,1,0); }`)
        .replace('#include <beginnormal_vertex>', `int pk = int(aPack + 0.5); int fc = pk & 7; vVUv = vec2(float((pk >> 3) & 1), float((pk >> 4) & 1)); vLayer = aLayer; vAO = float((pk >> 5) & 3) / 3.0;
vec3 objectNormal = fN(fc); vVT = normalize(normalMatrix * fT(fc)); vVB = normalize(normalMatrix * fB(fc));`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
precision highp sampler2DArray; uniform sampler2DArray uAlb; uniform sampler2DArray uNrm; uniform sampler2DArray uExt; uniform float uEmis; uniform float uNrmI;
varying vec2 vVUv; varying float vLayer; varying float vAO; varying vec3 vVT; varying vec3 vVB;`)
        .replace('#include <map_fragment>', `vec3 tuv = vec3(vVUv, vLayer); vec4 tA = texture(uAlb, tuv); vec4 tN = texture(uNrm, tuv); vec4 tE = texture(uExt, tuv); diffuseColor *= tA;`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tN.b;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * tE.r;')
        .replace('#include <normal_fragment_maps>', `{ vec3 mn = vec3((tN.xy * 2.0 - 1.0) * uNrmI, 1.0); mn.z = sqrt(max(0.0, 1.0 - dot(mn.xy, mn.xy))) + 0.0001; normal = normalize(mat3(normalize(vVT), normalize(vVB), normal) * normalize(mn)); }`)
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += diffuseColor.rgb * tE.g * uEmis;')
        .replace('#include <lights_fragment_maps>', LIGHT_APPLY('mix(0.38, 1.0, vAO * vAO) * tE.b'))
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n reflectedLight.directDiffuse *= mix(0.72, 1.0, vAO) * tE.b;');
    };
    m.customProgramCacheKey = () => 'hmvox' + (cutout ? 'c' : 's');
    return m;
  };
  const solid = make(false), cut = make(true);
  // cutout shadows: alpha-tested depth material
  const cutDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: .5 });
  cutDepth.onBeforeCompile = (sh) => {
    sh.uniforms.uAlb = { value: tex.alb };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPack; attribute float aLayer; varying vec2 vVUv; varying float vLayer;').replace('#include <begin_vertex>', '#include <begin_vertex>\nint pk = int(aPack + 0.5); vVUv = vec2(float((pk >> 3) & 1), float((pk >> 4) & 1)); vLayer = aLayer;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nprecision highp sampler2DArray; uniform sampler2DArray uAlb; varying vec2 vVUv; varying float vLayer;').replace('#include <alphatest_fragment>', 'if (texture(uAlb, vec3(vVUv, vLayer)).a < 0.5) discard;');
  };
  cutDepth.customProgramCacheKey = () => 'hmcutdepth';
  return { solid, cut, cutDepth, uniforms: { blockI, skyMin, emisI, nrmI } };
}

// Any three.js standard material can be made to sit in the world's light: it darkens in tunnels and takes lamp colour.
export function litMaterial(world, params = {}, uni = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: .7 }, params));
  const dims = new THREE.Vector3(world.W, world.H, world.D);
  const blockI = uni.blockI || { value: 2.2 }, skyMin = uni.skyMin || { value: .015 };
  m.onBeforeCompile = (sh) => { patchLight(sh, { lightTex: world.lightTex, dims, blockI, skyMin }); sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', LIGHT_APPLY('1.0')); };
  m.customProgramCacheKey = () => 'hmlit';
  return m;
}

// Pixel art for props (16..64 px), baked to a crisp map + relief normal map.
export function pixelTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.anisotropy = 8; map.generateMipmaps = true;
  let normalMap = null;
  if (o.relief !== false) {
    const sc = o.scale || 4, W2 = w * sc, H2 = h * sc, id = g.getImageData(0, 0, w, h).data, nc = document.createElement('canvas'); nc.width = W2; nc.height = H2; const ng = nc.getContext('2d'), out = ng.createImageData(W2, H2);
    const lum = (x, y) => { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); const i = (y * w + x) * 4; return (id[i] * .3 + id[i + 1] * .59 + id[i + 2] * .11) / 255 * (id[i + 3] / 255); };
    const Hh = new Float32Array(W2 * H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const tx = (x / sc) | 0, ty = (y / sc) | 0, lx = (x % sc + .5) / sc, ly = (y % sc + .5) / sc, d = Math.min(lx, 1 - lx, ly, 1 - ly); Hh[y * W2 + x] = lum(tx, ty) * (o.lumH ?? .35) + sm(clamp(d / .5, 0, 1)) * .14 * (o.bevel ?? .6); }
    const k = (o.strength ?? 3) * sc * .5;
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const dx = (Hh[y * W2 + Math.min(W2 - 1, x + 1)] - Hh[y * W2 + Math.max(0, x - 1)]) * k, dy = (Hh[Math.min(H2 - 1, y + 1) * W2 + x] - Hh[Math.max(0, y - 1) * W2 + x]) * k; let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); const i = (y * W2 + x) * 4; out.data[i] = (nx / l * .5 + .5) * 255; out.data[i + 1] = (ny / l * .5 + .5) * 255; out.data[i + 2] = (nz / l * .5 + .5) * 255; out.data[i + 3] = 255; }
    ng.putImageData(out, 0, 0); normalMap = new THREE.CanvasTexture(nc); normalMap.magFilter = THREE.LinearFilter; normalMap.minFilter = THREE.LinearMipmapLinearFilter; normalMap.generateMipmaps = true;
  }
  return { map, normalMap, canvas: c };
}
