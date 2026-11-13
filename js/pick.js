// Floatmine pickaxe mark: an arched pick head floating above its handle (a Float gap between them),
// the head cut by Float wave gaps into bands. pickSVG(color, opts) -> <svg> string on a 1000x1000 canvas.
const th = Math.tanh;
const F = n => n.toFixed(1);
const P = pts => pts.map((p, i) => (i ? 'L' : 'M') + F(p[0]) + ' ' + F(p[1])).join('');

export const PICK = { rot: 45, cuts: 1, R: 1100, cy: 1540, span: .78, wmax: 206, wtip: 12, pw: .55, off: .58, hw: 126, hy1: 1040, lift: 4, gap: 32, amp: 68, wid: .105 };

function headPts(o) {
  // arc centred below the head; t from tip to tip
  const N = 160, out = [], inn = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = -Math.PI / 2 + (t - .5) * o.span, w = o.wtip + (o.wmax - o.wtip) * Math.pow(Math.sin(Math.PI * t), o.pw);
    const cx = 500 + Math.cos(a) * o.R, cyy = o.cy + Math.sin(a) * o.R, nx = Math.cos(a), ny = Math.sin(a);
    out.push([cx + nx * w * o.off, cyy + ny * w * o.off]); inn.push([cx - nx * w * (1 - o.off), cyy - ny * w * (1 - o.off)]); mid.push({ x: cx, y: cyy, nx, ny, t, w });
  }
  return { out, inn, mid };
}
function roundedPoly(pts, r) {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]], l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2))));
    if (ang > 2.6 || l1 < 1 || l2 < 1) { d += (i ? 'L' : 'M') + F(p1[0]) + ' ' + F(p1[1]); continue; }
    const rr = Math.min(r, l1 / 2.1, l2 / 2.1), a = [p1[0] + v1[0] / l1 * rr, p1[1] + v1[1] / l1 * rr], b = [p1[0] + v2[0] / l2 * rr, p1[1] + v2[1] / l2 * rr];
    d += (i ? 'L' : 'M') + F(a[0]) + ' ' + F(a[1]) + 'Q' + F(p1[0]) + ' ' + F(p1[1]) + ' ' + F(b[0]) + ' ' + F(b[1]);
  }
  return d + 'Z';
}
export function pickParts(opt = {}) {
  const o = Object.assign({}, PICK, opt), h = headPts(o);
  // the tips: blunt-pointed, slightly rounded
  const poly = h.out.concat(h.inn.slice().reverse());
  const head = roundedPoly(poly, 14);
  // wave cuts along the head (Float bands): offsets across the head width, S-shaped along its length
  const cuts = [];
  const fr = o.cuts === 1 ? [.5] : o.cuts === 2 ? [.36, .64] : [];
  for (const f of fr) {
    const pts = [];
    for (const m of h.mid) { const s = (f - (1 - o.off)) * m.w + o.amp * th((m.t - .5) / o.wid) * Math.pow(Math.sin(Math.PI * m.t), .6); pts.push([m.x + m.nx * s, m.y + m.ny * s]); }
    cuts.push(P(pts));
  }
  // handle below the head with a Float gap (the head floats)
  const innMid = h.inn[Math.floor(h.inn.length / 2)][1];
  const hy0 = innMid + o.gap + o.lift, hw = o.hw;
  const handle = `M${F(500 - hw / 2)} ${F(hy0 + hw / 2)}A${F(hw / 2)} ${F(hw / 2)} 0 0 1 ${F(500 + hw / 2)} ${F(hy0 + hw / 2)}L${F(500 + hw / 2)} ${F(o.hy1 - hw / 2)}A${F(hw / 2)} ${F(hw / 2)} 0 0 1 ${F(500 - hw / 2)} ${F(o.hy1 - hw / 2)}Z`;
  // bounding box of the rotated mark (head outline + handle corners), for centring
  const pts = poly.concat([[500 - hw / 2, hy0], [500 + hw / 2, hy0], [500 - hw / 2, o.hy1], [500 + hw / 2, o.hy1]]);
  const r = o.rot * Math.PI / 180, cx0 = 500, cy0 = 640, rx = q => [cx0 + (q[0] - cx0) * Math.cos(r) - (q[1] - cy0) * Math.sin(r), cy0 + (q[0] - cx0) * Math.sin(r) + (q[1] - cy0) * Math.cos(r)];
  const R2 = pts.map(rx), bb = [Math.min(...R2.map(q => q[0])), Math.min(...R2.map(q => q[1])), Math.max(...R2.map(q => q[0])), Math.max(...R2.map(q => q[1]))];
  return { head, cuts, handle, gap: o.gap, rot: o.rot, o, bb };
}
let uid = 0;
export function pickSVG(col = '#fff', opt = {}) {
  const p = pickParts(opt.p || {}), id = opt.id || ('fpk' + (++uid)), pad = opt.pad ?? 30;
  const bw = p.bb[2] - p.bb[0], bh = p.bb[3] - p.bb[1], side = Math.max(bw, bh);
  const box = opt.box || (opt.tight ? [p.bb[0] - pad, p.bb[1] - pad, bw + 2 * pad, bh + 2 * pad] : [(p.bb[0] + p.bb[2]) / 2 - side / 2 - pad, (p.bb[1] + p.bb[3]) / 2 - side / 2 - pad, side + 2 * pad, side + 2 * pad]);
  const mk = p.cuts.length ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="-500" y="-500" width="2000" height="2000"><rect x="-500" y="-500" width="2000" height="2000" fill="#fff"/>${p.cuts.map(c => `<path d="${c}" stroke="#000" stroke-width="${p.gap}" fill="none"/>`).join('')}</mask>` : '';
  const inner = `<g transform="rotate(${p.rot} 500 640)"><path d="${p.head}" fill="${col}"${mk ? ` mask="url(#${id})"` : ''}/><path d="${p.handle}" fill="${col}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.map(F).join(' ')}"${opt.attrs ? ' ' + opt.attrs : ''}>${mk ? `<defs>${mk}</defs>` : ''}${inner}</svg>`;
}
