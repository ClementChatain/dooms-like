/** Tiny procedural audio engine (WebAudio). No asset files needed. */
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.35; this.music.connect(this.master);
    // shared noise buffer
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  noise(dur, { type = 'lowpass', f0 = 2000, f1 = 200, vol = 0.5, attack = 0.002, delay = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest ?? this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(freq0, freq1, dur, { type = 'sine', vol = 0.4, delay = 0, dest } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  rifle() {
    this.noise(0.18, { f0: 5000, f1: 300, vol: 0.55 });
    this.tone(220, 60, 0.12, { type: 'square', vol: 0.25 });
    this.tone(1400, 300, 0.06, { type: 'sawtooth', vol: 0.12 });
  }
  shotgun() {
    this.noise(0.45, { f0: 3500, f1: 120, vol: 0.9 });
    this.tone(120, 35, 0.3, { type: 'sine', vol: 0.7 });
    this.noise(0.12, { f0: 1500, f1: 400, vol: 0.4, delay: 0.38 });
    this.tone(300, 150, 0.06, { type: 'square', vol: 0.2, delay: 0.42 });
  }
  empty() { this.tone(900, 600, 0.04, { type: 'square', vol: 0.12 }); }
  swap() { this.noise(0.08, { type: 'bandpass', f0: 1800, f1: 900, vol: 0.2 }); this.tone(500, 800, 0.05, { type: 'square', vol: 0.08, delay: 0.07 }); }
  hit() { this.tone(900, 500, 0.04, { type: 'triangle', vol: 0.2 }); }
  enemyHurt() { this.noise(0.12, { type: 'bandpass', f0: 600, f1: 250, vol: 0.3 }); }
  enemyDie(big) {
    this.noise(0.5, { type: 'lowpass', f0: 1800, f1: 80, vol: 0.5 });
    this.tone(big ? 110 : 220, big ? 35 : 55, 0.5, { type: 'sawtooth', vol: 0.3 });
  }
  fireball() { this.noise(0.4, { type: 'bandpass', f0: 400, f1: 1600, vol: 0.35 }); this.tone(180, 500, 0.3, { type: 'sawtooth', vol: 0.15 }); }
  explode() { this.noise(0.6, { f0: 2500, f1: 60, vol: 0.8 }); this.tone(90, 30, 0.5, { vol: 0.7 }); }
  hurt() { this.tone(160, 70, 0.25, { type: 'sawtooth', vol: 0.4 }); this.noise(0.15, { f0: 800, f1: 200, vol: 0.3 }); }
  pickup() { this.tone(660, 990, 0.1, { type: 'triangle', vol: 0.25 }); this.tone(990, 1320, 0.12, { type: 'triangle', vol: 0.2, delay: 0.08 }); }
  roar() { this.tone(90, 60, 0.7, { type: 'sawtooth', vol: 0.3 }); this.noise(0.7, { type: 'bandpass', f0: 300, f1: 150, vol: 0.3 }); }
  unlock() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, f * 1.01, 0.4, { type: 'triangle', vol: 0.25, delay: i * 0.1 })); }
  portal() { [330, 440, 554, 660, 880].forEach((f, i) => this.tone(f, f * 2, 0.5, { type: 'sine', vol: 0.25, delay: i * 0.07 })); }
  die() { this.tone(300, 30, 1.6, { type: 'sawtooth', vol: 0.5 }); this.noise(1.4, { f0: 1200, f1: 40, vol: 0.5 }); }

  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const ctx = this.ctx;
    // drone pad
    for (const [f, d] of [[55, 0], [55.4, 0], [82.4, 3]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg = ctx.createGain(); lg.gain.value = 150; lfo.connect(lg); lg.connect(lp.frequency);
      const g = ctx.createGain(); g.gain.value = 0.18;
      o.connect(lp); lp.connect(g); g.connect(this.music);
      o.start(); lfo.start();
    }
    // pulsing bass sequencer
    const notes = [55, 55, 65.4, 55, 49, 55, 73.4, 65.4];
    let step = 0, next = ctx.currentTime + 0.1;
    const bpm = 100, stepDur = 60 / bpm / 2;
    const tick = () => {
      while (next < ctx.currentTime + 0.4) {
        const f = notes[step % notes.length];
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, next); lp.frequency.exponentialRampToValueAtTime(120, next + stepDur * 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(0.5, next + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, next + stepDur * 0.95);
        o.connect(lp); lp.connect(g); g.connect(this.music);
        o.start(next); o.stop(next + stepDur);
        if (step % 4 === 0) {
          const k = ctx.createOscillator(); const kg = ctx.createGain();
          k.frequency.setValueAtTime(120, next); k.frequency.exponentialRampToValueAtTime(40, next + 0.15);
          kg.gain.setValueAtTime(0.7, next); kg.gain.exponentialRampToValueAtTime(0.0001, next + 0.2);
          k.connect(kg); kg.connect(this.music); k.start(next); k.stop(next + 0.25);
        }
        next += stepDur; step++;
      }
      setTimeout(tick, 150);
    };
    tick();
  }
}
