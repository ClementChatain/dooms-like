/** Unified keyboard/mouse + touch input. */
export const isTouch = () =>
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.touch = isTouch();
    this.keys = new Set();
    this.moveX = 0; this.moveY = 0; // -1..1 (y>0 = forward)
    this.lookX = 0; this.lookY = 0; // accumulated radians-ish pixel deltas
    this.fire = false;
    this.sprint = false;
    this.swapQueued = 0;
    this.locked = false;
    this.onLockChange = () => {};
    this.sens = this.touch ? 0.0048 : 0.0022;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Digit1') this.swapQueued = 1;
      if (e.code === 'Digit2') this.swapQueued = 2;
      if (e.code === 'KeyE') this.swapQueued = -1;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.fire = false; });
    addEventListener('wheel', (e) => { if (this.locked) this.swapQueued = e.deltaY > 0 ? 1 : 2; }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange(this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX * this.sens;
      this.lookY += e.movementY * this.sens;
    });
    canvas.addEventListener('mousedown', (e) => { if (this.locked && e.button === 0) this.fire = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());

    if (this.touch) this.setupTouch();
  }

  requestLock() {
    if (this.touch) return;
    const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  setupTouch() {
    const root = document.getElementById('touch');
    root.hidden = false;
    document.body.classList.add('is-touch');
    const joyZone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const lookZone = document.getElementById('look-zone');
    const fireBtn = document.getElementById('btn-fire');
    const swapBtn = document.getElementById('btn-swap');
    const R = 56;
    let joyId = null, jx = 0, jy = 0;

    joyZone.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId; joyZone.setPointerCapture(joyId);
      jx = e.clientX; jy = e.clientY;
      base.style.left = jx + 'px'; base.style.top = jy + 'px'; base.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - jx, dy = e.clientY - jy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.moveX = dx / R; this.moveY = -dy / R;
      this.sprint = len > R * 1.25;
    });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.moveX = this.moveY = 0; this.sprint = false; base.classList.remove('on');
    };
    joyZone.addEventListener('pointerup', joyEnd);
    joyZone.addEventListener('pointercancel', joyEnd);

    let lookId = null, lx = 0, ly = 0;
    lookZone.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId; lookZone.setPointerCapture(lookId); lx = e.clientX; ly = e.clientY;
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.lookX += (e.clientX - lx) * this.sens; this.lookY += (e.clientY - ly) * this.sens;
      lx = e.clientX; ly = e.clientY;
    });
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
    lookZone.addEventListener('pointerup', lookEnd);
    lookZone.addEventListener('pointercancel', lookEnd);

    fireBtn.addEventListener('pointerdown', (e) => { fireBtn.setPointerCapture(e.pointerId); this.fire = true; fireBtn.classList.add('on'); });
    const fireEnd = () => { this.fire = false; fireBtn.classList.remove('on'); };
    fireBtn.addEventListener('pointerup', fireEnd);
    fireBtn.addEventListener('pointercancel', fireEnd);
    swapBtn.addEventListener('pointerdown', () => { this.swapQueued = -1; });
    for (const el of root.querySelectorAll('*')) el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  /** Returns movement vector (x = strafe right, y = forward) from all sources. */
  poll() {
    let x = this.moveX, y = this.moveY;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD')) x += 1;
    if (k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight')) this.lookX += 0.03;
    if (k.has('ArrowLeft')) this.lookX -= 0.03;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const sprint = this.sprint || k.has('ShiftLeft') || k.has('ShiftRight');
    const lx = this.lookX, ly = this.lookY; this.lookX = this.lookY = 0;
    const swap = this.swapQueued; this.swapQueued = 0;
    return { x, y, sprint, lookX: lx, lookY: ly, fire: this.fire, swap };
  }
}
