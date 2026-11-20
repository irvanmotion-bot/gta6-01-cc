// The sky dome, the sun and its shadows, fog and the day-night cycle that colours all of them.
import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, START_HOUR } from '../core/config.js';
import { clamp } from '../core/random.js';

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`;

const SKY_FRAGMENT = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float starAmount;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(horizonColor, topColor, pow(h, 0.55));
  float sunAmount = max(dot(dir, sunDir), 0.0);
  color += sunColor * pow(sunAmount, 420.0) * 3.0;
  color += sunColor * pow(sunAmount, 9.0) * 0.32;
  float streak = sin(dir.x * 9.0 + dir.z * 5.0) * sin(dir.z * 13.0 - dir.x * 3.0);
  color += vec3(1.0, 0.92, 0.85) * smoothstep(0.55, 1.0, streak) * (1.0 - h) * h * 0.55;
  float star = step(0.9985, hash(floor(dir * 190.0)));
  color += vec3(star) * starAmount * h;
  gl_FragColor = vec4(color, 1.0);
}`;

/** Colour keys through the day: [hour, sky top, horizon, sun light, sun strength, ambient strength]. */
const KEYS = [
  [0, '#060a1c', '#101a36', '#5b6fa8', 0.1, 0.24],
  [5, '#0c1230', '#2a2748', '#6d7bb0', 0.12, 0.26],
  [6.5, '#3f6fb4', '#ffb27a', '#ffc089', 1.3, 0.55],
  [9, '#2f8fe0', '#bfe6f5', '#fff2d6', 2.5, 0.85],
  [13, '#1f86e6', '#c9ecf7', '#fff8e8', 2.9, 0.95],
  [16.5, '#2a80d8', '#ffe0b0', '#ffe2ae', 2.7, 0.9],
  [18.6, '#35529e', '#ff9460', '#ff9a52', 1.9, 0.62],
  [19.8, '#1a2152', '#d4577a', '#c86a8c', 0.5, 0.38],
  [21, '#070c22', '#161f44', '#5b6fa8', 0.12, 0.25],
  [24, '#060a1c', '#101a36', '#5b6fa8', 0.1, 0.24],
];

export class SkyAndSun {
  constructor(scene) {
    this.hour = START_HOUR;
    this.night = 0;
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      starAmount: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -95; shadowCamera.right = 95; shadowCamera.top = 95; shadowCamera.bottom = -95;
    shadowCamera.near = 10; shadowCamera.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun, this.sun.target);

    this.ambient = new THREE.HemisphereLight(0xcfe8ff, 0x9a8a76, 0.9);
    // A soft light from opposite the sun, so shaded walls keep their colour instead of going black.
    this.fill = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(this.ambient, this.fill);
    scene.fog = new THREE.Fog(0xbfe6f5, 140, 1150);
    this.scene = scene;
    this.scratchA = new THREE.Color();
    this.scratchB = new THREE.Color();
    this.applyHour();
  }

  setShadows(enabled) {
    this.sun.castShadow = enabled;
  }

  update(dt, focus) {
    this.hour = (this.hour + (dt * 24) / DAY_LENGTH_SECONDS) % 24;
    this.applyHour();
    this.dome.position.set(focus.x, 0, focus.z);
    const dir = this.uniforms.sunDir.value;
    const snap = 4;
    const fx = Math.round(focus.x / snap) * snap;
    const fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + dir.x * 300, dir.y * 300, fz + dir.z * 300);
  }

  /** Blend the two colour keys around the current hour into the sky, the sun, the ambient light and the fog. */
  applyHour() {
    let index = 0;
    while (index < KEYS.length - 2 && KEYS[index + 1][0] <= this.hour) index += 1;
    const a = KEYS[index];
    const b = KEYS[index + 1];
    const t = clamp((this.hour - a[0]) / (b[0] - a[0]), 0, 1);
    const mix = (i, target) => target.copy(this.scratchA.set(a[i])).lerp(this.scratchB.set(b[i]), t);
    mix(1, this.uniforms.topColor.value);
    mix(2, this.uniforms.horizonColor.value);
    mix(3, this.sun.color);
    this.uniforms.sunColor.value.copy(this.sun.color);
    this.sun.intensity = a[4] + (b[4] - a[4]) * t;
    this.ambient.intensity = (a[5] + (b[5] - a[5]) * t) * 1.35;
    this.ambient.color.copy(this.uniforms.topColor.value).lerp(this.scratchA.set('#ffffff'), 0.6);
    this.fill.intensity = this.sun.intensity * 0.3;
    this.fill.color.copy(this.uniforms.horizonColor.value).lerp(this.scratchA.set('#ffffff'), 0.5);
    this.scene.fog.color.copy(this.uniforms.horizonColor.value);

    // The sun rises in the east (over the hills), sets in the west (over the ocean); the moon lights the night.
    const dayPart = (this.hour - 6) / 13.6;
    const up = this.hour > 6 && this.hour < 19.6;
    const angle = (up ? dayPart : ((this.hour + 24 - 19.6) % 24) / 10.4) * Math.PI;
    const height = Math.max(Math.sin(angle), 0.09);
    this.uniforms.sunDir.value.set(Math.cos(angle) * 0.92, height, 0.34).normalize();
    this.fill.position.set(-this.uniforms.sunDir.value.x, 0.55, -this.uniforms.sunDir.value.z);
    this.night = clamp(this.hour < 12 ? (6.6 - this.hour) / 1.2 : (this.hour - 18.7) / 1.3, 0, 1);
    this.uniforms.starAmount.value = this.night;
  }

  /** The clock as HH:MM for the HUD. */
  clockText() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
