// The map of Saros as data: its districts, street names, block rectangles and the landmarks the story visits.
import { CITY } from '../core/config.js';

export const DISTRICTS = {
  strand: { name: 'Gnomon Strand', ground: '#d9c9a3', map: '#f0c48c' },
  orrery: { name: 'Orrery Square', ground: '#b9bcc2', map: '#a9b4d0' },
  azimuth: { name: 'Azimuth Market', ground: '#c4b8a6', map: '#e2b39c' },
  hill: { name: 'Observatory Hill', ground: '#7fae5c', map: '#b3cf8e' },
  yards: { name: 'Cormorant Yards', ground: '#9a9a96', map: '#b9b1a4' },
  jacaranda: { name: 'Jacaranda Gardens', ground: '#6fb24f', map: '#8fca74' },
};

export const AVENUES = ['Corona Drive', 'Avocet Avenue', 'Sundial Way', 'Jacaranda Avenue', 'Penumbra Avenue', 'Grand Saros Avenue', 'Ecliptic Boulevard', 'Astrolabe Avenue', 'Perihelion Avenue', 'Cormorant Row', 'Zenith Road', 'Observatory Parkway'];
export const STREETS = ['Almanac Road', 'Limb Street', 'First Contact Street', 'Shadow Band Street', 'Umbra Street', 'Second Contact Street', 'Gnomon Street', 'Cannery Road', 'Nodal Street', 'Drydock Way'];

const P = CITY.pitch;
const HALF_ROAD = CITY.road / 2;

export function districtOfBlock(i, j) {
  if (j >= 7) return 'yards';
  if (i <= 1) return 'strand';
  if (i === 3 && (j === 3 || j === 4)) return 'jacaranda';
  if (j <= 1) return 'hill';
  if (i >= 4 && i <= 7 && j >= 3 && j <= 5) return 'orrery';
  return 'azimuth';
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
  if (x < -HALF_ROAD) return 'Gnomon Strand Beach';
  if (z > CITY.depth + HALF_ROAD) return 'Cormorant Docks';
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
  safehouse: landmark('safehouse', 'CASA REYES', 1, 5, '#58c48d', 'H', 'safehouse · rest and save'),
  garage: landmark('garage', 'BRAVO MOTORS', 3, 6, '#ffb547', 'B', 'tío bravo · workshop'),
  radio: landmark('radio', 'PENUMBRA FM', 2, 2, '#f08a5d', 'J', 'jazz · 98.6'),
  gunShop: landmark('gunShop', 'AMMO AMIGO', 6, 2, '#d9483b', 'A', 'guns · armor'),
  respray: landmark('respray', 'FRESH COAT CUSTOMS', 8, 5, '#4fb3a5', 'S', 'respray · repairs'),
  hospital: landmark('hospital', 'AVOCET MEDICAL', 8, 2, '#e8614f', '+', 'emergency'),
  police: landmark('police', 'SAROS P.D.', 6, 6, '#5b8def', 'P', 'headquarters'),
  bank: landmark('bank', 'ORRERY TRUST', 5, 4, '#e3c06a', '$', 'private banking · time-lock vault'),
  docks: landmark('docks', 'VANE FREIGHT', 4, 8, '#9aa3a8', 'V', 'pier 9'),
  beachLot: landmark('beachLot', 'STRAND PARKING', 0, 3, '#7fb6e6', 'C', 'beach parking'),
  observatory: landmark('observatory', 'SAROS OBSERVATORY', 9, 0, '#f4ecd8', 'O', 'eclipse watch'),
};
