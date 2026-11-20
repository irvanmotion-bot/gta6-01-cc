// Raises the buildings of Saros block by block: glass towers on Orrery Square, pastel hotels on the Strand, shops, houses and warehouses.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { createFacadeTextures, createSignTexture, createBillboardTexture, FACADE_TILE } from '../render/proceduralTextures.js';
import { blockRect, districtOfBlock, LANDMARKS } from './cityLayout.js';
import { ShopFronts } from './shopFronts.js';

const TINTS = {
  orrery: ['#8fd3e8', '#a8c8e8', '#f2d7b6', '#9ad1c4', '#e6eef5', '#f4b6a6', '#7fb8d8', '#c5b8e8'],
  strand: ['#ffd1dc', '#bfe9e3', '#fff1b8', '#ffcba4', '#c9d8ff', '#f9f3e6', '#aee6f5', '#ffb3a7'],
  azimuth: ['#f6d6ad', '#e9967a', '#f7e7ce', '#d8a48f', '#c8d6c1', '#e8c4a0', '#f0e0d0', '#b5cde0', '#f2b872'],
  hill: ['#fff4e0', '#ffe0c2', '#e8f0d8', '#f7d9d0', '#dfeaf5', '#fbe8a6'],
  yards: ['#9db4c0', '#c2b8a3', '#b56b5a', '#7d9a8c', '#d0d0cc', '#6f8fae'],
};
const AWNINGS = ['#e74c3c', '#16a085', '#f39c12', '#2980b9', '#e84393', '#27ae60', '#ffffff'];
const CONTAINER_COLORS = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#839192', '#e67e22'];

/** The brands of Saros, on the rooftop billboards: half the town is selling the eclipse. */
export const BRANDS = [
  { name: 'ECLIPSE WEEK', slogan: 'Totality · Friday 17:12', colors: ['#1a1640', '#f08a5d'], ink: '#fff3d6' },
  { name: 'UMBRA COLA', slogan: 'Drink it in the dark.', colors: ['#ff5e3a', '#ffb347'], ink: '#fff8e7' },
  { name: 'PENUMBRA 98.6', slogan: 'Jazz counts you down.', colors: ['#f08a5d', '#5b3a8c'], ink: '#ffffff' },
  { name: 'GNOMON SHADES', slogan: 'Look up. Safely.', colors: ['#f7b733', '#fc4a1a'], ink: '#2d1600' },
  { name: 'ORRERY TRUST', slogan: 'Your money sleeps with us.', colors: ['#0f2027', '#2c5364'], ink: '#e8c96a' },
  { name: 'AVOCET AIR', slogan: 'Fly in for four minutes of night.', colors: ['#1fa2ff', '#a6ffcb'], ink: '#0b2a4a' },
];
const BILLBOARD_BLOCKS = [[2, 5], [5, 2], [7, 6], [1, 2], [9, 4], [4, 6]];

const cone4 = new THREE.ConeGeometry(0.72, 1, 4);
cone4.rotateY(Math.PI / 4);

function splitLot(lot, countX, countZ, gap) {
  const cells = [];
  const width = (lot.maxX - lot.minX - gap * (countX - 1)) / countX;
  const depth = (lot.maxZ - lot.minZ - gap * (countZ - 1)) / countZ;
  for (let a = 0; a < countX; a += 1) {
    for (let b = 0; b < countZ; b += 1) {
      const minX = lot.minX + a * (width + gap);
      const minZ = lot.minZ + b * (depth + gap);
      cells.push({ minX, minZ, maxX: minX + width, maxZ: minZ + depth, edgeN: b === 0, edgeS: b === countZ - 1, edgeW: a === 0, edgeE: a === countX - 1 });
    }
  }
  return cells;
}

export class CityBuildings {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.rng = new SeededRandom(CITY.seed);
    this.batches = {};
    this.materials = {};
    for (const style of Object.keys(FACADE_TILE)) {
      this.batches[style] = new MeshBatcher();
      const textures = createFacadeTextures(style, CITY.seed + style.length * 77);
      this.materials[style] = new THREE.MeshStandardMaterial({
        map: textures.day, vertexColors: true, roughness: style === 'office' ? 0.32 : 0.82, metalness: style === 'office' ? 0.25 : 0,
        emissiveMap: textures.night, emissive: 0xffffff, emissiveIntensity: 0,
      });
    }
    this.plain = new MeshBatcher();
    this.fronts = new ShopFronts(CITY.seed + 303);
    this.roofHeights = new Map();

    for (let i = 0; i < CITY.roadsX - 1; i += 1) {
      for (let j = 0; j < CITY.roadsZ - 1; j += 1) this.fillBlock(i, j, districtOfBlock(i, j));
    }
    for (const style of Object.keys(this.batches)) {
      if (!this.batches[style].isEmpty()) scene.add(this.batches[style].build(this.materials[style]));
    }
    scene.add(this.plain.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
    this.fronts.build(scene);
    this.addLandmarkSigns();
    this.addBillboards();
  }

  /** One building: its box in the style's batch, a collider and a parapet; returns the roof height. */
  raise(cell, inset, height, style, tint) {
    const minX = cell.minX + inset;
    const maxX = cell.maxX - inset;
    const minZ = cell.minZ + inset;
    const maxZ = cell.maxZ - inset;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    this.batches[style].addBox(cx, CITY.curb, cz, width, height, depth, tint, { tile: FACADE_TILE[style], uvOffset: this.rng.int(0, 3) * 0.25 });
    this.plain.addBox(cx, CITY.curb + height, cz, width + 0.5, 0.6, depth + 0.5, '#f4efe6');
    this.collision.addBox(minX, minZ, maxX, maxZ, height + 1);
    return { cx, cz, width, depth, top: CITY.curb + height + 0.6 };
  }

  roofClutter(roof, count) {
    for (let k = 0; k < count; k += 1) {
      const size = this.rng.range(1.6, 3.4);
      this.plain.addBox(
        roof.cx + this.rng.range(-0.3, 0.3) * roof.width, roof.top, roof.cz + this.rng.range(-0.3, 0.3) * roof.depth,
        size, this.rng.range(1, 2.4), size, this.rng.pick(['#b8bcc0', '#d9d4c7', '#8e9aa3']),
      );
    }
  }

  awnings(cell, inset, color) {
    const cx = (cell.minX + cell.maxX) / 2;
    const cz = (cell.minZ + cell.maxZ) / 2;
    const width = cell.maxX - cell.minX - inset * 2;
    const depth = cell.maxZ - cell.minZ - inset * 2;
    if (cell.edgeS) this.plain.addBox(cx, 3.3, cell.maxZ - inset + 0.7, width * 0.9, 0.25, 1.5, color);
    if (cell.edgeN) this.plain.addBox(cx, 3.3, cell.minZ + inset - 0.7, width * 0.9, 0.25, 1.5, color);
    if (cell.edgeE) this.plain.addBox(cell.maxX - inset + 0.7, 3.3, cz, 1.5, 0.25, depth * 0.9, color);
    if (cell.edgeW) this.plain.addBox(cell.minX + inset - 0.7, 3.3, cz, 1.5, 0.25, depth * 0.9, color);
    this.shopfronts(cell, inset);
  }

  /** Name boards and neon on every wall of a building that faces a street. */
  shopfronts(cell, inset) {
    const cx = (cell.minX + cell.maxX) / 2;
    const cz = (cell.minZ + cell.maxZ) / 2;
    const width = cell.maxX - cell.minX - inset * 2;
    const depth = cell.maxZ - cell.minZ - inset * 2;
    if (cell.edgeS) this.fronts.dressWall(cx, cell.maxZ - inset, 0, 1, width);
    if (cell.edgeN) this.fronts.dressWall(cx, cell.minZ + inset, 0, -1, width);
    if (cell.edgeE) this.fronts.dressWall(cell.maxX - inset, cz, 1, 0, depth);
    if (cell.edgeW) this.fronts.dressWall(cell.minX + inset, cz, -1, 0, depth);
  }

  fillBlock(i, j, district) {
    const rng = this.rng;
    const rect = blockRect(i, j);
    const s = CITY.sidewalk;
    const lot = { minX: rect.minX + s, maxX: rect.maxX - s, minZ: rect.minZ + s, maxZ: rect.maxZ - s };
    let tallest = 0;
    if (district === 'orrery') {
      const cells = rng.chance(0.45) ? splitLot(lot, 1, 1, 0) : rng.chance(0.5) ? splitLot(lot, 2, 1, 5) : splitLot(lot, 1, 2, 5);
      for (const cell of cells) {
        const tint = rng.pick(TINTS.orrery);
        const podium = this.raise(cell, 1, rng.range(7, 11), 'shop', '#e9e4da');
        this.shopfronts(cell, 1);
        const height = rng.range(48, cells.length === 1 ? 165 : 120);
        const shrink = { minX: cell.minX + 5, maxX: cell.maxX - 5, minZ: cell.minZ + 5, maxZ: cell.maxZ - 5 };
        const tower = this.raise(shrink, rng.range(0, 3), height, 'office', tint);
        if (rng.chance(0.6)) {
          const crownHeight = rng.range(10, 30);
          const crown = { minX: shrink.minX + 5, maxX: shrink.maxX - 5, minZ: shrink.minZ + 5, maxZ: shrink.maxZ - 5 };
          this.batches.office.addBox((crown.minX + crown.maxX) / 2, tower.top, (crown.minZ + crown.maxZ) / 2, crown.maxX - crown.minX, crownHeight, crown.maxZ - crown.minZ, tint, { tile: FACADE_TILE.office });
          this.plain.addBox(tower.cx, tower.top + crownHeight, tower.cz, 0.6, rng.range(8, 22), 0.6, '#d0d6da');
          tallest = Math.max(tallest, tower.top + crownHeight);
        } else {
          this.roofClutter(tower, 3);
        }
        tallest = Math.max(tallest, tower.top, podium.top);
      }
    } else if (district === 'strand') {
      for (const cell of splitLot(lot, 2, 2, 5)) {
        const tint = rng.pick(TINTS.strand);
        const roof = this.raise(cell, rng.range(0.5, 2.5), rng.range(13, 36), 'hotel', tint);
        this.plain.addBox(roof.cx, roof.top, roof.cz, roof.width * 0.4, 2.2, roof.depth * 0.4, tint);
        this.awnings(cell, 0.5, rng.pick(AWNINGS));
        tallest = Math.max(tallest, roof.top);
      }
    } else if (district === 'azimuth') {
      for (const cell of splitLot(lot, rng.chance(0.5) ? 3 : 2, 2, 3)) {
        const roof = this.raise(cell, rng.range(0, 1.5), rng.range(8, 26), rng.chance(0.55) ? 'shop' : 'hotel', rng.pick(TINTS.azimuth));
        this.roofClutter(roof, rng.int(0, 2));
        this.awnings(cell, 0, rng.pick(AWNINGS));
        tallest = Math.max(tallest, roof.top);
      }
    } else if (district === 'hill') {
      for (const cell of splitLot(lot, 3, 3, 6)) {
        if (rng.chance(0.14)) continue;
        const height = rng.range(4.4, 7.2);
        const roof = this.raise(cell, rng.range(1.5, 3), height, 'house', rng.pick(TINTS.hill));
        this.plain.addGeometry(cone4, placement(roof.cx, roof.top + 1.3, roof.cz, 0, roof.width * 1.05, 3, roof.depth * 1.05), rng.pick(['#c0553a', '#a8432c', '#d06b45', '#8c5a3c']));
        tallest = Math.max(tallest, roof.top);
      }
    } else if (district === 'yards') {
      const cells = rng.chance(0.5) ? splitLot(lot, 2, 1, 14) : splitLot(lot, 1, 2, 14);
      const warehouse = cells[rng.int(0, 1)];
      for (const cell of cells) {
        if (cell === warehouse || rng.chance(0.35)) {
          const roof = this.raise(cell, 2, rng.range(9, 15), 'warehouse', rng.pick(TINTS.yards));
          this.roofClutter(roof, 2);
          tallest = Math.max(tallest, roof.top);
        } else {
          this.stackContainers(cell);
        }
      }
    }
    this.roofHeights.set(`${i},${j}`, tallest);
  }

  /** A yard of shipping containers, stacked up to three high. */
  stackContainers(cell) {
    const rng = this.rng;
    for (let x = cell.minX + 4; x < cell.maxX - 4; x += 5.2) {
      for (let z = cell.minZ + 8; z < cell.maxZ - 8; z += 15) {
        const levels = rng.int(0, 3);
        for (let level = 0; level < levels; level += 1) {
          this.plain.addBox(x, CITY.curb + level * 2.6, z, 2.5, 2.55, 12, rng.pick(CONTAINER_COLORS));
        }
        if (levels > 0) this.collision.addBox(x - 1.25, z - 6, x + 1.25, z + 6, levels * 2.6);
      }
    }
  }

  /** A two-post street sign with the landmark's name, facing the road beside its marker. */
  addLandmarkSigns() {
    for (const place of Object.values(LANDMARKS)) {
      const texture = createSignTexture(place.name, place.color, '#ffffff', place.subtitle);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
      board.position.set(place.x + 7, 4.4, place.z - 1.1);
      this.scene.add(board);
      this.plain.addBox(place.x + 3.3, CITY.curb, place.z - 1.1, 0.22, 4.6, 0.22, '#3a3f45');
      this.plain.addBox(place.x + 10.7, CITY.curb, place.z - 1.1, 0.22, 4.6, 0.22, '#3a3f45');
    }
  }

  addBillboards() {
    BILLBOARD_BLOCKS.forEach(([i, j], index) => {
      const rect = blockRect(i, j);
      const top = (this.roofHeights.get(`${i},${j}`) || 12) + 0.2;
      const material = new THREE.MeshBasicMaterial({ map: createBillboardTexture(BRANDS[index % BRANDS.length]), side: THREE.DoubleSide });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), material);
      const west = index % 2 === 0;
      board.position.set(west ? rect.minX + 9 : (rect.minX + rect.maxX) / 2, Math.min(top, 40) + 6, west ? (rect.minZ + rect.maxZ) / 2 : rect.maxZ - 9);
      if (west) board.rotation.y = -Math.PI / 2;
      this.scene.add(board);
    });
  }

  /** Light the windows as night falls. */
  setNight(night) {
    for (const material of Object.values(this.materials)) material.emissiveIntensity = night * 1.35;
    this.fronts.setNight(night);
  }
}
