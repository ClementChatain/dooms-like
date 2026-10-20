import * as THREE from 'three';
import { toonGradient } from './textures.js';

export const CELL = 3;
export const WALL_H = 3.6;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure grid data + collision / raycast helpers (no rendering). */
export class LevelData {
  constructor(level, { arena = false, seed = (Math.random() * 1e9) | 0 } = {}) {
    this.level = level;
    this.arena = arena;
    this.rand = mulberry32(seed);
    const size = arena ? 25 : Math.min(23 + level * 3, 43) | 1;
    this.w = this.h = size;
    this.grid = new Uint8Array(size * size).fill(1);
    this.rooms = [];
    if (arena) this.generateArena(); else this.generate();
    this.flow = new Int16Array(size * size);
    this.flowCell = -1;
  }

  idx(x, y) { return y * this.w + x; }
  isWall(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h || this.grid[y * this.w + x] === 1;
  }

  carve(x, y) { if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.grid[this.idx(x, y)] = 0; }

  /** Une grande salle ronde-carrée avec quatre piliers, pour le combat de boss. */
  generateArena() {
    const { w, h } = this, m = 3, rw = w - m * 2, rh = h - m * 2;
    const room = { x: m, y: m, w: rw, h: rh, cx: w >> 1, cy: h >> 1 };
    for (let j = room.y; j < room.y + rh; j++) for (let i = room.x; i < room.x + rw; i++) this.carve(i, j);
    for (const [px, py] of [[8, 8], [16, 8], [8, 16], [16, 16]]) this.grid[this.idx(px, py)] = 1;
    this.rooms = [room];
    this.start = room;
    this.spawn = { cx: w >> 1, cy: h - m - 2 };
    this.bossSpawn = { cx: w >> 1, cy: m + 3 };
    this.exitRoom = { cx: w >> 1, cy: m + 2 };
  }

  generate() {
    const r = this.rand, { w, h } = this;
    const target = Math.min(6 + this.level, 12);
    for (let tries = 0; tries < 300 && this.rooms.length < target; tries++) {
      const rw = 3 + Math.floor(r() * 5), rh = 3 + Math.floor(r() * 5);
      const x = 1 + Math.floor(r() * (w - rw - 2)), y = 1 + Math.floor(r() * (h - rh - 2));
      const ok = this.rooms.every((o) =>
        x > o.x + o.w + 1 || x + rw + 1 < o.x || y > o.y + o.h + 1 || y + rh + 1 < o.y);
      if (!ok) continue;
      this.rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
    }
    for (const rm of this.rooms) {
      for (let j = rm.y; j < rm.y + rm.h; j++) for (let i = rm.x; i < rm.x + rm.w; i++) this.carve(i, j);
    }
    // pillars (before corridors so corridors always win)
    for (const rm of this.rooms) {
      if (rm.w >= 5 && rm.h >= 5) {
        this.grid[this.idx(rm.x + 1, rm.y + 1)] = 1;
        this.grid[this.idx(rm.x + rm.w - 2, rm.y + rm.h - 2)] = 1;
      }
    }
    const link = (a, b) => {
      let x = a.cx, y = a.cy;
      const horizFirst = r() < 0.5;
      const hLine = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); this.carve(x, y); } };
      const vLine = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); this.carve(x, y); } };
      this.carve(x, y);
      if (horizFirst) { hLine(); vLine(); } else { vLine(); hLine(); }
    };
    for (let i = 1; i < this.rooms.length; i++) link(this.rooms[i - 1], this.rooms[i]);
    for (let i = 0; i < Math.floor(this.rooms.length / 3); i++) {
      link(this.rooms[Math.floor(r() * this.rooms.length)], this.rooms[Math.floor(r() * this.rooms.length)]);
    }
    // clear any pillar that landed on a room center
    for (const rm of this.rooms) this.carve(rm.cx, rm.cy);

    this.start = this.rooms[0];
    // exit = room with longest walking distance
    const d = this.bfs(this.start.cx, this.start.cy);
    let best = this.rooms[1] ?? this.rooms[0], bd = -1;
    for (const rm of this.rooms) {
      const v = d[this.idx(rm.cx, rm.cy)];
      if (v > bd) { bd = v; best = rm; }
    }
    this.exitRoom = best;
  }

  bfs(sx, sy, out) {
    const dist = out ?? new Int16Array(this.w * this.h);
    dist.fill(-1);
    const q = [this.idx(sx, sy)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const cur = q[h], cx = cur % this.w, cy = (cur / this.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (this.isWall(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        q.push(ni);
      }
    }
    return dist;
  }

  /** Update the flow field toward world position (x,z). */
  updateFlow(x, z) {
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    const key = this.idx(cx, cy);
    if (key === this.flowCell) return;
    this.flowCell = key;
    this.bfs(cx, cy, this.flow);
  }

  /** World center of the neighbouring cell with the lowest flow distance, or null. */
  nextStep(x, z) {
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    let bestD = this.flow[this.idx(cx, cy)], bx = -1, by = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (this.isWall(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (this.isWall(cx + dx, cy) || this.isWall(cx, cy + dy))) continue;
      const d = this.flow[this.idx(nx, ny)];
      if (d >= 0 && d < bestD) { bestD = d; bx = nx; by = ny; }
    }
    if (bx < 0) return null;
    return [(bx + 0.5) * CELL, (by + 0.5) * CELL];
  }

  circleHitsWall(x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
      if (!this.isWall(i, j)) continue;
      const nx = Math.max(i * CELL, Math.min(x, (i + 1) * CELL));
      const nz = Math.max(j * CELL, Math.min(z, (j + 1) * CELL));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /** Move with axis-separated sliding. Mutates pos {x,z}. */
  move(pos, dx, dz, r) {
    if (!this.circleHitsWall(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!this.circleHitsWall(pos.x, pos.z + dz, r)) pos.z += dz;
  }

  /** DDA ray against walls. Direction need not be unit; returns parameter t of first hit (or Infinity). */
  rayWall(ox, oz, dx, dz, maxT = 100) {
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
    if (this.isWall(cx, cz)) return 0;
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx)) : Infinity;
    let tMaxZ = dz !== 0 ? ((dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / Math.abs(dz)) : Infinity;
    for (let n = 0; n < 200; n++) {
      let t;
      if (tMaxX < tMaxZ) { t = tMaxX; cx += stepX; tMaxX += tDeltaX; }
      else { t = tMaxZ; cz += stepZ; tMaxZ += tDeltaZ; }
      if (t > maxT) return Infinity;
      if (this.isWall(cx, cz)) return t;
    }
    return Infinity;
  }

  hasLOS(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.001) return true;
    return this.rayWall(ax, az, dx / len, dz / len, len) === Infinity;
  }

  randomFloorIn(room) {
    const r = this.rand;
    for (let k = 0; k < 20; k++) {
      const i = room.x + Math.floor(r() * room.w), j = room.y + Math.floor(r() * room.h);
      if (!this.isWall(i, j)) return { x: (i + 0.5) * CELL, z: (j + 0.5) * CELL };
    }
    return { x: (room.cx + 0.5) * CELL, z: (room.cy + 0.5) * CELL };
  }
}

/** Builds the three.js geometry for a LevelData. */
export class LevelView {
  constructor(data, tex, glowTex, theme, lightCount) {
    this.data = data;
    this.group = new THREE.Group();
    this.torches = [];
    const { w, h, grid } = data;

    // ---------- walls (only those touching a floor cell)
    const wallCells = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!data.isWall(i, j)) continue;
      if (!data.isWall(i + 1, j) || !data.isWall(i - 1, j) || !data.isWall(i, j + 1) || !data.isWall(i, j - 1)) {
        wallCells.push([i, j]);
      }
    }
    const gradientMap = toonGradient();
    const wallMat = new THREE.MeshToonMaterial({ map: tex.wall.map, gradientMap });
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMat, wallCells.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    wallCells.forEach(([i, j], n) => {
      m.makeTranslation((i + 0.5) * CELL, WALL_H / 2, (j + 0.5) * CELL);
      walls.setMatrixAt(n, m);
      const v = 0.92 + data.rand() * 0.12;
      walls.setColorAt(n, col.setRGB(v, v, v));
    });
    walls.instanceMatrix.needsUpdate = true;
    if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
    this.group.add(walls);

    // ---------- floor / ceiling
    const span = w * CELL;
    const floorMat = new THREE.MeshToonMaterial({ map: tex.floor.map.clone(), gradientMap });
    floorMat.map.repeat.set(w * 0.5, h * 0.5); floorMat.map.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(span / 2, 0, span / 2);
    this.group.add(floor);

    const ceilMat = new THREE.MeshToonMaterial({ map: tex.ceil.map.clone(), gradientMap });
    ceilMat.map.repeat.set(w * 0.5, h * 0.5); ceilMat.map.needsUpdate = true;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(span, span), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(span / 2, WALL_H, span / 2);
    this.group.add(ceil);

    // ---------- torches
    const cands = [];
    for (const [i, j] of wallCells) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!data.isWall(i + dx, j + dz)) cands.push({ i, j, dx, dz });
      }
    }
    for (let k = cands.length - 1; k > 0; k--) {
      const s = Math.floor(data.rand() * (k + 1));
      [cands[k], cands[s]] = [cands[s], cands[k]];
    }
    const flameGeo = new THREE.SphereGeometry(0.09, 10, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.torch).multiplyScalar(3.5) });
    const bracketMat = new THREE.MeshToonMaterial({ color: 0x2a2036, gradientMap });
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex, color: theme.torch, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
    });
    for (const c of cands) {
      if (this.torches.length >= 70) break;
      const x = (c.i + 0.5) * CELL + c.dx * (CELL / 2 + 0.12);
      const z = (c.j + 0.5) * CELL + c.dz * (CELL / 2 + 0.12);
      if (this.torches.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 36)) continue;
      const g = new THREE.Group();
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), bracketMat);
      bracket.position.set(0, 1.85, 0);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.07, 0.16, 8), bracketMat);
      cup.position.set(0, 2.15, 0);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 2.3, 0); flame.scale.set(1, 1.7, 1);
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(0, 2.32, 0); glow.scale.set(1.6, 1.6, 1);
      g.add(bracket, cup, flame, glow);
      g.position.set(x, 0, z);
      this.group.add(g);
      this.torches.push({ x, z, y: 2.4, flame, glow, phase: data.rand() * 100 });
    }

    // ---------- torch light pool
    this.lights = [];
    for (let n = 0; n < lightCount; n++) {
      const l = new THREE.PointLight(theme.torch, 0, 22, 1.6);
      l.userData = { torch: -1, k: 0 };
      this.lights.push(l);
      this.group.add(l);
    }
    this.theme = theme;

    // ---------- exit portal
    const ex = (data.exitRoom.cx + 0.5) * CELL, ez = (data.exitRoom.cy + 0.5) * CELL;
    this.exit = { x: ex, z: ez, unlocked: false };
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.09, 12, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a2a).multiplyScalar(3) }),
    );
    ring.position.set(ex, 1.3, ez);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    disc.position.copy(ring.position);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, WALL_H, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.position.set(ex, WALL_H / 2, ez);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.08, 32),
      new THREE.MeshToonMaterial({ color: 0x221830, emissive: 0xff2020, emissiveIntensity: 0.6, gradientMap }),
    );
    pad.position.set(ex, 0.04, ez);
    const exitGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff2020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
    }));
    exitGlow.position.set(ex, 1.3, ez); exitGlow.scale.set(4, 4, 1);
    this.exit.parts = { ring, disc, beam, pad, exitGlow };
    this.group.add(ring, disc, beam, pad, exitGlow);
    this.exit.visible = !data.arena;
    for (const o of Object.values(this.exit.parts)) o.visible = this.exit.visible;
  }

  unlockExit() {
    this.exit.unlocked = true;
    this.exit.visible = true;
    for (const o of Object.values(this.exit.parts)) o.visible = true;
    const c = new THREE.Color(0x3dffb0);
    const p = this.exit.parts;
    p.ring.material.color.copy(c).multiplyScalar(3);
    p.disc.material.color.copy(c); p.beam.material.color.copy(c);
    p.pad.material.emissive.copy(c); p.exitGlow.material.color.copy(c);
    p.disc.material.opacity = 0.4; p.beam.material.opacity = 0.2;
  }

  update(dt, time, playerPos) {
    // flicker
    for (const t of this.torches) {
      const f = 0.85 + 0.15 * Math.sin(time * 13 + t.phase) * Math.sin(time * 7.3 + t.phase * 2);
      t.flame.scale.set(f, 1.7 * f, f);
      t.glow.scale.setScalar(1.5 + 0.25 * f);
    }
    // assign nearest torches to the light pool
    const n = this.lights.length;
    const order = this.torches
      .map((t, i) => ({ i, d: (t.x - playerPos.x) ** 2 + (t.z - playerPos.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    const wanted = new Set(order.map((o) => o.i));
    const held = new Set(this.lights.map((l) => l.userData.torch));
    const free = order.filter((o) => !held.has(o.i)).map((o) => o.i);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.torch >= 0 && !wanted.has(u.torch)) {
        u.k -= dt * 3;
        if (u.k <= 0) { u.k = 0; u.torch = free.length ? free.pop() : -1; }
      } else if (u.torch < 0 && free.length) {
        u.torch = free.pop(); u.k = 0;
      } else if (u.torch >= 0) {
        u.k = Math.min(1, u.k + dt * 3);
      }
      if (u.torch >= 0) {
        const t = this.torches[u.torch];
        const f = 0.85 + 0.15 * Math.sin(time * 13 + t.phase) * Math.sin(time * 7.3 + t.phase * 2);
        l.position.set(t.x - 0.0, t.y, t.z);
        l.intensity = 20 * u.k * f;
      } else l.intensity = 0;
    }
    // exit animation
    const p = this.exit.parts;
    p.ring.rotation.y += dt * 1.5;
    p.ring.position.y = 1.3 + Math.sin(time * 2) * 0.08;
    p.disc.position.y = p.ring.position.y;
    p.beam.rotation.y -= dt * 0.5;
    p.exitGlow.scale.setScalar(3.6 + Math.sin(time * 3) * 0.4);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.isSpriteMaterial) {
        for (const k of ['map', 'bumpMap']) if (o.material[k] && o.material[k] !== undefined) { /* shared textures kept */ }
      }
    });
  }
}
