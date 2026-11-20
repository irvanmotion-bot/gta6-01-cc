// Lays the ground of the city: asphalt, lane paint, crosswalks, sidewalk slabs and each district's lot surface.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { MeshBatcher } from '../render/meshBatcher.js';
import { blockRect, districtOfBlock, DISTRICTS } from './cityLayout.js';

const P = CITY.pitch;
const HALF_ROAD = CITY.road / 2;

export function buildStreetsAndGround(scene) {
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.width + CITY.road, CITY.depth + CITY.road),
    new THREE.MeshStandardMaterial({ color: 0x3b3e45, roughness: 0.95 }),
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
      slabs.addBox(cx, 0, cz, size, CITY.curb, size, district === 'jardin' ? '#cfc6b0' : '#c9c5bb');
      const inner = size - CITY.sidewalk * 2;
      slabs.addBox(cx, CITY.curb, cz, inner, 0.03, inner, DISTRICTS[district].ground);
    }
  }
  scene.add(paint.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), { castShadow: false }));
  scene.add(slabs.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), { castShadow: false }));
}

/** A dashed yellow centre line on every road segment, with solid white stop lines before each intersection. */
function paintLaneMarkings(paint) {
  for (let i = 0; i < CITY.roadsX; i += 1) {
    for (let j = 0; j < CITY.roadsZ; j += 1) {
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
