// HyperHash figures: blocky people with hand-painted pixel skins, real hard hats, working headlamps and tools.
// Each figure is one skinned atlas (64x64) on six boxes, lit by the world's light field like every other prop.
import * as THREE from 'three';
import { litMaterial, pixelTex, mulberry, clamp } from './mine3d.js';

const U = 1 / 16 * 0.9; // one skin pixel in world units (figure stands 1.8 blocks)
const hexA = h => h;

// classic box unwrap: top/bottom row (d x w), then right, front, left, back (h tall)
function rects(u0, v0, w, h, d) { return { px: [u0, v0 + d, d, h], nx: [u0 + d + w, v0 + d, d, h], py: [u0 + d, v0, w, d], ny: [u0 + d + w, v0, w, d], pz: [u0 + d, v0 + d, w, h], nz: [u0 + 2 * d + w, v0 + d, w, h] }; }
function boxUV(geo, R, S) {
  const uv = geo.attributes.uv, order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  for (let f = 0; f < 6; f++) { const [x, y, w, h] = R[order[f]]; for (let k = 0; k < 4; k++) { const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (x + u * w) / S, 1 - (y + (1 - v) * h) / S); } }
  uv.needsUpdate = true; return geo;
}
// paint helpers on the 64px atlas
function fillR(g, r, col) { g.fillStyle = col; g.fillRect(r[0], r[1], r[2], r[3]); }
function noiseR(g, r, cols, seed, dens = 1) { const rnd = mulberry(seed); for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) { g.fillStyle = cols[(rnd() * cols.length * dens | 0) % cols.length]; g.fillRect(r[0] + x, r[1] + y, 1, 1); } }
function px(g, x, y, col, w = 1, h = 1) { g.fillStyle = col; g.fillRect(x, y, w, h); }

const PARTS = { head: [8, 8, 8, 0, 0], body: [8, 12, 4, 16, 16], armR: [4, 12, 4, 40, 16], armL: [4, 12, 4, 32, 48], legR: [4, 12, 4, 0, 16], legL: [4, 12, 4, 16, 48] };

// Skin recipes. Colours are picked so the figures read at a distance: helmets, vests and hoodies carry the brand mint and Bitcoin orange.
export const LOOKS = {
  minerA: { skin: ['#e0ac84', '#d49d75', '#c98f68'], hair: '#5a3a22', beard: '#5a3a22', eyes: '#2a4f8f', shirt: ['#3a3f46', '#343940'], vest: ['#f28a1a', '#e57c10'], stripe: '#e9eef2', pants: ['#2f4a6b', '#2a4361'], boots: ['#3b2a1d', '#2f2117'], gloves: '#c9a227', hat: '#f2f4f1', lamp: true },
  minerB: { skin: ['#7a4a2e', '#6e4229', '#633b24'], hair: '#1f1612', beard: null, eyes: '#2b1a10', shirt: ['#5a5f66', '#51565c'], vest: ['#4fd3b8', '#3fc3a8'], stripe: '#f4f6f2', pants: ['#55595e', '#4b4f54'], boots: ['#2a2420', '#211c19'], gloves: '#5a5f66', hat: '#ffcc33', lamp: true },
  minerC: { skin: ['#f0c3a0', '#e6b694', '#dba987'], hair: '#b8b3ab', beard: null, mustache: '#9b958c', eyes: '#3a5a3a', shirt: ['#c94a3a', '#b84132'], vest: null, overalls: ['#2d5f9a', '#28568c'], pants: ['#2d5f9a', '#28568c'], boots: ['#3b2a1d', '#2f2117'], gloves: '#8a6a3a', hat: '#f28a1a', lamp: true },
  holderD: { skin: ['#e8b896', '#ddab88', '#d29e7c'], hair: '#2a1d16', beard: null, eyes: '#4a3020', hoodie: ['#2bb59a', '#26a68c'], hoodMark: '#06302a', pants: ['#1f2328', '#1a1d21'], boots: ['#eef1ee', '#d9ddd9'], cap: '#06302a', capMark: '#97fce4' },
  holderE: { skin: ['#f1c9a8', '#e8bc9a', '#ddae8c'], hair: '#7a3d1d', long: true, beard: null, eyes: '#2c6e5a', jacket: ['#f3f4f0', '#e5e7e2'], scarf: '#f28a1a', pants: ['#25344d', '#202d43'], boots: ['#3b2a1d', '#2f2117'] },
  fmMinerA: { skin: ['#e0ac84', '#d49d75', '#c98f68'], hair: '#5a3a22', beard: '#5a3a22', eyes: '#2a4f8f', shirt: ['#2a3550', '#25304a'], vest: ['#3d8bff', '#2f7cf0'], stripe: '#ffffff', pants: ['#22314f', '#1e2b46'], boots: ['#3b2a1d', '#2f2117'], gloves: '#f2c53d', hat: '#f4f6fa', lamp: true },
  fmMinerB: { skin: ['#7a4a2e', '#6e4229', '#633b24'], hair: '#1f1612', beard: null, eyes: '#2b1a10', shirt: ['#f2f4f7', '#e4e7ec'], vest: ['#f2a03a', '#e8902a'], stripe: '#ffffff', pants: ['#2b3d63', '#263757'], boots: ['#2a2420', '#211c19'], gloves: '#2b3d63', hat: '#3d8bff', lamp: true },
  fmMinerC: { skin: ['#f0c3a0', '#e6b694', '#dba987'], hair: '#b8b3ab', beard: null, mustache: '#9b958c', eyes: '#3a5a3a', shirt: ['#e4473d', '#d33f35'], vest: null, overalls: ['#2f6fe0', '#2a63cc'], pants: ['#2f6fe0', '#2a63cc'], boots: ['#3b2a1d', '#2f2117'], gloves: '#8a6a3a', hat: '#ffd23a', lamp: true },
  fmHolderA: { skin: ['#e8b896', '#ddab88', '#d29e7c'], hair: '#2a1d16', beard: null, eyes: '#4a3020', hoodie: ['#3d8bff', '#3480f2'], fmark: '#ffffff', pants: ['#1d2740', '#1a2238'], boots: ['#f4f6fa', '#dfe4ec'], cap: '#022866', capMark: '#ffffff' },
  fmHolderB: { skin: ['#f1c9a8', '#e8bc9a', '#ddae8c'], hair: '#c7772d', long: true, beard: null, eyes: '#2c5a8e', hoodie: ['#f4f6fa', '#e7ebf2'], fmark: '#3d8bff', pants: ['#25344d', '#202d43'], boots: ['#3b2a1d', '#2f2117'] },
  fmHolderC: { skin: ['#9a6644', '#8f5d3e', '#845538'], hair: '#141010', beard: '#141010', eyes: '#1a1210', hoodie: ['#022866', '#03215a'], fmark: '#ffffff', pants: ['#3c3f44', '#35383d'], boots: ['#f4f6fa', '#dfe4ec'], shades: true },
  fmHolderD: { skin: ['#f3d2b4', '#ead0ae', '#dfc0a0'], hair: '#e8d08a', long: true, beard: null, eyes: '#3a6a9a', jacket: ['#ff9fc6', '#f58fb9'], scarf: '#ffffff', pants: ['#2f6fe0', '#2a63cc'], boots: ['#f4f6fa', '#dfe4ec'] },
  fmHolderE: { skin: ['#c98e66', '#bd825b', '#b07752'], hair: '#3a2416', beard: null, eyes: '#2a1a10', hoodie: ['#2fb8a8', '#28a99a'], fmark: '#ffffff', pants: ['#1d2740', '#1a2238'], boots: ['#3b2a1d', '#2f2117'], cap: '#ffd23a', capMark: '#022866' },
  holderF: { skin: ['#9a6644', '#8f5d3e', '#845538'], hair: '#141010', beard: '#141010', eyes: '#1a1210', tee: ['#141618', '#101214'], teeMark: '#f7931a', jacketOpen: ['#6b7177', '#61666c'], pants: ['#3c3f44', '#35383d'], boots: ['#eef1ee', '#d9ddd9'], shades: true },
};

function paintSkin(g, L, seed) {
  const R = {}; for (const k in PARTS) { const [w, h, d, u0, v0] = PARTS[k]; R[k] = rects(u0, v0, w, h, d); }
  const sk = L.skin;
  // head
  for (const f of ['px', 'nx', 'pz', 'nz', 'py', 'ny']) noiseR(g, R.head[f], sk, seed + 1);
  const hf = R.head.pz, [fx, fy] = hf;
  fillR(g, R.head.py, L.hair); fillR(g, R.head.nz, L.hair); fillR(g, [R.head.px[0], R.head.px[1], 8, 3], L.hair); fillR(g, [R.head.nx[0], R.head.nx[1], 8, 3], L.hair);
  fillR(g, [R.head.px[0] + 5, R.head.px[1], 3, 5], L.hair); fillR(g, [R.head.nx[0], R.head.nx[1], 3, 5], L.hair);
  px(g, fx, fy, L.hair, 8, 2); px(g, fx, fy + 2, L.hair, 1, 1); px(g, fx + 7, fy + 2, L.hair, 1, 1);
  if (L.long) { fillR(g, R.head.nz, L.hair); px(g, fx, fy + 2, L.hair, 1, 5); px(g, fx + 7, fy + 2, L.hair, 1, 5); fillR(g, [R.head.px[0], R.head.px[1], 8, 7], L.hair); fillR(g, [R.head.nx[0], R.head.nx[1], 8, 7], L.hair); }
  // face: brows, eyes with a catch light, nose shade, mouth
  px(g, fx + 1, fy + 3, L.hair, 2, 1); px(g, fx + 5, fy + 3, L.hair, 2, 1);
  px(g, fx + 1, fy + 4, '#f6f7f5', 1, 1); px(g, fx + 2, fy + 4, L.eyes, 1, 1); px(g, fx + 5, fy + 4, L.eyes, 1, 1); px(g, fx + 6, fy + 4, '#f6f7f5', 1, 1);
  px(g, fx + 3, fy + 5, sk[2], 2, 1);
  if (L.beard) { px(g, fx, fy + 5, L.beard, 1, 3); px(g, fx + 7, fy + 5, L.beard, 1, 3); px(g, fx + 1, fy + 6, L.beard, 6, 2); px(g, fx + 3, fy + 6, '#7a3e30', 2, 1); }
  else if (L.mustache) { px(g, fx + 2, fy + 6, L.mustache, 4, 1); px(g, fx + 3, fy + 7, '#8a4a3a', 2, 1); }
  else { px(g, fx + 3, fy + 6, '#9a4e45', 2, 1); }
  if (L.shades) { px(g, fx + 1, fy + 4, '#0d0f12', 6, 1); px(g, fx + 1, fy + 3, '#0d0f12', 2, 1); px(g, fx + 5, fy + 3, '#0d0f12', 2, 1); px(g, fx + 2, fy + 3, '#5a6a7a', 1, 1); }
  // torso
  const shirt = L.hoodie || L.jacket || L.tee || L.shirt;
  for (const f of ['px', 'nx', 'pz', 'nz', 'py', 'ny']) noiseR(g, R.body[f], shirt, seed + 2);
  for (const a of ['armR', 'armL']) { for (const f of ['px', 'nx', 'pz', 'nz', 'py']) noiseR(g, R[a][f], L.jacketOpen || shirt, seed + 3); fillR(g, R[a].ny, sk[1]); for (const f of ['px', 'nx', 'pz', 'nz']) { const r = R[a][f]; noiseR(g, [r[0], r[1] + 9, r[2], 3], L.gloves ? [L.gloves] : sk, seed + 4); } }
  const bf = R.body.pz;
  if (L.vest) { for (const f of ['pz', 'nz', 'px', 'nx']) { const r = R.body[f]; noiseR(g, [r[0], r[1], r[2], 10], L.vest, seed + 5); px(g, r[0], r[1] + 6, L.stripe, r[2], 1); px(g, r[0], r[1] + 8, L.stripe, r[2], 1); } px(g, bf[0] + 3, bf[1], L.shirt[0], 2, 4); px(g, bf[0] + 2, bf[1] + 2, '#1c1f22', 1, 1); }
  if (L.overalls) { for (const f of ['pz', 'nz']) { const r = R.body[f]; noiseR(g, [r[0] + 1, r[1] + 4, r[2] - 2, 8], L.overalls, seed + 6); px(g, r[0] + 1, r[1], L.overalls[0], 1, 4); px(g, r[0] + 6, r[1], L.overalls[0], 1, 4); } px(g, bf[0] + 1, bf[1] + 3, '#d8c27a', 1, 1); px(g, bf[0] + 6, bf[1] + 3, '#d8c27a', 1, 1); }
  if (L.hoodie && L.fmark) { const m = L.fmark; px(g, bf[0] + 2, bf[1] + 3, m, 4, 1); px(g, bf[0] + 1, bf[1] + 4, m, 2, 1); px(g, bf[0] + 5, bf[1] + 4, m, 2, 1); px(g, bf[0] + 2, bf[1] + 5, m, 4, 1); px(g, bf[0] + 1, bf[1] + 6, m, 2, 1); px(g, bf[0] + 5, bf[1] + 6, m, 2, 1); px(g, bf[0] + 2, bf[1] + 7, m, 4, 1); px(g, bf[0], bf[1] + 11, L.hoodie[1], 8, 1); }
  else if (L.hoodie) { px(g, bf[0] + 2, bf[1] + 4, L.hoodMark, 4, 1); px(g, bf[0] + 2, bf[1] + 6, L.hoodMark, 4, 1); px(g, bf[0] + 3, bf[1] + 3, L.hoodMark, 1, 5); px(g, bf[0] + 5, bf[1] + 3, L.hoodMark, 1, 5); px(g, bf[0] + 4, bf[1] + 5, '#97fce4', 1, 1); px(g, bf[0] + 3, bf[1] + 9, '#1e8f78', 2, 2); px(g, bf[0], bf[1] + 11, '#1e8f78', 8, 1); }
  if (L.jacket) { px(g, bf[0] + 3, bf[1], '#d6d8d3', 2, 12); px(g, bf[0] + 2, bf[1], L.scarf, 4, 2); px(g, bf[0] + 2, bf[1] + 2, L.scarf, 1, 4); px(g, bf[0] + 1, bf[1] + 7, '#c9ccc6', 2, 1); px(g, bf[0] + 5, bf[1] + 7, '#c9ccc6', 2, 1); }
  if (L.tee) { px(g, bf[0], bf[1], L.jacketOpen[0], 2, 12); px(g, bf[0] + 6, bf[1], L.jacketOpen[0], 2, 12); px(g, bf[0] + 3, bf[1] + 3, L.teeMark, 2, 4); px(g, bf[0] + 2, bf[1] + 4, L.teeMark, 4, 1); px(g, bf[0] + 2, bf[1] + 6, L.teeMark, 4, 1); }
  // legs
  for (const a of ['legR', 'legL']) { for (const f of ['px', 'nx', 'pz', 'nz', 'py']) noiseR(g, R[a][f], L.pants, seed + 7); for (const f of ['px', 'nx', 'pz', 'nz']) { const r = R[a][f]; noiseR(g, [r[0], r[1] + 9, r[2], 3], L.boots, seed + 8); } fillR(g, R[a].ny, L.boots[1]); }
}

export function makeFigure(world, look, opts = {}) {
  const L = typeof look === 'string' ? LOOKS[look] : look, seed = opts.seed || 7;
  const skin = pixelTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); paintSkin(g, L, seed); }, { strength: 2.2, bevel: .5, lumH: .25 });
  const mat = litMaterial(world, { map: skin.map, normalMap: skin.normalMap, roughness: .78, metalness: 0 }, opts.uni);
  const root = new THREE.Group(), parts = {};
  const mk = (name, pivot, off) => { const [w, h, d, u0, v0] = PARTS[name]; const geo = boxUV(new THREE.BoxGeometry(w * U, h * U, d * U), rects(u0, v0, w, h, d), 64); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; const p = new THREE.Group(); p.position.set(pivot[0] * U, pivot[1] * U, pivot[2] * U); m.position.set(off[0] * U, off[1] * U, off[2] * U); p.add(m); parts[name] = p; return p; };
  const hips = new THREE.Group(); hips.position.y = 12 * U; root.add(hips);
  hips.add(mk('legR', [-2, 0, 0], [0, -6, 0])); hips.add(mk('legL', [2, 0, 0], [0, -6, 0]));
  const torso = new THREE.Group(); hips.add(torso); torso.add(mk('body', [0, 6, 0], [0, 0, 0]));
  torso.add(mk('armR', [-6, 10, 0], [0, -4, 0])); torso.add(mk('armL', [6, 10, 0], [0, -4, 0]));
  const head = mk('head', [0, 12, 0], [0, 4, 0]); torso.add(head);
  parts.torso = torso; parts.hips = hips;
  // gear
  const hat = L.hat || L.cap;
  if (L.hat) {
    const hm = litMaterial(world, { color: new THREE.Color(L.hat), roughness: .32, metalness: 0 }, opts.uni);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(9 * U, 3 * U, 9 * U), hm); shell.position.set(0, 9 * U, 0); shell.castShadow = true;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(10 * U, 1 * U, 11 * U), hm); brim.position.set(0, 7.6 * U, .6 * U); brim.castShadow = true;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(2 * U, 1 * U, 9.4 * U), hm); ridge.position.set(0, 10.7 * U, 0);
    parts.head.children[0].add(shell, brim, ridge);
    shell.position.y = 5 * U; brim.position.y = 3.6 * U; ridge.position.y = 6.7 * U;
    if (L.lamp) {
      const lm = new THREE.Mesh(new THREE.BoxGeometry(2.4 * U, 1.8 * U, 1 * U), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color('#fff1c9'), emissiveIntensity: 6, roughness: .3 }));
      lm.position.set(0, 4.9 * U, 4.9 * U); parts.head.children[0].add(lm); parts.lampMesh = lm;
      if (opts.lights) { const sp = new THREE.SpotLight(0xfff0cf, opts.lampI ?? 9, 14, .42, .55, 1.6); sp.position.set(0, 4.9 * U, 5.2 * U); const tg = new THREE.Object3D(); tg.position.set(0, 1.5 * U, 30 * U); parts.head.children[0].add(sp, tg); sp.target = tg; parts.lamp = sp; }
    }
  }
  if (L.cap) {
    const cm = litMaterial(world, { color: new THREE.Color(L.cap), roughness: .7 }, opts.uni);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(8.6 * U, 2.6 * U, 8.6 * U), cm); crown.position.set(0, 4.6 * U, 0); crown.castShadow = true;
    const bill = new THREE.Mesh(new THREE.BoxGeometry(8 * U, .9 * U, 4 * U), cm); bill.position.set(0, 3.4 * U, 5.6 * U); bill.castShadow = true;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(2 * U, 1.2 * U, .4 * U), litMaterial(world, { color: new THREE.Color(L.capMark), emissive: new THREE.Color(L.capMark), emissiveIntensity: .4, roughness: .5 }, opts.uni)); dot.position.set(0, 4.6 * U, 4.4 * U);
    parts.head.children[0].add(crown, bill, dot);
  }
  if (L.long) { const hm = litMaterial(world, { color: new THREE.Color(L.hair), roughness: .8 }, opts.uni); const tail = new THREE.Mesh(new THREE.BoxGeometry(3 * U, 7 * U, 2.4 * U), hm); tail.position.set(0, 0, -5 * U); tail.castShadow = true; parts.head.children[0].add(tail); parts.tail = tail; }
  root.userData = { parts, look: L, mat, phase: (seed * 1.37) % 6.28, tool: null };
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

// A cordless rotary drill: the realistic tool of the HyperHash crews (no pickaxes here).
export function makeDrill(world, uni) {
  const g = new THREE.Group(), U2 = U;
  const body = litMaterial(world, { color: new THREE.Color('#13a88c'), roughness: .38, metalness: .1 }, uni);
  const dark = litMaterial(world, { color: new THREE.Color('#1b1e22'), roughness: .55 }, uni);
  const steel = litMaterial(world, { color: new THREE.Color('#c6ccd2'), roughness: .22, metalness: 1 }, uni);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(3 * U2, 3.4 * U2, 9 * U2), body); b1.position.set(0, 0, 3 * U2);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(2.4 * U2, 6 * U2, 2.6 * U2), dark); grip.position.set(0, -3.6 * U2, 0);
  const batt = new THREE.Mesh(new THREE.BoxGeometry(3.6 * U2, 2 * U2, 4.4 * U2), body); batt.position.set(0, -7.2 * U2, .6 * U2);
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * U2, 1.3 * U2, 2.2 * U2, 10), dark); chuck.rotation.x = Math.PI / 2; chuck.position.set(0, 0, 8.6 * U2);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(.35 * U2, .45 * U2, 7 * U2, 8), steel); bit.rotation.x = Math.PI / 2; bit.position.set(0, 0, 13 * U2);
  g.add(b1, grip, batt, chuck, bit); g.userData.bit = bit; g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makePickaxe(world, uni, head = '#3d8bff') {
  const g = new THREE.Group(), U2 = U;
  const wood = litMaterial(world, { color: new THREE.Color('#9a6a3e'), roughness: .7 }, uni);
  const metal = litMaterial(world, { color: new THREE.Color(head), roughness: .28, metalness: .35, emissive: new THREE.Color(head), emissiveIntensity: .12 }, uni);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.4 * U2, 1.4 * U2, 15 * U2), wood); handle.position.set(0, 0, 5 * U2);
  g.add(handle);
  // head: five stepped blocks that arc like the pixel pickaxe, centred on the handle tip
  for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2 * U2, 2.4 * U2, 2.2 * U2), metal); b.position.set(0, i * 2.1 * U2, 12.2 * U2 - Math.abs(i) * Math.abs(i) * .55 * U2); g.add(b); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// poses: walk, idle, drill, push, cheer, carry, wave, look. t in seconds, k = 0..1 blend weight not needed (direct pose).
export function pose(fig, kind, t, o = {}) {
  const P = fig.userData.parts, ph = fig.userData.phase + t * (o.speed || 1);
  const reset = () => { for (const k of ['legR', 'legL', 'armR', 'armL', 'head', 'torso']) { P[k].rotation.set(0, 0, 0); } P.hips.position.y = 12 * U; P.hips.rotation.set(0, 0, 0); };
  reset();
  const s = Math.sin(ph * 6.2), c = Math.cos(ph * 6.2);
  if (kind === 'walk' || kind === 'push' || kind === 'carry') {
    const amp = o.amp ?? .62;
    P.legR.rotation.x = s * amp; P.legL.rotation.x = -s * amp;
    P.hips.position.y = 12 * U + Math.abs(c) * .7 * U;
    if (kind === 'walk') { P.armR.rotation.x = -s * amp * .8; P.armL.rotation.x = s * amp * .8; P.head.rotation.y = Math.sin(ph * 1.3) * .12; }
    else { P.armR.rotation.x = -1.35 + s * .05; P.armL.rotation.x = -1.35 - s * .05; P.torso.rotation.x = kind === 'push' ? .18 : .05; }
  } else if (kind === 'drill') {
    const j = Math.sin(t * 90) * .018;
    P.armR.rotation.x = -1.42 + j; P.armL.rotation.x = -1.3 - j; P.armR.rotation.z = .05; P.armL.rotation.z = -.32;
    P.torso.rotation.x = .12; P.head.rotation.x = .18 + j * .5; P.legR.rotation.x = .25; P.legL.rotation.x = -.15; P.hips.position.y = 11.6 * U;
  } else if (kind === 'mine') {
    // pickaxe swing: wind up over the shoulder, strike down, short recoil (period ~1.1 s)
    const u = ((ph * .9) % 1 + 1) % 1, up = u < .55 ? Math.sin(u / .55 * Math.PI * .5) : u < .68 ? 1 - (u - .55) / .13 * 1.25 : -.25 + (u - .68) / .32 * .25;
    P.armR.rotation.x = -.35 - up * 2.35; P.armL.rotation.x = -.25 - up * 2.1; P.armR.rotation.z = .08; P.armL.rotation.z = -.22;
    P.torso.rotation.x = .1 + (1 - up) * .22; P.head.rotation.x = .25; P.legR.rotation.x = .22; P.legL.rotation.x = -.2; P.hips.position.y = 11.7 * U;
  } else if (kind === 'cheer') {
    const b = Math.abs(Math.sin(ph * 3.4)); P.hips.position.y = 12 * U + b * 3.5 * U;
    P.armR.rotation.x = Math.PI - .25 + Math.sin(ph * 6.8) * .25; P.armL.rotation.x = Math.PI - .25 - Math.sin(ph * 6.8 + 1) * .25; P.armR.rotation.z = .35; P.armL.rotation.z = -.35;
    P.head.rotation.x = -.18; P.legR.rotation.x = -b * .2; P.legL.rotation.x = b * .1;
  } else if (kind === 'wave') {
    P.armR.rotation.x = Math.PI - .4; P.armR.rotation.z = .3 + Math.sin(ph * 5) * .35; P.head.rotation.y = .15; P.hips.position.y = 12 * U + Math.sin(ph * 2) * .2 * U;
  } else if (kind === 'look') {
    P.head.rotation.x = -(o.up ?? .45); P.head.rotation.y = o.turn ?? 0; P.armR.rotation.x = Math.sin(ph) * .04; P.armL.rotation.x = -Math.sin(ph) * .04;
  } else { // idle: breathing + small head turns
    P.torso.rotation.x = Math.sin(ph * 1.6) * .02; P.head.rotation.y = Math.sin(ph * .7) * .25; P.head.rotation.x = Math.sin(ph * .5) * .05; P.armR.rotation.z = .05; P.armL.rotation.z = -.05;
  }
}
export function holdTool(fig, tool) { const arm = fig.userData.parts.armR.children[0]; tool.position.set(0, -6 * U, 2.6 * U); tool.rotation.set(Math.PI / 2, 0, 0); arm.add(tool); fig.userData.tool = tool; }
