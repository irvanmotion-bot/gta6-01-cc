// Shafts of light from the low sun, worked out from the finished frame. The frame's bright picture holds the sun's
// own light (the crescent the moon has left of it, or the corona at totality) wherever open sky shows; each pixel
// looks back along its line to the sun and gathers the light it finds there. So the crescent throws rays between the
// palms and down the street, and whatever stands in front of it (a tower, a helicopter, a car) cuts them.
import * as THREE from 'three';
import { FramePass, createFrameTarget } from './framePass.js';

const STREAK_FRAGMENT = `
uniform sampler2D bright;
uniform vec2 sunPoint;
uniform float sunSize;
uniform float sunLight;
uniform float aspect;
uniform float strength;
varying vec2 vUv;
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  const int STEPS = 36;
  vec2 toSun = sunPoint - vUv;
  vec2 stride = toSun * (0.96 / float(STEPS));
  vec2 at = vUv + stride * grain(gl_FragCoord.xy);
  float reach = 1.0;
  vec3 light = vec3(0.0);
  for (int k = 0; k < STEPS; k++) {
    vec2 inside = step(vec2(0.0), at) * step(at, vec2(1.0));
    // The bright picture: the light kept in rgb, how much of the pixel is open sky in alpha.
    vec4 seen = texture2D(bright, at);
    // Beyond the edge of the frame nothing was drawn: the disc itself stands in for what would be there.
    float disc = 1.0 - smoothstep(sunSize * 0.8, sunSize * 1.2, length((at - sunPoint) * vec2(aspect, 1.0)));
    light += mix(vec3(1.0, 0.82, 0.5) * disc * sunLight, seen.rgb * seen.a, inside.x * inside.y) * reach;
    reach *= 0.955;
    at += stride;
  }
  float far = length(toSun * vec2(aspect, 1.0));
  gl_FragColor = vec4(light * (strength / float(STEPS)) * (1.0 - smoothstep(0.3, 1.6, far)), 1.0);
}`;

export class SunShafts {
  /** `sky` is the SkyAndSun whose sun (and moon) these shafts follow. */
  constructor(sky) {
    this.sky = sky;
    this.enabled = true;
    this.target = createFrameTarget(2, 2, THREE.UnsignedByteType);
    this.pass = new FramePass(STREAK_FRAGMENT, {
      bright: { value: null }, sunPoint: { value: new THREE.Vector2(0.5, 0.5) }, sunSize: { value: 0.09 }, sunLight: { value: 1 }, aspect: { value: 1.6 }, strength: { value: 0 },
    });
    this.point = new THREE.Vector3();
    this.ahead = new THREE.Vector3();
  }

  /** The shafts are soft, so their picture is a quarter of the frame's size. */
  resize(width, height, type) {
    this.target.dispose();
    this.target = createFrameTarget(Math.ceil(width / 4), Math.ceil(height / 4), type);
    this.pass.uniforms.aspect.value = width / height;
  }

  /** How strong the shafts are through `camera` right now, 0 to 1: by day, facing the sun; faint under the corona. */
  strengthThrough(camera) {
    if (!this.enabled) return 0;
    const sky = this.sky;
    camera.getWorldDirection(this.ahead);
    const facing = this.ahead.dot(sky.uniforms.sunDir.value);
    const daylight = Math.max(1 - sky.night, sky.uniforms.corona.value * 0.6);
    return daylight * Math.min(1, Math.max(0, (facing - 0.25) / 0.35));
  }

  /** Draw this frame's shafts from its bright picture; returns their strength (0: nothing was drawn). */
  render(renderer, brightTexture, camera) {
    const strength = this.strengthThrough(camera);
    if (strength < 0.02) return 0;
    const sky = this.sky;
    const uniforms = this.pass.uniforms;
    const point = this.point.copy(camera.position).addScaledVector(sky.uniforms.sunDir.value, 1000).project(camera);
    uniforms.bright.value = brightTexture;
    uniforms.sunPoint.value.set(point.x * 0.5 + 0.5, point.y * 0.5 + 0.5);
    uniforms.sunSize.value = Math.tan(sky.uniforms.sunRadius.value) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    uniforms.sunLight.value = sky.discLight();
    uniforms.strength.value = strength;
    this.pass.run(renderer, this.target);
    return strength;
  }
}
