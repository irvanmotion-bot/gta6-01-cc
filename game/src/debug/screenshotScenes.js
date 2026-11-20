// The scenes behind ?shot=chase|shootout|atlas|race|title: each loads a save, stages a moment with the game's own
// systems, plays the real simulation forward for a few seconds with keys held down, then freezes the frame.
import { LANDMARKS } from '../world/cityLayout.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
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
function spawnPursuit(game, role, model, x, z, heading, speed, tactic = null) {
  const cruiser = game.police.enlist(game.vehicles.spawn(model, x, z, heading), role);
  cruiser.velX = Math.sin(heading) * speed;
  cruiser.velZ = Math.cos(heading) * speed;
  // The tactic the dispatcher's pack pattern gives a unit in this place, until its next round of orders.
  if (tactic) cruiser.controller.tactic = tactic;
  return cruiser;
}

function clearLane(game, keep, x, zFrom, zTo) {
  for (const other of [...game.vehicles.list]) {
    if (other !== keep && Math.abs(other.position.x - x) < 8 && other.position.z > zFrom && other.position.z < zTo) game.vehicles.remove(other);
  }
}

/** The cover: Nova in Marlin's stolen Rayo on Ocean Drive at five stars, the whole response around her. */
function chaseScene(game) {
  const z0 = 254;
  const seconds = 0.9;
  const zEnd = z0 + 43;
  loadCity(game, stagedSave(4), 15.6, -0.6, z0 - 4, 0);
  game.missions.start(missionById('paintItGone'));
  const rayo = game.missions.active.vehicle;
  rayo.position.set(-0.6, 0, z0);
  rayo.heading = 0;
  tryEnterVehicle(game);
  play(game, 0.05);
  game.hud.clearSpeech();
  rayo.velZ = 44;
  rayo.health = rayo.maxHealth * 0.78;
  clearLane(game, rayo, 0, z0 - 90, z0 + 130);
  game.wanted.setStars(5, 99);
  // The pack around her: an interceptor door to door, a cruiser on the rear quarter, another cutting across her nose.
  spawnPursuit(game, 'interceptor', 'lince', -5.0, z0 - 1.2, 0, 50, 'flankRight');
  spawnPursuit(game, 'interceptor', 'lince', 4.0, z0 - 1.6, 0, 50, 'flankLeft');
  spawnPursuit(game, 'patrol', 'centinela', 5.4, z0 + 19, 0, 47, 'cutOff');
  // At the junction ahead: a blockade with a spike strip, and a tactical van swinging in from Marlin Street.
  game.police.roadblocks.deploy({ x: 0, z: 337, alongX: false, direction: 1 }, true);
  spawnPursuit(game, 'tactical', 'bastion', 22, 322.6, -Math.PI / 2, 9, 'ram');
  // Everyone else on Ocean Drive: a cab diving for the kerb, traffic held up behind the blockade, people
  // scattering off the pavement and the boardwalk.
  const traffic = [['solCab', -4.9, zEnd + 12, 0, null, true], ['toro', 2.8, 349, Math.PI, '#ff7eb6', false], ['brisa', 2.8, 358, Math.PI, '#1abc9c', false], ['duna', -2.8, 352, 0, '#e67e22', false]];
  for (const [model, x, z, heading, paint, panics] of traffic) {
    const bystander = game.vehicles.spawn(model, x, z, heading, paint);
    bystander.driver = 'ai';
    bystander.ambient = true;
    bystander.controller = createTrafficDriverFor(game, bystander, game.traffic.rng);
    if (panics) bystander.controller.panic(6);
  }
  for (const z of [5, 9, 14, 18, 27, 31]) game.pedestrians.spawnFleeing(7.4 + (z % 3) * 0.5, zEnd + z, { x: 0, z: zEnd });
  for (const z of [6, 10, 13, 19, 24, 30, 36]) game.pedestrians.spawnAt({ x: -9.5 + (z % 2), z: zEnd + z, boardwalk: true }).scare(0, zEnd, 9);
  // A cruiser that lost the corner burns against the kerb and goes up as she passes.
  const wreck = game.vehicles.spawn('centinela', 6.1, zEnd + 14, 0.6);
  wreck.health = 0;
  wreck.hitByPlayer = true;
  wreck.burning = 3.6 - (seconds - 0.13);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = Math.PI / 2 + 0.12;
  game.police.helicopter.mesh.position.set(1, 25, zEnd + 50);
  game.crew.cooldowns.jam = 96;
  game.hud.say('JAZZ', 'That is every badge on Marlin\'s payroll behind you. Fresh Coat, now!', '#f062b0');
  play(game, seconds, (t) => {
    game.input.held.add('KeyW');
    if (t > seconds - 0.4) game.input.held.add('ShiftLeft');
    // The gunship's next burst is due as the frame is taken, so its tracer is in the air.
    if (t > seconds - 0.05 && game.police.helicopter.cooldown > 0.05) game.police.helicopter.cooldown = 0;
    // No hit in the last moments, so the red damage vignette does not tint the frame.
    if (t > seconds - 0.6) game.player.invulnerable = 1;
    // The mouse is left alone: the chase camera settles behind the car by itself.
    game.camera.idleLook = 2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/** The Sundown Heist's gunfight outside Banco Marlin: guards, tracers, a burning car and the police arriving. */
function shootoutScene(game) {
  const bank = LANDMARKS.bank;
  const seconds = 1.4;
  const x0 = bank.x - 22;
  const z0 = bank.z + 5;
  loadCity(game, stagedSave(9), 16.2, x0, z0, Math.PI / 2);
  game.player.cash = 61200;
  game.missions.start(missionById('sundownHeist'));
  play(game, 0.3);
  game.hud.clearSpeech();
  // Marlin's guards close in along Calle Cinco: one already down at Nova's feet, three trading fire with her.
  const guards = game.gunmen.list.filter((gunman) => gunman.kind === 'guard');
  const posts = [[x0 + 5.2, z0 + 2.6], [x0 + 8.5, z0 + 2.4], [x0 + 11, z0 - 0.4], [x0 + 13.5, z0 + 4.6]];
  posts.forEach(([x, z], index) => {
    guards[index].position.set(x, 0, z);
    guards[index].hostile = true;
    guards[index].heading = -Math.PI / 2;
  });
  guards[0].takeDamage(999, true);
  const wreck = game.vehicles.spawn('duna', x0 + 21, z0 + 3.6, Math.PI / 2 + 0.5, '#3498db');
  wreck.health = 0;
  wreck.hitByPlayer = false;
  wreck.burning = 3.6 - (seconds - 0.16);
  for (const [dx, dz] of [[9, -5.6], [15, -5.2], [19, -6], [25, -5.4], [17, 9.8], [24, 10.4]]) game.pedestrians.spawnFleeing(x0 + dx, z0 + dz, { x: x0 + 6, z: z0 });
  game.wanted.setStars(3, 99);
  spawnPursuit(game, 'patrol', 'centinela', x0 + 42, z0 + 6.4, -Math.PI / 2, 13);
  spawnPursuit(game, 'interceptor', 'lince', x0 + 58, z0 + 1.5, -Math.PI / 2, 15);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = 0.1;
  game.police.helicopter.mesh.position.set(x0 + 46, 25, z0 + 1);
  game.hud.say('NOVA', 'Guards on every corner. Marlin was expecting company.', '#ff7b6b');
  // Nova holds the aim (right mouse) on the nearest guard and fires as the burning Duna goes off behind them.
  play(game, seconds, (t) => {
    game.camera.yaw = Math.PI / 2 + 0.05;
    game.camera.pitch = 0.05;
    game.input.buttons[2] = true;
    game.input.buttons[0] = t > seconds - 0.09;
    // The three guards facing her are due to fire as the frame is taken, so their tracers are in the air.
    if (t > seconds - 0.07) for (const guard of guards.slice(1, 4)) guard.cooldown = Math.min(guard.cooldown, 0.01);
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
    game.player.health = Math.max(game.player.health, 58);
    if (t > seconds - 0.7) game.player.invulnerable = 1;
  });
  game.input.buttons[0] = false;
  game.input.buttons[2] = false;
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
  loadCity(game, stagedSave(7), 19.05, event.x - 4, event.z, event.heading);
  const ride = game.vehicles.spawn('marlinGT', event.x, event.z, event.heading, '#ff3b30');
  ride.parked = true;
  ride.stolen = true;
  tryEnterVehicle(game);
  game.races.start(event);
  game.races.active.countdown = 0.05;
  play(game, 3.1, (t) => {
    game.input.held.add('KeyW');
    if (t > 2.2) game.input.held.add('ShiftLeft');
    game.camera.idleLook = 2;
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
