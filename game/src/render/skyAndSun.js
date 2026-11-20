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
uniform float cloudTime;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cloudCover(vec2 p) {
  float sum = 0.0;
  float gain = 0.5;
  for (int k = 0; k < 4; k++) { sum += valueNoise(p) * gain; p = p * 2.03 + vec2(13.7, 7.1); gain *= 0.5; }
  return sum;
}
void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, 0.0, 1.0);
  // Deep colour overhead, a paler tone of it lower down, and the horizon's own colour only in a low band of haze.
  vec3 color = mix(mix(topColor, vec3(1.0), 0.42), topColor, pow(h, 0.6));
  color = mix(horizonColor, color, smoothstep(0.0, 0.2, h));
  float sunAmount = max(dot(dir, sunDir), 0.0);
  color += sunColor * pow(sunAmount, 420.0) * 3.0;
  color += sunColor * pow(sunAmount, 9.0) * 0.32;
  float star = step(0.9985, hash(floor(dir * 190.0)));
  color += vec3(star) * starAmount * h;
  // Drifting cumulus on a flat layer overhead: lit by the sun on top, tinted by the horizon underneath.
  vec2 plane = dir.xz / (dir.y + 0.16) * 1.7 + vec2(cloudTime * 0.012, cloudTime * 0.005);
  float cover = smoothstep(0.58, 0.8, cloudCover(plane)) * smoothstep(0.02, 0.22, dir.y);
  vec3 cloudLit = mix(horizonColor, vec3(1.0), 0.86) + sunColor * (0.14 + pow(sunAmount, 5.0) * 0.5);
  vec3 cloudColor = mix(cloudLit, topColor * 0.55 + horizonColor * 0.3, starAmount * 0.85);
  color = mix(color, cloudColor, cover * 0.88);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

/** Colour keys through the day: [hour, sky top, horizon, sun light, sun strength, ambient strength]. */
const KEYS = [
  [0, '#0c1438', '#24346a', '#9fb3e8', 0.75, 0.66],
  [5, '#0e1638', '#2f2d55', '#9fb3e8', 0.75, 0.66],
  [6.5, '#3f6fb4', '#ffb27a', '#ffc089', 1.3, 0.55],
  [9, '#2a8ae6', '#bfe6f5', '#fff0d0', 3.0, 0.7],
  [13, '#1578ee', '#c4ebf8', '#fff3da', 3.5, 0.72],
  [16.5, '#1c74e6', '#ffe4bd', '#ffd9a0', 3.4, 0.66],
  [18.6, '#35529e', '#ff9460', '#ff9a52', 1.9, 0.62],
  [19.8, '#1a2152', '#d4577a', '#c86a8c', 0.6, 0.5],
  [21, '#0c1438', '#2a3a72', '#9fb3e8', 0.75, 0.66],
  [24, '#0c1438', '#24346a', '#9fb3e8', 0.75, 0.66],
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
      cloudTime: { value: 0 },
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
    this.uniforms.cloudTime.value += dt;
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
    // Shade is lit by the blue of the sky from above and by warm light bounced off sand and stucco from below,
    // so sunlit walls glow against cool shadows.
    this.ambient.intensity = (a[5] + (b[5] - a[5]) * t) * 1.35;
    this.ambient.color.copy(this.uniforms.topColor.value).lerp(this.scratchA.set('#ffffff'), 0.42);
    this.ambient.groundColor.copy(this.sun.color).lerp(this.scratchA.set('#b98f66'), 0.55);
    this.fill.intensity = this.sun.intensity * 0.17;
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
