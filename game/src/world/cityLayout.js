// The map of Solmara as data: its districts, street names, block rectangles and the landmarks the story visits.
import { CITY } from '../core/config.js';

export const DISTRICTS = {
  playa: { name: 'Playa Dorada', ground: '#d9c9a3', map: '#f2c08a' },
  centro: { name: 'Centro Alto', ground: '#b9bcc2', map: '#9fb6d6' },
  mercado: { name: 'El Mercado', ground: '#c4b8a6', map: '#e3b4a0' },
  colinas: { name: 'Las Colinas', ground: '#7fae5c', map: '#a9d08a' },
  puerto: { name: 'Puerto Viejo', ground: '#9a9a96', map: '#b7b2a8' },
  jardin: { name: 'Jardín del Sol', ground: '#6fb24f', map: '#7fcf6a' },
};

export const AVENUES = ['Ocean Drive', 'Avenida Coral', 'Flamingo Way', 'Calle Mango', 'Paseo Bravo', 'Grand Solmara Ave', 'Tidewave Blvd', 'Calle Lima', 'Avenida Ámbar', 'Pelican Row', 'Camino Alto', 'Sierra Parkway'];
export const STREETS = ['Mirador Road', 'Hibiscus Street', 'Calle Uno', 'Sunset Street', 'Marlin Street', 'Calle Cinco', 'Neon Street', 'Cannery Road', 'Harbor Street', 'Dockside Way'];

const P = CITY.pitch;
const HALF_ROAD = CITY.road / 2;

export function districtOfBlock(i, j) {
  if (j >= 7) return 'puerto';
  if (i <= 1) return 'playa';
  if (i === 3 && (j === 3 || j === 4)) return 'jardin';
  if (j <= 1) return 'colinas';
  if (i >= 4 && i <= 7 && j >= 3 && j <= 5) return 'centro';
  return 'mercado';
}

/** The kerb-to-kerb rectangle of block (i, j): the sidewalk slab and everything built on it. */
export function blockRect(i, j) {
  return { minX: i * P + HALF_ROAD, maxX: (i + 1) * P - HALF_ROAD, minZ: j * P + HALF_ROAD, maxZ: (j + 1) * P - HALF_ROAD };
}

export function blockIndexAt(x, z) {
  return { i: Math.floor(x / P), j: Math.floor(z / P) };
}

export function isInsideCity(x, z) {
  return x >= -HALF_ROAD && x <= CITY.width + HALF_ROAD && z >= -HALF_ROAD && z <= CITY.depth + HALF_ROAD;
}

/** True on a sidewalk or building lot, false on asphalt or outside the grid. */
export function isOnBlock(x, z) {
  if (x < 0 || z < 0 || x > CITY.width || z > CITY.depth) return false;
  const lx = x % P;
  const lz = z % P;
  return lx > HALF_ROAD && lx < P - HALF_ROAD && lz > HALF_ROAD && lz < P - HALF_ROAD;
}

/** The ground is flat: the roads at 0 and the sidewalk slabs one kerb higher. */
export function groundHeight(x, z) {
  return isOnBlock(x, z) ? CITY.curb : 0;
}

/** The district name the HUD shows for a position. */
export function districtNameAt(x, z) {
  if (x < -HALF_ROAD) return 'Playa Dorada Beach';
  if (z > CITY.depth + HALF_ROAD) return 'Puerto Viejo Docks';
  const i = Math.min(Math.max(Math.floor(x / P), 0), CITY.roadsX - 2);
  const j = Math.min(Math.max(Math.floor(z / P), 0), CITY.roadsZ - 2);
  return DISTRICTS[districtOfBlock(i, j)].name;
}

/** The nearest street's name, for the HUD line under the minimap. */
export function streetNameAt(x, z) {
  const ix = Math.min(Math.max(Math.round(x / P), 0), CITY.roadsX - 1);
  const jz = Math.min(Math.max(Math.round(z / P), 0), CITY.roadsZ - 1);
  return Math.abs(x - ix * P) < Math.abs(z - jz * P) ? AVENUES[ix] : STREETS[jz];
}

/** A spot on block (i, j)'s south sidewalk, `t` of the way along it; landmarks and markers stand there. */
export function sidewalkSpot(i, j, t = 0.5) {
  const rect = blockRect(i, j);
  return { x: rect.minX + (rect.maxX - rect.minX) * t, z: rect.maxZ - 1.6 };
}

/** The kerbside road spot beside a sidewalk spot: where a car stops for that landmark. */
export function kerbSpot(i, j, t = 0.5) {
  const spot = sidewalkSpot(i, j, t);
  return { x: spot.x, z: (j + 1) * P - 5 };
}

function landmark(id, name, i, j, color, icon, subtitle) {
  return { id, name, block: [i, j], color, icon, subtitle, ...sidewalkSpot(i, j), kerb: kerbSpot(i, j) };
}

/** The named places of the story, each on the south sidewalk of its block. */
export const LANDMARKS = {
  safehouse: landmark('safehouse', 'CASA REYES', 1, 5, '#2bb673', 'H', 'safehouse · save game'),
  garage: landmark('garage', 'BRAVO MOTORS', 3, 6, '#f39c12', 'B', 'tío bravo · chop shop'),
  radio: landmark('radio', 'TIDEWAVE FM', 2, 2, '#e84393', 'J', 'jazz · 98.6'),
  gunShop: landmark('gunShop', 'AMMO AMIGO', 6, 2, '#c0392b', 'A', 'guns · armor'),
  respray: landmark('respray', 'FRESH COAT CUSTOMS', 8, 5, '#16a085', 'S', 'respray · repairs'),
  hospital: landmark('hospital', 'SANTA BRISA MEDICAL', 8, 2, '#e74c3c', '+', 'emergency'),
  police: landmark('police', 'SOLMARA P.D.', 6, 6, '#2e6fd8', 'P', 'headquarters'),
  bank: landmark('bank', 'BANCO MARLIN', 5, 4, '#b8962e', '$', 'private banking'),
  docks: landmark('docks', 'MARLIN FREIGHT', 4, 8, '#7f8c8d', 'M', 'pier 9'),
  beachLot: landmark('beachLot', 'PLAYA PARKING', 0, 3, '#3498db', 'C', 'beach parking'),
};
