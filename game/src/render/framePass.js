// One full-screen pass over the finished frame: a fragment shader run on every pixel of a target (or of the
// screen), reading the pictures earlier passes left. Bloom, the sun's shafts and the colour grade are built of these.
import * as THREE from 'three';

const PASS_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
sheet.frustumCulled = false;
const stage = new THREE.Scene();
stage.add(sheet);
const lens = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export class FramePass {
  /** `uniforms` are the shader's own; a pass `toScreen` may call on the renderer's tone curve and colour space. */
  constructor(fragmentShader, uniforms, toScreen = false) {
    this.uniforms = uniforms;
    this.material = new THREE.ShaderMaterial({ uniforms, vertexShader: PASS_VERTEX, fragmentShader, depthTest: false, depthWrite: false, fog: false, toneMapped: toScreen });
  }

  /** Run the pass into `target`; null is the screen. */
  run(renderer, target) {
    sheet.material = this.material;
    renderer.setRenderTarget(target);
    renderer.render(stage, lens);
  }
}

/** A picture a pass writes and a later pass reads: linear light, smooth when it is read at another size. */
export function createFrameTarget(width, height, type, options = {}) {
  return new THREE.WebGLRenderTarget(Math.max(2, width), Math.max(2, height), { type, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, ...options });
}
