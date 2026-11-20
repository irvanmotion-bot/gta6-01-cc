// The scenes behind ?shot=chase|shootout|atlas|race|title: each loads a save, stages a moment with the game's own
// systems, plays the real simulation forward for a few seconds with keys held down, then freezes the frame.
import { LANDMARKS } from '../world/cityLayout.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { STREET_RACES } from '../activities/streetRaces.js';
import { restoreGame, summarizeGame, captureGame } from '../core/gameSnapshot.js';
import { freshStats, writeSaveSlot } from '../core/saveGame.js';

const STEP = 1 / 60;

/** Run the game loop for `seconds` of simulated time; `each` runs before every step (to hold keys, pin the camera). */
function play(game, seconds, each = null) {
  for (let t = 0; t < seconds; t += STEP) {
    if (each) each(t);
    game.update(STEP);
  }
}

/** A save as a playthrough would have left it after `jobs` story jobs: cred, upgrades, guns, activities and record. */
function stagedSave(jobs, extra = {}) {
  const share = jobs / STORY_MISSIONS.length;
  return {
    cash: 3250 + jobs * 3800, armor: 64, hour: 17.2, missions: STORY_MISSIONS.slice(0, jobs).map((mission) => mission.id), cred: Math.round(260 + share * 3300),
    workshop: { engine: Math.min(3, Math.floor(jobs / 3)), plating: jobs > 3 ? 1 : 0, tires: Math.min(3, Math.floor(jobs / 3)), nitro: jobs > 3 ? 1 : 0 },
    weapons: { current: 'smg', owned: { fists: true, pistol: true, smg: jobs > 2, shotgun: jobs > 5, rifle: jobs > 8 }, clip: { pistol: 12, smg: 32, shotgun: 6, rifle: 30 }, reserve: { pistol: 60, smg: 128, shotgun: 18, rifle: 120 } },
    tokens: [0, 2, 3, 5, 8, 9, 11].slice(0, jobs + 1), faresDone: jobs + 2, races: jobs > 4 ? { oceanDash: { place: 1, time: 96.4 }, centroCircuit: { place: 2, time: 131.8 } } : {},
    bounties: jobs > 3 ? ['anzuelo', 'contadora'] : [],
    stats: {
      ...freshStats(), missionsPassed: jobs, missionsFailed: 2, carsStolen: 9 + jobs * 4, copsDowned: 6 + jobs * 3, enforcersDowned: 4 + jobs * 5, choppersDowned: jobs > 4 ? 1 : 0, shotsFired: 310 + jobs * 240,
      maxStars: Math.min(5, 2 + Math.floor(jobs / 2)), escapes: 3 + jobs * 2, earned: 4200 + jobs * 6100, spent: 1500 + jobs * 2900, faresDone: jobs + 2, racesRun: jobs > 4 ? 5 : 0, racesWon: jobs > 4 ? 1 : 0,
      bountiesClaimed: jobs > 3 ? 2 : 0, favorsUsed: jobs * 2, metresDriven: 9000 + jobs * 7400, timesBusted: 1, timesWiped: 2, playSeconds: 900 + jobs * 1150,
    },
    ...extra,
  };
}

/** Load a staged save into a fresh city at a place and hour, on foot, with the streets already alive. */
function loadCity(game, save, hour, x, z, heading) {
  game.resetWorld();
  restoreGame(game, save);
  game.sky.hour = hour;
  game.player.revive(x, z, heading);
  game.player.invulnerable = 0;
  game.camera.snapBehind(heading);
  game.traffic.populate();
  game.pedestrians.populate();
  game.setState('play');
  game.input.locked = true;
}

function missionById(id) {
  return STORY_MISSIONS.find((mission) => mission.id === id);
}

/** Put a police unit of a role on the road at speed; the dispatcher names it and gives it its tactic. */
function spawnPursuit(game, role, model, x, z, heading, speed) {
  const cruiser = game.police.enlist(game.vehicles.spawn(model, x, z, heading), role);
  cruiser.velX = Math.sin(heading) * speed;
  cruiser.velZ = Math.cos(heading) * speed;
  return cruiser;
}

function clearLane(game, keep, x, zFrom, zTo) {
  for (const other of [...game.vehicles.list]) {
    if (other !== keep && Math.abs(other.position.x - x) < 8 && other.position.z > zFrom && other.position.z < zTo) game.vehicles.remove(other);
  }
}

/** The cover: Nova in Marlin's stolen Rayo on Ocean Drive at five stars, the whole response around her. */
function chaseScene(game) {
  loadCity(game, stagedSave(4), 16.7, 0, 232, 0);
  game.missions.start(missionById('paintItGone'));
  const rayo = game.missions.active.vehicle;
  rayo.position.set(0, 0, 236);
  rayo.heading = 0;
  tryEnterVehicle(game);
  play(game, 0.05);
  game.hud.clearSpeech();
  rayo.velZ = 33;
  rayo.health = rayo.maxHealth * 0.78;
  clearLane(game, rayo, 0, 150, 318);
  game.wanted.setStars(5, 99);
  // The pack: an interceptor and a cruiser boxing her in from ahead, a tactical van coming head-on, one more behind.
  spawnPursuit(game, 'interceptor', 'lince', 4.8, 247, 0, 39);
  spawnPursuit(game, 'patrol', 'centinela', -4.8, 244, 0, 38);
  spawnPursuit(game, 'tactical', 'bastion', 3.4, 366, Math.PI, 6);
  spawnPursuit(game, 'patrol', 'centinela', 3, 205, 0, 35);
  game.police.roadblocks.deploy({ x: 0, z: 392, alongX: false, direction: 1 }, true);
  const wreck = game.vehicles.spawn('centinela', 8.8, 336, 0.5);
  wreck.health = 0;
  wreck.hitByPlayer = true;
  wreck.burning = 2.2;
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = Math.PI / 2 + 0.1;
  game.police.helicopter.mesh.position.set(-2, 25, 345);
  game.crew.cooldowns.jam = 96;
  game.hud.say('JAZZ', 'That is every badge on Marlin\'s payroll behind you. Fresh Coat, now!', '#f062b0');
  play(game, 1.75, (t) => {
    game.input.held.add('KeyW');
    if (t > 1.45) game.input.held.add('ShiftLeft');
    game.camera.yaw = 0.05;
    game.camera.pitch = 0.2;
    game.camera.idleLook = 0;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/** The Sundown Heist's gunfight outside Banco Marlin: guards, tracers, a burning car and the police arriving. */
function shootoutScene(game) {
  const bank = LANDMARKS.bank;
  loadCity(game, stagedSave(9), 16.4, bank.x - 25, bank.z + 6, Math.PI / 2);
  game.player.cash = 61200;
  game.missions.start(missionById('sundownHeist'));
  game.hud.clearSpeech();
  const wreck = game.vehicles.spawn('duna', bank.x - 7, bank.z + 9.5, Math.PI / 2, '#3498db');
  wreck.health = 0;
  wreck.hitByPlayer = false;
  wreck.burning = 2.36;
  game.wanted.setStars(3, 99);
  spawnPursuit(game, 'patrol', 'centinela', bank.x + 30, bank.z + 5, -Math.PI / 2, 12);
  spawnPursuit(game, 'interceptor', 'lince', bank.x + 52, bank.z + 9, -Math.PI / 2, 14);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = 0.2;
  game.police.helicopter.mesh.position.set(bank.x + 40, 27, bank.z + 2);
  game.hud.say('NOVA', 'Guards on every corner. Marlin was expecting company.', '#ff7b6b');
  play(game, 1.35, (t) => {
    game.camera.yaw = Math.PI / 2 + 0.14;
    game.camera.pitch = 0.08;
    game.input.buttons[0] = t > 0.2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
    game.player.health = Math.max(game.player.health, 58);
    if (t > 0.9) game.player.invulnerable = 1;
  });
  game.input.buttons[0] = false;
}

/** The city atlas mid-story: three save slots on file, the second one loaded and its map and progress open. */
function atlasScene(game) {
  for (const [slot, jobs] of [[1, 2], [3, 9], [2, 6]]) {
    loadCity(game, stagedSave(jobs), 15.5, LANDMARKS.safehouse.x - 7, LANDMARKS.safehouse.z, Math.PI / 2);
    game.saveSlot = slot;
    writeSaveSlot(slot, summarizeGame(game), captureGame(game));
  }
  game.missions.start(missionById('loudAndClear'));
  play(game, 0.5);
  game.setState('map');
}

/** The Centro Circuit after dark: the grid away under the neon, nitro lit, rivals door to door. */
function raceScene(game) {
  const event = STREET_RACES.find((entry) => entry.id === 'centroCircuit');
  loadCity(game, stagedSave(7), 21.6, event.x - 4, event.z, event.heading);
  const ride = game.vehicles.spawn('marlinGT', event.x, event.z, event.heading, '#ff3b30');
  ride.parked = true;
  ride.stolen = true;
  tryEnterVehicle(game);
  game.races.start(event);
  game.races.active.countdown = 0.05;
  play(game, 3.1, (t) => {
    game.input.held.add('KeyW');
    if (t > 2.2) game.input.held.add('ShiftLeft');
    game.camera.yaw = event.heading + 0.1;
    game.camera.pitch = 0.13;
    game.camera.idleLook = 0;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/** The start screen, with saves on file so CONTINUE, LOAD GAME and the slot cards are offered. */
function titleScene(game) {
  for (const [slot, jobs] of [[1, 2], [2, 6]]) {
    loadCity(game, stagedSave(jobs), 15.5, LANDMARKS.safehouse.x - 7, LANDMARKS.safehouse.z, Math.PI / 2);
    game.saveSlot = slot;
    writeSaveSlot(slot, summarizeGame(game), captureGame(game));
  }
  game.resetWorld();
  game.showTitle();
  play(game, 3);
}

const SCENES = { chase: chaseScene, shootout: shootoutScene, atlas: atlasScene, race: raceScene, title: titleScene };

export function stageScreenshot(game, name) {
  (SCENES[name] || titleScene)(game);
  game.input.held.clear();
  game.frozen = true;
  window.__shotReady = true;
}
