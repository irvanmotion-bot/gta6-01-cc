// The light of the finished frame. The city is drawn into a picture that keeps light brighter than white; the
// brightest of it (the sun's crescent, sirens, lamps, fire, pale walls in the low sun) is spread into a soft bloom,
// the sun's shafts are laid over it, speed smears the edges of the frame, and the whole is toned for the screen and
// graded: gold in the light and violet in the shade by day, cool under the corona and after dark.
import * as THREE from 'three';
import { FramePass, createFrameTarget } from './framePass.js';
import { SunShafts } from './sunShafts.js';

/* Halve the frame and keep only the light above the threshold; alpha is how much of the pixel is open sky. */
const BRIGHT_FRAGMENT = `
uniform sampler2D frame;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec4 mean = (texture2D(frame, vUv + texel * vec2(-1.0, -1.0)) + texture2D(frame, vUv + texel * vec2(1.0, -1.0))
    + texture2D(frame, vUv + texel * vec2(-1.0, 1.0)) + texture2D(frame, vUv + texel * vec2(1.0, 1.0))) * 0.25;
  float peak = max(mean.r, max(mean.g, mean.b));
  float keep = smoothstep(threshold, threshold * 1.9, peak);
  gl_FragColor = vec4(min(mean.rgb, vec3(6.0)) * keep, 1.0 - mean.a);
}`;

/* Halve a picture, each new pixel the mean of the sixteen under it. */
const SHRINK_FRAGMENT = `
uniform sampler2D source;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  gl_FragColor = (texture2D(source, vUv + texel * vec2(-1.0, -1.0)) + texture2D(source, vUv + texel * vec2(1.0, -1.0))
    + texture2D(source, vUv + texel * vec2(-1.0, 1.0)) + texture2D(source, vUv + texel * vec2(1.0, 1.0))) * 0.25;
}`;

/* On the way back up: this size's own picture mixed with the smoothed picture of the size below it. */
const SPREAD_FRAGMENT = `
uniform sampler2D sharp;
uniform sampler2D soft;
uniform vec2 texel;
uniform float spread;
varying vec2 vUv;
void main() {
  vec3 wide = texture2D(soft, vUv).rgb * 4.0;
  wide += (texture2D(soft, vUv + texel * vec2(1.0, 0.0)).rgb + texture2D(soft, vUv + texel * vec2(-1.0, 0.0)).rgb
    + texture2D(soft, vUv + texel * vec2(0.0, 1.0)).rgb + texture2D(soft, vUv + texel * vec2(0.0, -1.0)).rgb) * 2.0;
  wide += texture2D(soft, vUv + texel).rgb + texture2D(soft, vUv - texel).rgb
    + texture2D(soft, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(soft, vUv + texel * vec2(-1.0, 1.0)).rgb;
  gl_FragColor = vec4(mix(texture2D(sharp, vUv).rgb, wide / 16.0, spread), 1.0);
}`;

/* The frame with its bloom and shafts, toned for the screen and graded. */
const FINISH_FRAGMENT = `
uniform sampler2D frame;
uniform sampler2D bloom;
uniform sampler2D shafts;
uniform float bloomAmount;
uniform float shaftAmount;
uniform vec3 shaftTint;
uniform vec2 rushCentre;
uniform float rush;
uniform float aspect;
uniform float warmth;
uniform float saturation;
uniform float contrast;
uniform float vignette;
varying vec2 vUv;
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 drawn = texture2D(frame, vUv);
  vec3 color = drawn.rgb;
  if (rush > 0.001) {
    // At speed the edges of the frame smear away from the car: each pixel is the mean along its line toward it.
    // The open sky is left alone (its alpha is 0), so the sun stays sharp.
    vec2 away = vUv - rushCentre;
    float edge = smoothstep(0.4, 1.1, length(away * vec2(aspect, 1.0))) * drawn.a;
    vec2 stride = away * (rush * edge * 0.005);
    for (int k = 1; k < 8; k++) color += texture2D(frame, vUv - stride * float(k)).rgb;
    color /= 8.0;
  }
  color += texture2D(bloom, vUv).rgb * bloomAmount + texture2D(shafts, vUv).rgb * shaftTint * shaftAmount;
  gl_FragColor = vec4(color, 1.0);
  // Whatever the light fell on is toned for the screen by the renderer's own curve. The open sky is painted in
  // screen colours to begin with: it is only capped, so the glow round the sun burns up to white.
  #include <tonemapping_fragment>
  gl_FragColor.rgb = mix(min(color, vec3(1.0)), gl_FragColor.rgb, drawn.a);
  #include <colorspace_fragment>
  vec3 graded = gl_FragColor.rgb;
  float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  // By day the shade leans to violet and the light to gold; under the corona and after dark the frame is left cool.
  graded *= mix(vec3(1.0), vec3(0.95, 0.93, 1.08), (1.0 - smoothstep(0.0, 0.42, luma)) * warmth);
  graded *= mix(vec3(1.0), vec3(1.04, 1.0, 0.93), smoothstep(0.35, 0.95, luma) * warmth);
  graded = mix(vec3(luma), graded, saturation);
  graded = (graded - 0.5) * contrast + 0.5;
  vec2 fromCentre = (vUv - 0.5) * vec2(1.15, 1.0);
  graded *= 1.0 - vignette * pow(length(fromCentre) * 1.28, 2.4);
  graded += (grain(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
}`;

/** The look: where bloom starts, how much of it and of the shafts is laid on, and the grade. */
const LOOK = { threshold: 1.25, bloom: 0.16, spread: 0.66, shafts: 0.2, saturation: 1.3, contrast: 1.07, vignette: 0.42 };
const DAY_SHAFTS = new THREE.Color(1.0, 0.8, 0.5);
const CORONA_SHAFTS = new THREE.Color(0.8, 0.86, 1.0);

export class BloomAndGrade {
  /** `sky` is the SkyAndSun whose sun the shafts follow and whose daylight sets the grade. */
  constructor(renderer, sky) {
    this.renderer = renderer;
    this.sky = sky;
    this.bloomOn = true;
    this.look = { ...LOOK };
    // Light brighter than white needs a float picture; a card without one gets the same passes on plain bytes.
    this.type = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.frame = new THREE.WebGLRenderTarget(2, 2, { type: this.type, samples: 4 });
    this.steps = [];
    this.shafts = new SunShafts(sky);
    this.bright = new FramePass(BRIGHT_FRAGMENT, { frame: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: LOOK.threshold } });
    this.shrink = new FramePass(SHRINK_FRAGMENT, { source: { value: null }, texel: { value: new THREE.Vector2() } });
    this.spread = new FramePass(SPREAD_FRAGMENT, { sharp: { value: null }, soft: { value: null }, texel: { value: new THREE.Vector2() }, spread: { value: LOOK.spread } });
    this.finish = new FramePass(FINISH_FRAGMENT, {
      frame: { value: null }, bloom: { value: null }, shafts: { value: null }, bloomAmount: { value: 0 }, shaftAmount: { value: 0 }, shaftTint: { value: new THREE.Color() },
      rushCentre: { value: new THREE.Vector2(0.5, 0.4) }, rush: { value: 0 }, aspect: { value: 1.6 }, warmth: { value: 1 },
      saturation: { value: LOOK.saturation }, contrast: { value: LOOK.contrast }, vignette: { value: LOOK.vignette },
    }, true);
    this.size = new THREE.Vector2();
    this.point = new THREE.Vector3();
  }

  /** Size every picture to the drawing buffer: the frame whole, then halves of it down to a couple of dozen pixels. */
  resize(width, height) {
    this.frame.setSize(width, height);
    for (const step of this.steps) {
      step.sharp.dispose();
      if (step.soft) step.soft.dispose();
    }
    this.steps = [];
    const count = Math.min(7, Math.max(3, Math.round(Math.log2(height / 24))));
    let w = width;
    let h = height;
    for (let index = 0; index < count; index += 1) {
      w = Math.ceil(w / 2);
      h = Math.ceil(h / 2);
      this.steps.push({ width: w, height: h, sharp: createFrameTarget(w, h, this.type), soft: index < count - 1 ? createFrameTarget(w, h, this.type) : null });
    }
    this.shafts.resize(width, height, this.type);
    this.finish.uniforms.aspect.value = width / height;
  }

  /** The bloom of this frame: its bright picture halved again and again, then spread back up; returns the picture. */
  spreadBloom() {
    const renderer = this.renderer;
    const steps = this.steps;
    this.bright.uniforms.frame.value = this.frame.texture;
    this.bright.uniforms.texel.value.set(1 / this.frame.width, 1 / this.frame.height);
    this.bright.run(renderer, steps[0].sharp);
    for (let index = 1; index < steps.length; index += 1) {
      this.shrink.uniforms.source.value = steps[index - 1].sharp.texture;
      this.shrink.uniforms.texel.value.set(1 / steps[index - 1].width, 1 / steps[index - 1].height);
      this.shrink.run(renderer, steps[index].sharp);
    }
    let below = steps[steps.length - 1];
    let soft = below.sharp;
    for (let index = steps.length - 2; index >= 0; index -= 1) {
      const uniforms = this.spread.uniforms;
      uniforms.sharp.value = steps[index].sharp.texture;
      uniforms.soft.value = soft.texture;
      uniforms.texel.value.set(1 / below.width, 1 / below.height);
      this.spread.run(renderer, steps[index].soft);
      below = steps[index];
      soft = below.soft;
    }
    return soft.texture;
  }

  /**
   * Draw `scene` through `camera` to the screen. `rush` (0 to 1) is how hard speed smears the edges of the frame,
   * and `around` the place in the world the smear runs from: the car at the wheel.
   */
  render(scene, camera, rush = 0, around = null) {
    const renderer = this.renderer;
    renderer.getDrawingBufferSize(this.size);
    if (this.size.x !== this.frame.width || this.size.y !== this.frame.height) this.resize(this.size.x, this.size.y);
    renderer.setRenderTarget(this.frame);
    renderer.render(scene, camera);
    const sky = this.sky;
    const look = this.look;
    const uniforms = this.finish.uniforms;
    this.bright.uniforms.threshold.value = look.threshold;
    this.spread.uniforms.spread.value = look.spread;
    const bloom = this.spreadBloom();
    const shafts = this.shafts.render(renderer, this.steps[0].sharp.texture, camera);
    uniforms.frame.value = this.frame.texture;
    uniforms.bloom.value = bloom;
    uniforms.bloomAmount.value = this.bloomOn ? look.bloom : 0;
    uniforms.shafts.value = this.shafts.target.texture;
    uniforms.shaftAmount.value = shafts > 0 ? look.shafts : 0;
    uniforms.shaftTint.value.copy(DAY_SHAFTS).lerp(CORONA_SHAFTS, sky.uniforms.corona.value);
    uniforms.warmth.value = 1 - sky.night;
    uniforms.saturation.value = look.saturation;
    uniforms.contrast.value = look.contrast;
    uniforms.vignette.value = look.vignette;
    uniforms.rush.value = rush;
    if (rush > 0 && around) {
      const point = this.point.copy(around).project(camera);
      uniforms.rushCentre.value.set(point.x * 0.5 + 0.5, point.y * 0.5 + 0.5);
    }
    this.finish.run(renderer, null);
  }
}
