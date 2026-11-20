// One pooled point cloud for every puff in the game: smoke, fire, sparks, tire smoke, blood, plus bullet tracers and flashes.
import * as THREE from 'three';
import { createGlowTexture } from '../render/proceduralTextures.js';

const MAX = 1100;
const RING_LIFE = 0.55;
const VERTEX = `
attribute float size;
attribute vec4 tint;
varying vec4 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (520.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAGMENT = `
uniform sampler2D dotTexture;
varying vec4 vTint;
void main() {
  float a = texture2D(dotTexture, gl_PointCoord).a * vTint.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vTint.rgb, a);
}`;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.positions = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    this.tints = new Float32Array(MAX * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('tint', new THREE.BufferAttribute(this.tints, 4));
    this.geometry = geometry;
    this.points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { dotTexture: { value: createGlowTexture() } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.tracers = [];
    // A streak that is thickest in the middle and fine at both ends, so a round passing the camera stays a line.
    const tracerGeometry = new THREE.BoxGeometry(0.11, 0.11, 1, 1, 1, 2);
    const corners = tracerGeometry.attributes.position;
    for (let k = 0; k < corners.count; k += 1) {
      if (Math.abs(corners.getZ(k)) > 0.4) corners.setXY(k, corners.getX(k) * 0.12, corners.getY(k) * 0.12);
    }
    for (let k = 0; k < 24; k += 1) {
      const mesh = new THREE.Mesh(tracerGeometry, new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true }));
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    this.rings = [];
    const ringGeometry = new THREE.RingGeometry(0.82, 1, 40);
    ringGeometry.rotateX(-Math.PI / 2);
    for (let k = 0; k < 4; k += 1) {
      const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0 });
    }
    this.flash = new THREE.PointLight(0xffc266, 0, 26);
    scene.add(this.flash);
    this.flashLife = 0;
  }

  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, alpha, gravity = 0) {
    if (this.items.length >= MAX) this.items.shift();
    this.items.push({ x, y, z, vx, vy, vz, life, age: 0, size, grow, r, g, b, alpha, gravity });
  }

  smoke(x, y, z, dark = false) {
    const c = dark ? 0.12 : 0.55;
    this.emit(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8, 1.8, 0.9, 1.6, c, c, c, 0.5);
  }

  tireSmoke(x, y, z) {
    if (Math.random() < 0.5) return;
    this.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.9, 0.7, 1.8, 0.92, 0.92, 0.92, 0.32);
  }

  fire(x, y, z) {
    this.emit(x + (Math.random() - 0.5) * 1.2, y, z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5), 0.5, 1.1, -0.8, 1, 0.5 + Math.random() * 0.3, 0.1, 0.9);
  }

  /** The blue-white jet behind a car burning nitro. */
  nitroFlame(x, y, z, vx, vz) {
    for (let k = 0; k < 2; k += 1) {
      this.emit(x + (Math.random() - 0.5) * 0.7, y, z + (Math.random() - 0.5) * 0.7, vx * 0.55, 0.4, vz * 0.55, 0.22, 0.55, 0.5, 0.35, 0.75, 1, 0.95);
    }
  }

  /** The burst at a gun's muzzle: a white-hot heart in a short yellow flare, gone in a few frames. */
  muzzleFlash(x, y, z) {
    this.emit(x, y, z, 0, 0, 0, 0.1, 1.0, 0.3, 1, 0.78, 0.25, 0.95);
    this.emit(x, y, z, 0, 0, 0, 0.08, 0.55, 0.1, 1, 0.97, 0.8, 1);
  }

  sparks(x, y, z, count) {
    for (let k = 0; k < count; k += 1) {
      this.emit(x, y, z, (Math.random() - 0.5) * 9, Math.random() * 5, (Math.random() - 0.5) * 9, 0.35 + Math.random() * 0.3, 0.14, 0, 1, 0.85, 0.4, 1, 14);
    }
  }

  dust(x, y, z, r = 0.75, g = 0.72, b = 0.66) {
    for (let k = 0; k < 4; k += 1) this.emit(x, y, z, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.5, 0.3, 0.9, r, g, b, 0.6);
  }

  blood(x, y, z) {
    for (let k = 0; k < 6; k += 1) this.emit(x, y, z, (Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3, 0.45, 0.2, 0.2, 0.7, 0.05, 0.05, 0.9, 9);
  }

  /** A fireball, a pillar of black smoke, flying sparks and a flash of light. */
  explosion(x, y, z) {
    // Smoke goes in first so the fire, drawn after it, burns in front of the column instead of behind it.
    for (let k = 0; k < 22; k += 1) {
      this.emit(x + (Math.random() - 0.5) * 3, y + 2.5 + Math.random() * 2.5, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 4 + Math.random() * 5, (Math.random() - 0.5) * 3, 2.6 + Math.random(), 2.4, 2.6, 0.1, 0.09, 0.09, 0.75);
    }
    for (let k = 0; k < 40; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 7;
      const heat = Math.random();
      this.emit(x, y + Math.random() * 2, z, Math.cos(a) * s, 2 + Math.random() * 8, Math.sin(a) * s, 0.75 + Math.random() * 0.5, 2.4, 2.4, 1, 0.42 + heat * 0.48, 0.04 + heat * 0.2, 1);
    }
    this.sparks(x, y + 1, z, 26);
    // Burning debris thrown high, a white-hot core and a shockwave ring racing out along the ground.
    for (let k = 0; k < 16; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 6 + Math.random() * 10;
      this.emit(x, y + 1, z, Math.cos(a) * s, 7 + Math.random() * 9, Math.sin(a) * s, 1.1 + Math.random() * 0.6, 0.5, -0.2, 1, 0.55, 0.12, 1, 16);
    }
    // The heart of the fireball: a tight knot of deep orange with a small white-hot core in front of it.
    for (let k = 0; k < 16; k += 1) {
      const a = Math.random() * Math.PI * 2;
      this.emit(x + Math.cos(a) * 1.4, y + 0.4 + Math.random() * 2.6, z + Math.sin(a) * 1.4, Math.cos(a) * 2, 2.5 + Math.random() * 3, Math.sin(a) * 2, 0.9 + Math.random() * 0.4, 1.7, 1.6, 1, 0.3 + Math.random() * 0.2, 0.02, 1);
    }
    for (let k = 0; k < 6; k += 1) this.emit(x + (Math.random() - 0.5) * 1.6, y + 0.8 + Math.random() * 1.4, z + (Math.random() - 0.5) * 1.6, 0, 2.5, 0, 0.4, 2.4, 1.6, 1, 0.9, 0.55, 1);
    this.shockwave(x, z);
    this.lightFlash(x, y + 2, z, 60, 0.45);
  }

  /** A ring of hot air that spreads from a blast and fades. */
  shockwave(x, z) {
    const ring = this.rings.find((entry) => entry.life <= 0) || this.rings[0];
    ring.mesh.position.set(x, 0.3, z);
    ring.mesh.visible = true;
    ring.life = RING_LIFE;
  }

  lightFlash(x, y, z, intensity, life) {
    this.flash.position.set(x, y, z);
    this.flash.intensity = intensity;
    this.flashStart = intensity;
    this.flashLife = life;
    this.flashTotal = life;
  }

  /** A bullet's streak from muzzle to impact. */
  tracer(from, to, color = 0xfff1a8) {
    const slot = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const length = from.distanceTo(to);
    slot.mesh.position.copy(from).lerp(to, 0.5);
    slot.mesh.scale.set(1, 1, length);
    slot.mesh.lookAt(to);
    slot.mesh.material.color.setHex(color);
    slot.mesh.material.opacity = 0.9;
    slot.mesh.visible = true;
    slot.life = 0.11;
  }

  clear() {
    this.items.length = 0;
    for (const ring of this.rings) { ring.life = 0; ring.mesh.visible = false; }
  }

  update(dt) {
    let count = 0;
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const p = this.items[index];
      p.age += dt;
      if (p.age >= p.life) { this.items.splice(index, 1); continue; }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy) * 0.3; }
    }
    for (const p of this.items) {
      const t = p.age / p.life;
      this.positions[count * 3] = p.x; this.positions[count * 3 + 1] = p.y; this.positions[count * 3 + 2] = p.z;
      this.sizes[count] = Math.max(0.05, p.size + p.grow * t);
      this.tints[count * 4] = p.r; this.tints[count * 4 + 1] = p.g; this.tints[count * 4 + 2] = p.b; this.tints[count * 4 + 3] = p.alpha * (1 - t);
      count += 1;
    }
    this.geometry.setDrawRange(0, count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.tint.needsUpdate = true;
    for (const tracer of this.tracers) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      tracer.mesh.material.opacity = Math.max(0, tracer.life / 0.11);
      if (tracer.life <= 0) tracer.mesh.visible = false;
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const t = 1 - Math.max(0, ring.life) / RING_LIFE;
      ring.mesh.scale.setScalar(1.5 + t * 15);
      ring.mesh.material.opacity = (1 - t) * 0.75;
      if (ring.life <= 0) ring.mesh.visible = false;
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.intensity = Math.max(0, this.flashStart * (this.flashLife / this.flashTotal));
    }
  }
}
