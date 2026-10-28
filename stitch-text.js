// Embroidered cloth patches for the notebook, with fabric-ribbon highlights.
// Every .patch gets one canvas behind it. On it we paint a piece of linen with frayed edges, then sew onto it,
// stitch by stitch: a scalloped border, a frame of French knots, a bow and vines, little sparkles, and the text.
// Each stitch is a straight run of thread between two needle holes: fat in the middle, tapering where it dives
// into the cloth, with the linen dimpled around each hole. Lengths and angles vary a little, like hand sewing.
// The page text stays where the browser lays it out (transparent, so it can still be selected and read by
// screen readers); each word is re-sewn inside its own box with a single-line font (one pen path per letter).

const FONT_URL = 'fonts/EMSReadability.svg';   // other single-line fonts in fonts/: EMSElfin, EMSFelix, EMSAllure

// Everything about how the stitching looks.
export const LOOK = {
  // lettering (sizes are fractions of the text's font size)
  letterSize: 1.25,      // letter size
  flat: 0.7,           // letter height, as a share of its normal height
  stitch: 0.155,         // length of one stitch
  gap: 0.055,            // gap between stitches
  thread: 0.06,         // thread thickness
  wordSpacing: 0.4,     // extra space between words (em)
  // every stitch
  jitter: 0.38,          // how much stitch and gap lengths vary
  wobble: 0.55,         // how far stitch ends stray sideways (in thread widths)
  taper: 0.56,           // how thin a stitch gets where it enters the cloth (0 = blunt, 1 = pointed)
  pull: 0.54,           // how strongly the stitch pulls the linen in: needle holes and dimples
  sheen: 0.46,           // how light the sheen along the top of each stitch is
  shadow: 0.24,         // how dark the shadow under each stitch is
  // decorations (pixels)
  decoThread: 1.45,      // thread thickness of border, bow, vines
  decoStitch: 3.9,      // stitch length
  decoGap: 1.6,         // gap between stitches
  scallop: 18,          // width of each scallop in the border
  knotSize: 1.8,        // French knot radius
  knotStep: 31,         // spacing of the knot frame
  // cloth
  fringeLength: 14,     // longest loose fibre
  fringeDensity: 0.6,   // fibres per pixel of edge
  clothShadow: 0.05,    // shadow under each piece
  // thread colours: text
  titleColor: '#799800', headingColor: '#9AA60E', questionColor: '#2F5E33',
  answerColor1: '#4F8A3C', answerColor2: '#6E9A3E', answerColor3: '#3E7A3A',
  conceptColor: '#6E9A3E', labelColor: '#8DB255',
  // thread colours: decorations
  borderColor: '#A9C25A', knotColor: '#8DB255', bowColor: '#6E9A3E', vineColor: '#8DB255',
  leafColor: '#3E7A3A', budColor: '#D6D36A', flowerColor: '#A9C25A', sparkleColor: '#6E9A3E',
  // cloth colours
  linenColor: '#F6F3EA', fringeColor: '#E4DECC',
};

const PAD = 22;   // room around each patch for the fringe and shadow

// ---------- font ----------
async function loadFont(url) {
  const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml');
  const face = doc.querySelector('font-face'), font = doc.querySelector('font');
  const upm = +face.getAttribute('units-per-em') || 1000, defAdv = +font.getAttribute('horiz-adv-x') || 500;
  const glyphs = new Map();
  for (const g of doc.querySelectorAll('glyph')) {
    const u = g.getAttribute('unicode');
    if (!u) continue;
    const strokes = [], tok = (g.getAttribute('d') || '').trim().split(/[\s,]+/);
    let cur = null;
    for (let i = 0; i < tok.length;) {
      if (tok[i] === 'M') { cur = [[+tok[i + 1], +tok[i + 2]]]; strokes.push(cur); i += 3; }
      else if (tok[i] === 'L') { cur.push([+tok[i + 1], +tok[i + 2]]); i += 3; }
      else i++;
    }
    glyphs.set(u, { adv: +g.getAttribute('horiz-adv-x') || defAdv, strokes });
  }
  return { upm, defAdv, glyphs };
}

// ---------- helpers ----------
const measure = document.createElement('canvas').getContext('2d');
const lighten = (col, k) => {
  measure.fillStyle = col;
  const n = parseInt(measure.fillStyle.slice(1), 16), m = (x) => Math.round(Math.min(255, Math.max(0, x + (255 - x) * k)));
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
};
// the same patch always gets the same fringe, stitches and decorations, however often it is redrawn
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// sampled curves, so every decoration is a plain list of points to sew along
const quad = (a, b, c, n = 8) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; });
const cubic = (a, b, c, d, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
});
const join = (...parts) => parts.reduce((all, p) => all.concat(all.length ? p.slice(1) : p), []);

// ---------- one stitch ----------
// a lens of thread from a to b: half-width h in the middle, thinner at the ends where it goes into the cloth
function lens(c, ax, ay, bx, by, h) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const e = h * (1 - LOOK.taper), k = 2 * h - e, mx = (ax + bx) / 2, my = (ay + by) / 2;
  c.beginPath();
  c.moveTo(ax + nx * e, ay + ny * e);
  c.quadraticCurveTo(mx + nx * k, my + ny * k, bx + nx * e, by + ny * e);
  c.lineTo(bx - nx * e, by - ny * e);
  c.quadraticCurveTo(mx - nx * k, my - ny * k, ax - nx * e, ay - ny * e);
  c.closePath();
}
function stitch(c, ax, ay, bx, by, col, w, rnd) {
  const sway = LOOK.wobble * w;
  ax += (rnd() - 0.5) * sway; ay += (rnd() - 0.5) * sway; bx += (rnd() - 0.5) * sway; by += (rnd() - 0.5) * sway;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const pull = LOOK.pull;
  // the linen pulled down around the thread, and the needle holes at both ends
  if (pull > 0) {
    c.strokeStyle = `rgba(95,85,55,${0.13 * pull})`; c.lineWidth = w * 2.3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.fillStyle = `rgba(70,60,38,${0.55 * pull})`;
    for (const [hx, hy] of [[ax - ux * w * 0.15, ay - uy * w * 0.15], [bx + ux * w * 0.15, by + uy * w * 0.15]]) {
      c.beginPath(); c.arc(hx, hy, w * 0.34, 0, 7); c.fill();
    }
  }
  // shadow, thread, and a sheen on its raised middle
  c.save(); c.translate(w * 0.3, w * 0.45); lens(c, ax, ay, bx, by, w * 0.5); c.fillStyle = `rgba(40,60,30,${LOOK.shadow})`; c.fill(); c.restore();
  lens(c, ax, ay, bx, by, w * 0.5); c.fillStyle = col; c.fill();
  const s0 = 0.22, s1 = 0.78;
  c.save(); c.translate(-w * 0.12, -w * 0.15);
  lens(c, ax + dx * s0, ay + dy * s0, ax + dx * s1, ay + dy * s1, w * 0.17);
  c.fillStyle = lighten(col, LOOK.sheen); c.fill(); c.restore();
}
// sew a running stitch along a list of points: straight stitches between needle holes, never quite even
function sewLine(c, pts, col, w, len, gap, rnd) {
  if (pts.length < 2) return;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  if (total < 0.3) return;
  let seg = 1;
  const at = (d) => {
    while (seg < cum.length - 1 && cum[seg] < d) seg++;
    while (seg > 1 && cum[seg - 1] > d) seg--;
    const t = (d - cum[seg - 1]) / ((cum[seg] - cum[seg - 1]) || 1), p = pts[seg - 1], q = pts[seg];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  if (total < len * 1.3) { const [ax, ay] = at(0), [bx, by] = at(total); stitch(c, ax, ay, bx, by, col, w, rnd); return; }
  const J = LOOK.jitter;
  let d = rnd() * gap * 0.5;
  while (d < total) {
    const e = Math.min(total, d + len * (1 + (rnd() - 0.5) * 2 * J));
    if (e - d > w * 0.8) { const [ax, ay] = at(d), [bx, by] = at(e); stitch(c, ax, ay, bx, by, col, w, rnd); }
    d = e + gap * (1 + (rnd() - 0.5) * 2 * J);
  }
}
function knot(c, x, y, r, col) {
  c.fillStyle = `rgba(70,60,38,${0.3 * LOOK.pull})`; c.beginPath(); c.arc(x + r * 0.15, y + r * 0.2, r * 1.25, 0, 7); c.fill();
  c.fillStyle = `rgba(40,60,30,${LOOK.shadow})`; c.beginPath(); c.arc(x + r * 0.3, y + r * 0.4, r, 0, 7); c.fill();
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(col, LOOK.sheen + 0.15)); g.addColorStop(0.6, col); g.addColorStop(1, lighten(col, -0.18));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  // the wraps of thread around the knot
  c.strokeStyle = lighten(col, -0.22); c.lineWidth = r * 0.16;
  for (const a of [0.6, 2.4, 4.3]) { c.beginPath(); c.arc(x, y, r * 0.62, a, a + 1.1); c.stroke(); }
}

// ---------- the linen ----------
function paintCloth(c, w, h, rnd) {
  const edge = [];
  const side = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 0; i < n; i++) { const t = i / n; edge.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * 1.6, y0 + (y1 - y0) * t + (rnd() - 0.5) * 1.6]); }
  };
  const L = PAD, T = PAD, R = PAD + w, B = PAD + h;
  side(L, T, R, T); side(R, T, R, B); side(R, B, L, B); side(L, B, L, T);
  const body = () => { c.beginPath(); edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  c.save();
  c.shadowColor = `rgba(60,80,40,${LOOK.clothShadow})`; c.shadowBlur = 16; c.shadowOffsetY = 5;
  body(); c.fillStyle = LOOK.linenColor; c.fill();
  c.restore();
  // the weave: fine warp and weft threads of slightly different tone, with the odd thicker slub
  c.save(); body(); c.clip();
  for (let y = T; y < B; y += 1.6) { c.fillStyle = rnd() < 0.5 ? `rgba(140,120,95,${0.03 + rnd() * 0.06})` : `rgba(255,255,255,${0.15 + rnd() * 0.25})`; c.fillRect(L, y, w, 0.8); }
  for (let x = L; x < R; x += 1.6) { c.fillStyle = rnd() < 0.5 ? `rgba(140,120,95,${0.02 + rnd() * 0.05})` : `rgba(255,255,255,${0.1 + rnd() * 0.2})`; c.fillRect(x, T, 0.8, h); }
  for (let k = 0; k < w * h / 900; k++) {
    const x = L + rnd() * w, y = T + rnd() * h, len = 6 + rnd() * 22;
    c.fillStyle = `rgba(150,128,100,${0.05 + rnd() * 0.07})`;
    if (rnd() < 0.5) c.fillRect(x, y, len, 0.9); else c.fillRect(x, y, 0.9, len);
  }
  c.restore();
  // frayed edges: loose fibres standing out all round
  c.lineCap = 'round';
  const fibres = (x0, y0, x1, y1, nx, ny) => {
    const n = Math.hypot(x1 - x0, y1 - y0) * LOOK.fringeDensity;
    for (let i = 0; i < n; i++) {
      const t = rnd(), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const len = 2 + Math.pow(rnd(), 2.2) * (LOOK.fringeLength - 2), bend = (rnd() - 0.5) * 0.9;
      const ex = x + (nx + bend * ny) * len, ey = y + (ny + bend * nx) * len;
      c.strokeStyle = rnd() < 0.8 ? LOOK.fringeColor : lighten(LOOK.fringeColor, -0.12);
      c.lineWidth = 0.4 + rnd() * 0.7;
      c.beginPath(); c.moveTo(x - nx * 2.5, y - ny * 2.5);
      c.quadraticCurveTo(x + nx * len * 0.5 + (rnd() - 0.5) * 3 * ny, y + ny * len * 0.5 + (rnd() - 0.5) * 3 * nx, ex, ey);
      c.stroke();
    }
  };
  fibres(L, T, R, T, 0, -1); fibres(R, T, R, B, 1, 0); fibres(R, B, L, B, 0, 1); fibres(L, B, L, T, -1, 0);
}

// ---------- the decorations (as point lists) ----------
function scallops(x0, y0, x1, y1, bump) {   // a border of little outward arcs, clockwise
  const pts = [];
  const run = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / bump)), r = len / n / 2;
    const ux = (bx - ax) / len, uy = (by - ay) / len, ox = uy, oy = -ux;   // outward is to the left of travel
    for (let i = 0; i < n; i++) {
      const cx = ax + ux * r * (2 * i + 1), cy = ay + uy * r * (2 * i + 1);
      for (let k = i ? 1 : 0; k <= 8; k++) { const t = Math.PI * k / 8; pts.push([cx - ux * Math.cos(t) * r + ox * Math.sin(t) * r, cy - uy * Math.cos(t) * r + oy * Math.sin(t) * r]); }
    }
  };
  run(x0, y0, x1, y0); run(x1, y0, x1, y1); run(x1, y1, x0, y1); run(x0, y1, x0, y0);
  return pts;
}
function vine(cx, cy, from, to, dir, rnd) {   // a wavy stem with leaf loops, buds, and a curl at its end
  let stem = [[cx + dir * from, cy]];
  const leaves = [], buds = [], steps = Math.max(2, Math.round((to - from) / 14));
  for (let i = 1; i <= steps; i++) {
    const x = cx + dir * (from + (to - from) * i / steps), y = cy + (i % 2 ? -3 : 3);
    stem = join(stem, quad(stem[stem.length - 1], [x - dir * 7, cy + (i % 2 ? -7 : 7)], [x, y], 6));
    if (i % 2 && i < steps) {
      const a = dir > 0 ? -0.7 : -2.44, tip = [x + Math.cos(a) * 6, y + Math.sin(a) * 6];
      leaves.push(join(quad([x, y], [x + Math.cos(a - 0.6) * 6, y + Math.sin(a - 0.6) * 6], tip, 5), quad(tip, [x + Math.cos(a + 0.6) * 6, y + Math.sin(a + 0.6) * 6], [x, y], 5)));
    } else if (i < steps && rnd() < 0.6) buds.push([x, y + (i % 2 ? -5 : 5)]);
  }
  const ex = cx + dir * to, s = [ex, cy + 3];
  const curl = join(cubic(s, [ex + dir * 6, cy + 3], [ex + dir * 7, cy - 5], [ex + dir, cy - 5], 8), cubic([ex + dir, cy - 5], [ex - dir * 3, cy - 5], [ex - dir * 3, cy - 1], [ex, cy - 1], 6));
  return { stem, curl, leaves, buds };
}
function bow(cx, cy) {
  const l = join(cubic([cx, cy], [cx - 6, cy - 11], [cx - 18, cy - 9], [cx - 15, cy]), cubic([cx - 15, cy], [cx - 12, cy + 6], [cx - 5, cy + 3], [cx, cy]));
  const r = join(cubic([cx, cy], [cx + 6, cy - 11], [cx + 18, cy - 9], [cx + 15, cy]), cubic([cx + 15, cy], [cx + 12, cy + 6], [cx + 5, cy + 3], [cx, cy]));
  return [l, r, [[cx - 1, cy + 1], [cx - 8, cy + 13]], [[cx + 1, cy + 1], [cx + 8, cy + 13]]];
}
const sparkle = (x, y, s) => [join(quad([x, y - s], [x, y], [x + s * 0.8, y], 5), quad([x + s * 0.8, y], [x, y], [x, y + s], 5), quad([x, y + s], [x, y], [x - s * 0.8, y], 5), quad([x - s * 0.8, y], [x, y], [x, y - s], 5))];
const cross = (x, y, s) => [[[x - s, y], [x + s, y]], [[x, y - s], [x, y + s]]];

function decorate(c, x, y, w, h, rnd) {
  const L = LOOK, tw = L.decoThread, st = L.decoStitch, gp = L.decoGap;
  const run = (pts, col, k = 1) => sewLine(c, pts, col, tw * k, st * k, gp * k, rnd);
  run(scallops(x + 12, y + 12, x + w - 12, y + h - 12, L.scallop), L.borderColor, 1.07);
  const frame = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / L.knotStep));
    for (let i = 0; i < n; i++) knot(c, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, L.knotSize, L.knotColor);
  };
  frame(x + 30, y + 30, x + w - 30, y + 30); frame(x + w - 30, y + 30, x + w - 30, y + h - 30);
  frame(x + w - 30, y + h - 30, x + 30, y + h - 30); frame(x + 30, y + h - 30, x + 30, y + 30);
  // a bow with vines across the top, a vine with a little flower across the bottom
  const cx = x + w / 2, span = Math.max(40, Math.min(130, w / 2 - 60)), top = y + 52, bottom = y + h - 48;
  for (const part of bow(cx, top)) run(part, L.bowColor, 1.07);
  for (const [yy, from] of [[top, 22], [bottom, 10]]) for (const dir of [-1, 1]) {
    const v = vine(cx, yy, from, span, dir, rnd);
    run(v.stem, L.vineColor); run(v.curl, L.vineColor, 0.9);
    for (const leaf of v.leaves) run(leaf, L.leafColor, 0.86);
    for (const [bx, by] of v.buds) knot(c, bx, by, L.knotSize * 0.86, L.budColor);
  }
  for (let k = 0; k < 5; k++) knot(c, cx + Math.cos(k * 1.2566) * 3.4, bottom + Math.sin(k * 1.2566) * 3.4, L.knotSize * 0.95, L.flowerColor);
  knot(c, cx, bottom, L.knotSize * 0.76, '#F2C935');
  // a few sparkles and crosses tucked in the corners
  for (const [sx, sy] of [[x + 46, y + 48], [x + w - 46, y + 48], [x + 46, y + h - 46], [x + w - 46, y + h - 46]]) {
    const r = rnd(), big = 7 + rnd() * 3, alt = rnd() < 0.5;
    if (r < 0.45) for (const p of sparkle(sx, sy, big)) run(p, alt ? L.sparkleColor : L.leafColor, 0.9);
    else if (r < 0.75) for (const p of cross(sx, sy, 4)) run(p, alt ? L.vineColor : L.leafColor, 0.86);
  }
}

// ---------- the lettering ----------
function letters(c, el, font, ox, oy, range, rnd) {
  const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
  const col = cs.getPropertyValue('--thread').trim() || LOOK.answerColor1;
  measure.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  const asc = measure.measureText('Hg').fontBoundingBoxAscent;
  const s = size / font.upm * LOOK.letterSize, sy = s * LOOK.flat;
  const w = size * LOOK.thread, len = size * LOOK.stitch, gap = size * LOOK.gap;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('.check')) continue;
    for (const m of node.nodeValue.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      const glyphs = [...m[0]].map((ch) => font.glyphs.get(ch) || null);
      const natural = glyphs.reduce((a, g) => a + (g ? g.adv : font.defAdv * 0.6), 0) * s;
      const fit = Math.min(1.25, Math.max(0.7, r.width / natural));   // squeeze or stretch to the word's box
      let x = r.left - ox;
      const y = r.top - oy + asc;
      for (const g of glyphs) {
        if (g) for (const st of g.strokes) sewLine(c, st.map(([gx, gy]) => [x + gx * s * fit, y - gy * sy]), col, w, len, gap, rnd);
        x += (g ? g.adv : font.defAdv * 0.6) * s * fit;
      }
    }
  }
}

// ---------- fabric-ribbon highlights ----------
// Select text in the notebook and a strip of ribbon is sewn on underneath it. Every ribbon is made up fresh:
// its fabric, colour, weave, edges and ends are picked at random when you make it (and then kept, so it looks
// the same after a reload). Click a ribbon to unpick it.
const RIBBON_COLOURS = [   // [ground, pattern, thread]
  ['#F7EDB0', '#E2C64C', '#B89A2A'], ['#DDEFC8', '#8DB255', '#4F8A3C'], ['#FFF4C2', '#F2C935', '#C99A1C'],
  ['#D7E4C0', '#6E9A3E', '#3E7A3A'], ['#EAF2D3', '#A9C25A', '#6E9A3E'], ['#F3F6DA', '#C9D46A', '#8DA03A'],
  ['#F6D9DF', '#D98BA3', '#B8607E'], ['#DCEBF2', '#7FB0C9', '#4F86A3'],
];
const WEAVES = ['gingham', 'stripes', 'diagonal', 'dots', 'flowers', 'plain'];
const ENDS = ['notch', 'pinked', 'fray', 'fold'];
const HL_STORE = 'shirt-terrain-ribbons';
let highlights = [];   // { range, seed }

function ribbonStyle(seed) {
  const r = seeded(seed);
  return {
    colours: RIBBON_COLOURS[r() * RIBBON_COLOURS.length | 0], weave: WEAVES[r() * WEAVES.length | 0],
    ends: ENDS[r() * ENDS.length | 0], pinkedEdges: r() < 0.3, sewn: r() < 0.75, scale: 0.8 + r() * 0.6,
  };
}
// the boxes a highlighted range covers, one per line
function lineRects(range) {
  const rects = [...range.getClientRects()].filter((r) => r.width > 0.5).sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - r.top) < 5) { last.left = Math.min(last.left, r.left); last.right = Math.max(last.right, r.right); last.bottom = Math.max(last.bottom, r.bottom); }
    else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  }
  return lines;
}
function ribbon(c, x, y, w, h, st, rnd, first, last) {
  const [ground, pattern, threadCol] = st.colours, tooth = 2.6;
  // outline: top edge, right end, bottom edge, left end
  const pts = [], wav = () => (rnd() - 0.5) * 0.8;
  const edge = (y0, x0, x1) => {
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / (st.pinkedEdges ? tooth : 8)));
    for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (st.pinkedEdges ? (i % 2 ? tooth * 0.7 * Math.sign(h) * (y0 === y ? 1 : -1) : 0) : wav())]);
  };
  const end = (x0, closed, dir) => {   // dir 1: right end, going down; -1: left end, going up
    const ys = dir > 0 ? [y, y + h] : [y + h, y];
    if (!closed) { pts.push([x0, ys[1]]); return; }
    if (st.ends === 'notch') pts.push([x0 - dir * h * 0.38, y + h / 2], [x0, ys[1]]);
    else if (st.ends === 'pinked') { const n = 4; for (let i = 1; i <= n; i++) pts.push([x0 + (i % 2 ? dir * tooth * 0.8 : 0), ys[0] + (ys[1] - ys[0]) * i / n]); }
    else pts.push([x0, ys[1]]);
  };
  edge(y, x, x + w); end(x + w, last, 1); edge(y + h, x + w, x); end(x, first, -1);
  const shape = () => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
  c.save();
  c.translate(x + w / 2, y + h / 2); c.rotate((rnd() - 0.5) * 0.02); c.translate(-(x + w / 2), -(y + h / 2));
  c.save(); c.translate(0.8, 1.6); shape(); c.fillStyle = 'rgba(60,70,40,.18)'; c.fill(); c.restore();
  shape(); c.fillStyle = ground; c.fill();
  c.save(); shape(); c.clip();
  const k = st.scale, ox = rnd() * 20, oy = rnd() * 20;
  c.fillStyle = pattern; c.strokeStyle = pattern;
  if (st.weave === 'gingham') {
    const b = 5 * k;
    c.globalAlpha = 0.35;
    for (let gx = x - b * 2 + (ox % (b * 2)); gx < x + w; gx += b * 2) c.fillRect(gx, y - 2, b, h + 4);
    for (let gy = y - b * 2 + (oy % (b * 2)); gy < y + h; gy += b * 2) c.fillRect(x - 2, gy, w + 4, b);
  } else if (st.weave === 'stripes') {
    c.globalAlpha = 0.5;
    for (let gy = y + (oy % (5 * k)); gy < y + h; gy += 5 * k) c.fillRect(x - 2, gy, w + 4, 1.6 * k);
  } else if (st.weave === 'diagonal') {
    c.globalAlpha = 0.4; c.lineWidth = 1.8 * k;
    for (let gx = x - h + (ox % (6 * k)); gx < x + w + h; gx += 6 * k) { c.beginPath(); c.moveTo(gx, y + h + 2); c.lineTo(gx + h + 4, y - 2); c.stroke(); }
  } else if (st.weave === 'dots') {
    c.globalAlpha = 0.6;
    for (let gy = y + 3 * k, row = 0; gy < y + h; gy += 5 * k, row++) for (let gx = x + (row % 2 ? 3 : 0) * k + (ox % 6); gx < x + w; gx += 6 * k) { c.beginPath(); c.arc(gx, gy, 1.1 * k, 0, 7); c.fill(); }
  } else if (st.weave === 'flowers') {
    c.globalAlpha = 0.75;
    for (let fx = x + 4 + rnd() * 8; fx < x + w; fx += 10 + rnd() * 10) {
      const fy = y + h * (0.25 + rnd() * 0.5);
      for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(fx + Math.cos(p * 1.2566) * 1.6 * k, fy + Math.sin(p * 1.2566) * 1.6 * k, 1 * k, 0, 7); c.fill(); }
      c.fillStyle = '#F2C935'; c.beginPath(); c.arc(fx, fy, 0.8 * k, 0, 7); c.fill(); c.fillStyle = pattern;
    }
  }
  // a fine weave over every ribbon, and a soft roundness across its width
  c.globalAlpha = 1;
  for (let gy = y; gy < y + h; gy += 1.4) { c.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.12})`; c.fillRect(x - 2, gy, w + 4, 0.6); }
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,60,30,.1)');
  c.fillStyle = g; c.fillRect(x - 3, y - 3, w + 6, h + 6);
  c.restore();
  // folded-under ends and frayed ends
  if (st.ends === 'fold') for (const [fx, on, dir] of [[x, first, 1], [x + w, last, -1]]) {
    if (!on) continue;
    c.fillStyle = 'rgba(60,60,30,.16)'; c.beginPath(); c.moveTo(fx, y); c.lineTo(fx + dir * 4, y); c.lineTo(fx, y + h); c.closePath(); c.fill();
  }
  if (st.ends === 'fray') for (const [fx, on, dir] of [[x, first, -1], [x + w, last, 1]]) {
    if (!on) continue;
    c.strokeStyle = ground; c.lineWidth = 0.6;
    for (let i = 0; i < h * 1.2; i++) { const fy = y + rnd() * h, l = 1.5 + rnd() * 4; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + dir * l, fy + (rnd() - 0.5) * 1.5); c.stroke(); }
  }
  // sewn on with a running stitch along both edges
  if (st.sewn && h > 12) {
    const inset = st.pinkedEdges ? 3.6 : 2.4;
    sewLine(c, [[x + 3, y + inset], [x + w - 3, y + inset]], threadCol, 0.9, 3.4, 1.8, rnd);
    sewLine(c, [[x + 3, y + h - inset], [x + w - 3, y + h - inset]], threadCol, 0.9, 3.4, 1.8, rnd);
  }
  c.restore();
}
function drawRibbons(c, patchRect, ox, oy) {
  for (const hl of highlights) {
    const lines = lineRects(hl.range), st = ribbonStyle(hl.seed);
    lines.forEach((r, i) => {
      const cy = (r.top + r.bottom) / 2;
      if (cy < patchRect.top || cy > patchRect.bottom) return;
      const h = r.bottom - r.top;
      ribbon(c, r.left - ox - 4, r.top - oy + h * 0.1, r.right - r.left + 8, h * 0.86, st, seeded(hl.seed * 31 + i), i === 0, i === lines.length - 1);
    });
  }
}
// highlights are kept in this browser as character offsets into the notebook's text
function textNodes(book) {
  const out = [], walker = document.createTreeWalker(book, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) out.push(walker.currentNode);
  return out;
}
function saveHighlights(book) {
  const nodes = textNodes(book), offset = (node, off) => { let n = 0; for (const t of nodes) { if (t === node) return n + off; n += t.nodeValue.length; } return -1; };
  const data = highlights.map((h) => [offset(h.range.startContainer, h.range.startOffset), offset(h.range.endContainer, h.range.endOffset), h.seed]);
  try { localStorage.setItem(HL_STORE, JSON.stringify(data)); } catch {}
}
function loadHighlights(book) {
  let data = [];
  try { data = JSON.parse(localStorage.getItem(HL_STORE) || '[]'); } catch {}
  const nodes = textNodes(book), find = (n) => { for (const t of nodes) { if (n <= t.nodeValue.length) return [t, n]; n -= t.nodeValue.length; } return null; };
  for (const [a, b, seed] of data) {
    const s = find(a), e = find(b);
    if (!s || !e || a < 0 || b <= a) continue;
    const range = document.createRange();
    range.setStart(...s); range.setEnd(...e);
    highlights.push({ range, seed });
  }
}
function listenForHighlights(book, redo) {
  const up = (e) => {
    const sel = getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      if (!book.contains(range.commonAncestorContainer) || !range.toString().trim()) return;
      highlights.push({ range: range.cloneRange(), seed: (Math.random() * 2 ** 31) | 0 });
      sel.removeAllRanges();
    } else {
      // a plain click on a ribbon unpicks it
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const i = highlights.findIndex((h) => lineRects(h.range).some((r) => p.clientX >= r.left - 4 && p.clientX <= r.right + 4 && p.clientY >= r.top && p.clientY <= r.bottom));
      if (i < 0) return;
      highlights.splice(i, 1);
    }
    saveHighlights(book);
    redo();
  };
  book.addEventListener('mouseup', up);
  book.addEventListener('touchend', up);
}

// ---------- putting it together ----------
const CSS_VARS = { titleColor: '--c-title', headingColor: '--c-heading', questionColor: '--c-question', answerColor1: '--c-answer1',
  answerColor2: '--c-answer2', answerColor3: '--c-answer3', conceptColor: '--c-concept', labelColor: '--c-label' };
function canvasFor(host, cls, w, h) {
  let cv = host.querySelector(`:scope > canvas.${cls}`);
  if (!cv) { cv = document.createElement('canvas'); cv.className = cls; cv.setAttribute('aria-hidden', 'true'); host.prepend(cv); }
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}
function sew(font, book) {
  for (const [k, v] of Object.entries(CSS_VARS)) book.style.setProperty(v, LOOK[k]);
  book.style.setProperty('--word-gap', `${LOOK.wordSpacing}em`);
  const range = document.createRange();
  book.querySelectorAll('.patch').forEach((p, i) => {
    const r = p.getBoundingClientRect();
    const c = canvasFor(p, 'cloth', r.width + PAD * 2, r.height + PAD * 2);
    paintCloth(c, r.width, r.height, seeded(i * 7919 + 17));
    decorate(c, PAD, PAD, r.width, r.height, seeded(i * 104729 + 3));
    const ox = r.left - PAD, oy = r.top - PAD;
    drawRibbons(c, r, ox, oy);
    p.querySelectorAll('[data-sew]').forEach((el, j) => letters(c, el, font, ox, oy, range, seeded(i * 31337 + j * 97 + 5)));
  });
  // text sewn straight onto the page (the section headings) gets a small canvas of its own
  book.querySelectorAll('[data-sew]').forEach((el, j) => {
    if (el.closest('.patch')) return;
    const r = el.getBoundingClientRect(), m = 14;
    const c = canvasFor(el, 'sewn-text', r.width + m * 2, r.height + m * 2);
    letters(c, el, font, r.left - m, r.top - m, range, seeded(j * 7717 + 11));
  });
}

let state = null;

export async function embroider(book, selector) {
  for (const el of book.querySelectorAll(selector)) el.dataset.sew = '';
  const [font] = await Promise.all([loadFont(FONT_URL), document.fonts.ready]);
  book.classList.add('sewn');
  let pending = 0;
  state = { redo: () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => sew(font, book)); } };
  loadHighlights(book);
  listenForHighlights(book, state.redo);
  state.redo();
  new ResizeObserver(() => state.redo()).observe(book);
}
