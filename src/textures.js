import * as THREE from 'three';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dégradé à 3 paliers : c'est lui qui donne l'aspect "cel-shading" aux matériaux toon. */
let _grad = null;
export function toonGradient() {
  if (!_grad) {
    _grad = new THREE.DataTexture(Uint8Array.from([120, 195, 255]), 3, 1, THREE.RedFormat);
    _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
    _grad.needsUpdate = true;
  }
  return _grad;
}

const INK_W = 9; // épaisseur des contours dessinés dans les textures

function rect(c, x, y, w, h, fill, ink, hi = true) {
  c.fillStyle = fill; c.fillRect(x, y, w, h);
  if (hi) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, y, w, h * 0.22); }
  c.strokeStyle = ink; c.lineWidth = INK_W; c.strokeRect(x, y, w, h);
}

/** Dessine une tuile de mur selon le style du monde. */
function drawWall(c, size, p, rnd) {
  c.fillStyle = p.mortar; c.fillRect(0, 0, size, size);
  const pick = () => p.wall[rnd() < 0.5 ? 0 : 1];
  if (p.style === 'bricks' || p.style === 'lava') {
    const rows = 6, bh = size / rows, bw = size / 3;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2);
      for (let i = -1; i < 4; i++) rect(c, i * bw + off + 4, r * bh + 4, bw - 8, bh - 8, pick(), p.ink);
    }
    if (p.style === 'lava') { // joints incandescents : on repasse le mortier en couleur vive
      c.strokeStyle = p.accent; c.lineWidth = 3;
      for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(0, r * bh); c.lineTo(size, r * bh); c.stroke(); }
    }
  } else if (p.style === 'crystal') {
    const n = 3, t = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const x0 = x * t, y0 = y * t;
      c.fillStyle = p.wall[0]; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + t, y0); c.lineTo(x0, y0 + t); c.closePath(); c.fill();
      c.fillStyle = p.wall[1]; c.beginPath(); c.moveTo(x0 + t, y0); c.lineTo(x0 + t, y0 + t); c.lineTo(x0, y0 + t); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x0 + 10, y0 + 10); c.lineTo(x0 + t * 0.45, y0 + 10); c.lineTo(x0 + 10, y0 + t * 0.45); c.closePath(); c.fill();
      c.strokeStyle = p.ink; c.lineWidth = INK_W;
      c.strokeRect(x0, y0, t, t);
      c.beginPath(); c.moveTo(x0 + t, y0); c.lineTo(x0, y0 + t); c.stroke();
    }
  } else { // panels : grands panneaux avec liseré néon
    const n = 2, t = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      rect(c, x * t + 6, y * t + 6, t - 12, t - 12, pick(), p.ink, false);
      c.strokeStyle = p.accent; c.lineWidth = 5;
      c.strokeRect(x * t + 26, y * t + 26, t - 52, t - 52);
      c.fillStyle = p.accent;
      c.fillRect(x * t + t / 2 - 28, y * t + t / 2 - 5, 56, 10);
    }
  }
}

function drawFloor(c, size, p) {
  const n = 4, t = size / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    rect(c, x * t, y * t, t, t, p.floor[(x + y) % 2], p.ink, false);
  }
  if (p.style === 'panels') { // fines lignes néon au sol
    c.strokeStyle = p.accent; c.globalAlpha = 0.5; c.lineWidth = 3;
    c.strokeRect(t / 2, t / 2, size - t, size - t);
    c.globalAlpha = 1;
  }
}

function drawCeil(c, size, p) {
  c.fillStyle = p.ceil; c.fillRect(0, 0, size, size);
  const n = 2, t = size / n;
  c.strokeStyle = p.ink; c.lineWidth = INK_W;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) c.strokeRect(x * t, y * t, t, t);
  c.fillStyle = 'rgba(255,255,255,.1)';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) c.fillRect(x * t + 8, y * t + 8, t - 16, t * 0.2);
}

const _cache = {};
/** Textures mur / sol / plafond d'un monde (mises en cache). Renvoie { wall, floor, ceil } avec .map. */
export function makeWorldTextures(world) {
  if (_cache[world.id]) return _cache[world.id];
  const p = world.palette, rnd = mulberry32(world.id.length * 7919 + world.id.charCodeAt(0));
  const out = {};
  for (const [key, draw] of [['wall', drawWall], ['floor', drawFloor], ['ceil', drawCeil]]) {
    const c = canvas(512);
    draw(c.getContext('2d'), 512, p, rnd);
    out[key] = { map: toTexture(c) };
  }
  return (_cache[world.id] = out);
}

/** Soft radial glow used by sprites */
export function makeGlow(size = 128) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
