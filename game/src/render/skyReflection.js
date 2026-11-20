// A small mirror image of Solmara's sky (blue overhead, a pale horizon, a hot sun, warm ground) that car paint,
// windscreens and tower glass reflect, so they gleam in the sun instead of sitting flat.
import * as THREE from 'three';

const REFLECTION_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const REFLECTION_FRAGMENT = `
varying vec3 vDir;
void main() {
  vec3 dir = normalize(vDir);
  vec3 sky = mix(vec3(0.86, 0.95, 1.0), vec3(0.08, 0.36, 0.92), pow(clamp(dir.y, 0.0, 1.0), 0.5));
  vec3 ground = mix(vec3(0.62, 0.58, 0.52), vec3(0.2, 0.2, 0.22), clamp(-dir.y * 2.5, 0.0, 1.0));
  vec3 color = mix(ground, sky, smoothstep(-0.03, 0.03, dir.y));
  // A skyline band of pale walls just above the horizon, then the sun and its glow.
  color = mix(color, vec3(0.98, 0.9, 0.78), smoothstep(0.0, 0.02, dir.y) * (1.0 - smoothstep(0.1, 0.16, dir.y)) * 0.5);
  float sun = max(dot(dir, normalize(vec3(-0.5, 0.62, 0.3))), 0.0);
  color += vec3(1.0, 0.9, 0.7) * (pow(sun, 60.0) * 7.0 + pow(sun, 6.0) * 0.5);
  gl_FragColor = vec4(color, 1.0);
}`;

/** Render the sky mirror once into a prefiltered environment map; returns the texture to hand to materials. */
export function createSkyReflection(renderer) {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 24, 12),
    new THREE.ShaderMaterial({ vertexShader: REFLECTION_VERTEX, fragmentShader: REFLECTION_FRAGMENT, side: THREE.BackSide }),
  );
  scene.add(dome);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.03);
  generator.dispose();
  dome.geometry.dispose();
  dome.material.dispose();
  return target.texture;
}

/** Give materials the sky to reflect; `strength` is how much of it shows (dimmed after dark by the caller). */
export function reflectSkyOn(materials, texture, strength) {
  for (const material of materials) {
    material.envMap = texture;
    material.envMapIntensity = strength;
    material.needsUpdate = true;
  }
}
