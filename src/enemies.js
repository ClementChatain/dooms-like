import * as THREE from 'three';
import { makeSkin } from './textures.js';

const skins = {};
const skin = (hex) => (skins[hex] ??= makeSkin(hex));

export const TYPES = {
  imp:   { hp: 40,  speed: 2.6, radius: 0.5,  cy: 1.0, height: 1.9, score: 100, tint: '#6a2218', eye: 0xffa030 },
  brute: { hp: 150, speed: 3.3, radius: 0.85, cy: 1.35, height: 2.7, score: 300, tint: '#3d3a52', eye: 0x40ff70 },
  skull: { hp: 18,  speed: 5.2, radius: 0.38, cy: 1.35, height: 1.6, score: 60,  tint: '#d8d2c0', eye: 0x40c0ff },
};

function mat(type, extra = {}) {
  const s = skin(type.tint);
  return new THREE.MeshStandardMaterial({
    map: s.map, bumpMap: s.bump, bumpScale: 4, roughness: 0.55, metalness: 0.1,
    emissive: 0x000000, ...extra,
  });
}

function eyeMat(color) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4) });
}

function buildImp(t) {
  const g = new THREE.Group(), body = mat(t), parts = { mats: [body] };
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 12), body);
  torso.position.y = 1.15; torso.scale.set(1.1, 1, 0.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), body);
  head.position.y = 1.78; head.scale.set(1, 0.9, 1);
  const em = eyeMat(t.eye);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), em);
    eye.position.set(sx * 0.1, 1.82, -0.22); eye.scale.set(1.5, 0.8, 0.6); g.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 8), mat({ tint: '#d8d2c0' }));
    horn.position.set(sx * 0.17, 2.07, 0); horn.rotation.z = -sx * 0.35; g.add(horn);
  }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.16), new THREE.MeshBasicMaterial({ color: 0x220000 }));
  jaw.position.set(0, 1.68, -0.2); g.add(jaw);
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.42, 1.5, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), body);
    arm.position.y = -0.3; a.add(arm);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), mat({ tint: '#d8d2c0' }));
    claw.position.set(0, -0.72, -0.04); claw.rotation.x = Math.PI; a.add(claw);
    g.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.18, 0.7, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.45, 4, 8), body);
    leg.position.y = -0.3; l.add(leg); g.add(l); legs.push(l);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a20).multiplyScalar(3) }));
  ball.position.set(0.42, 1.0, -0.4); ball.visible = false; g.add(ball);
  g.add(torso, head);
  Object.assign(parts, { arms, legs, ball, head });
  return { g, parts };
}

function buildBrute(t) {
  const g = new THREE.Group(), body = mat(t), parts = { mats: [body] };
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 6, 14), body);
  torso.position.y = 1.55; torso.scale.set(1.25, 1, 0.95);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), body);
  head.position.y = 2.35; head.scale.set(1.1, 0.85, 1);
  const em = eyeMat(t.eye);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), em);
    eye.position.set(sx * 0.12, 2.38, -0.27); eye.scale.set(1.6, 0.7, 0.6); g.add(eye);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), mat({ tint: '#aaa0b8' }));
    spike.position.set(sx * 0.7, 2.15, 0.05); spike.rotation.z = -sx * 0.9; g.add(spike);
    const spike2 = spike.clone(); spike2.position.set(sx * 0.35, 2.62, 0.05); spike2.rotation.z = -sx * 0.3; spike2.scale.setScalar(0.8); g.add(spike2);
  }
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.85, 1.95, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), body);
    arm.position.y = -0.5; a.add(arm);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), body);
    fist.position.y = -1.05; a.add(fist);
    g.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.35, 0.95, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), body);
    leg.position.y = -0.4; l.add(leg); g.add(l); legs.push(l);
  }
  // glowing chest core
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), eyeMat(t.eye));
  core.position.set(0, 1.7, -0.5); g.add(core);
  g.add(torso, head);
  Object.assign(parts, { arms, legs, head, core });
  return { g, parts };
}

function buildSkull(t) {
  const g = new THREE.Group(), body = mat(t, { roughness: 0.4 }), parts = { mats: [body] };
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), body);
  skull.position.y = 1.35; skull.scale.set(1, 1.05, 1.1);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.26), body);
  jaw.position.set(0, 1.04, -0.15);
  const em = eyeMat(t.eye);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), em);
    eye.position.set(sx * 0.14, 1.42, -0.27); g.add(eye);
  }
  g.add(skull, jaw);
  Object.assign(parts, { jaw, skull });
  return { g, parts };
}

const BUILD = { imp: buildImp, brute: buildBrute, skull: buildSkull };

export class Enemy {
  constructor(kind, x, z, scene, scaleHp = 1) {
    this.kind = kind;
    this.t = TYPES[kind];
    const { g, parts } = BUILD[kind](this.t);
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
    if (p.core) p.core.scale.setScalar(1 + Math.sin(this.phase * 2) * 0.2);
    if (p.ball?.visible) p.ball.scale.setScalar(0.6 + (0.55 - this.wind) * 1.4);
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.parts.mats) m.dispose();
  }
}
