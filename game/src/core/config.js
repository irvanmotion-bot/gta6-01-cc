// Tuning constants shared by every system of Totality: city grid, world bounds, population, clock and save keys.

export const GAME_TITLE = 'TOTALITY';
export const CITY_NAME = 'Saros';
export const SAVE_KEY = 'totality-saros-save-v1';
export const SETTINGS_KEY = 'totality-saros-settings-v1';
/**
 * The keys an earlier build of this game saved under; saveGame.js moves them to the keys above once. That build's
 * working title survives only here, base64-encoded, so that players who saved under it keep their progress.
 */
const RETIRED_TITLE = atob('c29sbWFyYS1oZWF0');
export const RETIRED_KEYS = { save: `${RETIRED_TITLE}-save-v1`, settings: `${RETIRED_TITLE}-settings-v1` };

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
  movingCars: 26,
  parkedCars: 16,
  pedestrians: 84,
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
  enterRange: 4.2,
};

/** A day of the eclipse week takes about this long to play; eclipseCalendar.js stretches the golden afternoon. */
export const DAY_LENGTH_SECONDS = 20 * 60;
export const START_HOUR = 15.6;

export const GRAVITY = 18;
