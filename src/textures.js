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

function noiseOverlay(ctx, size, amount, rnd) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function blobs(ctx, size, count, rgba, rmin, rmax, rnd) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = rmin + rnd() * (rmax - rmin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba.replace('A', (0.25 * rnd()).toFixed(3)));
    g.addColorStop(1, rgba.replace('A', '0'));
    ctx.fillStyle = g;
    // wrap around so the texture tiles
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.save(); ctx.translate(ox, oy); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
  }
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Brick wall: returns { map, bump } */
export function makeBricks(size = 512) {
  const rnd = mulberry32(1337);
  const col = canvas(size), hgt = canvas(size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = '#2a2420'; c.fillRect(0, 0, size, size);
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  const rows = 8, bh = size / rows, bw = size / 4, gap = 5;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let i = -1; i < 5; i++) {
      const x = i * bw + off + gap / 2, y = r * bh + gap / 2;
      const l = 38 + rnd() * 22, s = 18 + rnd() * 14, hue = 8 + rnd() * 18;
      c.fillStyle = `hsl(${hue} ${s}% ${l}%)`;
      h.fillStyle = `rgb(${150 + rnd() * 80},${150 + rnd() * 80},${150 + rnd() * 80})`;
      for (const [ox] of [[0], [size]]) {
        c.fillRect(x + ox - size * 0, y, bw - gap, bh - gap);
        h.fillRect(x, y, bw - gap, bh - gap);
      }
      // chipped edge highlight
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(x, y, bw - gap, 3);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + bh - gap - 3, bw - gap, 3);
    }
  }
  blobs(c, size, 40, 'rgba(10,6,4,A)', 30, 90, rnd);
  blobs(h, size, 30, 'rgba(0,0,0,A)', 20, 60, rnd);
  noiseOverlay(c, size, 38, rnd);
  noiseOverlay(h, size, 60, rnd);
  return { map: toTexture(col), bump: toTexture(hgt, false) };
}

/** Stone floor tiles */
export function makeFloor(size = 512) {
  const rnd = mulberry32(42);
  const col = canvas(size), hgt = canvas(size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = '#0d0c0c'; c.fillRect(0, 0, size, size);
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  const n = 4, t = size / n, gap = 6;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = 22 + rnd() * 10;
    c.fillStyle = `hsl(${20 + rnd() * 10} 8% ${l}%)`;
    c.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
    const v = 150 + rnd() * 80;
    h.fillStyle = `rgb(${v},${v},${v})`;
    h.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
    // cracks
    if (rnd() < 0.5) {
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5; c.beginPath();
      let px = x * t + rnd() * t, py = y * t + rnd() * t; c.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 40; py += (rnd() - 0.5) * 40; c.lineTo(px, py); }
      c.stroke();
    }
  }
  blobs(c, size, 50, 'rgba(0,0,0,A)', 30, 100, rnd);
  blobs(c, size, 12, 'rgba(90,20,10,A)', 15, 50, rnd);
  noiseOverlay(c, size, 30, rnd);
  noiseOverlay(h, size, 70, rnd);
  return { map: toTexture(col), bump: toTexture(hgt, false) };
}

/** Riveted metal ceiling panels */
export function makeCeiling(size = 512) {
  const rnd = mulberry32(7);
  const col = canvas(size), hgt = canvas(size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = '#16171a'; c.fillRect(0, 0, size, size);
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  const n = 2, t = size / n, gap = 8;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = 14 + rnd() * 6;
    c.fillStyle = `hsl(220 6% ${l}%)`;
    c.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
    h.fillStyle = '#c8c8c8';
    h.fillRect(x * t + gap / 2, y * t + gap / 2, t - gap, t - gap);
    for (const [rx, ry] of [[20, 20], [t - 20, 20], [20, t - 20], [t - 20, t - 20]]) {
      c.fillStyle = '#333'; c.beginPath(); c.arc(x * t + rx, y * t + ry, 5, 0, 7); c.fill();
      h.fillStyle = '#fff'; h.beginPath(); h.arc(x * t + rx, y * t + ry, 5, 0, 7); h.fill();
    }
  }
  blobs(c, size, 40, 'rgba(0,0,0,A)', 30, 100, rnd);
  noiseOverlay(c, size, 20, rnd);
  return { map: toTexture(col), bump: toTexture(hgt, false) };
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

/** Cracked, veined demon skin */
export function makeSkin(base = '#6a2218', size = 256) {
  const rnd = mulberry32(base.length * 977 + base.charCodeAt(1) * 31);
  const col = canvas(size), hgt = canvas(size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = base; c.fillRect(0, 0, size, size);
  h.fillStyle = '#888'; h.fillRect(0, 0, size, size);
  blobs(c, size, 60, 'rgba(0,0,0,A)', 10, 50, rnd);
  blobs(c, size, 30, 'rgba(255,120,60,A)', 8, 30, rnd);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 6;
    h.fillStyle = `rgba(${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},0.35)`;
    h.beginPath(); h.arc(x, y, r, 0, 7); h.fill();
  }
  noiseOverlay(c, size, 40, rnd);
  noiseOverlay(h, size, 100, rnd);
  return { map: toTexture(col), bump: toTexture(hgt, false) };
}
