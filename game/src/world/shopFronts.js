// Shopfronts: name boards for Solmara's own shops above the awnings, and neon blade signs that stick out from the
// walls and glow after dark. Every board shares one painted atlas, so all of them draw in one call.
import * as THREE from 'three';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';

export class ShopFronts {
  constructor(seed) {
    this.rng = new SeededRandom(seed);
    this.boards = new MeshBatcher();
    this.neon = new MeshBatcher();
    this.neonSpots = [];
    this.count = 0;
  }

  /** A name board on a wall whose outward normal is (nx, nz), centred on (x, z) at height y. */
  addBoard(x, y, z, nx, nz, width) {
    const cell = this.count % SHOP_NAMES.length;
    this.count += 1;
    const column = cell % ATLAS_COLUMNS;
    const row = Math.floor(cell / ATLAS_COLUMNS);
    const uvOf = (i, u, v) => [(column + u) / ATLAS_COLUMNS, 1 - (row + 1 - v) / ATLAS_ROWS];
    this.boards.addGeometry(boardShape, placement(x + nx * 0.08, y, z + nz * 0.08, Math.atan2(nx, nz), width, width / 4, 1), '#ffffff', uvOf);
  }

  /** A vertical neon blade standing out from the wall, and the spot its glow is drawn at. */
  addNeonBlade(x, y, z, nx, nz, height) {
    const color = this.rng.pick(NEON_COLORS);
    this.neon.addBox(x + nx * 0.75, y, z + nz * 0.75, nx ? 1.3 : 0.3, height, nz ? 1.3 : 0.3, color);
    this.neonSpots.push({ x: x + nx * 0.9, y: y + height / 2, z: z + nz * 0.9, color });
  }

  /** A thin neon tube along a shopfront, under the edge of its awning. */
  addNeonTube(x, y, z, nx, nz, length) {
    const color = this.rng.pick(NEON_COLORS);
    this.neon.addBox(x + nx * 0.1, y, z + nz * 0.1, nx ? 0.16 : length, 0.16, nz ? 0.16 : length, color);
    this.neonSpots.push({ x: x + nx * 0.5, y, z: z + nz * 0.5, color });
  }

  /** Dress one street-facing wall: usually a board, sometimes a blade, sometimes a tube. */
  dressWall(x, z, nx, nz, width) {
    const rng = this.rng;
    if (rng.chance(0.7)) this.addBoard(x, 5.05, z, nx, nz, Math.min(Math.max(width * 0.5, 5), 9));
    if (rng.chance(0.3)) this.addNeonBlade(x + nz * width * 0.42, 5.5, z + nx * width * 0.42, nx, nz, rng.range(3.5, 6.5));
    if (rng.chance(0.35)) this.addNeonTube(x, 3.05, z, nx, nz, width * 0.8);
  }

  build(scene) {
    this.boardMaterial = new THREE.MeshBasicMaterial({ map: paintShopSignAtlas(), vertexColors: true });
    this.neonMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    scene.add(this.boards.build(this.boardMaterial, { castShadow: false, receiveShadow: false }));
    scene.add(this.neon.build(this.neonMaterial, { castShadow: true, receiveShadow: false }));
  }

  /** By day the boards and tubes are painted signs; by night they are lit. */
  setNight(night) {
    this.boardMaterial.color.setScalar(0.82 + night * 0.3);
    this.neonMaterial.color.setScalar(0.85 + night * 0.9);
  }
}

/** Paint every shop's board into one canvas: a grid of coloured boards with the shop's name in bold. */
function paintShopSignAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * 512;
  canvas.height = ATLAS_ROWS * 128;
  const c = canvas.getContext('2d');
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  SHOP_NAMES.forEach(([name, background, ink], index) => {
    const x = (index % ATLAS_COLUMNS) * 512;
    const y = Math.floor(index / ATLAS_COLUMNS) * 128;
    c.fillStyle = background;
    c.fillRect(x, y, 512, 128);
    c.strokeStyle = ink;
    c.lineWidth = 8;
    c.strokeRect(x + 10, y + 10, 492, 108);
    c.fillStyle = ink;
    let size = 78;
    c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    while (c.measureText(name).width > 440 && size > 24) { size -= 4; c.font = `900 ${size}px Impact, "Arial Black", sans-serif`; }
    c.fillText(name, x + 256, y + 68);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const boardShape = new THREE.PlaneGeometry(1, 1);
const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = 8;
const NEON_COLORS = ['#ff2d95', '#35d0ff', '#ffe14d', '#7dff6a', '#b06cff', '#ff7a1a'];

/** Solmara's shops: name, board colour, lettering colour. */
const SHOP_NAMES = [
  ['CAFÉ LUNA', '#3b1f5e', '#ffe14d'], ['TACO BRAVO', '#d93a1f', '#fff3d6'], ['SURF SHACK', '#0e8fa8', '#ffffff'], ['MODA ROSA', '#ff5fa2', '#2b0a1c'],
  ['PIXEL ARCADE', '#141a3a', '#35d0ff'], ['FARMACIA SOL', '#ffffff', '#1f9d55'], ['DISCOS DEL MAR', '#15151a', '#ff7a1a'], ['PAN DE ORO', '#f2c14e', '#4a2a0a'],
  ['HOTEL CORAL', '#ff7b6b', '#ffffff'], ['JUGOS TRÓPICO', '#2bb673', '#fff9c4'], ['BARBERÍA REY', '#1c2a4a', '#f5f5f5'], ['GELATO NUBE', '#bfe9ff', '#b0306a'],
  ['EL FARO BAR', '#0b3b5a', '#ffd60a'], ['LAVANDERÍA OLA', '#e8f6ff', '#1f6fd8'], ['MERCADO 24', '#e74c3c', '#ffffff'], ['TATTOO SIRENA', '#101014', '#7dff6a'],
];
