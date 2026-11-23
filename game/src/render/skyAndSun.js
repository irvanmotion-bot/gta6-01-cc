// The sky dome with its big low sun and the moon that crosses it, the sunlight and its long shadows, the warm
// haze, and the colours of the day, the night and the minutes of totality.
import * as THREE from 'three';
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
uniform vec3 moonDir;
uniform vec3 discRight;
uniform vec3 discUp;
uniform float sunRadius;
uniform float moonRadius;
uniform float moonShade;
uniform vec3 moonColor;
uniform float corona;
uniform float sunGlow;
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
/* The pearly crown round the black moon at totality: a bright inner ring and long uneven streamers. */
vec3 coronaLight(vec3 dir, float moonAngle) {
  vec3 offset = dir - moonDir;
  float around = atan(dot(offset, discUp), dot(offset, discRight));
  float beyond = max(moonAngle - moonRadius, 0.0) / moonRadius;
  float streamers = 0.55 + 0.45 * pow(abs(sin(around * 2.0 + 0.7)), 3.0) + 0.25 * sin(around * 7.0 + 2.1);
  float ring = exp(-beyond * 9.0) * 1.5;
  float crown = exp(-beyond * (2.6 - streamers * 1.4)) * 0.75 * streamers;
  return vec3(1.0, 0.95, 0.86) * (ring + crown) * step(moonRadius, moonAngle);
}
/* The rays of the low sun: a wide soft star round the disc, some spokes longer than others. */
vec3 sunRays(vec3 dir, float sunAngle) {
  vec3 offset = dir - sunDir;
  float around = atan(dot(offset, discUp), dot(offset, discRight));
  float reach = max(1.0 - sunAngle / (sunRadius * 4.6), 0.0);
  float spokes = 0.5 + 0.3 * sin(around * 12.0 + 0.6) + 0.2 * sin(around * 5.0 + 1.9);
  return vec3(1.0, 0.7, 0.3) * reach * reach * (0.3 + 0.7 * spokes) * 0.26;
}
void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, 0.0, 1.0);
  // Deep colour overhead, a paler tone of it lower down, and the horizon's own colour in a broad band of warm haze.
  vec3 color = mix(mix(topColor, vec3(1.0), 0.2 * (1.0 - starAmount)), topColor, pow(h, 0.5));
  color = mix(horizonColor, color, smoothstep(0.0, 0.4, h));
  float sunAmount = max(dot(dir, sunDir), 0.0);
  float sunAngle = acos(min(sunAmount, 1.0));
  float moonAngle = acos(clamp(dot(dir, moonDir), -1.0, 1.0));
  // The glow round the sun warms a wide patch of sky; it shrinks with the crescent.
  color += sunColor * pow(sunAmount, 6.0) * 0.12 * sunGlow;
  // Close to the sun the haze burns orange rather than white, so the pale disc and its crescent stand out of it.
  color = mix(color, vec3(1.0, 0.62, 0.26), pow(sunAmount, 20.0) * 0.7 * sunGlow * (1.0 - starAmount) * (1.0 - corona));
  float star = step(0.9985, hash(floor(dir * 190.0)));
  color += vec3(star) * starAmount * h;
  // Drifting cumulus on a flat layer overhead, kept clear of the sun so the eclipse is never hidden.
  vec2 plane = dir.xz / (dir.y + 0.16) * 1.7 + vec2(cloudTime * 0.012, cloudTime * 0.005);
  float cover = smoothstep(0.58, 0.8, cloudCover(plane)) * smoothstep(0.02, 0.22, dir.y) * (1.0 - smoothstep(0.9, 0.975, sunAmount));
  vec3 cloudLit = mix(horizonColor, vec3(1.0), 0.8) + sunColor * (0.14 + pow(sunAmount, 5.0) * 0.5) * sunGlow;
  vec3 cloudColor = mix(cloudLit, topColor * 0.8 + horizonColor * 0.3, starAmount * 0.96);
  color = mix(color, cloudColor, cover * 0.88);
  // The moon's disc darkens the sky it stands in front of, then the sun's disc shows wherever the moon is not.
  float edge = sunRadius * 0.03;
  float moon = 1.0 - smoothstep(moonRadius - edge, moonRadius + edge, moonAngle);
  float disc = 1.0 - smoothstep(sunRadius - edge, sunRadius + edge, sunAngle);
  // A thin bright halo hugs the limb of the sun, so the crescent stands out from the haze around it.
  // The halo and the rays belong to the crescent: the moon's disc stands in front of them on its own side.
  float clearOfMoon = 1.0 - moon * moonShade * 0.9;
  float halo = (1.0 - smoothstep(sunRadius, sunRadius * 1.9, sunAngle)) * (1.0 - disc) * sunGlow * clearOfMoon;
  color += vec3(1.0, 0.66, 0.26) * halo * 0.22;
  // Long uneven rays stand out from the limb, so even a thin crescent blazes in the haze.
  color += sunRays(dir, sunAngle) * sunGlow * (1.0 - disc) * (1.0 - corona) * clearOfMoon;
  color = mix(color, vec3(1.0, 0.99, 0.9), disc);
  // Where the moon has the sun behind it, it is a clean bite of deep indigo. Beside the sun it is a round dusk-violet
  // shade in the haze, plain enough to read as the moon and no darker, until totality brings the whole black disc out.
  float overSun = 1.0 - smoothstep(sunRadius * 0.97, sunRadius * 1.1, sunAngle);
  color = mix(color, moonColor, moon * moonShade * mix(0.5, 1.0, max(overSun, corona)));
  color += coronaLight(dir, moonAngle) * corona;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

/** Colour keys through the day: [hour, sky top, horizon haze, sunlight, sun strength, ambient strength]. */
const DAY_COLOURS = [
  [0, '#0a1030', '#24346a', '#9fb3e8', 0.9, 0.7],
  [5, '#0c1232', '#2f2d55', '#9fb3e8', 0.9, 0.7],
  [6.5, '#3f6fb4', '#ffb27a', '#ffc089', 1.3, 0.55],
  [9, '#2a84e2', '#ffeed2', '#fff0d0', 3.0, 0.7],
  [13, '#2379e4', '#ffe6bd', '#ffecc4', 3.4, 0.78],
  [15, '#2c7fe8', '#ffd9a4', '#ffe6b8', 3.6, 0.7],
  [17.4, '#2f7ae8', '#ffb474', '#ffd08e', 3.6, 0.68],
  [18.8, '#3a56b4', '#ff9a5a', '#ff9a52', 2.3, 0.62],
  [19.8, '#231d66', '#ee5f7c', '#d8708c', 0.8, 0.7],
  [21, '#0a1030', '#2a3a72', '#9fb3e8', 0.9, 0.7],
  [24, '#0a1030', '#24346a', '#9fb3e8', 0.9, 0.7],
];
/** The sky inside the moon's shadow: indigo overhead and a ring of sunset on every horizon. */
const TOTALITY_SKY = { top: '#0b1136', horizon: '#b0562f', light: '#c9d4ff' };
/** The sun and moon are drawn many times their true size, so the crescent reads from any street. */
const SUN_RADIUS = 0.104;
const MOON_RADIUS = 0.11;
const SUNRISE = 6;
const SUNSET = 19.6;

export class SkyAndSun {
  constructor(scene) {
    this.hour = 16;
    this.night = 0;
    this.eclipseDark = 0;
    this.goldenHour = 0;
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      discRight: { value: new THREE.Vector3(1, 0, 0) },
      discUp: { value: new THREE.Vector3(0, 1, 0) },
      sunRadius: { value: SUN_RADIUS },
      moonRadius: { value: MOON_RADIUS },
      moonShade: { value: 0 },
      moonColor: { value: new THREE.Color('#1b1638') },
      corona: { value: 0 },
      sunGlow: { value: 1 },
      starAmount: { value: 0 },
      cloudTime: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 48, 24),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    // A low sun stretches the shadow map along the ground, so the box is wide across the light and short along it.
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -80; shadowCamera.right = 80; shadowCamera.top = 34; shadowCamera.bottom = -30;
    shadowCamera.near = 10; shadowCamera.far = 640;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.35;
    scene.add(this.sun, this.sun.target);

    this.ambient = new THREE.HemisphereLight(0xcfe8ff, 0x9a8a76, 0.9);
    // A soft light from opposite the sun, so shaded walls keep their colour instead of going black.
    this.fill = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(this.ambient, this.fill);
    // The haze starts well down the street, so the road ahead and the far blocks keep their detail in the glare.
    scene.fog = new THREE.Fog(0xffcf8e, 190, 1150);
    this.scene = scene;
    this.scratchA = new THREE.Color();
    this.scratchB = new THREE.Color();
    this.applyClock(this.hour, null, 0, 1);
  }

  setShadows(enabled) {
    this.sun.castShadow = enabled;
  }

  /** Follow the eclipse calendar's clock and keep the dome and the shadow box centred on the player. */
  update(dt, focus, calendar) {
    this.uniforms.cloudTime.value += dt;
    this.applyClock(calendar.hour, calendar.shadowTrack(), calendar.darkness(), calendar.sunlight());
    this.dome.position.set(focus.x, 0, focus.z);
    const dir = this.uniforms.sunDir.value;
    const snap = 4;
    const fx = Math.round(focus.x / snap) * snap;
    const fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + dir.x * 300, dir.y * 300, fz + dir.z * 300);
  }

  /** Where the sun stands at an hour: up over the hills in the east, down low over the ocean, south of west. */
  sunDirectionAt(hour, target) {
    const up = hour > SUNRISE && hour < SUNSET;
    const angle = (up ? (hour - SUNRISE) / (SUNSET - SUNRISE) : ((hour + 24 - SUNSET) % 24) / (24 - SUNSET + SUNRISE)) * Math.PI;
    const west = Math.max(0, -Math.cos(angle));
    return target.set(Math.cos(angle) * 0.62, Math.max(Math.sin(angle) * 0.92, 0.1), 0.3 + west * 2.3).normalize();
  }

  /**
   * Colour the sky, the sun, the ambient light and the haze for an hour of the day, then lay the eclipse over it:
   * `track` is the moon's place on its way across the sun (-1 to 1, null for none), `dark` the depth of its shadow
   * and `sunlight` the share of light the crescent still gives.
   */
  applyClock(hour, track, dark, sunlight) {
    this.hour = hour;
    this.eclipseDark = dark;
    let index = 0;
    while (index < DAY_COLOURS.length - 2 && DAY_COLOURS[index + 1][0] <= hour) index += 1;
    const a = DAY_COLOURS[index];
    const b = DAY_COLOURS[index + 1];
    const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
    const uniforms = this.uniforms;
    const mix = (i, target) => target.copy(this.scratchA.set(a[i])).lerp(this.scratchB.set(b[i]), t);
    mix(1, uniforms.topColor.value).lerp(this.scratchA.set(TOTALITY_SKY.top), dark * 0.94);
    mix(2, uniforms.horizonColor.value).lerp(this.scratchA.set(TOTALITY_SKY.horizon), dark * 0.85);
    mix(3, this.sun.color).lerp(this.scratchA.set(TOTALITY_SKY.light), dark);
    uniforms.sunColor.value.copy(this.sun.color);
    this.sun.intensity = (a[4] + (b[4] - a[4]) * t) * sunlight;
    // Shade is lit by the blue of the sky from above and by warm light bounced off sand and stucco from below,
    // so sunlit walls glow against cool shadows.
    this.ambient.intensity = (a[5] + (b[5] - a[5]) * t) * 1.3 * (1 - dark * 0.6);
    this.ambient.color.copy(uniforms.topColor.value).lerp(this.scratchA.set('#ffffff'), 0.6 - dark * 0.25);
    this.ambient.groundColor.copy(this.sun.color).lerp(this.scratchA.set('#c0926a'), 0.55);
    // The fill is the daylight bounced back off the bright sand, sea and stucco: with it, the shaded side of a
    // car or a wall is a soft violet-blue with its own colour still in it, never a black silhouette.
    this.fill.intensity = this.sun.intensity * 0.26 * (1 - dark) + dark * 0.2;
    this.fill.color.copy(uniforms.horizonColor.value).lerp(this.scratchA.set('#ffffff'), 0.5);
    // The haze is the horizon's colour with a little of the sky's blue in it: distance reads as depth, not as glare.
    // Golden hour (0 to 1, set by photo mode): the late sun turns the haze orange-gold and the light honey, the
    // shade warms with it, and the sun itself shines a little harder. It fades out as the moon's shadow falls.
    const golden = this.goldenHour * (1 - dark);
    if (golden > 0) {
      uniforms.horizonColor.value.lerp(this.scratchA.set('#ff9e48'), 0.78 * golden);
      uniforms.topColor.value.lerp(this.scratchA.set('#ffb878'), 0.4 * golden);
      this.sun.color.lerp(this.scratchA.set('#ffb35e'), 0.7 * golden);
      uniforms.sunColor.value.copy(this.sun.color);
      this.sun.intensity *= 1 + 0.12 * golden;
      this.ambient.color.lerp(this.scratchA.set('#ffd8ac'), 0.35 * golden);
      this.ambient.groundColor.lerp(this.scratchA.set('#e8944c'), 0.4 * golden);
      this.fill.color.copy(uniforms.horizonColor.value).lerp(this.scratchA.set('#ffffff'), 0.5);
    }
    this.scene.fog.color.copy(uniforms.horizonColor.value).lerp(uniforms.topColor.value, 0.22 + dark * 0.4);

    const sunDir = this.sunDirectionAt(hour, uniforms.sunDir.value);
    this.fill.position.set(-sunDir.x, 0.55, -sunDir.z);
    const nightfall = clamp(hour < 12 ? (6.6 - hour) / 1.2 : (hour - 18.9) / 1.2, 0, 1);
    this.night = Math.max(nightfall, dark);
    uniforms.starAmount.value = Math.max(nightfall, dark * 0.9);
    // With the sun on the horizon or gone the sky itself is the lamp: lift the ambient light so that streets in
    // long shadow, and the asphalt most of all, stay readable through dusk and night.
    this.ambient.intensity *= 1 + clamp(1 - sunDir.y / 0.5, 0, 1) * 0.5;

    // The moon slides across the sun's disc along a slanted line; off the track it waits below the horizon.
    const right = uniforms.discRight.value.set(sunDir.z, 0, -sunDir.x).normalize();
    const up = uniforms.discUp.value.crossVectors(sunDir, right).normalize();
    const moonDir = uniforms.moonDir.value;
    if (track === null) {
      moonDir.set(0, -1, 0);
      uniforms.moonShade.value = 0;
      uniforms.corona.value = 0;
      uniforms.sunGlow.value = nightfall > 0.99 ? 0.5 : 1;
    } else {
      const slide = track * (SUN_RADIUS + MOON_RADIUS);
      // It comes up from below on the ocean side, so the last of the sun is a crescent high on the landward side.
      moonDir.copy(sunDir).addScaledVector(right, slide * 0.82).addScaledVector(up, slide * 0.57).normalize();
      uniforms.moonShade.value = clamp((1 - Math.abs(track)) * 6, 0, 1);
      uniforms.corona.value = dark;
      uniforms.sunGlow.value = 0.25 + 0.75 * sunlight;
    }
  }
}
