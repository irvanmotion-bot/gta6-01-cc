// Everything around the grid: the animated ocean, Playa Dorada's sand and umbrellas, the docks, lawns and far hills.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';

const OCEAN_VERTEX = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const OCEAN_FRAGMENT = `
uniform float time;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 skyColor;
uniform float shoreX;
uniform float shoreZ;
varying vec3 vWorld;
void main() {
  float offshore = min(shoreX - vWorld.x, vWorld.z - shoreZ);
  offshore = max(offshore, max(shoreX - vWorld.x, 0.0) * step(vWorld.z, shoreZ));
  float depth = clamp(offshore / 160.0, 0.0, 1.0);
  vec3 color = mix(shallowColor, deepColor, depth);
  float wave = sin(vWorld.x * 0.11 + time * 1.1) * sin(vWorld.z * 0.07 - time * 0.8) + sin((vWorld.x + vWorld.z) * 0.23 + time * 1.7) * 0.5;
  color += vec3(0.07, 0.09, 0.08) * wave;
  float glitter = pow(max(sin(vWorld.x * 1.3 + time * 2.0) * sin(vWorld.z * 1.7 - time * 2.6), 0.0), 9.0);
  color += vec3(1.0, 0.95, 0.85) * glitter * 0.55;
  float foam = smoothstep(0.82, 1.0, sin(offshore * 0.42 - time * 1.4)) * (1.0 - smoothstep(0.0, 34.0, offshore));
  color = mix(color, vec3(1.0), foam * 0.75);
  float dist = length(vWorld.xz - cameraPosition.xz);
  color = mix(color, skyColor, smoothstep(280.0, 1300.0, dist));
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

const SHORE_X = -78;
const SHORE_Z = CITY.depth + 46;

export class OceanAndBeach {
  constructor(scene, collision) {
    this.uniforms = {
      time: { value: 0 },
      deepColor: { value: new THREE.Color('#0b6fa8') },
      shallowColor: { value: new THREE.Color('#3fd0c9') },
      skyColor: { value: new THREE.Color('#bfe6f5') },
      shoreX: { value: SHORE_X },
      shoreZ: { value: SHORE_Z },
    };
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: OCEAN_VERTEX, fragmentShader: OCEAN_FRAGMENT }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(CITY.width / 2, -0.6, CITY.depth / 2);
    scene.add(ocean);

    const rng = new SeededRandom(CITY.seed + 5);
    const land = new MeshBatcher();
    // Sand west of Ocean Drive, the boardwalk beside it, the dock apron south of the grid and lawns north and east.
    land.addBox(-42, -1.2, CITY.depth / 2 - 20, 72, 1.2, CITY.depth + 52, '#f1dfb0');
    land.addBox(-9.5, 0, CITY.depth / 2, 5, 0.22, CITY.depth + 12, '#c9a678');
    land.addBox(CITY.width / 2 + 40, -1.2, CITY.depth + 26, CITY.width + 200, 1.2, 40, '#8f9094');
    land.addBox(CITY.width / 2 + 60, -1.2, -306, CITY.width + 900, 1.18, 600, '#7fae5c');
    land.addBox(CITY.width + 306, -1.2, CITY.depth / 2 + 20, 600, 1.18, CITY.depth + 100, '#7fae5c');
    // Piers reaching into the harbour, each with a warehouse-height crane.
    for (let k = 0; k < 4; k += 1) {
      const x = 150 + k * 190;
      land.addBox(x, -1.2, SHORE_Z + 28, 16, 1.2, 60, '#77787c');
      this.addCrane(land, x, SHORE_Z + 30, rng);
      collision.addBox(x - 3, SHORE_Z + 27, x + 3, SHORE_Z + 33, 30);
    }
    // A wooden pier off the beach with a lifeguard tower at its foot.
    land.addBox(-110, -0.4, 300, 90, 0.5, 5, '#b98b5e');
    for (let x = -150; x <= -75; x += 12) {
      land.addBox(x, -3, 297.8, 0.5, 3, 0.5, '#7a5a3c');
      land.addBox(x, -3, 302.2, 0.5, 3, 0.5, '#7a5a3c');
    }
    this.addBeachProps(land, rng);
    this.addHills(land, rng);
    scene.add(land.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  }

  addCrane(land, x, z, rng) {
    const color = rng.pick(['#e67e22', '#d35400', '#c0392b', '#2e86c1']);
    land.addBox(x - 5, 0, z, 1, 26, 1, color);
    land.addBox(x + 5, 0, z, 1, 26, 1, color);
    land.addBox(x, 25, z + 8, 12, 1.4, 34, color);
    land.addBox(x, 20, z + 16, 3, 5, 3, '#ecf0f1');
  }

  /** Umbrellas, towels and lifeguard towers along the sand. */
  addBeachProps(land, rng) {
    const cone = new THREE.ConeGeometry(1.7, 0.8, 8);
    const colors = ['#ff6b6b', '#ffd93d', '#4ecdc4', '#ff9f1c', '#f15bb5', '#ffffff', '#3a86ff'];
    for (let z = 10; z < CITY.depth; z += rng.range(7, 13)) {
      const x = rng.range(-58, -18);
      if (Math.abs(z - 300) < 8) continue;
      const color = rng.pick(colors);
      land.addBox(x, 0, z, 0.1, 2.2, 0.1, '#f5f5f5');
      land.addGeometry(cone, placement(x, 2.3, z), color);
      land.addFlat(x + 1.3, 0.04, z + 0.4, 0.9, 2, rng.pick(colors), rng.range(0, 1));
    }
    for (const z of [140, 460, 640]) {
      land.addBox(-40, 0, z, 0.3, 3, 0.3, '#f5f5f5');
      land.addBox(-37, 0, z, 0.3, 3, 0.3, '#f5f5f5');
      land.addBox(-40, 0, z + 3, 0.3, 3, 0.3, '#f5f5f5');
      land.addBox(-37, 0, z + 3, 0.3, 3, 0.3, '#f5f5f5');
      land.addBox(-38.5, 3, z + 1.5, 4, 2.2, 4, '#ff6b6b');
      land.addBox(-38.5, 5.2, z + 1.5, 4.6, 0.25, 4.6, '#ffffff');
    }
  }

  /** A ring of low-poly hills behind the city, north and east, to close the horizon. */
  addHills(land, rng) {
    const hill = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const greens = ['#6f9f78', '#7fae86', '#5f9470', '#8db892', '#7a9f6a'];
    const raise = (x, z) => {
      const radius = rng.range(150, 300);
      land.addGeometry(hill, placement(x, -6, z, rng.range(0, 3), radius, radius * rng.range(0.22, 0.42), radius * rng.range(0.7, 1.1)), rng.pick(greens));
    };
    for (let x = -260; x < CITY.width + 700; x += rng.range(80, 150)) raise(x, -330 - rng.range(0, 260));
    for (let z = -300; z < CITY.depth + 200; z += rng.range(80, 150)) raise(CITY.width + 340 + rng.range(0, 260), z);
  }

  update(dt, skyColor) {
    this.uniforms.time.value += dt;
    this.uniforms.skyColor.value.copy(skyColor);
  }
}
