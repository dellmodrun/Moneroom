// Floatmine world: one floating island in Float's navy sky. A terraced open mine in the middle with twelve rig halls
// (one per real mining pool), the Float core at the bottom of the pit that turns the haul into $FLOAT, a village of
// holders on the rim who receive it, a waterfall off the edge, satellite islets, voxel clouds.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VoxelWorld, B, BLOCKS, buildTextures, voxelMaterials, litMaterial, fbm, vnoise, hash2, hash3, mulberry, clamp } from './mine3d.js';
import { makeFigure, makeDrill, makePickaxe, pose, holdTool } from './figures.js';
import { pickSVG } from './pick.js';

export const C = { W: 204, H: 112, D: 204, CX: 102, CZ: 102, G: 80, R: 63, FLOOR: 60, FR: 20, PIT: 30, W0: 5, SH: 3, SI: 2 };
export const POOLS = ['ocean', 'antpool', 'viabtc', 'f2pool', 'spiderpool', 'marapool', 'luxor', 'secpool', 'binancepool', 'braiinspool', 'foundryusa', 'cloverpool'];
export const POOL_NAMES = { foundryusa: 'Foundry USA', antpool: 'AntPool', f2pool: 'F2Pool', viabtc: 'ViaBTC', luxor: 'Luxor', marapool: 'MARA Pool', spiderpool: 'SpiderPool', secpool: 'SECPOOL', ocean: 'OCEAN', braiinspool: 'Braiins', binancepool: 'Binance Pool', cloverpool: 'CloverPool', btccom: 'BTC.com' };
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- island shape
const angNoise = (a, s, k = 1.6) => fbm(Math.cos(a) * k + 10, Math.sin(a) * k + 10, s, 3);
export function rimR(a) { return C.R * (.82 + .3 * angNoise(a, 11)) ; }
// terraced pit: top solid y for a cell at distance d from the centre (null = natural surface)
export function pitTop(d) {
  if (d >= C.PIT) return null;
  if (d < C.FR) return C.FLOOR;
  const i = Math.floor((d - C.FR) / C.SI) + 1; // 1..5
  return C.FLOOR + C.W0 + (i - 1) * C.SH;
}
function surfaceY(x, z) {
  const dx = x + .5 - C.CX, dz = z + .5 - C.CZ, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), r = rimR(a);
  if (d > r) return null;
  let h = C.G + Math.round(2.2 * fbm(x * .035, z * .035, 21, 3) - .6);
  // a raised hill on the north-east carries the spring of the waterfall
  const hx = C.CX + Math.cos(HILL.a) * HILL.d, hz = C.CZ + Math.sin(HILL.a) * HILL.d, hd = Math.hypot(x + .5 - hx, z + .5 - hz);
  h += Math.round(7 * Math.max(0, 1 - hd / 16) ** 1.6);
  if (d < C.PIT + 5) h = C.G; // a level rim around the pit
  if (d > r - 3) h -= (d > r - 1.2 ? 2 : 1); // soft rounded edge
  return h;
}
const HILL = { a: 1.42, d: 41 };
const RIVER = { a: 1.78 }; // the stream leaves the hill and drops off the edge here
function undersideY(x, z, top) {
  const dx = x + .5 - C.CX, dz = z + .5 - C.CZ, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), f = clamp(d / rimR(a), 0, 1);
  let depth = (5 + 50 * Math.pow(1 - f, 1.35)) * (.78 + .38 * fbm(x * .07, z * .07, 31, 3));
  // stalactites hanging under the island
  const sp = hash2(x >> 2, z >> 2, 33); if (sp > .86 && f < .8) depth += (sp - .86) * 90 * (1 - f);
  return Math.round(top - depth);
}
// strata: Float waves through the rock (white and pale-blue bands bend like Float's mark)
function wave(x, z) { const u = ((x - C.CX) * .82 + (z - C.CZ) * .57); return 4.2 * Math.tanh(u / 16) + 1.2 * (fbm(x * .05, z * .05, 41, 2) - .5) * 2; }
function stratum(x, y, z, top) {
  const k = top - y, b = k + wave(x, z);
  if (k <= 0) return B.f_grass;
  if (b < 2.4) return B.f_dirt;
  if (b < 7.2) return oreIn(x, y, z, B.f_stone);
  if (b < 8.1) return B.f_floatw; // one thin quartz line: Float's wave through the rock
  if (b < 15) return oreIn(x, y, z, B.f_stone);
  if (b < 22) return oreIn(x, y, z, B.f_blue);
  return oreIn(x, y, z, B.f_navy);
}
// FLOAT ore comes in small glowing veins (2x2x2 cells), denser the deeper the rock
function oreIn(x, y, z, id) {
  const h = hash3(x, y, z, 51), v = hash3(x >> 1, y >> 1, z >> 1, 53);
  if (id === B.f_stone) return v < .045 && h < .55 ? B.f_ore : h < .005 ? B.f_gold : id;
  if (id === B.f_blue) return v < .07 && h < .6 ? B.f_ore : id;
  if (id === B.f_navy) return v < .09 && h < .6 ? B.f_ore : h < .004 ? B.f_crystal : id;
  return id;
}
// a lantern on a dark iron post (only on open ground)
function lantern(world, x, z, h = 2) {
  const t = world.top(x, z); if (t < 0) return false; const id = world.get(x, t, z);
  if (id !== B.f_grass && id !== B.f_path && id !== B.f_dirt && id !== B.f_slate) return false;
  for (let y = t + 1; y <= t + h + 1; y++) { const u = world.get(x, y, z); if (u && !BLOCKS[u].cross) return false; }
  for (let y = t + 1; y <= t + h; y++) world.set(x, y, z, B.f_post);
  world.set(x, t + h + 1, z, B.lamp); return true;
}

// ---------------------------------------------------------------- generation
export function generate(world) {
  const info = { galleries: [], houses: [], trees: [], chests: [], islets: [], plaza: null, river: null };
  // main island column by column
  for (let z = 0; z < C.D; z++) for (let x = 0; x < C.W; x++) {
    const top = surfaceY(x, z); if (top == null) continue;
    const bot = undersideY(x, z, top);
    for (let y = Math.max(1, bot); y <= top; y++) world.set(x, y, z, stratum(x, y, z, top));
    // crystal tip: the deepest rock glows Float blue
    if (top - bot > 48) for (let y = bot; y < bot + 2; y++) if (hash3(x, y, z, 61) < .3) world.set(x, y, z, B.f_crystal);
    // glowing crystal stalactites hang all over the underside
    if (top - bot > 14 && hash2(x, z, 63) < .03) { const len = 2 + (hash2(x, z, 64) * 6 | 0); for (let y = bot - 1; y >= Math.max(1, bot - len); y--) world.set(x, y, z, B.f_crystal); }
  }
  carvePit(world, info);
  carveGalleries(world, info);
  buildCore(world, info);
  river(world, info);
  village(world, info);
  trees(world, info);
  islets(world, info);
  plants(world);
  return info;
}
function carvePit(world) {
  for (let z = C.CZ - C.PIT - 1; z <= C.CZ + C.PIT + 1; z++) for (let x = C.CX - C.PIT - 1; x <= C.CX + C.PIT + 1; x++) {
    const d = Math.hypot(x + .5 - C.CX, z + .5 - C.CZ), t = pitTop(d); if (t == null) continue;
    for (let y = t + 1; y < C.H; y++) world.set(x, y, z, 0);
    // polished slate everywhere; the core plaza and the twelve spokes to the halls in Float white
    const ring = d < C.FR ? 0 : Math.floor((d - C.FR) / C.SI) + 1;
    const ang = Math.atan2(z + .5 - C.CZ, x + .5 - C.CX), spoke = Math.abs(((ang / TAU * 12 + 12.5) % 1) - .5) < .045;
    world.set(x, t, z, ring === 0 && d < 7 ? B.f_floatw : B.f_slate); void spoke;
    // re-colour exposed walls with the strata at their real depth below the original surface
    for (let y = t - 1; y >= t - 6; y--) { const id = world.get(x, y, z); if (id && id !== B.f_path) world.set(x, y, z, stratum(x, y, z, C.G)); }
  }
  // runway lights along the lip of every terrace and round the pit floor
  for (let ring = 1; ring <= 5; ring++) {
    const rr = C.FR + (ring - 1) * C.SI + .5, y = C.FLOOR + C.W0 + (ring - 1) * C.SH, n = Math.round(TAU * rr / 8.5);
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU + ring * .21, X = Math.floor(C.CX + .5 + Math.cos(a) * rr), Z = Math.floor(C.CZ + .5 + Math.sin(a) * rr); if (world.get(X, y, Z) === B.f_slate && !world.get(X, y + 1, Z)) world.set(X, y, Z, B.f_glow); }
  }
}
function carveGalleries(world, info) {
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU + TAU / 24, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const g = { k, pool: POOLS[k], a, dir: [dx, dz], p: [px, pz], x: C.CX + dx * C.FR, z: C.CZ + dz * C.FR, len: 13 };
    for (let s = -1; s <= g.len; s += .5) for (let w = -2.4; w <= 2.4; w += .5) {
      const x = Math.floor(C.CX + dx * (C.FR + s) + px * w), z = Math.floor(C.CZ + dz * (C.FR + s) + pz * w);
      for (let y = C.FLOOR + 1; y <= C.FLOOR + 4; y++) world.set(x, y, z, 0);
      world.set(x, C.FLOOR, z, B.f_slate);
    }
    // rig racks along both walls (their LED faces turned to the aisle), lamps in the ceiling, the glowing face at the end
    for (let s = 2; s <= g.len - 2; s += 1) for (const side of [-1, 1]) {
      const x = Math.floor(C.CX + dx * (C.FR + s) + px * side * 2.2), z = Math.floor(C.CZ + dz * (C.FR + s) + pz * side * 2.2);
      const fx = -side * px, fz = -side * pz, f = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 1) : (fz > 0 ? 4 : 5);
      world.set(x, C.FLOOR + 1, z, B.f_rack, f); world.set(x, C.FLOOR + 2, z, B.f_rack, f); if (s % 2 === 0) world.set(x, C.FLOOR + 3, z, B.f_rack, f);
    }
    for (let s = 1; s <= g.len - 1; s += 3) { const x = Math.floor(C.CX + dx * (C.FR + s)), z = Math.floor(C.CZ + dz * (C.FR + s)); world.set(x, C.FLOOR + 5, z, B.lamp); }
    // timber ceiling beams every three blocks, like a real gallery
    for (let s = 3; s <= g.len - 1; s += 3) for (let w = -2.4; w <= 2.4; w += .5) { const x = Math.floor(C.CX + dx * (C.FR + s) + px * w), z = Math.floor(C.CZ + dz * (C.FR + s) + pz * w); if (!world.get(x, C.FLOOR + 4, z)) world.set(x, C.FLOOR + 4, z, B.f_planks); }
    for (let w = -2.4; w <= 2.4; w += .5) for (let y = C.FLOOR + 1; y <= C.FLOOR + 4; y++) { const x = Math.floor(C.CX + dx * (C.FR + g.len + 1) + px * w), z = Math.floor(C.CZ + dz * (C.FR + g.len + 1) + pz * w); world.set(x, y, z, hash3(x, y, z, 81) < .84 ? B.f_ore : B.f_crystal); }
    // a clean Float-white portal at the mouth with two lamps inside its corners
    for (const side of [-1, 1]) {
      for (let y = C.FLOOR + 1; y <= C.FLOOR + 4; y++) { const x = Math.floor(C.CX + dx * (C.FR - .2) + px * side * 2.9), z = Math.floor(C.CZ + dz * (C.FR - .2) + pz * side * 2.9); world.set(x, y, z, B.f_post); }
      const lx = Math.floor(C.CX + dx * (C.FR + .4) + px * side * 1.9), lz = Math.floor(C.CZ + dz * (C.FR + .4) + pz * side * 1.9); world.set(lx, C.FLOOR + 4, lz, B.lamp);
    }
    info.galleries.push(g);
  }
}
function buildCore(world, info) {
  const y0 = C.FLOOR + 1;
  for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) {
    const d = Math.hypot(x, z), X = C.CX + x, Z = C.CZ + z;
    if (d <= 3.4) world.set(X, y0, Z, B.f_fblock);
    else if (d <= 4.6) world.set(X, y0, Z, B.f_crystal);
    else if (d <= 5.6) world.set(X, C.FLOOR, Z, B.f_floatw);
    else if (d <= 6.5) world.set(X, C.FLOOR, Z, B.f_slate);
    else if (d <= 7.4) world.set(X, C.FLOOR, Z, B.f_floatw);
  }
  // four pylons, each a Float block topped with a crystal and a light
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4; const X = Math.floor(C.CX + .5 + Math.cos(a) * 9.6), Z = Math.floor(C.CZ + .5 + Math.sin(a) * 9.6); world.set(X, y0, Z, B.f_fblock); world.set(X, y0 + 1, Z, B.f_fblock); world.set(X, y0 + 2, Z, B.f_crystal); }
  info.core = { x: C.CX + .5, y: y0 + 1, z: C.CZ + .5 };
}
function river(world, info) {
  const hx = C.CX + Math.cos(HILL.a) * HILL.d, hz = C.CZ + Math.sin(HILL.a) * HILL.d;
  // spring pool on the hill
  const top = world.top(Math.floor(hx), Math.floor(hz));
  for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) { if (Math.hypot(x, z) > 3.2) continue; const X = Math.floor(hx) + x, Z = Math.floor(hz) + z; const t = world.top(X, Z); for (let y = t; y > top - 1; y--) world.set(X, y, Z, 0); world.set(X, top - 1, Z, B.water); world.set(X, top - 2, Z, B.f_sand); }
  // the stream runs downhill in steps, then straight to the rim and over
  const ex = Math.cos(RIVER.a), ez = Math.sin(RIVER.a); let x = hx, z = hz, lvl = top - 1; const pts = [];
  for (let i = 0; i < 90; i++) {
    const tx = C.CX + ex * (C.R + 10), tz = C.CZ + ez * (C.R + 10); const vx = tx - x, vz = tz - z, l = Math.hypot(vx, vz); x += vx / l * .7; z += vz / l * .7;
    const X = Math.floor(x), Z = Math.floor(z), t = world.top(X, Z); if (t < 0) break;
    const d = Math.hypot(X + .5 - C.CX, Z + .5 - C.CZ), rr = rimR(Math.atan2(Z + .5 - C.CZ, X + .5 - C.CX)); if (d > rr + .6) { pts.push([x, lvl, z]); break; }
    if (d < rr - 4) lvl = Math.min(lvl, t); pts.push([x, lvl, z]);
    for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const XX = X + ox, ZZ = Z + oz; const tt = world.top(XX, ZZ); if (tt < 0 && d < rr - 1) continue; for (let y = Math.max(tt, lvl); y > lvl; y--) world.set(XX, y, ZZ, 0); world.set(XX, lvl, ZZ, B.water); world.set(XX, lvl - 1, ZZ, B.f_sand); if (!world.get(XX, lvl - 2, ZZ)) world.set(XX, lvl - 2, ZZ, B.f_stone); }
  }
  const last = pts[pts.length - 1];
  info.river = { pts, fall: { x: last[0] + ex * 1.2, y: last[1] + .86, z: last[2] + ez * 1.2, dx: ex, dz: ez } };
}
const ROOFS = ['roof_navy', 'roof_white', 'roof_blue', 'roof_slate', 'roof_navy', 'roof_blue', 'roof_white', 'roof_navy', 'roof_slate', 'roof_blue'];
function house(world, cx, cz, w, d, face, roofId, info) {
  const x0 = Math.round(cx - w / 2), z0 = Math.round(cz - d / 2), x1 = x0 + w - 1, z1 = z0 + d - 1;
  let base = 0; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) base = Math.max(base, world.top(x, z));
  for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) { for (let y = base + 1; y < base + 14; y++) world.set(x, y, z, 0); for (let y = base; y > base - 4; y--) if (!world.get(x, y, z)) world.set(x, y, z, B.f_dirt); world.set(x, base, z, B.f_path); }
  const H = 4;
  for (let y = base + 1; y <= base + H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1; if (!edgeX && !edgeZ) continue;
    const corner = edgeX && edgeZ, mid = (x === Math.floor((x0 + x1) / 2) || z === Math.floor((z0 + z1) / 2));
    world.set(x, y, z, corner ? B.log : y === base + H ? B.f_planks : (y === base + 2 && !corner && (x + z) % 2 === 0 && !mid) ? B.f_window : B.wall_white);
  }
  // door toward the pit
  const [fx, fz] = face, dxm = Math.floor((x0 + x1) / 2), dzm = Math.floor((z0 + z1) / 2);
  const doorX = fx > 0 ? x1 : fx < 0 ? x0 : dxm, doorZ = fz > 0 ? z1 : fz < 0 ? z0 : dzm;
  world.set(doorX, base + 1, doorZ, 0); world.set(doorX, base + 2, doorZ, 0);
  // hip roof in coloured tiles
  const rid = B[roofId];
  for (let k = 0; k < Math.ceil(Math.min(w, d) / 2) + 1; k++) { const y = base + H + 1 + k; for (let z = z0 - 1 + k; z <= z1 + 1 - k; z++) for (let x = x0 - 1 + k; x <= x1 + 1 - k; x++) { const inner = x > x0 - 1 + k && x < x1 + 1 - k && z > z0 - 1 + k && z < z1 + 1 - k; if (!inner || k === Math.ceil(Math.min(w, d) / 2)) world.set(x, y, z, rid); } }
  const chest = { x: doorX + .5 + fx * 1.4 + (fz !== 0 ? 1.4 : 0), y: base + 1, z: doorZ + .5 + fz * 1.4 + (fx !== 0 ? 1.4 : 0) };
  info.houses.push({ x0, z0, x1, z1, base, door: { x: doorX + .5 + fx * 1.2, z: doorZ + .5 + fz * 1.2 }, chest, roof: roofId });
  info.chests.push(chest);
  // a lantern on the other side of the door
  lantern(world, Math.floor(doorX + .5 + fx * 1.7 - (fz !== 0 ? 1.8 : 0)), Math.floor(doorZ + .5 + fz * 1.7 - (fx !== 0 ? 1.8 : 0)));
}
function village(world, info) {
  const r = mulberry(91), placed = [];
  const spots = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + (r() - .5) * .2; spots.push([a, 35 + r() * 14]); }
  let n = 0;
  const PA = 2.78, PX = C.CX + Math.cos(PA) * 33, PZ = C.CZ + Math.sin(PA) * 33;
  for (const [a, d] of spots) {
    if (Math.hypot(C.CX + Math.cos(a) * d - PX, C.CZ + Math.sin(a) * d - PZ) < 13) continue;
    if (Math.abs(((a - RIVER.a + Math.PI * 3) % TAU) - Math.PI) < .32) continue; // keep the stream clear
    if (Math.abs(((a - HILL.a + Math.PI * 3) % TAU) - Math.PI) < .4 && d > 30) continue;
    const cx = C.CX + Math.cos(a) * d, cz = C.CZ + Math.sin(a) * d; if (d > rimR(a) - 8) continue;
    if (placed.some(p => Math.hypot(p[0] - cx, p[1] - cz) < 10)) continue;
    const w = 5 + (r() * 3 | 0), dd = 5 + (r() * 2 | 0);
    const fx = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? -Math.sign(Math.cos(a)) : 0, fz = fx === 0 ? -Math.sign(Math.sin(a)) : 0;
    house(world, cx, cz, w, dd, [fx, fz], ROOFS[n % ROOFS.length], info); placed.push([cx, cz]); n++;
    // path from the door to the rim road, lit every few steps
    const door = info.houses[info.houses.length - 1].door; let x = door.x, z = door.z;
    for (let s = 0; s < 40; s++) { const vx = C.CX - x, vz = C.CZ - z, l = Math.hypot(vx, vz); if (l < C.PIT + 3) break; x += vx / l * .8; z += vz / l * .8; const X = Math.floor(x), Z = Math.floor(z), t = world.top(X, Z); if (world.get(X, t, Z) === B.f_grass) world.set(X, t, Z, B.f_path); if (s % 8 === 5) lantern(world, Math.floor(x - vz / l * 1.6), Math.floor(z + vx / l * 1.6)); }
  }
  // rim road around the pit, lanterns on its outer side
  for (let a = 0; a < TAU; a += .01) for (const rr of [C.PIT + 1.2, C.PIT + 2.1]) { const X = Math.floor(C.CX + Math.cos(a) * rr), Z = Math.floor(C.CZ + Math.sin(a) * rr), t = world.top(X, Z); if (world.get(X, t, Z) === B.f_grass) world.set(X, t, Z, B.f_path); }
  const PA0 = 2.78, PX0 = C.CX + Math.cos(PA0) * 33, PZ0 = C.CZ + Math.sin(PA0) * 33;
  for (let i = 0; i < 28; i++) { const a = (i + .5) / 28 * TAU, X = Math.floor(C.CX + Math.cos(a) * (C.PIT + 3.4)), Z = Math.floor(C.CZ + Math.sin(a) * (C.PIT + 3.4)); if (Math.hypot(X - PX0, Z - PZ0) > 7.5) lantern(world, X, Z); }
  // plaza with the Float flag, opposite the stream
  const pa = 2.78, px = C.CX + Math.cos(pa) * 33, pz = C.CZ + Math.sin(pa) * 33;
  for (let z = -5; z <= 5; z++) for (let x = -5; x <= 5; x++) { if (Math.hypot(x, z) > 5.4) continue; const X = Math.floor(px) + x, Z = Math.floor(pz) + z, t = world.top(X, Z), id = world.get(X, t, Z); if (id !== B.f_grass && id !== B.f_path && id !== B.f_dirt) continue; for (let y = t + 1; y < t + 3; y++) if (world.get(X, y, Z) && BLOCKS[world.get(X, y, Z)].cross) world.set(X, y, Z, 0); const dd = Math.hypot(x, z); world.set(X, t, Z, dd < 1.6 || (dd > 4.2 && dd <= 5.4) ? B.f_floatw : B.f_slate); }
  info.plaza = { x: Math.floor(px) + .5, z: Math.floor(pz) + .5, y: world.top(Math.floor(px), Math.floor(pz)) + 1, a: pa };
}
function tree(world, x, z, kind, r) {
  const t = world.top(x, z); if (t < 0 || world.get(x, t, z) !== B.f_grass) return false;
  if (kind === 'autumn') { // a spruce: tall trunk inside a stepped cone of dark needles
    const h = 7 + (r() * 3 | 0);
    for (let y = t + 1; y <= t + h; y++) world.set(x, y, z, B.log);
    for (let dy = 3; dy <= h + 1; dy++) { const Y = t + dy, rad = (h + 1 - dy) * .36 + (dy % 2 ? .55 : .1); for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { if (Math.hypot(dx, dz) > rad || (!dx && !dz && dy <= h)) continue; if (!world.get(x + dx, Y, z + dz)) world.set(x + dx, Y, z + dz, B.f_autumn); } }
    world.set(x, t + h + 1, z, B.f_autumn); world.set(x, t + h + 2, z, B.f_autumn);
    return true;
  }
  const h = kind === 'cherry' ? 5 + (r() * 2 | 0) : kind === 'birch' ? 6 + (r() * 2 | 0) : 5 + (r() * 3 | 0);
  const trunk = kind === 'birch' ? B.f_birch : B.log, leaf = kind === 'cherry' ? B.f_cherry : kind === 'autumn' ? B.f_autumn : B.f_oak;
  for (let y = t + 1; y <= t + h; y++) world.set(x, y, z, trunk);
  const R = kind === 'cherry' ? 3.4 : 2.6, cy = t + h;
  for (let dy = -2; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const e = Math.hypot(dx, dy * (kind === 'cherry' ? 1.5 : 1.15), dz); if (e > R + (hash3(x + dx, cy + dy, z + dz, 101) - .5) * .9) continue;
    const X = x + dx, Y = cy + dy, Z = z + dz; if (!world.get(X, Y, Z)) world.set(X, Y, Z, leaf);
  }
  return true;
}
function trees(world, info) {
  const r = mulberry(111); let n = 0;
  for (let i = 0; i < 1600 && n < 66; i++) {
    const a = r() * TAU, d = C.PIT + 10 + r() * (C.R - C.PIT - 10), x = Math.floor(C.CX + Math.cos(a) * d), z = Math.floor(C.CZ + Math.sin(a) * d);
    if (d > rimR(a) - 4) continue;
    if (info.houses.some(h => x > h.x0 - 4 && x < h.x1 + 4 && z > h.z0 - 4 && z < h.z1 + 4)) continue;
    if (info.plaza && Math.hypot(x - info.plaza.x, z - info.plaza.z) < 9) continue;
    if (info.trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 6.2)) continue;
    if (info.river && info.river.pts.some(p => Math.hypot(p[0] - x, p[2] - z) < 4)) continue;
    const q = r(), kind = q < .22 ? 'cherry' : q < .56 ? 'oak' : q < .82 ? 'autumn' : 'birch';
    if (tree(world, x, z, kind, r)) { info.trees.push([x, z, kind]); n++; }
  }
}
function islet(world, cx, cz, top, rad, seed) {
  const r = mulberry(seed);
  for (let z = Math.floor(cz - rad - 2); z <= cz + rad + 2; z++) for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
    const a = Math.atan2(z + .5 - cz, x + .5 - cx), rr = rad * (.8 + .35 * angNoise(a, seed, 1.2)), d = Math.hypot(x + .5 - cx, z + .5 - cz); if (d > rr) continue;
    const f = d / rr, t = top + Math.round(1.2 * fbm(x * .1, z * .1, seed, 2) - .4) - (f > .8 ? 1 : 0), depth = Math.round((3 + rad * 1.7 * Math.pow(1 - f, 1.3)) * (.8 + .4 * hash2(x >> 1, z >> 1, seed)));
    for (let y = t - depth; y <= t; y++) world.set(x, y, z, stratum(x, y, z, t));
  }
  void r;
}
function islets(world, info) {
  const spec = [[3.3, 82, 92, 8, 'cherry'], [.25, 80, 72, 9, 'rig'], [4.65, 82, 88, 7, 'cottage'], [1.15, 82, 62, 6, 'pond'],
    [2.42, 87, 100, 5, 'crystal'], [5.5, 85, 70, 6, 'lantern'], [.82, 88, 97, 4, 'crystal'], [3.98, 88, 67, 5, 'lantern']];
  spec.forEach(([a, d, top, rad, kind], i) => {
    const cx = C.CX + Math.cos(a) * d, cz = C.CZ + Math.sin(a) * d; islet(world, cx, cz, top, rad, 200 + i * 13);
    const X = Math.floor(cx), Z = Math.floor(cz), r = mulberry(300 + i);
    if (kind === 'cherry') tree(world, X, Z, 'cherry', r);
    if (kind === 'rig') { const t = world.top(X, Z); for (let z = -2; z <= 2; z++) for (let x = -3; x <= 3; x++) { world.set(X + x, t, Z + z, B.f_planks); if (Math.abs(z) === 2) { const f = z > 0 ? 5 : 4; world.set(X + x, t + 1, Z + z, B.f_rack, f); world.set(X + x, t + 2, Z + z, B.f_rack, f); } } world.set(X - 3, t + 3, Z, B.lamp); world.set(X + 3, t + 3, Z, B.lamp); info.rigIslet = { x: X + .5, y: t + 1, z: Z + .5 }; }
    if (kind === 'cottage') { house(world, cx, cz, 5, 5, [Math.cos(a) > 0 ? -1 : 1, 0], 'roof_blue', info); }
    if (kind === 'pond') { const t = world.top(X, Z); for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, z) < 2.4) { world.set(X + x, t, Z + z, B.water); world.set(X + x, t - 1, Z + z, B.f_sand); } tree(world, X + 3, Z - 2, 'autumn', r); }
    if (kind === 'crystal') { const t = world.top(X, Z); for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) { const d = Math.hypot(x, z); if (d > 2.3) continue; const hh = Math.round((2.6 - d) * 2.2 + hash2(X + x, Z + z, 71) * 2); for (let y = 1; y <= hh; y++) world.set(X + x, t + y, Z + z, d < 1.2 || y > 1 ? B.f_crystal : B.f_ore); } }
    if (kind === 'lantern') { lantern(world, X, Z, 3); tree(world, X - 3, Z + 2, 'cherry', r); }
    info.islets.push({ x: cx, z: cz, top, rad, kind });
  });
}
function plants(world) {
  const fl = [B.fl_blue, B.fl_white, B.fl_blue, B.fl_white, B.fl_yellow];
  for (let z = 0; z < C.D; z++) for (let x = 0; x < C.W; x++) {
    const t = world.top(x, z); if (t < 0 || world.get(x, t, z) !== B.f_grass || world.get(x, t + 1, z)) continue;
    const h = hash2(x, z, 131), patch = fbm(x * .09, z * .09, 133, 2);
    if (h < .05 + patch * .1) world.set(x, t + 1, z, fl[(hash2(x >> 2, z >> 2, 135) * fl.length) | 0]);
    else if (h < .2) world.set(x, t + 1, z, h < .14 ? B.f_tuft : B.f_tall);
  }
}

// ---------------------------------------------------------------- props
const loadImg = src => new Promise(r => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t; }
function swayMat(world, uni, params, key, amp = .06) {
  const m = litMaterial(world, params, uni);
  m.onBeforeCompile = ((ob) => (sh) => { ob(sh); sh.uniforms.uT = world.timeU; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>\n float sway = (1.0 - uv.y); transformed.z += sin(uT * 1.7 + position.x * 2.1) * ${amp.toFixed(3)} * sway + sin(uT * 2.9 + position.x * 4.0) * ${(amp / 3).toFixed(3)} * sway;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n vec2 fUv = vMapUv; if (!gl_FrontFacing) fUv.x = 1.0 - fUv.x; diffuseColor *= texture2D(map, fUv);\n#endif'); })(m.onBeforeCompile);
  m.customProgramCacheKey = () => key; return m;
}
function logoIsLight(img) { try { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 120) { s += (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255; n++; } return n ? s / n > .62 : false; } catch (e) { return false; } }
// pool banner: the real logo on white cloth with a Float-blue band, the name in Geist
// SVG logos without width/height draw as nothing on a canvas: give them a size from their viewBox first
export async function loadLogo(url, px = 512) {
  try {
    let t = await (await fetch(url)).text();
    const vb = t.match(/viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
    const ar = vb ? +vb[3] / +vb[4] : 1, w = ar >= 1 ? px : Math.round(px * ar), h = ar >= 1 ? Math.round(px / ar) : px;
    t = t.replace(/<svg([^>]*)>/, (m0, at) => '<svg' + at.replace(/\s(width|height)="[^"]*"/g, '') + ` width="${w}" height="${h}">`);
    return await loadImg(URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' })));
  } catch (e) { return loadImg(url); }
}
async function poolBanner(world, slug, uni, base = 'assets/mines/') {
  const img = await loadLogo(base + slug + '.svg'), light = img ? logoIsLight(img) : false;
  const map = canvasTex(640, 480, (g, w, h) => {
    g.fillStyle = light ? '#0b2350' : '#f7f9fc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d8bff'; g.fillRect(0, 0, w, 18); g.fillStyle = light ? '#3d8bff' : '#022866'; g.fillRect(0, h - 12, w, 12);
    if (img) { const box = 220, s = Math.min(box * 1.6 / img.width, box / img.height), iw = img.width * s, ih = img.height * s; g.imageSmoothingQuality = 'high'; g.drawImage(img, (w - iw) / 2, 58 + (box - ih) / 2, iw, ih); }
    g.fillStyle = light ? '#ffffff' : '#022866'; g.font = '700 48px Geist, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(POOL_NAMES[slug], w / 2, h - 56);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.55, 12, 8), swayMat(world, uni, { map, roughness: .85, side: THREE.DoubleSide }, 'fmbanner', .035)); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
async function floatFlagTex() {
  const img = await loadImg('data:image/svg+xml;utf8,' + encodeURIComponent(pickSVG('#ffffff', { pad: 0, tight: true, id: 'flg', attrs: 'width="512" height="512"' })));
  return canvasTex(512, 768, (g, w, h) => {
    g.fillStyle = '#3d8bff'; g.fillRect(0, 0, w, h);
    if (img) g.drawImage(img, w / 2 - 150, h * .42 - 150, 300, 300);
    g.fillStyle = '#ffffff'; g.font = '700 60px Geist, Arial'; g.textAlign = 'center'; g.fillText('FLOATMINE', w / 2, h - 96);
  });
}
export function crystalGeo(len, rad, tip) {
  const parts = [new THREE.CylinderGeometry(rad, rad * 1.04, len, 6, 1, true), new THREE.ConeGeometry(rad, tip, 6, 1, true).translate(0, len / 2 + tip / 2, 0), new THREE.ConeGeometry(rad * 1.04, tip * .6, 6, 1, true).rotateX(Math.PI).translate(0, -len / 2 - tip * .3, 0)];
  let n = 0; for (const g of parts) n += (g.index ? g.index.count : g.attributes.position.count); const pos = new Float32Array(n * 3); let o = 0; for (const g0 of parts) { const g = g0.index ? g0.toNonIndexed() : g0; pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.computeVertexNormals(); return out;
}
export function crystalMats() {
  return [new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#2f6fe0'), emissive: new THREE.Color('#2a63d6'), emissiveIntensity: .7, roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, flatShading: true, envMapIntensity: 1.2, iridescence: .3, iridescenceIOR: 1.5 }),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#bcd8ff'), emissive: new THREE.Color('#6aa4ff'), emissiveIntensity: .55, roughness: .06, clearcoat: 1, flatShading: true, envMapIntensity: 1.2 })];
}
function makeCrystals(x, y, z, sc = 1.3, seed = 99) {
  const grp = new THREE.Group(), [mA, mB] = crystalMats(), r = mulberry(seed);
  const spec = [[0, 0, 0, 7.6, 1, 2, 0, 0], [1.4, 0, .5, 4.8, .62, 1.2, .32, .4], [-1.3, 0, -.4, 5.4, .68, 1.3, -.28, 2.2], [.4, 0, -1.4, 4, .52, 1, .2, 4.1], [-.6, 0, 1.4, 3.6, .5, .9, -.22, 1.2], [1.9, 0, -1, 2.8, .42, .8, .45, 3.3], [-2, 0, 1.1, 2.6, .4, .7, -.5, 5.3]];
  for (const [cx, , cz, len, rad, tip, tilt, rot] of spec) { const m = new THREE.Mesh(crystalGeo(len, rad, tip), r() < .5 ? mA : mB); m.position.set(cx, len / 2 + .1, cz); m.rotation.set(tilt * .6, rot, tilt); m.castShadow = true; grp.add(m); }
  grp.position.set(x, y, z); grp.scale.setScalar(sc);
  const light = new THREE.PointLight(0x4a8cff, 26 * sc, 34 * sc, 1.7); light.position.set(x, y + 5 * sc, z);
  return { grp, light };
}
function makeCart(world, load, uni) {
  const g = new THREE.Group();
  const body = litMaterial(world, { color: new THREE.Color('#5d6878'), roughness: .42, metalness: .8 }, uni), rim = litMaterial(world, { color: new THREE.Color('#2b3240'), roughness: .5, metalness: .6 }, uni);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(.86, .08, 1.06), body, 0, .22, 0); add(new THREE.BoxGeometry(.08, .5, 1.06), body, -.39, .5, 0); add(new THREE.BoxGeometry(.08, .5, 1.06), body, .39, .5, 0);
  add(new THREE.BoxGeometry(.86, .5, .08), body, 0, .5, -.49); add(new THREE.BoxGeometry(.86, .5, .08), body, 0, .5, .49); add(new THREE.BoxGeometry(.94, .07, 1.14), rim, 0, .77, 0);
  for (const sx of [-.36, .36]) for (const sz of [-.32, .32]) { const w = add(new THREE.CylinderGeometry(.14, .14, .08, 12), rim, sx * 1.12, .14, sz); w.rotation.z = Math.PI / 2; }
  const lm = load === 'float' ? crystalMats()[1] : litMaterial(world, { color: new THREE.Color('#f2a43a'), emissive: new THREE.Color('#c46a0a'), emissiveIntensity: .3, roughness: .32, metalness: .85 }, uni);
  const rr = mulberry(load === 'float' ? 5 : 6);
  for (let i = 0; i < 7; i++) { const s = .2 + rr() * .14; const geo = load === 'float' ? crystalGeo(s * 1.8, s * .32, s * .5) : new THREE.BoxGeometry(s, s, s); const o = add(geo, lm, (rr() - .5) * .5, .74 + rr() * .12, (rr() - .5) * .66); o.rotation.set(rr() * 3, rr() * 3, rr() * 3); }
  return g;
}
// rails as meshes, so spokes can run at any angle
function railMesh(world, uni, a, b, y) {
  const g = new THREE.Group(), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const steel = litMaterial(world, { color: new THREE.Color('#9aa4b2'), roughness: .3, metalness: .9 }, uni), wood = litMaterial(world, { color: new THREE.Color('#7a5232'), roughness: .85 }, uni);
  for (const s of [-.36, .36]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, L), steel); r.position.set(s, .06, L / 2); r.receiveShadow = true; g.add(r); }
  const n = Math.floor(L / .62); const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, .05, .2), wood, n); const m = new THREE.Object3D();
  for (let i = 0; i < n; i++) { m.position.set(0, .025, (i + .5) * L / n); m.updateMatrix(); sl.setMatrixAt(i, m.matrix); } sl.receiveShadow = true; g.add(sl);
  g.position.set(a[0], y, a[1]); g.rotation.y = ang; return g;
}
function cloudSprite() {
  const t = canvasTex(256, 256, (g, w, h) => { const r = mulberry(5); for (let i = 0; i < 26; i++) { const x = w * (.22 + r() * .56), y = h * (.36 + r() * .3), rad = w * (.1 + r() * .16); const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); } });
  return t;
}
function cloudSprite2(seed) {
  return canvasTex(256, 128, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, ex = (u - .5) / .5, ey = (v - .62) / .38, r = Math.hypot(ex, ey * (ey < 0 ? 1.1 : 2.2)), n = fbm(x * .035, y * .035, seed, 4);
      const q = clamp((1 - r) * 1.6 + (n - .5) * 1.9, 0, 1), a = q * q * (3 - 2 * q), lit = clamp(1.15 - v * 1.5 + (n - .5) * .8, 0, 1), i = (y * w + x) * 4;
      im.data[i] = 70 + 185 * lit; im.data[i + 1] = 92 + 163 * lit; im.data[i + 2] = 150 + 105 * lit; im.data[i + 3] = a * 255;
    }
    g.putImageData(im, 0, 0);
  });
}
function cloudGroup(seed) {
  const grp = new THREE.Group(), r = mulberry(seed), mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#dfe8f8'), roughness: 1, emissive: new THREE.Color('#6f8fd0'), emissiveIntensity: .06, transparent: true, opacity: .62, depthWrite: false });
  const geos = [];
  const n = 6 + (r() * 8 | 0); for (let i = 0; i < n; i++) { const w = 4 + r() * 10, d = 3 + r() * 7, h = 1.2 + r() * 1.6; const g = new THREE.BoxGeometry(w, h, d); g.translate((r() - .5) * 16, r() * 1.2, (r() - .5) * 10); geos.push(g); }
  for (const g of geos) { const m = new THREE.Mesh(g, mat); m.receiveShadow = true; grp.add(m); }
  return grp;
}

// a small tileable value-noise texture (R and G: two fbm seeds), made once on the CPU, so the site's sky and cloud shaders
// read noise instead of computing it (D3D shader compiles of big noise loops froze the page for 20+ s); the film keeps the HQ path
let NOISE_TEX = null;
function noiseTex() {
  if (NOISE_TEX) return NOISE_TEX;
  const N = 256, data = new Uint8Array(N * N * 4), sm = t => t * t * (3 - 2 * t);
  const oct = [[8, .5], [16, .25], [32, .125], [64, .0625], [128, .03125]];
  const lat = s => oct.map(([P], k) => { const r = mulberry(s + k * 7), g = new Float32Array(P * P); for (let i = 0; i < P * P; i++) g[i] = r(); return g; });
  const A = lat(701), Bn = lat(751);
  const val = (g, P, x, y) => { const fx = x * P / N, fy = y * P / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy), x0 = ix % P, x1 = (ix + 1) % P, y0 = iy % P, y1 = (iy + 1) % P; const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1]; return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s1 = 0, s2 = 0, w = 0; oct.forEach(([P, a], k) => { s1 += a * val(A[k], P, x, y); s2 += a * val(Bn[k], P, x, y); w += a; }); const i = (y * N + x) * 4; data[i] = s1 / w * 255; data[i + 1] = s2 / w * 255; data[i + 3] = 255; }
  const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return (NOISE_TEX = t);
}

// ---------------------------------------------------------------- backdrop: Float navy, a soft Float-blue glow behind the subject, faint stars
const BACK_FRAG = `varying vec3 vD; uniform vec3 uGlow; uniform float uEnv; uniform float uNight;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
#ifdef HQ
float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn3(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
#endif
uniform sampler2D uNoise;
float stars3(vec3 d){ vec3 a = abs(d); vec2 uv = a.x > a.y && a.x > a.z ? d.zy / a.x : (a.y > a.z ? d.xz / a.y : d.xy / a.z); uv *= 420.0; vec2 id = floor(uv), f = fract(uv) - .5; float h = h21(id + 3.0 * sign(d.x + 2.0 * d.y + 3.0 * d.z) + 11.0); return step(.982, h) * smoothstep(.3, .0, length(f)) * (h - .982) * 55.0; }
float stars2(vec3 d){ vec3 a = abs(d); vec2 uv = a.x > a.y && a.x > a.z ? d.zy / a.x : (a.y > a.z ? d.xz / a.y : d.xy / a.z); uv *= 210.0; vec2 id = floor(uv), f = fract(uv) - .5; float h = h21(id + 7.0 * sign(d.x + 2.0 * d.y + 3.0 * d.z)); return step(.993, h) * smoothstep(.22, .0, length(f)) * (h - .993) * 140.0; }
float stars(vec3 d){ vec3 a = abs(d); vec2 uv = a.x > a.y && a.x > a.z ? d.zy / a.x : (a.y > a.z ? d.xz / a.y : d.xy / a.z); uv *= 90.0; vec2 id = floor(uv), f = fract(uv) - .5; float h = h21(id + sign(d.x + 2.0 * d.y + 3.0 * d.z)); return step(.985, h) * smoothstep(.12, .0, length(f)) * (h - .985) * 60.0; }
// night: deep navy dome, three layers of stars, a soft Milky Way, a moon, and a deck of moonlit clouds round the horizon
vec3 nightSky(vec3 d){
  float y = d.y;
  vec3 zen = vec3(0.0004, 0.0012, 0.0045), hor = vec3(0.0035, 0.0095, 0.03), bel = vec3(0.0012, 0.004, 0.014);
  vec3 c = y > 0.0 ? mix(hor, zen, pow(clamp(y, 0.0, 1.0), 0.45)) : mix(hor, bel, pow(clamp(-y, 0.0, 1.0), 0.6));
  vec3 N = normalize(vec3(0.42, 0.55, -0.72)); float bd = dot(d, N), band = exp(-bd * bd / 0.022);
#ifdef HQ
  float mot = fbm3(d * 6.0), dust = fbm3(d * 14.0 + 3.0);
#else
  vec2 su = vec2(atan(d.z, d.x) * 0.15915 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31831 + 0.5);
  float mot = textureLod(uNoise, su * vec2(3.0, 1.5), 0.0).r, dust = textureLod(uNoise, su * vec2(7.0, 3.5) + 0.37, 0.0).g;
#endif
  c += vec3(0.011, 0.014, 0.028) * band * (0.3 + 0.95 * mot) * (1.0 - 0.6 * smoothstep(0.45, 0.75, dust) * exp(-bd * bd / 0.004));
  float up = smoothstep(-0.12, 0.2, y), tint = h21(floor(d.xy * 97.0 + d.z * 41.0));
  vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.88, 0.72), step(0.86, tint));
  c += sc * (stars(d) * 0.4 + stars2(d) * 0.22 + stars3(d) * 0.06 * (1.0 + 2.5 * band)) * up;
  float hy = y + 0.05; vec2 cu = d.xz / (abs(hy) + 0.16) * 1.5; 
#ifdef HQ
  float cn = fbm3(vec3(cu, 1.7));
#else
  float cn = textureLod(uNoise, cu * 0.125 + 0.21, 0.0).r;
#endif
 
  float cm = smoothstep(0.42, 0.7, cn) * exp(-hy * hy / 0.06);
  vec3 cc = mix(vec3(0.006, 0.012, 0.03), vec3(0.05, 0.07, 0.13), smoothstep(0.5, 0.82, cn));
  c = mix(c, cc, cm * 0.95);
  float md = max(dot(d, normalize(vec3(-0.42, 0.82, 0.4))), 0.0);
  c += vec3(0.62, 0.72, 1.0) * (smoothstep(0.99955, 0.9997, md) * 5.0 + pow(md, 60.0) * 0.014 + pow(md, 8.0) * 0.004);
  return c;
}
void main(){ vec3 d = normalize(vD);
  vec3 base = vec3(0.0006, 0.0021, 0.0068) * mix(1.0, 0.75, uNight);
  float g = max(dot(d, normalize(uGlow)), 0.0);
  vec3 c = base + vec3(0.0022, 0.011, 0.046) * pow(g, 9.0) + vec3(0.0008, 0.0035, 0.012) * pow(g, 2.5);
  c += vec3(0.0008, 0.003, 0.012) * smoothstep(-0.2, -0.9, d.y);
  c += vec3(0.6, 0.75, 1.0) * stars(d) * mix(0.02, 0.05, uNight) * (1.0 - uEnv);
  if (uNight > 0.5 && uEnv < 0.5) c = nightSky(d) + base * 0.0 + vec3(0.0022, 0.011, 0.046) * pow(g, 9.0) * 0.5;
  // environment version: a warm key light and a cool sky so materials have something to reflect (night: a cool moon, a dark sky, the island's blue from below)
  vec3 day = vec3(1.0, 0.92, 0.8) * smoothstep(0.82, 0.98, dot(d, normalize(vec3(-0.55, 0.75, 0.38)))) * 2.4 + vec3(0.35, 0.55, 1.0) * smoothstep(-0.1, 1.0, d.y) * 0.35 + vec3(0.25, 0.45, 1.0) * smoothstep(0.7, 0.98, dot(d, normalize(vec3(0.4, 0.3, -0.85)))) * 0.9;
  vec3 night = vec3(0.62, 0.74, 1.0) * smoothstep(0.9, 0.995, dot(d, normalize(vec3(-0.42, 0.82, 0.4)))) * 1.6 + vec3(0.05, 0.09, 0.2) * smoothstep(-0.1, 1.0, d.y) + vec3(0.12, 0.3, 0.9) * smoothstep(0.75, 0.98, dot(d, normalize(vec3(0.4, 0.3, -0.85)))) * 0.35 + vec3(0.05, 0.14, 0.45) * smoothstep(0.0, -0.8, d.y) * 0.25;
  c += uEnv * mix(day, night, uNight);
  gl_FragColor = vec4(c, 1.0); }`;
function makeBackdrop(env = 0, night = false, hq = false) {
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, defines: hq ? { HQ: '' } : {}, uniforms: { uGlow: { value: new THREE.Vector3(0, .1, -1) }, uEnv: { value: env }, uNight: { value: night ? 1 : 0 }, uNoise: { value: noiseTex() } }, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }', fragmentShader: BACK_FRAG });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 64, 32), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}
// waterfall: a ribbon with a scrolling stream texture, foam at the lip
function waterfallMesh(fall) {
  const len = 58, w = 2.6, seg = 80, pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg, y = fall.y - t * len, out = 2.2 * Math.sqrt(t) * 3 + t * 2.5; for (let j = 0; j <= 4; j++) { const s = (j / 4 - .5) * w * (1 + t * 1.4); pos.push(fall.x + fall.dx * out - fall.dz * s, y, fall.z + fall.dz * out + fall.dx * s); uv.push(j / 4, t); } if (i < seg) for (let j = 0; j < 4; j++) { const k = i * 5 + j; idx.push(k, k + 1, k + 5, k + 1, k + 6, k + 5); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uB: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uB; float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float x = vUv.x, y = vUv.y; vec2 p = vec2(x * 9.0, y * 16.0 - uT * 3.2);
        float s = n(p) * .6 + n(p * 2.3 + 7.0) * .4; float foam = smoothstep(.55, .85, s) + smoothstep(.06, .0, y) * .8;
        float edge = smoothstep(0.0, .22, x) * smoothstep(1.0, .78, x); float fade = smoothstep(1.0, .35, y);
        vec3 c = mix(vec3(.26, .52, .96), vec3(.92, .96, 1.0), clamp(foam, 0.0, 1.0)); gl_FragColor = vec4(c * uB, (.62 + .3 * foam) * edge * fade); }` });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 3; return m;
}
function waterMesh(world) {
  const pos = [], idx = []; let v = 0;
  for (let z = 0; z < world.D; z++) for (let x = 0; x < world.W; x++) for (let y = world.H - 2; y > 0; y--) {
    if (world.get(x, y, z) !== B.water) continue; const up = world.get(x, y + 1, z); if (up !== 0 && !BLOCKS[up].cross) break;
    const yy = y + .86; pos.push(x, yy, z + 1, x + 1, yy, z + 1, x + 1, yy, z, x, yy, z); idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; break;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#2f7cf0'), emissive: new THREE.Color('#1a4fb8'), emissiveIntensity: .25, roughness: .04, transparent: true, opacity: .84, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: .03 });
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = 2; return m;
}

// ---------------------------------------------------------------- final grade
export const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTilt: { value: 0 }, uFocus: { value: .5 }, uBand: { value: .2 }, uTime: { value: 0 }, uVig: { value: .3 }, uGrain: { value: .022 }, uSat: { value: 1.1 }, uCon: { value: 1.03 }, uLift: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTilt, uFocus, uBand, uTime, uVig, uGrain, uSat, uCon, uLift; varying vec2 vUv;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){ vec2 uv = vUv; float blur = uTilt * smoothstep(uBand, uBand + 0.32, abs(uv.y - uFocus)); vec3 c = vec3(0.0);
    if (blur > 0.001) { for (int i = 0; i < 24; i++) { float a = float(i) * 2.39996; float r = sqrt(float(i) + 0.5) / sqrt(24.0); c += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * blur * 14.0 / uRes).rgb; } c /= 24.0; }
    else c = texture2D(tDiffuse, uv).rgb;
    float l0 = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l0), c, uSat); c = (c - 0.5) * uCon + 0.5 + uLift; c = max(c, 0.0);
    vec2 q = uv - 0.5; c *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
    c += (h21(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain; gl_FragColor = vec4(c, 1.0); }`,
};

// night sky filler: far-off islets made of voxel columns (moonlit tops, a few warm windows, blue crystals underneath), outside the world grid
function farIslets() {
  const r = mulberry(404), cols = [], tops = [], warm = [], blue = [];
  for (let k = 0; k < 38; k++) {
    const a = r() * TAU, d = 175 + Math.pow(r(), .8) * 430, s = d > 380 ? 2 : 1;
    const cx = C.CX + Math.cos(a) * d, cz = C.CZ + Math.sin(a) * d, cy = 22 + r() * 118, rad = (3 + r() * 7.5) / s, n = Math.ceil(rad + 1);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const aa = Math.atan2(j, i), rr = rad * (.78 + .4 * fbm(Math.cos(aa) * 1.4 + k * 3, Math.sin(aa) * 1.4 + k * 3, 405, 2)), dd = Math.hypot(i, j); if (dd > rr) continue;
      const f = dd / rr, depth = Math.max(1, Math.round((2 + rad * 1.6 * Math.pow(1 - f, 1.3)) * (.75 + .5 * hash2(i, j, 406 + k))));
      const x = cx + i * s, z = cz + j * s, top = cy + Math.round(fbm(i * .3, j * .3, 407 + k, 2) * 1.5) * s;
      cols.push([x, top - (depth + 1) * s / 2, z, s, depth * s]); tops.push([x, top, z, s]);
      const h = hash2(i, j, 408 + k);
      if (h < .03 && f < .8) warm.push([x, top + s * .8, z, s * .45]);
      if (f > .25 && f < .85 && h > .975) blue.push([x, top - (depth + .6) * s, z, s * .55]);
    }
  }
  const grp = new THREE.Group(), box = new THREE.BoxGeometry(1, 1, 1), m = new THREE.Object3D();
  const inst = (list, mat, tall) => { const im = new THREE.InstancedMesh(box, mat, list.length); list.forEach((c, i) => { m.position.set(c[0], c[1], c[2]); m.scale.set(c[3], tall ? c[4] : c[3], c[3]); m.updateMatrix(); im.setMatrixAt(i, m.matrix); }); im.frustumCulled = false; grp.add(im); return im; };
  inst(cols, new THREE.MeshStandardMaterial({ color: new THREE.Color('#252e45'), roughness: .95 }), true);
  inst(tops, new THREE.MeshStandardMaterial({ color: new THREE.Color('#244f3b'), roughness: .9 }), false);
  inst(warm, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(3.2) }), false);
  inst(blue, new THREE.MeshBasicMaterial({ color: new THREE.Color('#6aa4ff').multiplyScalar(3.2) }), false);
  return grp;
}

// ---------------------------------------------------------------- stage
export async function createIsland(canvas, o = {}) {
  const t0 = performance.now(), base = o.base || '';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.preserve, alpha: false });
  renderer.setPixelRatio(o.dpr || Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure ?? 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .5, 4000);

  const world = new VoxelWorld(C.W, C.H, C.D); world.timeU = { value: 0 };
  const info = generate(world); world.computeLight();
  const NIGHT = !!o.night;
  const tex = buildTextures(), mats = voxelMaterials(tex, world, Object.assign(NIGHT ? { env: .5, skyMin: .035, blockI: 2.4, emisI: 1.7 } : { env: .7, skyMin: .06, blockI: 1.5, emisI: 1.9 }, o.vox || {}));
  const uni = { blockI: mats.uniforms.blockI, skyMin: mats.uniforms.skyMin };
  const vox = new THREE.Group(); scene.add(vox); world.buildAll(vox, mats);
  const water = waterMesh(world); scene.add(water);
  const fall = waterfallMesh(info.river.fall); scene.add(fall); if (NIGHT) fall.material.uniforms.uB.value = .55;

  // light: a warm key from the upper left, a Float-blue rim from behind, the navy sky as a soft fill
  const mid = new THREE.Vector3(C.CX, 50, C.CZ), keyDir = (NIGHT ? new THREE.Vector3(-.42, .82, .4) : new THREE.Vector3(-.55, .75, .38)).normalize();
  const sun = new THREE.DirectionalLight(NIGHT ? 0xaec6ff : 0xfff4e6, o.sun ?? (NIGHT ? 1.6 : 4.2)); sun.position.copy(keyDir).multiplyScalar(300).add(mid); sun.target.position.copy(mid);
  sun.castShadow = true; const ss = o.shadowSize || 4096; sun.shadow.mapSize.set(ss, ss); const sc = sun.shadow.camera; sc.left = -125; sc.right = 125; sc.top = 125; sc.bottom = -125; sc.near = 80; sc.far = 640; sun.shadow.bias = -.00018; sun.shadow.normalBias = .05; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(NIGHT ? 0x5d8dff : 0x86b4ff, o.rim ?? (NIGHT ? 2.0 : 2.4)); rim.position.copy(new THREE.Vector3(.4, .3, -.86).multiplyScalar(260).add(mid)); rim.target.position.copy(mid); scene.add(rim, rim.target);
  const under = new THREE.DirectionalLight(NIGHT ? 0x2a55d0 : 0x4a7ae0, NIGHT ? 1.8 : 1.5); under.position.copy(new THREE.Vector3(.2, -1, .3).multiplyScalar(200).add(mid)); under.target.position.copy(mid); scene.add(under, under.target);
  const back = makeBackdrop(0, NIGHT, !!o.hq); scene.add(back);
  const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(makeBackdrop(1, NIGHT, !!o.hq)); scene.environment = pm.fromScene(envScene, 0, .1, 4000).texture; pm.dispose();
  scene.fog = new THREE.FogExp2(new THREE.Color(NIGHT ? '#050f27' : '#081633'), o.fog ?? (NIGHT ? .0015 : .0011));

  const props = new THREE.Group(); scene.add(props);
  if (NIGHT || o.far) scene.add(farIslets());
  // the Float core
  const core = makeCrystals(info.core.x, info.core.y, info.core.z, 1.25, 7); props.add(core.grp); scene.add(core.light);
  const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uT; uniform float uA; void main(){ float y = vUv.y; float fade = pow(clamp(1.0 - y, 0.0, 1.0), 2.2) * smoothstep(0.0, 0.04, y); float pulse = .82 + .18 * sin(y * 46.0 - uT * 5.0); float edge = pow(clamp(sin(vUv.x * 3.14159), 0.0, 1.0), 1.5); gl_FragColor = vec4(vec3(.32, .58, 1.0) * fade * pulse * edge * .42 * uA, 1.0); }' });
  const BH = o.beamH || 96;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.8, BH, 24, 1, true), beamMat); beam.position.set(info.core.x, info.core.y + BH / 2, info.core.z); beam.renderOrder = 4; props.add(beam);
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(.32, .55, BH, 16, 1, true), beamMat); beamCore.position.copy(beam.position); props.add(beamCore);

  // pool banners above every rig hall
  const banners = [];
  await Promise.all(info.galleries.map(async g => {
    const b = await poolBanner(world, g.pool, uni, base + 'assets/mines/'); const [dx, dz] = g.dir;
    const by = C.FLOOR + C.W0 + 2.3; let r0 = C.FR + 1;
    for (let d = C.FR + .5; d < C.FR + 6; d += .05) { let hit = false; for (const w of [-1.3, 0, 1.3]) { const x = Math.floor(C.CX + .5 + dx * d - dz * w), z = Math.floor(C.CZ + .5 + dz * d + dx * w); for (const yy of [by - 1, by, by + 1]) if (world.opaque(x, Math.floor(yy), z)) hit = true; } if (hit) { r0 = d - .12; break; } }
    b.position.set(C.CX + .5 + dx * r0, by, C.CZ + .5 + dz * r0); b.rotation.y = Math.atan2(-dx, -dz); props.add(b); banners.push({ mesh: b, g });
  }));
  // Float flag on the plaza
  const flagMap = await floatFlagTex();
  const flag = new THREE.Group(); { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 10, 12), litMaterial(world, { color: new THREE.Color('#eef2f8'), roughness: .3, metalness: .6 }, uni)); pole.position.y = 5; pole.castShadow = true; const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6, 8, 12), swayMat(world, uni, { map: flagMap, roughness: .9, side: THREE.DoubleSide }, 'fmflag', .09)); cloth.position.set(1.25, 7.9, 0); cloth.castShadow = true; flag.add(pole, cloth); flag.position.set(info.plaza.x, info.plaza.y, info.plaza.z); flag.rotation.y = -info.plaza.a; props.add(flag); }
  // rails + carts on six spokes: haul from the halls to the core
  const spokes = [0, 2, 4, 6, 8, 10].map(k => info.galleries[k]); const carts = [];
  for (const g of spokes) {
    const [dx, dz] = g.dir, a = [C.CX + .5 + dx * 6.2, C.CZ + .5 + dz * 6.2], b2 = [C.CX + .5 + dx * (C.FR + 11), C.CZ + .5 + dz * (C.FR + 11)];
    props.add(railMesh(world, uni, a, b2, C.FLOOR + 1));
    const c = makeCart(world, NIGHT ? 'float' : 'ore', uni); props.add(c); carts.push({ obj: c, g, off: g.k * .37 });
  }
  // people
  const figs = [];
  const add = (look, seed, x, z, kind, extra = {}) => { const f = makeFigure(world, look, { seed, uni, lights: !!extra.lamp && o.lamps !== false }); /* the site turns the headlamp spot lights off (shader size); the film keeps them */ f.position.set(x, extra.y ?? (world.top(Math.floor(x), Math.floor(z)) + 1), z); f.rotation.y = extra.ry || 0; props.add(f); const rec = Object.assign({ f, kind, seed }, extra); figs.push(rec); return rec; };
  const crew = ['fmMinerA', 'fmMinerB', 'fmMinerC'];
  info.galleries.forEach((g, i) => {
    const [dx, dz] = g.dir, x = C.CX + .5 + dx * (C.FR + g.len - .6), z = C.CZ + .5 + dz * (C.FR + g.len - .6);
    const lead = g.pool === 'foundryusa', m = add(lead ? 'fmMinerA' : crew[i % 3], 10 + i, x, z, 'mine', { y: C.FLOOR + 1, ry: Math.atan2(dx, dz), lamp: lead || i % 2 === 0 }); holdTool(m.f, makePickaxe(world, uni, lead || i % 2 === 0 ? '#3d8bff' : '#e9eef7'));
    if (i % 3 === 1) { const d2 = add(crew[(i + 1) % 3], 40 + i, x - dx * 3 + g.p[0] * 1.1, z - dz * 3 + g.p[1] * 1.1, 'drill', { y: C.FLOOR + 1, ry: Math.atan2(g.p[0], g.p[1]), lamp: true }); holdTool(d2.f, makeDrill(world, uni)); }
  });
  carts.forEach((c, i) => add(crew[(i + 2) % 3], 60 + i, 0, 0, 'pushcart', { cart: c, y: C.FLOOR + 1 }));
  // terrace walkers circle the pit
  for (let i = 0; i < 6; i++) { const ring = 1 + (i % 5), rr = C.FR + (ring - 1) * C.SI + 1, y = C.FLOOR + C.W0 + (ring - 1) * C.SH + 1; add(crew[i % 3], 80 + i, 0, 0, 'ringwalk', { y, rr, th0: i * 1.1, sp: (.12 + i * .015) * (i % 2 ? 1 : -1) }); }
  // holders: by their houses, on the plaza, on the rim road
  const hl = ['fmHolderA', 'fmHolderB', 'fmHolderC', 'fmHolderD', 'fmHolderE'];
  info.houses.forEach((h, i) => { const look = hl[i % hl.length]; const fx2 = h.door.x + (h.door.x - (h.x0 + h.x1) / 2 > 0 ? 1.1 : -1.1) * (Math.abs(h.door.x - (h.x0 + h.x1) / 2) > .6 ? 1 : 0), fz2 = h.door.z + (h.door.z - (h.z0 + h.z1) / 2 > 0 ? 1.1 : -1.1) * (Math.abs(h.door.z - (h.z0 + h.z1) / 2) > .6 ? 1 : 0); add(look, 100 + i, fx2 + .6, fz2 - .4, i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'wave' : 'look', { y: h.base + 1, ry: Math.atan2(C.CX - h.chest.x, C.CZ - h.chest.z), up: .55 }); });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? 4.2 : 3.2, x = info.plaza.x + Math.cos(a) * rr, z = info.plaza.z + Math.sin(a) * rr; add(hl[i % hl.length], 130 + i, x, z, i % 4 === 1 ? 'wave' : 'cheer', { ry: Math.atan2(info.plaza.x - x, info.plaza.z - z) }); }
  for (let i = 0; i < 6; i++) add(hl[(i + 2) % hl.length], 150 + i, 0, 0, 'ringwalk', { y: C.G + 1, rr: C.PIT + 1.6, th0: i * 1.05 + .4, sp: (.05 + i * .006) * (i % 2 ? 1 : -1) });

  // chests at every house + gems that arc from the core into them
  const chestMat = litMaterial(world, { color: new THREE.Color('#a8703a'), roughness: .7 }, uni), chestBand = litMaterial(world, { color: new THREE.Color('#3d8bff'), roughness: .35, metalness: .4, emissive: new THREE.Color('#3d8bff'), emissiveIntensity: .25 }, uni);
  for (const ch of info.chests) { const g = new THREE.Group(); const b0 = new THREE.Mesh(new THREE.BoxGeometry(.9, .7, .7), chestMat); b0.position.y = .35; const lid = new THREE.Mesh(new THREE.BoxGeometry(.94, .18, .74), chestBand); lid.position.y = .76; g.add(b0, lid); g.position.set(ch.x, ch.y, ch.z); g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); props.add(g); }
  const gemGeo = new THREE.OctahedronGeometry(.42, 0), gemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6aa4ff'), emissive: new THREE.Color('#3d8bff'), emissiveIntensity: 2.2, roughness: .15, metalness: .1 });
  const NG = 48, gems = new THREE.InstancedMesh(gemGeo, gemMat, NG); gems.frustumCulled = false; props.add(gems); const dummy = new THREE.Object3D();
  // rising motes around the core and over the island
  const NM = NIGHT ? 420 : 220, motes = new THREE.InstancedMesh(new THREE.BoxGeometry(NIGHT ? .1 : .16, NIGHT ? .1 : .16, NIGHT ? .1 : .16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9cc4ff'), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }), NM); motes.frustumCulled = false; props.add(motes);
  const moteSeed = []; { const r = mulberry(7); for (let i = 0; i < NM; i++) moteSeed.push([r() * TAU, r() * C.R * .9, r(), .5 + r()]); }
  // night: warm fireflies drifting over the village
  const NFF = NIGHT ? 180 : 0, flies = NFF ? new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .12, .12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc874'), transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }), NFF) : null;
  if (flies) { flies.frustumCulled = false; props.add(flies); }
  const flySeed = []; { const r = mulberry(19); for (let i = 0; i < NFF; i++) { const a = r() * TAU, d = C.PIT + 5 + r() * (C.R - C.PIT - 9), x = C.CX + Math.cos(a) * d, z = C.CZ + Math.sin(a) * d; flySeed.push([x, z, Math.max(C.G, world.top(Math.floor(x), Math.floor(z))) + 1.5 + r() * 3.5, r() * TAU, .4 + r() * .6]); } }
  // clouds
  // night: a sea of clouds under the island, moonlit tops, the island's blue light pooled under it
  const seaMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, defines: o.hq ? { HQ: '' } : {}, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector2(C.CX, C.CZ) }, uNoise: { value: noiseTex() } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uT; uniform vec2 uC; uniform sampler2D uNoise;
#ifdef HQ
      float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * nn(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
#else
      float fb(vec2 p){ return texture2D(uNoise, p * 0.125).r * 0.82 + texture2D(uNoise, p * 0.5 + 0.3).g * 0.18; }
#endif
      void main(){
        vec2 p = vW.xz * 0.011 + vec2(uT * 0.004, uT * 0.0025);
        float d = fb(p), d2 = fb(p + vec2(-0.05, 0.048));
        float a = smoothstep(0.36, 0.7, d), lit = clamp((d - d2) * 7.0 + 0.5, 0.0, 1.0);
        vec3 col = mix(vec3(0.012, 0.02, 0.05), vec3(0.16, 0.21, 0.36), lit) * (0.55 + 0.9 * smoothstep(0.45, 0.82, d));
        float r = length(vW.xz - uC); col += vec3(0.03, 0.08, 0.26) * exp(-r * r / 7000.0) * a;
        float dist = length(vW - cameraPosition);
        gl_FragColor = vec4(col, a * smoothstep(1500.0, 500.0, dist)); }` });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3400, 3400), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(C.CX, 4, C.CZ); sea.renderOrder = -3; sea.visible = NIGHT; scene.add(sea);
  const clouds = []; {
    const r = mulberry(17), maps = NIGHT ? [cloudSprite2(611), cloudSprite2(612), cloudSprite2(613)] : [cloudSprite()];
    const addCloud = (a, d, y, sc, col, op, spd) => { const m = new THREE.SpriteMaterial({ map: maps[clouds.length % maps.length], color: new THREE.Color(col), transparent: true, opacity: op, depthWrite: false, fog: true }); const sp = new THREE.Sprite(m); sp.scale.set(sc * (NIGHT ? 2.2 : 1.8), sc, 1); sp.position.set(C.CX + Math.cos(a) * d, y, C.CZ + Math.sin(a) * d); sp.userData = { a, d, y, sp: spd }; sp.renderOrder = -2; scene.add(sp); clouds.push(sp); };
    for (let i = 0; i < 46; i++) { const op = (NIGHT ? .3 : .16) + r() * .16, a = r() * TAU, d = 40 + r() * 230, y = NIGHT ? 8 + r() * 24 : -40 + r() * 34, sc = 60 + r() * 90; addCloud(a, d, y, sc, NIGHT ? (i % 3 ? '#7f95c6' : '#9db0da') : (i % 3 ? '#9fb6e4' : '#c9d7f2'), op, .0015 + r() * .003); }
    if (NIGHT) for (let i = 0; i < 30; i++) { const a = r() * TAU, d = 170 + r() * 260, y = 36 + r() * 100, sc = 120 + r() * 200; addCloud(a, d, y, sc, i % 2 ? '#6a80b4' : '#8396c4', .2 + r() * .18, .001 + r() * .002); }
  }

  function update(t) {
    world.timeU.value = t; fall.material.uniforms.uT.value = t; beamMat.uniforms.uT.value = t;
    core.grp.rotation.y = t * .12; core.light.intensity = (NIGHT ? 44 : 32) + Math.sin(t * 2.1) * 3;
    for (const c of carts) { const [dx, dz] = c.g.dir, L = C.FR + 10.5 - 6.4, u = ((t * .9 + c.off * L) % (2 * L) + 2 * L) % (2 * L), s = u < L ? 6.4 + L - u : 6.4 + (u - L); c.obj.position.set(C.CX + .5 + dx * s, C.FLOOR + 1, C.CZ + .5 + dz * s); c.obj.rotation.y = Math.atan2(dx, dz); c.s = s; c.dirOut = u >= L; }
    for (const r of figs) {
      const f = r.f;
      if (r.kind === 'pushcart') { const c = r.cart, [dx, dz] = c.g.dir, s = c.s + (c.dirOut ? -1.25 : 1.25); f.position.set(C.CX + .5 + dx * s, C.FLOOR + 1, C.CZ + .5 + dz * s); f.rotation.y = Math.atan2(dx, dz) + (c.dirOut ? 0 : Math.PI); pose(f, 'push', t, { speed: .9 }); }
      else if (r.kind === 'ringwalk') { const th = r.th0 + t * r.sp; f.position.set(C.CX + .5 + Math.cos(th) * r.rr, r.y, C.CZ + .5 + Math.sin(th) * r.rr); f.rotation.y = Math.atan2(-Math.sin(th), Math.cos(th)) + (r.sp > 0 ? 0 : Math.PI); pose(f, 'walk', t, { speed: Math.abs(r.sp) * 6 }); }
      else if (r.kind === 'look') pose(f, 'look', t, { up: r.up ?? .45 });
      else pose(f, r.kind, t);
    }
    // gems: each chest receives one every few seconds
    const N = Math.min(NG, info.chests.length * 2);
    for (let i = 0; i < NG; i++) {
      if (i >= N) { dummy.scale.setScalar(0); dummy.updateMatrix(); gems.setMatrixAt(i, dummy.matrix); continue; }
      const ch = info.chests[i % info.chests.length], per = 4.2, u = ((t + i * .73) % per) / per;
      const sx = info.core.x, sy = info.core.y + 9, sz = info.core.z, ex = ch.x, ey = ch.y + 1.1, ez = ch.z;
      const k = Math.min(1, u / .8), hh = 16 + (i % 5) * 2;
      dummy.position.set(sx + (ex - sx) * k, sy + (ey - sy) * k + hh * 4 * k * (1 - k), sz + (ez - sz) * k);
      dummy.rotation.set(t * 2 + i, t * 3 + i, 0); dummy.scale.setScalar(u < .8 ? .9 : Math.max(0, 1 - (u - .8) / .2) * .9); dummy.updateMatrix(); gems.setMatrixAt(i, dummy.matrix);
    }
    gems.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NM; i++) { const [a, d, ph, sp] = moteSeed[i], u = (t * .05 * sp + ph) % 1; const nearCore = i < (NIGHT ? 90 : 70); const rr = nearCore ? 2 + d * .08 : d, y = nearCore ? info.core.y + u * 40 : C.G + 2 + u * 26; dummy.position.set(C.CX + Math.cos(a + t * .05) * rr, y, C.CZ + Math.sin(a + t * .05) * rr); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(Math.sin(u * Math.PI) * (nearCore ? 1 : .7)); dummy.updateMatrix(); motes.setMatrixAt(i, dummy.matrix); }
    motes.instanceMatrix.needsUpdate = true;
    if (flies) { for (let i = 0; i < NFF; i++) { const [x, z, y, ph, sp] = flySeed[i]; dummy.position.set(x + Math.sin(t * .31 * sp + ph) * 1.6, y + Math.sin(t * .47 * sp + ph * 1.7) * .6, z + Math.cos(t * .27 * sp + ph * 2.3) * 1.6); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.6 + .4 * Math.sin(t * 1.3 * sp + ph * 3)); dummy.updateMatrix(); flies.setMatrixAt(i, dummy.matrix); } flies.instanceMatrix.needsUpdate = true; }
    seaMat.uniforms.uT.value = t;
    for (const cg of clouds) { const u = cg.userData, a = u.a + t * u.sp; cg.position.x = C.CX + Math.cos(a) * u.d; cg.position.z = C.CZ + Math.sin(a) * u.d; }
  }

  // ---------------------------------------------------------------- post + views
  renderer.shadowMap.autoUpdate = false;
  function makeComposer(cam, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: o.samples ?? 4 });
    const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, cam));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), o.bloom ?? .42, .5, o.bloomT ?? 1.25); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const fin = new ShaderPass(FinalShader); fin.uniforms.uRes.value.set(w, h); composer.addPass(fin);
    return { composer, bloom, fin, dispose() { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); bloom.dispose && bloom.dispose(); } };
  }
  const shots = makeShots(info);
  let main = null, cur = shots.hero; const size = new THREE.Vector2();
  const look = (fin, s) => { fin.uniforms.uTilt.value = s.tilt ?? 0; fin.uniforms.uFocus.value = s.focus ?? .5; fin.uniforms.uBand.value = s.band ?? .2; };
  function resize(w, h) { renderer.setSize(w, h, false); renderer.getDrawingBufferSize(size); camera.aspect = w / h; camera.updateProjectionMatrix(); if (main) main.dispose(); main = makeComposer(camera, size.x, size.y); look(main.fin, cur); }
  const tmp = new THREE.Vector3();
  function setCam(p, tg, fov = 30) { camera.position.copy(p); camera.lookAt(tg); camera.fov = fov; camera.updateProjectionMatrix(); back.material.uniforms.uGlow.value.copy(tmp.copy(tg).sub(p).normalize()).add(new THREE.Vector3(0, .12, 0)); }
  function setShot(name, k = 0) { const s = shots[name] || shots.hero; cur = s; setCam(s.p.clone().lerp(s.p2 || s.p, k), s.t.clone().lerp(s.t2 || s.t, k), s.fov || 30); if (main) look(main.fin, s); }
  let frameN = 0;
  // compile every program off the main thread (KHR_parallel_shader_compile via compileAsync) before the first frame,
  // for the variants the composer really uses (scene into a half-float target, then the post passes)
  async function precompile() {
    if (!renderer.compileAsync) return;
    if (!main) { const c = renderer.domElement; resize(c.clientWidth || 1280, c.clientHeight || 720); }
    const prev = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(main.composer.renderTarget1);
      await renderer.compileAsync(scene, camera);
      const q = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), geo = new THREE.PlaneGeometry(2, 2), seen = new Set();
      for (const p of main.composer.passes) for (const k of Object.keys(p)) { const v = p[k]; for (const m of (Array.isArray(v) ? v : [v])) if (m && m.isMaterial && !seen.has(m)) { seen.add(m); q.add(new THREE.Mesh(geo, m)); } }
      renderer.setRenderTarget(main.composer.renderTarget2);
      await renderer.compileAsync(q, qc);
    } catch (e) { console.warn('precompile', e); }
    renderer.setRenderTarget(prev);
  }
  function render() { if ((frameN++ % (o.shadowEvery || 1)) === 0) renderer.shadowMap.needsUpdate = true; if (!main) { const c = renderer.domElement; resize(c.clientWidth || 1280, c.clientHeight || 720); } main.fin.uniforms.uTime.value = world.timeU.value; main.composer.render(); }
  update(0); setShot('hero');
  const ms = performance.now() - t0;
  return { renderer, scene, camera, world, info, shots, update, render, precompile, resize, setShot, setCam, mats, sun, rim, beam, beamMat, core, props, figs, banners, back, carts, vox, water, get fin() { return main && main.fin; }, get bloom() { return main && main.bloom; }, ms };
}

function makeShots(info) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), c = V(C.CX, 52, C.CZ);
  const g0 = info.galleries[1], [dx, dz] = g0.dir;
  const pl = info.plaza, fall = info.river.fall;
  // rigs: look across the pit floor at the halls opposite the camera; holders: the house nearest the hero camera side
  const rgA = 2.35, rg = [Math.cos(rgA), Math.sin(rgA)];
  const hsel = info.houses.filter(h => h.chest).map(h => ({ h, k: (h.chest.x - C.CX) * -0.6 + (h.chest.z - C.CZ) * 0.8 })).sort((a, b) => b.k - a.k)[1] || { h: info.houses[0] };
  const hs = { x: hsel.h.chest.x, y: hsel.h.chest.y, z: hsel.h.chest.z }, hl = Math.hypot(hs.x - C.CX, hs.z - C.CZ) || 1, hd = [(hs.x - C.CX) / hl, (hs.z - C.CZ) / hl];
  return {
    hero: { p: V(C.CX - 112, 156, C.CZ + 152), t: V(C.CX + 3, 50, C.CZ), fov: 30 },
    wide: { p: V(C.CX - 190, 150, C.CZ + 250), t: V(C.CX + 6, 40, C.CZ), fov: 30 },
    top: { p: V(C.CX - 40, 260, C.CZ + 90), t: V(C.CX, 50, C.CZ), fov: 30 },
    pit: { p: V(C.CX - 14, 104, C.CZ + 30), t: V(C.CX + 2, C.FLOOR + 3, C.CZ - 4), fov: 36, tilt: .4, focus: .55, band: .2 },
    site: { p: V(C.CX - 112, 176, C.CZ + 150), t: V(C.CX + 4, 82, C.CZ - 4), fov: 30 },
    hall: { p: V(C.CX + dx * 5 - g0.p[0] * 3, C.FLOOR + 3.4, C.CZ + dz * 5 - g0.p[1] * 3), t: V(C.CX + dx * (C.FR + 3), C.FLOOR + 3.6, C.CZ + dz * (C.FR + 3)), fov: 40 },
    core: { p: V(C.CX + 12, C.FLOOR + 8, C.CZ + 13), t: V(C.CX, C.FLOOR + 6, C.CZ), fov: 38 },
    village: { p: V(pl.x - Math.cos(pl.a) * -26 + 18, pl.y + 16, pl.z - Math.sin(pl.a) * -26 + 14), t: V(pl.x, pl.y + 2, pl.z), fov: 34, tilt: .5, focus: .5, band: .18 },
    fall: { p: V(fall.x + fall.dx * 40 - fall.dz * 30, fall.y - 10, fall.z + fall.dz * 40 + fall.dx * 30), t: V(fall.x, fall.y - 18, fall.z), fov: 34 },
    under: { p: V(C.CX - 110, 6, C.CZ + 130), t: V(C.CX, 46, C.CZ), fov: 32 },
    // the home page story: hero, launch (plaza + flag), rigs (pool halls), core (FLOAT crystal), holders (village)
    sHero: { p: V(C.CX - 124, 190, C.CZ + 166), t: V(C.CX + 4, 116, C.CZ - 4), fov: 30 },
    sLaunch: { p: V(pl.x + 30, pl.y + 26, pl.z + 34), t: V(pl.x - 2, pl.y + 4, pl.z - 2), fov: 32 },
    sRigs: { p: V(C.CX + rg[0] * 2 - rg[1] * 6, C.FLOOR + 13, C.CZ + rg[1] * 2 + rg[0] * 6), t: V(C.CX + rg[0] * (C.FR + 1), C.FLOOR + 5.5, C.CZ + rg[1] * (C.FR + 1)), fov: 46 },
    sCore: { p: V(C.CX + 15, C.FLOOR + 13, C.CZ + 19), t: V(C.CX, C.FLOOR + 8, C.CZ), fov: 40 },
    sHolders: { p: V(hs.x + hd[0] * 34 - hd[1] * 14, hs.y + 30, hs.z + hd[1] * 34 + hd[0] * 14), t: V(hs.x - hd[0] * 9, hs.y + 3, hs.z - hd[1] * 9), fov: 38 },
  };
}
