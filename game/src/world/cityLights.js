// The city's own light after dark: a warm pool on the asphalt under every street lamp, a halo round each lamp head
// and a coloured glow round every neon sign. Three draw calls for the whole city, faded in as night falls.
import * as THREE from 'three';
import { createGlowTexture } from '../render/proceduralTextures.js';

export class CityLights {
  /** `lampSpots` are the lamp heads {x, y, z}; `neonSpots` the neon signs {x, y, z, color}. */
  constructor(scene, lampSpots, neonSpots) {
    const glow = createGlowTexture();
    this.poolMaterial = new THREE.MeshBasicMaterial({ map: glow, color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pools = new THREE.Mesh(buildLampPools(lampSpots), this.poolMaterial);
    this.pools.renderOrder = 2;
    this.haloMaterial = new THREE.PointsMaterial({ map: glow, color: 0xffd9a0, size: 5.5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.halos = new THREE.Points(pointCloud(lampSpots, null), this.haloMaterial);
    this.neonMaterial = new THREE.PointsMaterial({ map: glow, vertexColors: true, size: 13, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.neonGlow = new THREE.Points(pointCloud(neonSpots, (spot) => spot.color), this.neonMaterial);
    for (const object of [this.pools, this.halos, this.neonGlow]) {
      object.frustumCulled = false;
      object.visible = false;
      scene.add(object);
    }
  }

  /** Fade the lights with the night, 0 (day) to 1. */
  setNight(night) {
    const on = night > 0.02;
    this.pools.visible = on;
    this.halos.visible = on;
    this.neonGlow.visible = on;
    this.poolMaterial.opacity = night * 0.5;
    this.haloMaterial.opacity = night * 0.9;
    this.neonMaterial.opacity = night * 0.55;
  }
}

/** One flat glowing quad on the road under each lamp, all in one geometry. */
function buildLampPools(lampSpots) {
  const positions = [];
  const uvs = [];
  const indices = [];
  lampSpots.forEach((spot, index) => {
    const r = POOL_RADIUS;
    positions.push(spot.x - r, POOL_HEIGHT, spot.z - r, spot.x + r, POOL_HEIGHT, spot.z - r, spot.x + r, POOL_HEIGHT, spot.z + r, spot.x - r, POOL_HEIGHT, spot.z + r);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    const base = index * 4;
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function pointCloud(spots, colorOf) {
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  for (const spot of spots) {
    positions.push(spot.x, spot.y, spot.z);
    if (colorOf) { color.set(colorOf(spot)); colors.push(color.r, color.g, color.b); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colorOf) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

const POOL_RADIUS = 9;
const POOL_HEIGHT = 0.27;
