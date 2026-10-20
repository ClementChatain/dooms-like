import * as THREE from 'three';
import { toonGradient } from './textures.js';

export const TYPES = {
  imp:   { hp: 40,  speed: 2.6, radius: 0.5,  cy: 1.0, height: 1.9, score: 100 },
  brute: { hp: 150, speed: 3.3, radius: 0.85, cy: 1.35, height: 2.7, score: 300 },
  skull: { hp: 18,  speed: 5.2, radius: 0.38, cy: 1.35, height: 1.6, score: 60 },
  boss:  { hp: 900, speed: 3.0, radius: 1.3,  cy: 2.2, height: 4.4, score: 5000 },
};

const WHITE = 0xffffff;
const inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide });

function mat(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive: 0x000000, ...extra });
}

/** Contour "dessiné" : on double chaque maillage toon par une coque inversée, légèrement grossie. */
function outlined(g, k = 0.07) {
  const list = [];
  g.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) list.push(o); });
  for (const m of list) {
    const ol = new THREE.Mesh(m.geometry, inkMat);
    ol.scale.setScalar(1 + k);
    m.add(ol);
  }
}

/** Grands yeux de dessin animé : blanc + iris colorée + reflet. Regardent vers -z. */
function eyes(g, y, spread, z, r, iris) {
  const white = new THREE.MeshBasicMaterial({ color: WHITE });
  const pupil = new THREE.MeshBasicMaterial({ color: new THREE.Color(iris).multiplyScalar(1.6) });
  const shine = new THREE.MeshBasicMaterial({ color: WHITE });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), white);
    w.position.set(sx * spread, y, z); w.scale.set(1, 1.25, 0.55);
    const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 12, 8), pupil);
    p.position.set(sx * spread, y - r * 0.05, z - r * 0.3); p.scale.set(1, 1.2, 0.5);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 6), shine);
    sh.position.set(sx * spread + r * 0.18, y + r * 0.3, z - r * 0.5);
    g.add(w, p, sh);
  }
}

/** Ornement de tête propre à chaque monde. Centré sur la tête, rayon r. */
function crest(kind, r, t) {
  const g = new THREE.Group(), body = mat(t.accent);
  for (const sx of [-1, 1]) {
    if (kind === 'horns') {
      const h = new THREE.Mesh(new THREE.ConeGeometry(r * 0.25, r * 1.3, 10), body);
      h.position.set(sx * r * 0.65, r * 0.95, 0); h.rotation.z = -sx * 0.4; g.add(h);
    } else if (kind === 'ears') {
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.26, r * 1.1, 4, 10), mat(t.tint));
      e.position.set(sx * r * 0.75, r * 1.25, 0); e.rotation.z = -sx * 0.35; g.add(e);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.12, r * 0.8, 4, 8), body);
      inner.position.set(sx * r * 0.75, r * 1.25, -r * 0.1); inner.rotation.z = -sx * 0.35; g.add(inner);
    }
  }
  if (kind === 'antenna') {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 1.2, 6), body);
    stalk.position.y = r * 1.4;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(t.eye).multiplyScalar(2) }));
    tip.position.y = r * 2.05;
    g.add(stalk, tip);
  } else if (kind === 'flame') {
    for (const [x, h] of [[-0.45, 0.9], [0, 1.3], [0.45, 0.9]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, r * h, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(t.accent).multiplyScalar(1.5) }));
      f.position.set(x * r, r * (0.9 + h * 0.3), 0); g.add(f);
    }
  }
  return g;
}

function buildImp(t) {
  const g = new THREE.Group(), body = mat(t.tint), parts = { mats: [body] };
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 6, 14), body);
  torso.position.y = 1.1; torso.scale.set(1.1, 1, 0.9);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(t.accent));
  belly.position.set(0, 1.05, -0.22); belly.scale.set(1, 1.1, 0.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), body);
  head.position.y = 1.72;
  head.add(crest(t.crest, 0.34, t));
  g.add(torso, belly, head);
  eyes(g, 1.76, 0.13, -0.28, 0.1, t.eye);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0x2a0a18 }));
  mouth.position.set(0, 1.6, -0.32); g.add(mouth);
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.45, 1.45, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), body);
    arm.position.y = -0.3; a.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(t.accent));
    hand.position.y = -0.68; a.add(hand);
    g.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.2, 0.7, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 4, 8), body);
    leg.position.y = -0.3; l.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(t.accent));
    foot.position.set(0, -0.62, -0.05); foot.scale.set(1, 0.6, 1.3); l.add(foot);
    g.add(l); legs.push(l);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(t.eye).multiplyScalar(2.5) }));
  ball.position.set(0.45, 0.9, -0.42); ball.visible = false; g.add(ball);
  outlined(g);
  Object.assign(parts, { arms, legs, ball, head });
  return { g, parts };
}

function buildBrute(t) {
  const g = new THREE.Group(), body = mat(t.tint), parts = { mats: [body] };
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 0.65, 6, 16), body);
  torso.position.y = 1.5; torso.scale.set(1.25, 1, 1);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), mat(t.accent));
  belly.position.set(0, 1.4, -0.4); belly.scale.set(1, 1.1, 0.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), body);
  head.position.y = 2.32; head.scale.set(1.15, 0.95, 1);
  head.add(crest(t.crest, 0.4, t));
  g.add(torso, belly, head);
  eyes(g, 2.36, 0.17, -0.36, 0.12, t.eye);
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.88, 1.95, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.65, 4, 10), body);
    arm.position.y = -0.5; a.add(arm);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat(t.accent));
    fist.position.y = -1.08; a.add(fist);
    g.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.36, 0.95, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), body);
    leg.position.y = -0.4; l.add(leg); g.add(l); legs.push(l);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(t.eye).multiplyScalar(2.5) }));
  core.position.set(0, 1.75, -0.58); g.add(core);
  outlined(g);
  Object.assign(parts, { arms, legs, head, core });
  return { g, parts };
}

function buildSkull(t) {
  const g = new THREE.Group(), body = mat(t.tint), parts = { mats: [body] };
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), body);
  skull.position.y = 1.35;
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(t.accent));
  jaw.position.set(0, 1.02, -0.18); jaw.scale.set(1.3, 0.5, 1);
  g.add(skull, jaw);
  // petites épines tout autour : c'est une bombe vivante
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), mat(t.accent));
    sp.position.set(Math.cos(a) * 0.4, 1.35 + Math.sin(a * 2) * 0.1, Math.sin(a) * 0.4);
    sp.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
    g.add(sp);
  }
  eyes(g, 1.42, 0.15, -0.34, 0.11, t.eye);
  outlined(g, 0.08);
  Object.assign(parts, { jaw, skull });
  return { g, parts };
}

function buildBoss(t) {
  const g = new THREE.Group(), body = mat(t.tint), parts = { mats: [body] };
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 0.9, 8, 18), body);
  torso.position.y = 1.9; torso.scale.set(1.2, 1, 1.05);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), mat(t.accent));
  belly.position.set(0, 1.75, -0.78); belly.scale.set(1, 1.1, 0.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), body);
  head.position.y = 3.55; head.scale.set(1.2, 1, 1);
  head.add(crest(t.crest, 0.75, t));
  // couronne
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 8), mat(t.accent));
    sp.position.set(Math.cos(a) * 0.5, 0.78, Math.sin(a) * 0.5 - 0.1);
    head.add(sp);
  }
  g.add(torso, belly, head);
  eyes(g, 3.6, 0.3, -0.7, 0.2, t.eye);
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 1.45, 2.8, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 4, 10), body);
    arm.position.y = -0.8; a.add(arm);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), mat(t.accent));
    fist.position.y = -1.6; a.add(fist);
    g.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.6, 1.1, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 8), body);
    leg.position.y = -0.5; l.add(leg); g.add(l); legs.push(l);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(t.eye).multiplyScalar(2.5) }));
  core.position.set(0, 2.1, -1.05); g.add(core);
  outlined(g, 0.05);
  Object.assign(parts, { arms, legs, head, core });
  return { g, parts };
}

const BUILD = { imp: buildImp, brute: buildBrute, skull: buildSkull, boss: buildBoss };

export class Enemy {
  constructor(kind, x, z, scene, scaleHp = 1, skin = {}) {
    this.kind = kind;
    this.t = { ...TYPES[kind], ...skin };
    if (skin.hp) this.t.hp = skin.hp;
    this.flesh = new THREE.Color(this.t.tint).lerp(new THREE.Color(0xffffff), 0.25);
    const { g, parts } = BUILD[kind](this.t);
    this.group = g;
    this.group = g; this.parts = parts;
    this.pos = { x, z };
    this.hp = this.maxHp = Math.round(this.t.hp * scaleHp);
    this.state = 'idle';
    this.dead = false; this.deadT = 0; this.gone = false;
    this.cool = 1 + Math.random() * 1.5;
    this.wind = 0; this.phase = Math.random() * 10;
    this.flash = 0; this.yaw = Math.random() * 6.28;
    this.stuck = 0;
    this.group.position.set(x, 0, z);
    scene.add(g);
  }

  get cx() { return this.pos.x; }
  get cz() { return this.pos.z; }
  get cy() { return this.t.cy + (this.kind === 'skull' ? Math.sin(this.phase * 2) * 0.12 : 0); }

  damage(amount) {
    if (this.dead) return false;
    this.hp -= amount; this.flash = 0.12;
    if (this.state === 'idle') this.state = 'chase';
    if (this.hp <= 0) { this.dead = true; this.deadT = 0; return true; }
    return false;
  }

  update(dt, ctx) {
    const { player, level } = ctx;
    this.phase += dt * (this.kind === 'skull' ? 6 : 5);
    for (const m of this.parts.mats) m.emissive.setRGB(this.flash * 6, this.flash * 3, this.flash * 2);
    if (this.flash > 0) this.flash -= dt;

    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.5);
      if (this.kind === 'skull') { this.group.scale.setScalar(Math.max(0, 1 - k)); }
      else { this.group.rotation.x = -k * 1.5; this.group.position.y = -k * 0.15; }
      if (this.deadT > 2.2) this.group.scale.setScalar(Math.max(0, 1 - (this.deadT - 2.2) * 2));
      if (this.deadT > 2.7) this.gone = true;
      return;
    }

    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const los = level.hasLOS(this.pos.x, this.pos.z, player.pos.x, player.pos.z);

    if (this.state === 'idle') {
      if ((los && dist < 20) || dist < 4) { this.state = 'chase'; ctx.audio.roar?.(); }
      this.animate(dt, 0, dist);
      return;
    }

    // face player
    const want = Math.atan2(-dx, -dz);
    let da = want - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    this.yaw += da * Math.min(1, dt * 8);

    let tx, tz, speed = this.t.speed;
    if (los) { tx = player.pos.x; tz = player.pos.z; }
    else {
      const s = level.nextStep(this.pos.x, this.pos.z);
      if (s) [tx, tz] = s; else { tx = player.pos.x; tz = player.pos.z; }
    }
    let mx = tx - this.pos.x, mz = tz - this.pos.z;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    let moveAmt = speed;

    this.cool -= dt;
    if (this.kind === 'imp') {
      if (los && dist < 15) {
        // keep distance, strafe
        if (dist < 7) { mx = -dx / dist; mz = -dz / dist; moveAmt = speed * 0.8; }
        else if (dist < 11) { const s = Math.sin(this.phase * 0.35) > 0 ? 1 : -1; mx = -dz / dist * s; mz = dx / dist * s; moveAmt = speed * 0.7; }
        if (this.wind > 0) { this.wind -= dt; moveAmt = 0; if (this.wind <= 0) { this.fire(ctx, dx, dz, dist); } }
        else if (this.cool <= 0 && dist > 3) { this.wind = 0.55; this.cool = 1.8 + Math.random() * 1.6; this.parts.ball.visible = true; }
      } else { this.parts.ball.visible = false; this.wind = 0; }
    } else if (this.kind === 'brute') {
      if (dist < 2.1) {
        moveAmt = 0;
        if (this.wind > 0) { this.wind -= dt; if (this.wind <= 0) { if (dist < 2.5) ctx.hurtPlayer(18, this.pos); this.cool = 1.1; } }
        else if (this.cool <= 0) this.wind = 0.45;
      } else this.wind = 0;
      if (los && dist > 6 && dist < 12 && this.cool <= 0 && Math.random() < dt * 0.35) { this.cool = 2; moveAmt = speed * 2.2; }
    } else if (this.kind === 'skull') {
      moveAmt = speed * (0.85 + 0.3 * Math.sin(this.phase * 0.5));
      if (dist < 1.1) { ctx.explode(this); return; }
    } else if (this.kind === 'boss') {
      const ph = this.phaseNo();
      moveAmt = speed * (0.8 + 0.15 * ph);
      if (los && dist < 24) {
        if (dist < 7) { mx = -dx / dist; mz = -dz / dist; moveAmt = speed * 0.9; }
        else if (dist < 14) { const k = Math.sin(this.phase * 0.25) > 0 ? 1 : -1; mx = -dz / dist * k; mz = dx / dist * k; moveAmt = speed * 0.8; }
        if (this.wind > 0) { this.wind -= dt; moveAmt = 0; if (this.wind <= 0) this.bossAttack(ctx, dx, dz, dist, ph); }
        else if (this.cool <= 0) { this.wind = 0.9 - 0.1 * ph; this.cool = 3.2 - 0.55 * ph + Math.random() * 0.8; }
      } else this.wind = 0;
    }

    const step = moveAmt * dt;
    level.move(this.pos, mx * step, mz * step, this.t.radius * 0.8);
    // separation
    for (const o of ctx.enemies) {
      if (o === this || o.dead) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, d2 = ox * ox + oz * oz, r = this.t.radius + o.t.radius;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = (r - d) * 0.5;
        level.move(this.pos, (ox / d) * push, (oz / d) * push, this.t.radius * 0.8);
      }
    }
    this.animate(dt, moveAmt / speed, dist);
  }

  /** 1 → 3 selon les points de vie restants : chaque phase ajoute une attaque. */
  phaseNo() { const r = this.hp / this.maxHp; return r > 0.66 ? 1 : r > 0.33 ? 2 : 3; }

  bossAttack(ctx, dx, dz, dist, ph) {
    const sy = 2.3, base = Math.atan2(dx, dz);
    this.atk = (this.atk ?? 0) + 1;
    const shoot = (ang) => {
      const ddx = Math.sin(ang), ddz = Math.cos(ang);
      ctx.spawnFireball(this.pos.x, sy, this.pos.z, ddx * 0.97, (1.2 - sy) / 14, ddz * 0.97);
    };
    if (ph >= 3 && this.atk % 3 === 0) { for (let i = 0; i < 14; i++) shoot((i / 14) * Math.PI * 2); return; } // anneau
    const n = ph === 1 ? 1 : ph === 2 ? 2 : 3;
    for (let i = -n; i <= n; i++) shoot(base + i * 0.2); // éventail
    if (ph >= 2 && this.atk % 2 === 0) { // renforts
      for (const sx of [-1, 1]) ctx.spawnMinion('skull', this.pos.x + sx * 2.2, this.pos.z);
    }
  }

  fire(ctx, dx, dz, dist) {
    this.parts.ball.visible = false;
    const sy = this.cy + 0.2;
    const ty = 1.2 + (Math.random() - 0.5) * 0.3;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy, dz);
    ctx.spawnFireball(this.pos.x, sy, this.pos.z, dx / len, dy / len, dz / len);
  }

  animate(dt, moving, dist) {
    const g = this.group;
    g.position.set(this.pos.x, 0, this.pos.z);
    g.rotation.y = this.yaw;
    const p = this.parts, sw = Math.sin(this.phase * 1.6) * 0.7 * moving;
    if (p.legs) { p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw; }
    if (p.arms) {
      if (this.kind === 'brute' && this.wind > 0) { p.arms[0].rotation.x = p.arms[1].rotation.x = -2.4 + (0.45 - this.wind) * 5; }
      else if (this.kind === 'imp' && this.wind > 0) { p.arms[1].rotation.x = -1.4; p.arms[0].rotation.x = 0; }
      else { p.arms[0].rotation.x = -sw * 0.8; p.arms[1].rotation.x = sw * 0.8; }
    }
    if (p.head && this.kind !== 'skull') p.head.rotation.z = Math.sin(this.phase * 0.8) * 0.06;
    if (this.kind === 'skull') {
      g.position.y = Math.sin(this.phase * 2) * 0.12;
      p.jaw.rotation.x = Math.sin(this.phase * 3) * 0.3 + 0.25;
      g.rotation.z = Math.sin(this.phase) * 0.12;
    } else g.position.y = Math.abs(Math.sin(this.phase * 1.6)) * 0.05 * moving;
    if (this.kind === 'boss' && this.wind > 0) { p.arms[0].rotation.x = p.arms[1].rotation.x = -2.6; }
    if (p.core) p.core.scale.setScalar(1 + Math.sin(this.phase * 2) * 0.2 + (this.kind === 'boss' && this.wind > 0 ? 0.8 : 0));
    if (p.ball?.visible) p.ball.scale.setScalar(0.6 + (0.55 - this.wind) * 1.4);
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.parts.mats) m.dispose();
  }
}
