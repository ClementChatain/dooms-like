import * as THREE from 'three';

const metal = (c = 0x2b2e35) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.32 });
const glow = (c, i = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) });

export const WEAPONS = [
  { id: 'rifle',   name: 'FUSIL À PLASMA', ammo: 'cells',  rate: 0.095, dmg: 14, pellets: 1, spread: 0.012, auto: true,  kick: 0.035, shake: 0.004, color: 0x40d8ff },
  { id: 'shotgun', name: 'FUSIL À POMPE',  ammo: 'shells', rate: 0.85,  dmg: 11, pellets: 9, spread: 0.075, auto: false, kick: 0.12,  shake: 0.02,  color: 0xffa040 },
];

function buildRifle() {
  const g = new THREE.Group();
  const dark = metal(), light = metal(0x6a717c);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.34), dark); body.position.set(0, 0, 0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.3, 12), light); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.012, -0.28);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), dark); shroud.position.set(0, 0.005, -0.2);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.2), glow(0x40d8ff, 0.9)); cell.position.set(0, 0.062, -0.02);
  const coil1 = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 16), glow(0x40d8ff, 1.1)); coil1.position.set(0, 0.012, -0.22);
  const coil2 = coil1.clone(); coil2.position.z = -0.31;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), dark); grip.position.set(0, -0.1, 0.1); grip.rotation.x = 0.25;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), light); mag.position.set(0, -0.09, -0.04);
  g.add(body, barrel, shroud, cell, coil1, coil2, grip, mag);
  g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.46);
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  const dark = metal(0x23252a), light = metal(0x777d88);
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.6, metalness: 0.1 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 14), light);
    b.rotation.x = Math.PI / 2; b.position.set(sx * 0.024, 0.02, -0.28); g.add(b);
  }
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.5), dark); rib.position.set(0, 0.052, -0.28);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.2), dark); receiver.position.set(0, 0, 0.02);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), wood); pump.position.set(0, -0.03, -0.2); pump.name = 'pump';
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), wood); stock.position.set(0, -0.04, 0.2); stock.rotation.x = -0.12;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.014, 0.12), glow(0xffa040, 1.3)); stripe.position.set(0, 0.052, 0.04);
  g.add(rib, receiver, pump, stock, stripe);
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.56);
  return g;
}

/** First-person weapon rig attached to the camera. */
export class WeaponRig {
  constructor(camera, glowTex) {
    this.root = new THREE.Group();
    this.root.position.set(0.2, -0.19, -0.38);
    camera.add(this.root);
    this.models = [buildRifle(), buildShotgun()];
    this.models.forEach((m) => { m.visible = false; this.root.add(m); });
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.flash.renderOrder = 999; this.flash.visible = false;
    this.root.add(this.flash);
    this.cur = 0; this.next = -1;
    this.swapT = 0; // 0..1 lowering, then raising
    this.kick = 0; this.flashT = 0; this.bob = 0; this.pump = 0;
    this.show(0);
  }

  show(i) {
    this.cur = i;
    this.models.forEach((m, k) => (m.visible = k === i));
    this.flash.material.color.setHex(WEAPONS[i].color === 0x40d8ff ? 0x80e8ff : 0xffc060);
  }

  switchTo(i) { if (i !== this.cur && this.next < 0) { this.next = i; this.swapT = 0; } }

  fire() {
    this.kick = WEAPONS[this.cur].kick * 4;
    this.flashT = 0.06;
    if (this.cur === 1) this.pump = 1;
  }

  update(dt, speed, time) {
    this.kick = Math.max(0, this.kick - dt * 1.6 * (0.3 + this.kick * 10));
    this.flashT -= dt;
    const m = this.models[this.cur];
    this.flash.visible = this.flashT > 0;
    if (this.flash.visible) {
      this.flash.position.copy(m.userData.muzzle);
      this.flash.scale.setScalar(0.28 + Math.random() * 0.14);
      this.flash.material.rotation = Math.random() * 6;
    }
    let lower = 0;
    if (this.next >= 0) {
      this.swapT += dt * 4;
      lower = this.swapT < 1 ? this.swapT : 2 - this.swapT;
      if (this.swapT >= 1 && this.cur !== this.next) this.show(this.next);
      if (this.swapT >= 2) { this.next = -1; lower = 0; }
    }
    this.bob += dt * speed * 1.9;
    const bx = Math.sin(this.bob) * 0.012 * Math.min(1, speed / 3);
    const by = Math.abs(Math.cos(this.bob)) * 0.01 * Math.min(1, speed / 3);
    const idle = Math.sin(time * 1.5) * 0.002;
    this.root.position.set(0.2 + bx, -0.19 + by + idle - lower * 0.3, -0.38 + this.kick);
    this.root.rotation.x = this.kick * 1.5 - lower * 0.6;
    const pump = this.models[1].getObjectByName('pump');
    if (pump) { this.pump = Math.max(0, this.pump - dt * 1.6); pump.position.z = -0.2 + Math.sin(Math.min(1, this.pump) * Math.PI) * 0.1 * (this.pump > 0 ? 1 : 0); }
  }
}
