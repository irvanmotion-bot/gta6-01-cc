// What stands on the pavements of Saros between the trees and lamps: benches, bins, hydrants, news boxes, planters,
// parking meters, bus shelters and corner bollards, plus the kiosks, surfboard racks and benches of the boardwalk.
// The city is cut into chunks of three blocks by three, one merged mesh each, so furniture out of view is not drawn.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { blockRect, districtOfBlock } from './cityLayout.js';

const CHUNK_BLOCKS = 3;
const KERB_GAP = 0.75;
const BOX_COLORS = ['#2f6fd8', '#e74c3c', '#f1c40f', '#16a085', '#e84393'];
const FLOWERS = ['#ff5fa2', '#ffd23f', '#ff7b3a', '#b46bff', '#ffffff'];
const BOARD_COLORS = ['#ff5e5b', '#ffd60a', '#1fb5a6', '#35d0ff', '#f062b0', '#ffffff', '#ff9f1c'];
const shrub = new THREE.IcosahedronGeometry(1, 0);
const umbrella = new THREE.ConeGeometry(1, 0.5, 8);

export class StreetFurniture {
  constructor(scene) {
    this.rng = new SeededRandom(CITY.seed + 909);
    this.chunks = new Map();
    for (let i = 0; i < CITY.roadsX - 1; i += 1) {
      for (let j = 0; j < CITY.roadsZ - 1; j += 1) {
        const district = districtOfBlock(i, j);
        if (district !== 'jacaranda') this.furnishBlock(blockRect(i, j), district, this.chunkOf(`${Math.floor(i / CHUNK_BLOCKS)},${Math.floor(j / CHUNK_BLOCKS)}`));
      }
    }
    for (let z = 20; z < CITY.depth - 10; z += 240) this.furnishBoardwalk(z, Math.min(z + 240, CITY.depth - 10), this.chunkOf(`boardwalk${z}`));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
    this.count = 0;
    for (const batch of this.chunks.values()) {
      if (batch.isEmpty()) continue;
      scene.add(batch.build(material));
      this.count += 1;
    }
  }

  chunkOf(key) {
    if (!this.chunks.has(key)) this.chunks.set(key, new MeshBatcher());
    return this.chunks.get(key);
  }

  /** Walk the four pavements of a block and set something down every few metres, clear of the landmark's door. */
  furnishBlock(rect, district, batch) {
    const rng = this.rng;
    const size = rect.maxX - rect.minX;
    const busy = district === 'orrery' || district === 'azimuth' || district === 'strand';
    const edges = [
      [rect.minX, rect.minZ + KERB_GAP, 1, 0, 0, -1], [rect.minX, rect.maxZ - KERB_GAP, 1, 0, 0, 1],
      [rect.minX + KERB_GAP, rect.minZ, 0, 1, -1, 0], [rect.maxX - KERB_GAP, rect.minZ, 0, 1, 1, 0],
    ];
    edges.forEach(([x0, z0, tx, tz, nx, nz], edge) => {
      for (let t = 15.5; t < size - 8; t += 13) {
        // The south pavement's middle belongs to the block's landmark: its marker, its sign and the people using it.
        if (edge === 1 && t > size / 2 - 6 && t < size / 2 + 13) continue;
        if (!rng.chance(busy ? 0.8 : 0.45)) continue;
        this.placeItem(batch, x0 + tx * t, z0 + tz * t, tx, tz, nx, nz, district);
      }
      // Bollards guard both ends of the pavement where it meets the crossing.
      for (const t of [2.2, size - 2.2]) {
        const px = x0 + tx * t - nx * 0.25;
        const pz = z0 + tz * t - nz * 0.25;
        batch.addBox(px, CITY.curb, pz, 0.22, 0.85, 0.22, '#f2c744');
        batch.addBox(px, CITY.curb + 0.55, pz, 0.24, 0.12, 0.24, '#22252a');
      }
    });
  }

  /** One piece of furniture at a kerbside spot; (tx, tz) runs along the pavement and (nx, nz) points at the road. */
  placeItem(batch, x, z, tx, tz, nx, nz, district) {
    const rng = this.rng;
    const y = CITY.curb;
    // A box `along` the pavement by `across` it, shifted `back` metres away from the road.
    const box = (y0, along, height, across, color, back = 0, slide = 0) => {
      batch.addBox(x - nx * back + tx * slide, y0, z - nz * back + tz * slide, tx ? along : across, height, tz ? along : across, color);
    };
    const roll = rng.next();
    if (roll < 0.2) {
      const wood = rng.pick(['#9a6a44', '#1f8f86', '#c9503f']);
      box(y + 0.38, 1.7, 0.1, 0.5, wood);
      box(y + 0.48, 1.7, 0.5, 0.08, wood, 0.24);
      box(y, 0.1, 0.4, 0.46, '#2b2f34', 0, -0.7);
      box(y, 0.1, 0.4, 0.46, '#2b2f34', 0, 0.7);
    } else if (roll < 0.36) {
      box(y, 0.55, 0.95, 0.55, rng.pick(['#2f7d5f', '#34495e', '#d35400']));
      box(y + 0.95, 0.62, 0.1, 0.62, '#1d2024');
    } else if (roll < 0.47) {
      box(y, 0.3, 0.55, 0.3, '#e03a2f');
      box(y + 0.55, 0.2, 0.16, 0.2, '#f4f1e4');
      box(y + 0.3, 0.5, 0.14, 0.14, '#e03a2f');
    } else if (roll < 0.6) {
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        box(y + 0.12, 0.5, 0.95, 0.46, rng.pick(BOX_COLORS), 0, (k - (count - 1) / 2) * 0.6);
        box(y, 0.36, 0.12, 0.3, '#22252a', 0, (k - (count - 1) / 2) * 0.6);
      }
    } else if (roll < 0.78) {
      box(y, 1.5, 0.5, 1.0, district === 'orrery' ? '#d9d4c7' : '#c96f4a');
      batch.addGeometry(shrub, placement(x, y + 0.75, z, rng.range(0, 3), tx ? 0.75 : 0.5, 0.45, tz ? 0.75 : 0.5), '#3f9b4b');
      for (let k = 0; k < 4; k += 1) box(y + 0.85 + (k % 2) * 0.12, 0.2, 0.18, 0.2, rng.pick(FLOWERS), rng.range(-0.25, 0.25), -0.5 + k * 0.33);
    } else if (roll < 0.9) {
      for (const slide of [-1.6, 1.6]) {
        box(y, 0.09, 1.15, 0.09, '#5c6670', 0, slide);
        box(y + 1.15, 0.2, 0.3, 0.16, '#2b2f34', 0, slide);
      }
    } else {
      // A bus shelter: posts, a tinted back wall, a bright roof, a bench and the stop's sign.
      const roof = rng.pick(['#ff9f1c', '#1fb5a6', '#e84393', '#2f6fd8']);
      for (const slide of [-1.6, 1.6]) box(y, 0.1, 2.4, 0.1, '#3a3f45', 0.45, slide);
      box(y + 0.5, 3.2, 1.7, 0.06, '#7fc4dc', 0.5);
      box(y + 2.4, 3.6, 0.14, 1.5, roof, 0.1);
      box(y + 0.4, 2.2, 0.09, 0.42, '#cfd4d8', 0.25);
      box(y, 0.09, 2.9, 0.09, '#3a3f45', -0.2, 2.3);
      box(y + 2.3, 0.6, 0.6, 0.06, roof, -0.2, 2.3);
    }
  }

  /** The sea side of the boardwalk from z0 to z1: benches facing the water, snack kiosks and racks of surfboards. */
  furnishBoardwalk(z0, z1, batch) {
    const rng = this.rng;
    for (let z = z0; z < z1; z += 9) {
      const roll = rng.next();
      if (roll < 0.3) {
        batch.addBox(-11.5, 0.6, z, 0.5, 0.1, 1.7, '#f4f1e4');
        batch.addBox(-11.25, 0.7, z, 0.08, 0.5, 1.7, '#f4f1e4');
        batch.addBox(-11.5, 0.22, z - 0.7, 0.46, 0.4, 0.1, '#2b2f34');
        batch.addBox(-11.5, 0.22, z + 0.7, 0.46, 0.4, 0.1, '#2b2f34');
      } else if (roll < 0.5) {
        // Surfboards stood in a rack on the sand.
        batch.addBox(-13.6, 0, z, 0.12, 1.1, 3.2, '#8a5a3a');
        for (let k = 0; k < 5; k += 1) batch.addBox(-13.6 + 0.16, 0.1, z - 1.3 + k * 0.65, 0.09, rng.range(1.9, 2.4), 0.5, rng.pick(BOARD_COLORS));
      } else if (roll < 0.66) {
        // A kiosk with a striped canopy, a counter and a parasol table beside it.
        const paint = rng.pick(BOARD_COLORS);
        batch.addBox(-14.8, 0, z, 2.6, 2.3, 3, '#fdf6e3');
        batch.addBox(-14.8, 2.3, z, 3, 0.16, 3.4, paint);
        batch.addBox(-13.2, 1.9, z, 1.1, 0.1, 3.2, paint);
        batch.addBox(-13.45, 0.9, z, 0.12, 0.12, 2.6, '#8a5a3a');
        batch.addBox(-14.8, 2.46, z, 2.2, 0.7, 0.14, paint);
        batch.addBox(-13.8, 0, z + 3.4, 0.08, 2.2, 0.08, '#f5f5f5');
        batch.addGeometry(umbrella, placement(-13.8, 2.2, z + 3.4, 0, 1.5, 1.2, 1.5), rng.pick(BOARD_COLORS));
        batch.addBox(-13.8, 0, z + 3.4, 0.9, 0.75, 0.9, '#d9d4c7');
      }
    }
  }
}
