import * as THREE from 'three';
import { makeBricks, makeFloor, makeCeiling, makeGlow } from './textures.js';
import { LevelData, LevelView, THEMES, CELL, WALL_H } from './level.js';
import { Enemy, TYPES } from './enemies.js';
import { WeaponRig, WEAPONS } from './weapons.js';
import { Particles, createComposer } from './fx.js';
import { Input, isTouch } from './input.js';
import { Audio } from './audio.js';

const $ = (s) => document.querySelector(s);
const mobile = isTouch();
const EYE = 1.6;
const PLAYER_R = 0.42;
const MAX_AMMO = { cells: 240, shells: 48 };

// hit spheres [absolute y, radius] per enemy type (last one = head)
const HIT = {
  imp:   [[0.7, 0.42], [1.2, 0.45], [1.78, 0.3]],
  brute: [[0.9, 0.6], [1.6, 0.8], [2.35, 0.38]],
  skull: [[1.35, 0.42]],
};

// ---------------------------------------------------------------- renderer
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
const maxPixelRatio = pixelRatio;
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 90);
camera.rotation.order = 'YXZ';
scene.add(camera);
const hemi = new THREE.HemisphereLight(0x806050, 0x1a0e0a, 0.9);
scene.add(hemi);
const headlamp = new THREE.PointLight(0xffb070, 14, 12, 1.6);
camera.add(headlamp);

const fx = createComposer(renderer, scene, camera, { mobile });
const particles = new Particles(scene, mobile ? 450 : 800);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  fx.composer.setPixelRatio(pixelRatio);
  fx.composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 90 : 76;
  camera.updateProjectionMatrix();
  particles.setScale(h * pixelRatio, camera.fov);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- assets
const tex = { wall: makeBricks(), floor: makeFloor(), ceil: makeCeiling() };
const glowTex = makeGlow();
const rig = new WeaponRig(camera, glowTex);
const audio = new Audio();
const input = new Input(canvas);

// pickups assets
const pickupGeo = { health: new THREE.BoxGeometry(0.34, 0.34, 0.34), cells: new THREE.CylinderGeometry(0.13, 0.13, 0.36, 12), shells: new THREE.BoxGeometry(0.3, 0.2, 0.42) };
const pickupCol = { health: 0x2dff7a, cells: 0x40d8ff, shells: 0xffa040 };
const pickupMat = {};
for (const k in pickupCol) pickupMat[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(pickupCol[k]).multiplyScalar(2.2) });
const pickupGlow = {};
for (const k in pickupCol) pickupGlow[k] = new THREE.SpriteMaterial({ map: glowTex, color: pickupCol[k], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
const fireGeo = new THREE.SphereGeometry(0.2, 12, 10);
const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a20).multiplyScalar(4) });
const fireGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff5a10, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

// ---------------------------------------------------------------- state
const player = {
  pos: { x: 0, z: 0 }, yaw: 0, pitch: 0, hp: 100, vx: 0, vz: 0,
  ammo: { cells: 90, shells: 12 }, cool: 0, bobT: 0, speed: 0, dmgT: 0, healT: 0, shake: 0, deadT: 0,
};
let state = 'menu'; // menu | playing | paused | dead | transition
let levelNo = 1, data = null, view = null;
let enemies = [], projectiles = [], pickups = [];
let score = 0, kills = 0, time = 0, totalLeft = 0;
let best = 0;
try { best = +localStorage.getItem('hellbound-best') || 0; } catch {}
let seen = null;
const ctx = { player, enemies, audio };

const el = {
  hpN: $('#hp-n'), hpBar: $('#hp-bar'), ammoN: $('#ammo-n'), wname: $('#wname'), left: $('#left'), score: $('#score'),
  lvl: $('#lvl-name'), banner: $('#banner'), cross: $('#crosshair'), mini: $('#minimap'), fade: $('#fade'),
};

function showBanner(text, sub = '', ms = 2600) {
  el.banner.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  el.banner.classList.add('show');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => el.banner.classList.remove('show'), ms);
}

function updateHud() {
  const hp = Math.max(0, Math.ceil(player.hp));
  el.hpN.textContent = hp;
  el.hpBar.style.width = hp + '%';
  const w = WEAPONS[rig.cur];
  el.wname.textContent = w.name;
  el.ammoN.textContent = player.ammo[w.ammo];
  el.left.textContent = totalLeft;
  el.score.textContent = score;
}

// ---------------------------------------------------------------- level
function disposeLevel() {
  if (view) { scene.remove(view.group); view.dispose(); }
  for (const e of enemies) e.dispose(scene);
  for (const p of projectiles) scene.remove(p.mesh);
  for (const p of pickups) scene.remove(p.mesh);
  enemies.length = 0; projectiles.length = 0; pickups.length = 0;
}

function spawnPickup(kind, x, z) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(pickupGeo[kind], pickupMat[kind]);
  const s = new THREE.Sprite(pickupGlow[kind]); s.scale.set(1.1, 1.1, 1);
  g.add(m, s);
  g.position.set(x, 0.7, z);
  scene.add(g);
  pickups.push({ kind, mesh: g, body: m, x, z, phase: Math.random() * 6 });
}

function startLevel(n) {
  disposeLevel();
  levelNo = n;
  const theme = THEMES[(n - 1) % THEMES.length];
  do { data = new LevelData(n); } while (data.rooms.length < 4);
  view = new LevelView(data, tex, glowTex, theme, mobile ? 4 : 6);
  scene.add(view.group);
  scene.fog = new THREE.FogExp2(theme.fog, 0.045);
  scene.background = new THREE.Color(theme.fog);
  hemi.color.setHex(theme.ambient); hemi.groundColor.setHex(0x0a0504);
  hemi.intensity = 1.5;
  headlamp.color.setHex(theme.torch).lerp(new THREE.Color(0xffffff), 0.5);

  const st = data.start;
  player.pos.x = (st.cx + 0.5) * CELL; player.pos.z = (st.cy + 0.5) * CELL;
  // look toward the nearest open direction
  let best = 0, bd = -1;
  for (let a = 0; a < 8; a++) {
    const yaw = (a / 8) * Math.PI * 2;
    const d = data.rayWall(player.pos.x, player.pos.z, -Math.sin(yaw), -Math.cos(yaw), 60);
    if (d > bd) { bd = d; best = yaw; }
  }
  player.yaw = best; player.pitch = 0;
  seen = new Uint8Array(data.w * data.h);

  // enemies
  const count = Math.min(4 + n * 3, 34);
  const rooms = data.rooms.filter((r) => r !== st);
  const hpScale = 1 + 0.07 * (n - 1);
  for (let i = 0; i < count; i++) {
    const room = rooms[Math.floor(data.rand() * rooms.length)];
    const p = data.randomFloorIn(room);
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 10) continue;
    const r = data.rand();
    const bruteP = n < 2 ? 0 : Math.min(0.12 + n * 0.03, 0.3);
    const kind = r < bruteP ? 'brute' : r < bruteP + 0.18 ? 'skull' : 'imp';
    enemies.push(new Enemy(kind, p.x, p.z, scene, hpScale));
  }
  totalLeft = enemies.length;

  // pickups
  for (const room of data.rooms) {
    const reps = room === st ? 0 : data.rand() < 0.6 ? 1 : 0;
    for (let k = 0; k < reps; k++) {
      const p = data.randomFloorIn(room);
      const r = data.rand();
      spawnPickup(r < 0.4 ? 'health' : r < 0.75 ? 'cells' : 'shells', p.x, p.z);
    }
  }
  el.lvl.textContent = `Niv. ${n} · ${theme.name}`;
  showBanner(`Niveau ${n}`, theme.name);
  updateHud();
}

function newGame() {
  player.hp = 100; player.ammo.cells = 90; player.ammo.shells = 12;
  player.dmgT = 0; player.deadT = 0; player.cool = 0; player.vx = player.vz = 0;
  score = 0; kills = 0;
  rig.show(0); rig.next = -1;
  startLevel(1);
}

// ---------------------------------------------------------------- combat helpers
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const sparkOrange = new THREE.Color(0xffa040), sparkCyan = new THREE.Color(0x60e0ff), dust = new THREE.Color(0x887766), gore = new THREE.Color(0xff3010);

function hurtPlayer(amount, from) {
  if (state !== 'playing') return;
  player.hp -= amount;
  player.dmgT = Math.min(1, player.dmgT + 0.5 + amount / 40);
  player.shake = Math.min(0.06, player.shake + amount * 0.002);
  audio.hurt();
  if (player.hp <= 0) die();
  updateHud();
}

function killEnemy(e, byPlayer) {
  if (byPlayer) { score += e.t.score * levelNo; kills++; }
  else kills++;
  totalLeft--;
  audio.enemyDie(e.kind === 'brute');
  particles.burst(e.pos.x, e.t.cy, e.pos.z, e.kind === 'brute' ? 40 : 24, gore, 5, 0.22, 0.8, 9);
  particles.burst(e.pos.x, e.t.cy, e.pos.z, 10, sparkOrange, 7, 0.14, 0.5, 9);
  if (Math.random() < (e.kind === 'brute' ? 0.9 : 0.35)) {
    const r = Math.random();
    const need = player.hp < 60 ? 0.5 : 0.2;
    spawnPickup(r < need ? 'health' : r < 0.7 ? 'cells' : 'shells', e.pos.x, e.pos.z);
  }
  if (totalLeft <= 0) {
    view.unlockExit(); audio.unlock();
    showBanner('Sortie ouverte', 'Rejoignez le portail vert', 3600);
  }
  updateHud();
}

function explode(e) {
  e.dead = true; e.deadT = 0; e.hp = 0;
  audio.explode();
  particles.burst(e.pos.x, 1.3, e.pos.z, 36, sparkOrange, 8, 0.3, 0.7, 4);
  particles.burst(e.pos.x, 1.3, e.pos.z, 14, gore, 5, 0.4, 0.9, 2);
  if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 2.4) hurtPlayer(16, e.pos);
  killEnemy(e, false);
}

function spawnFireball(x, y, z, dx, dy, dz) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(fireGeo, fireMat));
  const s = new THREE.Sprite(fireGlowMat); s.scale.set(1.4, 1.4, 1); g.add(s);
  g.position.set(x, y, z);
  scene.add(g);
  const sp = 9 + Math.min(levelNo, 8) * 0.5;
  projectiles.push({ mesh: g, x, y, z, vx: dx * sp, vy: dy * sp, vz: dz * sp, life: 5 });
  audio.fireball();
}

Object.assign(ctx, { level: null, hurtPlayer, spawnFireball, explode });

function alertEnemies(radius) {
  for (const e of enemies) {
    if (e.dead || e.state !== 'idle') continue;
    if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < radius) e.state = 'chase';
  }
}

function shoot() {
  const w = WEAPONS[rig.cur];
  player.ammo[w.ammo]--;
  player.cool = w.rate;
  audio[w.id === 'rifle' ? 'rifle' : 'shotgun']();
  rig.fire();
  player.pitch += w.kick * 0.35;
  player.shake = Math.min(0.06, player.shake + w.shake);
  headlamp.intensity = 70;
  alertEnemies(26);

  _o.set(player.pos.x, EYE, player.pos.z);
  const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
  _f.set(-Math.sin(player.yaw) * cp, sp, -Math.cos(player.yaw) * cp);
  _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  _u.crossVectors(_r, _f).normalize();
  // muzzle position for tracers
  const mx = _o.x + _f.x * 0.5 + _r.x * 0.18, my = _o.y + _f.y * 0.5 - 0.12, mz = _o.z + _f.z * 0.5 + _r.z * 0.18;
  const col = w.id === 'rifle' ? sparkCyan : sparkOrange;
  let hitAny = false, killed = false;

  for (let p = 0; p < w.pellets; p++) {
    const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * w.spread;
    _d.copy(_f).addScaledVector(_r, Math.cos(ang) * rad).addScaledVector(_u, Math.sin(ang) * rad).normalize();

    let tMax = data.rayWall(_o.x, _o.z, _d.x, _d.z, 70);
    if (_d.y < -1e-4) tMax = Math.min(tMax, -_o.y / _d.y);
    if (_d.y > 1e-4) tMax = Math.min(tMax, (WALL_H - _o.y) / _d.y);
    if (!isFinite(tMax)) tMax = 70;

    let bestT = tMax, bestE = null, bestHead = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const sph = HIT[e.kind];
      for (let s = 0; s < sph.length; s++) {
        const ocx = e.pos.x - _o.x, ocy = sph[s][0] - _o.y, ocz = e.pos.z - _o.z;
        const tca = ocx * _d.x + ocy * _d.y + ocz * _d.z;
        if (tca < 0) continue;
        const d2 = ocx * ocx + ocy * ocy + ocz * ocz - tca * tca, r = sph[s][1];
        if (d2 > r * r) continue;
        const t = tca - Math.sqrt(r * r - d2);
        if (t < bestT) { bestT = Math.max(0, t); bestE = e; bestHead = s === sph.length - 1 && sph.length > 1; }
      }
    }
    const hx = _o.x + _d.x * bestT, hy = _o.y + _d.y * bestT, hz = _o.z + _d.z * bestT;
    // tracer
    const steps = Math.min(10, Math.floor(bestT / 2));
    if (p < 3) for (let s = 0; s < steps; s++) {
      const k = (s + 1) / (steps + 1);
      particles.emit(mx + (hx - mx) * k, my + (hy - my) * k, mz + (hz - mz) * k, 0, 0, 0, col, 0.03, 0.07, 0);
    }
    if (bestE) {
      hitAny = true;
      const dmg = w.dmg * (bestHead ? 1.6 : 1);
      particles.burst(hx, hy, hz, 5, gore, 3.5, 0.1, 0.35, 8);
      particles.burst(hx, hy, hz, 2, sparkOrange, 4, 0.08, 0.25, 8);
      if (bestE.damage(dmg)) { killEnemy(bestE, true); killed = true; }
      else audio.enemyHurt();
    } else {
      particles.burst(hx, hy, hz, 4, col, 3, 0.07, 0.3, 9);
      particles.burst(hx, hy, hz, 3, dust, 1.5, 0.18, 0.5, 0);
    }
  }
  if (hitAny) {
    audio.hit();
    el.cross.classList.add('hit');
    clearTimeout(shoot.t); shoot.t = setTimeout(() => el.cross.classList.remove('hit'), killed ? 220 : 90);
  }
  updateHud();
}

function die() {
  state = 'dead'; player.deadT = 0; audio.die();
  input.releaseLock();
  input.fire = false;
  best = Math.max(best, score);
  try { localStorage.setItem('hellbound-best', best); } catch {}
}

// ---------------------------------------------------------------- update
function updatePlayer(dt, cmd) {
  player.yaw -= cmd.lookX;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - cmd.lookY));
  // pitch springs back a little from recoil
  const sp = cmd.sprint && cmd.y > 0.2 ? 8.2 : 5.4;
  const fx_ = -Math.sin(player.yaw), fz_ = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const tvx = (fx_ * cmd.y + rx * cmd.x) * sp, tvz = (fz_ * cmd.y + rz * cmd.x) * sp;
  const a = 1 - Math.exp(-dt * 14);
  player.vx += (tvx - player.vx) * a; player.vz += (tvz - player.vz) * a;
  data.move(player.pos, player.vx * dt, player.vz * dt, PLAYER_R);
  player.speed = Math.hypot(player.vx, player.vz);
  player.bobT += dt * player.speed * 1.9;

  // weapon switching
  if (cmd.swap) {
    let target = cmd.swap === -1 ? (rig.cur + 1) % WEAPONS.length : cmd.swap - 1;
    if (target >= 0 && target < WEAPONS.length && target !== rig.cur) { rig.switchTo(target); audio.swap(); }
  }
  player.cool -= dt;
  const w = WEAPONS[rig.cur];
  if (cmd.fire && player.cool <= 0 && rig.next < 0) {
    if (player.ammo[w.ammo] > 0) {
      shoot();
      if (!w.auto) input.fire = input.touch ? input.fire : false; // semi-auto: one shot per click
    } else {
      audio.empty(); player.cool = 0.3;
      const other = WEAPONS.findIndex((x, i) => i !== rig.cur && player.ammo[x.ammo] > 0);
      if (other >= 0) { rig.switchTo(other); audio.swap(); }
    }
  }
}

function updateWorld(dt) {
  data.updateFlow(player.pos.x, player.pos.z);
  ctx.level = data;
  for (const e of enemies) e.update(dt, ctx);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) { enemies[i].dispose(scene); enemies.splice(i, 1); }

  // fireballs
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.mesh.position.set(p.x, p.y, p.z);
    particles.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, sparkOrange, 0.2, 0.3, 0);
    let boom = p.life <= 0 || p.y < 0.05 || p.y > WALL_H || data.isWall(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    if (!boom && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 0.6 && p.y > 0.1 && p.y < 2.0) {
      hurtPlayer(12, p); boom = true;
    }
    if (boom) {
      particles.burst(p.x, p.y, p.z, 14, sparkOrange, 5, 0.18, 0.5, 6);
      particles.burst(p.x, p.y, p.z, 6, gore, 3, 0.3, 0.5, 0);
      scene.remove(p.mesh); projectiles.splice(i, 1);
    }
  }

  // pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.phase += dt * 2.5;
    p.mesh.position.y = 0.7 + Math.sin(p.phase) * 0.1;
    p.body.rotation.y += dt * 2;
    if ((p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2 > 1.3) continue;
    let ok = false;
    if (p.kind === 'health' && player.hp < 100) { player.hp = Math.min(100, player.hp + 25); ok = true; player.healT = 1; }
    if (p.kind === 'cells' && player.ammo.cells < MAX_AMMO.cells) { player.ammo.cells = Math.min(MAX_AMMO.cells, player.ammo.cells + 36); ok = true; }
    if (p.kind === 'shells' && player.ammo.shells < MAX_AMMO.shells) { player.ammo.shells = Math.min(MAX_AMMO.shells, player.ammo.shells + 6); ok = true; }
    if (ok) {
      audio.pickup();
      particles.burst(p.x, 0.8, p.z, 12, new THREE.Color(pickupCol[p.kind]), 3, 0.12, 0.5, 2);
      scene.remove(p.mesh); pickups.splice(i, 1); updateHud();
    }
  }

  // exit
  if (view.exit.unlocked && Math.hypot(view.exit.x - player.pos.x, view.exit.z - player.pos.z) < 1.4) nextLevel();
}

function nextLevel() {
  if (state !== 'playing') return;
  state = 'transition';
  audio.portal();
  el.fade.classList.add('on');
  setTimeout(() => {
    player.hp = Math.min(100, player.hp + 30);
    player.ammo.cells = Math.min(MAX_AMMO.cells, player.ammo.cells + 40);
    player.ammo.shells = Math.min(MAX_AMMO.shells, player.ammo.shells + 8);
    startLevel(levelNo + 1);
    el.fade.classList.remove('on');
    state = 'playing';
  }, 700);
}

// ---------------------------------------------------------------- minimap
const mctx = el.mini.getContext('2d');
function drawMinimap() {
  const S = el.mini.width, R = 11, cs = S / (R * 2 + 1);
  const pcx = player.pos.x / CELL, pcz = player.pos.z / CELL;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx + dz * dz > 10) continue;
    const x = Math.floor(pcx) + dx, z = Math.floor(pcz) + dz;
    if (x >= 0 && z >= 0 && x < data.w && z < data.h) seen[z * data.w + x] = 1;
  }
  mctx.clearRect(0, 0, S, S);
  const ox = pcx - (R + 0.5), oz = pcz - (R + 0.5);
  for (let j = 0; j <= R * 2 + 1; j++) for (let i = 0; i <= R * 2 + 1; i++) {
    const x = Math.floor(ox) + i, z = Math.floor(oz) + j;
    if (x < 0 || z < 0 || x >= data.w || z >= data.h || !seen[z * data.w + x]) continue;
    mctx.fillStyle = data.isWall(x, z) ? 'rgba(255,255,255,.28)' : 'rgba(255,120,60,.2)';
    mctx.fillRect((x - ox) * cs, (z - oz) * cs, cs + 0.5, cs + 0.5);
  }
  const dot = (wx, wz, color, r) => {
    const x = (wx / CELL - ox) * cs, y = (wz / CELL - oz) * cs;
    if (x < 0 || y < 0 || x > S || y > S) return;
    mctx.fillStyle = color; mctx.beginPath(); mctx.arc(x, y, r, 0, 7); mctx.fill();
  };
  const ex = view.exit;
  dot(ex.x, ex.z, ex.unlocked ? '#3dffb0' : '#ff3030', 7);
  for (const e of enemies) if (!e.dead && seen[Math.floor(e.pos.z / CELL) * data.w + Math.floor(e.pos.x / CELL)]) dot(e.pos.x, e.pos.z, '#ff4020', 5);
  mctx.save();
  mctx.translate(S / 2, S / 2); mctx.rotate(-player.yaw);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -10); mctx.lineTo(7, 8); mctx.lineTo(-7, 8); mctx.closePath(); mctx.fill();
  mctx.restore();
}

// ---------------------------------------------------------------- flow control
const screens = { menu: $('#menu'), pause: $('#pause'), over: $('#over') };
function showScreen(name) { for (const k in screens) screens[k].classList.toggle('show', k === name); }

function beginPlay() {
  audio.init();
  if (mobile) {
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    screen.orientation?.lock?.('landscape').catch(() => {});
  } else input.requestLock();
  showScreen(null);
  document.body.classList.add('playing');
  state = 'playing';
}

$('#start').addEventListener('click', () => { newGame(); beginPlay(); });
$('#retry').addEventListener('click', () => { newGame(); beginPlay(); });
$('#resume').addEventListener('click', () => { if (state === 'paused') beginPlay(); });
$('#pause').addEventListener('click', () => { if (state === 'paused') beginPlay(); });
input.onLockChange = (locked) => {
  if (!locked && state === 'playing') pause();
};
function pause() {
  if (state !== 'playing') return;
  state = 'paused'; input.fire = false; showScreen('pause');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { const m = audio.toggleMute(); showBanner(m ? 'Son coupé' : 'Son activé', '', 900); }
  if (e.code === 'KeyP' && state === 'playing') { input.releaseLock(); if (input.touch) pause(); }
});
canvas.addEventListener('click', () => { if (state === 'paused' && !input.touch) beginPlay(); });

// ---------------------------------------------------------------- main loop
let last = performance.now(), emaMs = 16, lowFrames = 0, hudT = 0, miniT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000; last = now;
  const dt = Math.min(0.05, rawDt);
  time += dt;

  // adaptive resolution
  emaMs += (rawDt * 1000 - emaMs) * 0.05;
  if (state === 'playing' && emaMs > 26 && pixelRatio > 0.6) { if (++lowFrames > 40) { pixelRatio = Math.max(0.6, pixelRatio - 0.15); resize(); lowFrames = 0; emaMs = 16; } }
  else lowFrames = 0;

  const dmgTarget = Math.max(0, player.dmgT);
  if (state === 'playing') {
    const cmd = input.poll();
    updatePlayer(dt, cmd);
    updateWorld(dt);
  } else if (state === 'menu') {
    player.yaw += dt * 0.12;
    input.poll();
  } else if (state === 'dead') {
    player.deadT += dt;
    updateWorld(dt * 0.6);
    input.poll();
    if (player.deadT > 1.6 && !screens.over.classList.contains('show')) {
      $('#o-lvl').textContent = levelNo; $('#o-kills').textContent = kills; $('#o-score').textContent = score;
      $('#over-tag').textContent = score >= best && score > 0 ? 'Nouveau record !' : `Meilleur score : ${best}`;
      document.body.classList.remove('playing');
      showScreen('over');
    }
  } else input.poll();

  // camera
  const bob = player.speed > 0.5 ? Math.sin(player.bobT * 1.0) * 0.045 : 0;
  const dead = state === 'dead' ? Math.min(1, player.deadT * 1.5) : 0;
  const shk = player.shake;
  camera.position.set(player.pos.x, EYE + bob - dead * 1.1, player.pos.z);
  camera.rotation.set(
    player.pitch + (Math.random() - 0.5) * shk - dead * 0.3,
    player.yaw + (Math.random() - 0.5) * shk,
    dead * 0.9 + Math.sin(player.bobT * 0.5) * 0.004 * Math.min(1, player.speed),
  );
  player.shake *= Math.pow(0.002, dt);

  rig.update(dt, player.speed, time);
  headlamp.intensity += (14 - headlamp.intensity) * Math.min(1, dt * 18);
  view.update(dt, time, player.pos);
  particles.update(dt);

  player.dmgT = Math.max(0, player.dmgT - dt * 1.1);
  player.healT = Math.max(0, player.healT - dt * 2);
  fx.grade.uniforms.time.value = time;
  fx.grade.uniforms.damage.value = state === 'dead' ? 0.8 : dmgTarget * 0.9 + (player.hp < 30 ? (0.18 + 0.12 * Math.sin(time * 6)) * (1 - player.hp / 30) : 0);
  fx.grade.uniforms.flash.value = Math.max(0, headlamp.intensity - 14) / 56;
  fx.grade.uniforms.heal.value = player.healT;

  miniT -= dt;
  if (miniT <= 0 && (state === 'playing')) { miniT = 0.1; drawMinimap(); }
  hudT -= dt;
  if (hudT <= 0) { hudT = 0.25; updateHud(); }

  fx.composer.render(dt);
}

// boot
startLevel(1);
$('#best').textContent = best ? `Meilleur score : ${best}` : '';
requestAnimationFrame(frame);

// debugging / automated tests
window.__game = {
  get state() { return state; }, player, get enemies() { return enemies; }, get data() { return data; }, get view() { return view; },
  startLevel, newGame, shoot, setState: (s) => (state = s), get totalLeft() { return totalLeft; },
};
