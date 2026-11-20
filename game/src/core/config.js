// Tuning constants shared by every system of Solmara Heat: city grid, world bounds, population and save key.

export const GAME_TITLE = 'SOLMARA HEAT';
export const SAVE_KEY = 'solmara-heat-save-v1';
export const SETTINGS_KEY = 'solmara-heat-settings-v1';

/** The street grid: roads run every `pitch` metres, asphalt `road` wide, with a `sidewalk` each side. */
export const CITY = {
  pitch: 80,
  road: 12,
  sidewalk: 3,
  roadsX: 12,
  roadsZ: 10,
  curb: 0.2,
  seed: 20261120,
};
CITY.width = (CITY.roadsX - 1) * CITY.pitch;
CITY.depth = (CITY.roadsZ - 1) * CITY.pitch;

/** Where the player and vehicles may go: the city, the beach to the west and the docks to the south. */
export const WORLD_BOUNDS = { minX: -76, maxX: CITY.width + 22, minZ: -22, maxZ: CITY.depth + 44 };

export const POPULATION = {
  movingCars: 13,
  parkedCars: 7,
  pedestrians: 40,
  pedestrianFar: 115,
  spawnNear: 55,
  spawnFar: 150,
  despawn: 210,
};

export const PLAYER = {
  walkSpeed: 3.2,
  runSpeed: 7.4,
  jumpSpeed: 5.6,
  radius: 0.42,
  maxHealth: 100,
  maxArmor: 100,
  enterRange: 3.6,
};

export const DAY_LENGTH_SECONDS = 20 * 60;
export const START_HOUR = 16.4;

export const GRAVITY = 18;
