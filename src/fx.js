import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/** Pooled additive soft particles rendered as sized points. */
export class Particles {
  constructor(scene, max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 4);
    this.baseSize = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec4 aColor; attribute float aSize; uniform float uScale;
        varying vec4 vColor;
        void main(){
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 48.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec4 vColor;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor.rgb * a * vColor.a, a * vColor.a);
        }`,
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
  }

  setScale(heightPx, fov) {
    this.uniforms.uScale.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
  }

  emit(x, y, z, vx, vy, vz, color, size, life, gravity = 0) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = color;
    this.base[i * 4] = c.r; this.base[i * 4 + 1] = c.g; this.base[i * 4 + 2] = c.b; this.base[i * 4 + 3] = 1;
    this.baseSize[i] = size;
    this.life[i] = this.maxLife[i] = life;
    this.grav[i] = gravity;
  }

  burst(x, y, z, n, color, speed, size, life, gravity = 6) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s,
        color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.7), gravity);
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = k;
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k);
    }
    const a = this.mesh.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = true;
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, damage: { value: 0 },
    aberr: { value: 0.0015 }, flash: { value: 0 }, heal: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, damage, aberr, flash, heal; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c,c);
      float ab = aberr * (1.0 + damage * 3.0) * (0.4 + r2 * 3.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c * ab).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * ab).b;
      // contrast / saturation
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, 1.15);
      // vignette
      float vig = smoothstep(0.85, 0.15, r2 * 1.6);
      col *= mix(0.35, 1.0, vig);
      // damage tint
      col = mix(col, col * vec3(1.6,0.25,0.2) + vec3(0.25,0.0,0.0) * r2 * 4.0, damage * smoothstep(0.0, 0.5, r2 + 0.1));
      col += vec3(0.5,0.35,0.2) * flash * 0.15;
      col += vec3(0.05,0.35,0.15) * heal * (0.3 + r2 * 2.0);
      // film grain
      col += (hash(vUv * 1000.0 + fract(time)) - 0.5) * 0.014;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createComposer(renderer, scene, camera, { mobile }) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(size.clone().multiplyScalar(mobile ? 0.5 : 0.75), mobile ? 0.4 : 0.55, 0.5, 1.0);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let smaa = null;
  if (!mobile) { smaa = new SMAAPass(); composer.addPass(smaa); }
  return { composer, bloom, grade, smaa };
}
