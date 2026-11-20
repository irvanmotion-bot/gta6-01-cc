// Shafts of light from the low sun. After the city is drawn, the sun's disc (with the moon's bite out of it, or the
// corona at totality) is drawn again, small, as white on black, with every palm, tower, car and helicopter as a
// black shape in front of it; that picture is smeared outwards from the sun and laid over the frame as warm light.
// So the crescent throws rays between the palms and down the street, and whatever stands in front of it cuts them.
import * as THREE from 'three';

const DOME_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/* The sun as a light source only: its disc and a soft halo, less whatever the moon covers; at totality, the corona. */
const SOURCE_FRAGMENT = `
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform float sunRadius;
uniform float moonRadius;
uniform float moonShade;
uniform float corona;
varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  float sunAngle = acos(clamp(dot(dir, sunDir), -1.0, 1.0));
  float moonAngle = acos(clamp(dot(dir, moonDir), -1.0, 1.0));
  float disc = 1.0 - smoothstep(sunRadius * 0.94, sunRadius * 1.06, sunAngle);
  float halo = (1.0 - smoothstep(sunRadius, sunRadius * 2.8, sunAngle)) * 0.45;
  float moon = (1.0 - smoothstep(moonRadius * 0.97, moonRadius * 1.03, moonAngle)) * moonShade;
  float crown = exp(-max(moonAngle - moonRadius, 0.0) / moonRadius * 4.0) * step(moonRadius, moonAngle);
  float light = max(disc, halo) * (1.0 - moon) * (1.0 - corona) + crown * corona * 0.9;
  gl_FragColor = vec4(vec3(light), 1.0);
}`;

const SCREEN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/* Each pixel looks back along the line to the sun and gathers the light it finds there, fading with every step. */
const STREAK_FRAGMENT = `
uniform sampler2D source;
uniform vec2 sunPoint;
uniform vec3 tint;
uniform float strength;
uniform float aspect;
varying vec2 vUv;
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  const int STEPS = 40;
  vec2 toSun = sunPoint - vUv;
  vec2 stride = toSun * (0.94 / float(STEPS));
  vec2 at = vUv + stride * grain(gl_FragCoord.xy);
  float reach = 1.0;
  float light = 0.0;
  for (int k = 0; k < STEPS; k++) {
    light += texture2D(source, at).r * reach;
    reach *= 0.955;
    at += stride;
  }
  float far = length(toSun * vec2(aspect, 1.0));
  light *= strength / float(STEPS) * (1.0 - smoothstep(0.25, 1.5, far));
  gl_FragColor = vec4(tint * light, 1.0);
}`;

/** The streaks are worked out on a picture a third the size of the frame: they are soft anyway. */
const SOURCE_SHRINK = 3;
const DAY_TINT = new THREE.Color(1.0, 0.74, 0.4);
const CORONA_TINT = new THREE.Color(0.82, 0.86, 1.0);

export class SunShafts {
  /** `sky` is the SkyAndSun whose sun and moon these shafts follow; they share its uniforms. */
  constructor(renderer, sky) {
    this.renderer = renderer;
    this.sky = sky;
    this.enabled = true;
    this.source = new THREE.WebGLRenderTarget(8, 8);
    const shared = sky.uniforms;
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1700, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { sunDir: shared.sunDir, moonDir: shared.moonDir, sunRadius: shared.sunRadius, moonRadius: shared.moonRadius, moonShade: shared.moonShade, corona: shared.corona },
        vertexShader: DOME_VERTEX, fragmentShader: SOURCE_FRAGMENT, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
      }),
    );
    this.dome.frustumCulled = false;
    this.domeScene = new THREE.Scene();
    this.domeScene.add(this.dome);
    // Everything in the city, drawn flat black: whatever stands between the camera and the sun.
    this.silhouette = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false });
    this.streaks = new THREE.ShaderMaterial({
      uniforms: { source: { value: this.source.texture }, sunPoint: { value: new THREE.Vector2(0.5, 0.5) }, tint: { value: new THREE.Color() }, strength: { value: 0 }, aspect: { value: 1.6 } },
      vertexShader: SCREEN_VERTEX, fragmentShader: STREAK_FRAGMENT, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.streaks);
    sheet.frustumCulled = false;
    this.screen = new THREE.Scene();
    this.screen.add(sheet);
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.point = new THREE.Vector3();
    this.ahead = new THREE.Vector3();
    this.size = new THREE.Vector2();
  }

  /** How bright the shafts are right now, 0 to 1: the daylight the crescent still gives, or the corona's glow. */
  brightness() {
    const sky = this.sky;
    const corona = sky.uniforms.corona.value;
    const daylight = (1 - sky.night) * sky.uniforms.sunGlow.value;
    return Math.max(daylight * 0.95, corona * 0.55);
  }

  /** Lay the shafts over the frame the renderer has just drawn of `scene` through `camera`. */
  render(scene, camera) {
    if (!this.enabled) return;
    const sky = this.sky;
    const sunDir = sky.uniforms.sunDir.value;
    camera.getWorldDirection(this.ahead);
    const facing = this.ahead.dot(sunDir);
    // With the sun behind the camera, or well off to the side, there is nothing to draw.
    const strength = this.brightness() * Math.min(1, Math.max(0, (facing - 0.25) / 0.35));
    if (strength < 0.02) return;
    const point = this.point.copy(camera.position).addScaledVector(sunDir, 1000).project(camera);
    const renderer = this.renderer;
    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(8, Math.ceil(this.size.x / SOURCE_SHRINK));
    const height = Math.max(8, Math.ceil(this.size.y / SOURCE_SHRINK));
    if (this.source.width !== width || this.source.height !== height) this.source.setSize(width, height);

    // The light source and the silhouettes in front of it, on the small picture. The shadow maps are already
    // drawn for this frame, and the sky's own dome sits this pass out.
    const shadows = renderer.shadowMap.autoUpdate;
    const clearColor = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.source);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    this.dome.position.copy(camera.position);
    renderer.autoClear = false;
    renderer.render(this.domeScene, camera);
    sky.dome.visible = false;
    scene.overrideMaterial = this.silhouette;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    sky.dome.visible = true;
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.shadowMap.autoUpdate = shadows;

    const uniforms = this.streaks.uniforms;
    uniforms.sunPoint.value.set(point.x * 0.5 + 0.5, point.y * 0.5 + 0.5);
    uniforms.strength.value = strength;
    uniforms.aspect.value = this.size.x / this.size.y;
    uniforms.tint.value.copy(DAY_TINT).lerp(CORONA_TINT, sky.uniforms.corona.value);
    renderer.render(this.screen, this.screenCamera);
    renderer.autoClear = true;
  }
}
