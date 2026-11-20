// Solmara's own cars: each model's name, size, handling and paint, plus which ones traffic drives.

/**
 * Sizes in metres, speed in m/s, accel in m/s². `grip` is how fast sideways slide dies (higher = stickier),
 * `shape` picks the body builder in vehicleModel.js.
 */
export const VEHICLE_CATALOG = {
  brisa: { name: 'Brisa', kind: 'Compact', shape: 'hatch', length: 3.9, width: 1.75, height: 1.45, maxSpeed: 31, accel: 10, grip: 7.5, mass: 1000, health: 100, paints: factoryPaints() },
  estela: { name: 'Estela', kind: 'Sedan', shape: 'sedan', length: 4.6, width: 1.85, height: 1.4, maxSpeed: 36, accel: 11, grip: 7, mass: 1300, health: 110, paints: factoryPaints() },
  coyote: { name: 'Coyote', kind: 'Muscle', shape: 'coupe', length: 4.7, width: 1.95, height: 1.3, maxSpeed: 44, accel: 15, grip: 5.6, mass: 1500, health: 120, paints: ['#c0392b', '#f39c12', '#2c3e50', '#16a085', '#ecf0f1'] },
  marlinGT: { name: 'Marlin GT', kind: 'Sports', shape: 'sports', length: 4.4, width: 1.95, height: 1.15, maxSpeed: 52, accel: 18, grip: 8, mass: 1250, health: 100, paints: ['#ff3b30', '#ffd60a', '#0a84ff', '#30d158', '#ff9f0a', '#f5f5f7'] },
  rayo: { name: 'Rayo', kind: 'Supercar', shape: 'sports', length: 4.5, width: 2.0, height: 1.08, maxSpeed: 60, accel: 22, grip: 8.6, mass: 1300, health: 100, paints: ['#b8962e', '#111111', '#ff2d55'] },
  duna: { name: 'Duna', kind: 'SUV', shape: 'suv', length: 4.8, width: 2.0, height: 1.8, maxSpeed: 35, accel: 10.5, grip: 6.4, mass: 2000, health: 150, paints: factoryPaints() },
  toro: { name: 'Toro', kind: 'Pickup', shape: 'pickup', length: 5.2, width: 2.0, height: 1.75, maxSpeed: 34, accel: 10, grip: 6, mass: 2100, health: 150, paints: ['#c0392b', '#ecf0f1', '#34495e', '#d35400', '#1e8449'] },
  caravana: { name: 'Caravana', kind: 'Van', shape: 'van', length: 5.0, width: 2.0, height: 2.1, maxSpeed: 30, accel: 8.5, grip: 5.8, mass: 2300, health: 160, paints: ['#ecf0f1', '#f7dc6f', '#aed6f1', '#d5d8dc'] },
  solCab: { name: 'Sol Cab', kind: 'Taxi', shape: 'sedan', length: 4.6, width: 1.85, height: 1.4, maxSpeed: 37, accel: 11.5, grip: 7, mass: 1350, health: 120, paints: ['#ffcc00'], taxi: true },
  centinela: { name: 'Centinela', kind: 'Police cruiser', shape: 'sedan', length: 4.8, width: 1.9, height: 1.42, maxSpeed: 47, accel: 17, grip: 8, mass: 1600, health: 150, paints: ['#f4f6f7'], police: true },
  lince: { name: 'Lince', kind: 'Police interceptor', shape: 'coupe', length: 4.6, width: 1.95, height: 1.28, maxSpeed: 55, accel: 20, grip: 8.4, mass: 1500, health: 140, paints: ['#16213e'], police: true },
  bastion: { name: 'Bastion', kind: 'Tactical van', shape: 'van', length: 5.6, width: 2.2, height: 2.4, maxSpeed: 38, accel: 12, grip: 6.4, mass: 3200, health: 260, paints: ['#1c2833'], police: true },
};

/** What ambient traffic drives, and how often. */
const TRAFFIC_MIX = [
  ['brisa', 20], ['estela', 22], ['duna', 13], ['toro', 9], ['caravana', 8], ['coyote', 7], ['solCab', 12], ['marlinGT', 5], ['rayo', 1],
];
const TRAFFIC_TOTAL = TRAFFIC_MIX.reduce((sum, entry) => sum + entry[1], 0);

export function randomTrafficModel(rng) {
  let roll = rng.next() * TRAFFIC_TOTAL;
  for (const [id, weight] of TRAFFIC_MIX) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return 'estela';
}

/** The paint colours the everyday models leave the factory in. */
function factoryPaints() {
  return ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2c3e50', '#1abc9c', '#e67e22', '#9b59b6', '#bdc3c7', '#ff7eb6', '#27ae60', '#16213e'];
}

export function randomPaint(modelId, rng) {
  return rng.pick(VEHICLE_CATALOG[modelId].paints);
}
