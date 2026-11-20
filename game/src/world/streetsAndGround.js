// Lays the ground of the city: asphalt, lane paint, crosswalks, sidewalk slabs and each district's lot surface.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher } from '../render/meshBatcher.js';
import { blockRect, districtOfBlock, DISTRICTS } from './cityLayout.js';

const P = CITY.pitch;
const HALF_ROAD = CITY.road / 2;
const ASPHALT_TILE = 26;

export function buildStreetsAndGround(scene) {
  const surface = paintAsphaltTexture();
  surface.repeat.set((CITY.width + CITY.road) / ASPHALT_TILE, (CITY.depth + CITY.road) / ASPHALT_TILE);
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.width + CITY.road, CITY.depth + CITY.road),
    new THREE.MeshStandardMaterial({ map: surface, color: 0xf2f2f4, roughness: 0.9 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(CITY.width / 2, 0, CITY.depth / 2);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const paint = new MeshBatcher();
  const slabs = new MeshBatcher();
  paintLaneMarkings(paint);
  paintCrosswalks(paint);
  for (let i = 0; i < CITY.roadsX - 1; i += 1) {
    for (let j = 0; j < CITY.roadsZ - 1; j += 1) {
      const rect = blockRect(i, j);
      const cx = (rect.minX + rect.maxX) / 2;
      const cz = (rect.minZ + rect.maxZ) / 2;
      const size = rect.maxX - rect.minX;
      const district = districtOfBlock(i, j);
      slabs.addBox(cx, 0, cz, size, CITY.curb, size, district === 'jacaranda' ? '#cfc6b0' : '#c9c5bb');
      const inner = size - CITY.sidewalk * 2;
      slabs.addBox(cx, CITY.curb, cz, inner, 0.03, inner, DISTRICTS[district].ground);
    }
  }
  scene.add(paint.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), { castShadow: false }));
  scene.add(slabs.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), { castShadow: false }));
}

/** Worn asphalt for the whole grid: one tile of speckle, repair patches, cracks and oil stains, repeated. */
function paintAsphaltTexture() {
  const rng = new SeededRandom(CITY.seed + 71);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#676a72';
  c.fillRect(0, 0, size, size);
  for (let k = 0; k < 5200; k += 1) {
    const shade = rng.int(78, 128);
    c.fillStyle = `rgba(${shade},${shade},${shade + 6},${rng.range(0.25, 0.7)})`;
    c.fillRect(rng.int(0, size), rng.int(0, size), rng.int(1, 3), rng.int(1, 3));
  }
  for (let k = 0; k < 9; k += 1) {
    c.fillStyle = `rgba(30,32,37,${rng.range(0.25, 0.5)})`;
    c.fillRect(rng.int(0, size), rng.int(0, size), rng.int(30, 110), rng.int(18, 70));
  }
  c.strokeStyle = 'rgba(18,19,22,0.75)';
  c.lineWidth = 1.5;
  for (let k = 0; k < 12; k += 1) {
    let x = rng.int(0, size);
    let y = rng.int(0, size);
    c.beginPath();
    c.moveTo(x, y);
    for (let step = 0; step < 6; step += 1) { x += rng.range(-34, 34); y += rng.range(-34, 34); c.lineTo(x, y); }
    c.stroke();
  }
  for (let k = 0; k < 5; k += 1) {
    const x = rng.int(40, size - 40);
    const y = rng.int(40, size - 40);
    const stain = c.createRadialGradient(x, y, 0, x, y, rng.int(14, 34));
    stain.addColorStop(0, 'rgba(12,12,16,0.6)');
    stain.addColorStop(1, 'rgba(12,12,16,0)');
    c.fillStyle = stain;
    c.fillRect(x - 40, y - 40, 80, 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A dashed yellow centre line on every road segment, white edge lines along the kerbs and stop lines before each intersection. */
function paintLaneMarkings(paint) {
  for (let i = 0; i < CITY.roadsX; i += 1) {
    for (let j = 0; j < CITY.roadsZ; j += 1) {
      for (const side of [-1, 1]) {
        const edge = side * (HALF_ROAD - 0.55);
        if (i < CITY.roadsX - 1) paint.addFlat(i * P + P / 2, 0.03, j * P + edge, P - CITY.road - 5.4, 0.16, '#e4e3dc');
        if (j < CITY.roadsZ - 1) paint.addFlat(i * P + edge, 0.03, j * P + P / 2, 0.16, P - CITY.road - 5.4, '#e4e3dc');
      }
      if (i < CITY.roadsX - 1) {
        for (let along = HALF_ROAD + 6; along < P - HALF_ROAD - 5; along += 7) paint.addFlat(i * P + along + 1.5, 0.03, j * P, 3, 0.22, '#f2c744');
        paint.addFlat(i * P + HALF_ROAD + 3.4, 0.03, j * P - 3, 0.45, 6, '#f1f1ea');
        paint.addFlat((i + 1) * P - HALF_ROAD - 3.4, 0.03, j * P + 3, 0.45, 6, '#f1f1ea');
      }
      if (j < CITY.roadsZ - 1) {
        for (let along = HALF_ROAD + 6; along < P - HALF_ROAD - 5; along += 7) paint.addFlat(i * P, 0.03, j * P + along + 1.5, 0.22, 3, '#f2c744');
        paint.addFlat(i * P + 3, 0.03, j * P + HALF_ROAD + 3.4, 6, 0.45, '#f1f1ea');
        paint.addFlat(i * P - 3, 0.03, (j + 1) * P - HALF_ROAD - 3.4, 6, 0.45, '#f1f1ea');
      }
    }
  }
}

/** Zebra stripes across each arm of each intersection. */
function paintCrosswalks(paint) {
  for (let i = 0; i < CITY.roadsX; i += 1) {
    for (let j = 0; j < CITY.roadsZ; j += 1) {
      for (let stripe = -4.8; stripe <= 4.8; stripe += 1.6) {
        if (i < CITY.roadsX - 1) paint.addFlat(i * P + HALF_ROAD + 1.5, 0.03, j * P + stripe, 2.4, 0.7, '#ecebe4');
        if (i > 0) paint.addFlat(i * P - HALF_ROAD - 1.5, 0.03, j * P + stripe, 2.4, 0.7, '#ecebe4');
        if (j < CITY.roadsZ - 1) paint.addFlat(i * P + stripe, 0.03, j * P + HALF_ROAD + 1.5, 0.7, 2.4, '#ecebe4');
        if (j > 0) paint.addFlat(i * P + stripe, 0.03, j * P - HALF_ROAD - 1.5, 0.7, 2.4, '#ecebe4');
      }
    }
  }
}
