// The scenes behind ?shot=chase|standoff|workshop|atlas|title: each loads a save, stages a moment with the game's
// own systems, plays the real simulation forward for a few seconds with keys held down, then freezes the frame.
import { LANDMARKS } from '../world/cityLayout.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { CONTACTS, ECLIPSE_DAY } from '../eclipse/eclipseCalendar.js';
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

/** A save as a playthrough would have left it after `jobs` story jobs: the day, cred, upgrades, guns and record. */
function stagedSave(jobs, extra = {}) {
  const share = jobs / STORY_MISSIONS.length;
  const done = STORY_MISSIONS.slice(0, jobs);
  return {
    cash: 3250 + jobs * 3800, armor: 64, day: Math.min(ECLIPSE_DAY, STORY_MISSIONS[Math.min(jobs, STORY_MISSIONS.length - 1)].day), hour: 15.9, missions: done.map((mission) => mission.id), cred: Math.round(260 + share * 3300),
    workshop: { engine: Math.min(3, Math.floor(jobs / 3)), plating: jobs > 3 ? 1 : 0, tires: Math.min(3, Math.floor(jobs / 4)), nitro: jobs > 3 ? 1 : 0 },
    weapons: { current: 'smg', owned: { fists: true, pistol: true, smg: jobs > 2, shotgun: jobs > 5, rifle: jobs > 8 }, clip: { pistol: 12, smg: 32, shotgun: 6, rifle: 30 }, reserve: { pistol: 60, smg: 128, shotgun: 18, rifle: 120 } },
    tokens: [0, 2, 3, 5, 8, 9, 11].slice(0, jobs + 1), faresDone: jobs + 2, races: jobs > 4 ? { coronaDash: { place: 1, time: 96.4 }, orreryCircuit: { place: 2, time: 131.8 } } : {},
    bounties: jobs > 3 ? ['anzuelo', 'contadora'] : [],
    stats: {
      ...freshStats(), missionsPassed: jobs, missionsFailed: 2, carsStolen: 9 + jobs * 4, copsDowned: 6 + jobs * 3, enforcersDowned: 4 + jobs * 5, choppersDowned: jobs > 4 ? 1 : 0, shotsFired: 310 + jobs * 240,
      maxStars: Math.min(5, 2 + Math.floor(jobs / 2)), escapes: 3 + jobs * 2, earned: 4200 + jobs * 6100, spent: 1500 + jobs * 2900, faresDone: jobs + 2, racesRun: jobs > 4 ? 5 : 0, racesWon: jobs > 4 ? 1 : 0,
      bountiesClaimed: jobs > 3 ? 2 : 0, favorsUsed: jobs * 2, metresDriven: 9000 + jobs * 7400, timesBusted: 1, timesWiped: 2, playSeconds: 900 + jobs * 1150,
    },
    ...extra,
  };
}

/** Load a staged save into a fresh city at a place, on foot, with the streets and the watch parties already alive. */
function loadCity(game, save, x, z, heading) {
  game.resetWorld();
  restoreGame(game, save);
  game.player.revive(x, z, heading);
  game.player.invulnerable = 0;
  game.camera.snapBehind(heading);
  game.traffic.populate();
  game.pedestrians.populate();
  game.watchParties.populate();
  game.setState('play');
  game.input.locked = true;
}

function missionById(id) {
  return STORY_MISSIONS.find((mission) => mission.id === id);
}

/** The hour of eclipse day at which the moon covers `share` of the sun, on its way in. */
function hourOfCoverage(share) {
  return CONTACTS.first + (CONTACTS.totalityStart - CONTACTS.first) * share;
}

/** Start the last job on eclipse afternoon and play its opening steps until the one of `kind` is running. */
function startHeist(game, untilKind) {
  game.missions.start(missionById('totality'));
  for (let guard = 0; guard < 12 && game.missions.active.step.kind !== untilKind; guard += 1) game.missions.advance();
  // Skipping past the boardwalk fight leaves its lookouts dealt with, as playing it would.
  if (untilKind !== 'eliminate') game.gunmen.removeTagged(game.missions.active.tag);
  play(game, 0.05);
  game.hud.clearSpeech();
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

/**
 * The cover: eclipse afternoon, the moon two thirds of the way across the sun, and Nova breaking through to the
 * Orrery Trust in the getaway Rayo down Corona Drive at five stars, with the whole response around her.
 */
function chaseScene(game) {
  const z0 = 225;
  const seconds = 0.9;
  const zEnd = z0 + 43;
  loadCity(game, stagedSave(9), -0.4, z0 - 4, 0);
  startHeist(game, 'steal');
  const rayo = game.missions.active.vehicle;
  rayo.position.set(-0.4, 0, z0);
  rayo.heading = 0;
  tryEnterVehicle(game);
  play(game, 0.05);
  game.hud.clearSpeech();
  game.calendar.setHour(hourOfCoverage(0.62));
  rayo.velZ = 44;
  rayo.health = rayo.maxHealth * 0.78;
  clearLane(game, rayo, 0, z0 - 90, z0 + 130);
  game.wanted.setStars(5, 99);
  // The pack: one interceptor on her rear quarter, one drawing level on the ocean side, a cruiser cutting across
  // her nose further up the drive.
  spawnPursuit(game, 'interceptor', 'lince', 4.3, z0 - 0.4, 0, 49, 'flankRight');
  spawnPursuit(game, 'interceptor', 'lince', -4.0, z0 + 3.4, 0, 49, 'flankLeft');
  spawnPursuit(game, 'patrol', 'centinela', 4.6, z0 + 21, 0, 46, 'cutOff');
  // At the junction ahead: a blockade with a spike strip, and a tactical van swinging in from Umbra Street.
  game.police.roadblocks.deploy({ x: 0, z: 337, alongX: false, direction: 1 }, true);
  spawnPursuit(game, 'tactical', 'bastion', 22, 322.6, -Math.PI / 2, 9, 'ram');
  // Everyone else on Corona Drive: a cab diving for the kerb, traffic held up behind the blockade, and people
  // scattering off the pavement.
  const traffic = [['sarosCab', -4.9, zEnd + 14, 0, null, true], ['toro', 2.8, 349, Math.PI, '#ff7eb6', false], ['avocet', 2.8, 358, Math.PI, '#1abc9c', false], ['duna', -2.8, 352, 0, '#e67e22', false]];
  for (const [model, x, z, heading, paint, panics] of traffic) {
    const bystander = game.vehicles.spawn(model, x, z, heading, paint);
    bystander.driver = 'ai';
    bystander.ambient = true;
    bystander.controller = createTrafficDriverFor(game, bystander, game.traffic.rng);
    if (panics) bystander.controller.panic(6);
  }
  for (const z of [5, 9, 14, 18, 27, 31]) game.pedestrians.spawnFleeing(7.4 + (z % 3) * 0.5, zEnd + z, { x: 0, z: zEnd });
  // A cruiser that lost the corner burns against the kerb and goes up as she passes.
  const wreck = game.vehicles.spawn('centinela', 6.1, zEnd + 15, 0.6);
  wreck.health = 0;
  wreck.hitByPlayer = true;
  wreck.burning = 3.6 - (seconds - 0.13);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = Math.PI / 2 - 0.25;
  game.police.helicopter.mesh.position.set(12, 25, zEnd + 46);
  game.crew.cooldowns.jam = 96;
  game.hud.say('JAZZ', 'They made the car, baby. Get to the square before the sun goes!', '#f4ecd8');
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

/**
 * On foot on Corona Drive as the eclipse begins: Vane's lookouts among the watch parties on the boardwalk, the low
 * sun behind Nova, a burning car going up, tracers both ways and the police coming down the drive.
 */
function standoffScene(game) {
  const seconds = 1.4;
  const x0 = 1.2;
  const z0 = 351;
  const aim = Math.PI + 0.2;
  loadCity(game, stagedSave(9), x0, z0, aim);
  game.player.cash = 61200;
  startHeist(game, 'eliminate');
  game.calendar.setHour(hourOfCoverage(0.34));
  game.weapons.select('rifle');
  // Vane's lookouts come off the boardwalk and the kerb, between the watch parties: one already down, three
  // trading fire with Nova up the drive.
  const lookouts = game.gunmen.list.filter((gunman) => gunman.kind === 'enforcer');
  const posts = [[x0 - 1.6, z0 - 6], [x0 - 4.6, z0 - 9.4], [x0 + 2.2, z0 - 12.2], [x0 - 1.4, z0 - 15.6]];
  posts.forEach(([x, z], index) => {
    lookouts[index].position.set(x, 0, z);
    lookouts[index].hostile = true;
    lookouts[index].heading = 0;
  });
  lookouts[0].takeDamage(999, true);
  const wreck = game.vehicles.spawn('duna', x0 + 3.6, z0 - 25, 0.5, '#3498db');
  wreck.health = 0;
  wreck.hitByPlayer = false;
  wreck.burning = 3.6 - (seconds - 0.16);
  game.wanted.setStars(3, 99);
  spawnPursuit(game, 'patrol', 'centinela', x0 - 2.4, z0 - 46, 0, 13);
  spawnPursuit(game, 'interceptor', 'lince', x0 + 3.2, z0 - 62, 0, 15);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = -Math.PI / 2 + 0.3;
  game.police.helicopter.mesh.position.set(x0 + 9, 25, z0 - 44);
  game.hud.say('NOVA', 'Half of Saros is on the boardwalk looking up. Five of them are looking for me.', '#ff9e7a');
  // Nova holds the aim (right mouse) on the nearest lookout and fires as the burning Duna goes off behind them.
  const guards = lookouts;
  play(game, seconds, (t) => {
    game.camera.yaw = aim;
    game.camera.pitch = 0.02;
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

/** Bravo's workshop on eclipse eve: the Rayo on the turntable, the upgrade list and its prices beside it. */
function workshopScene(game) {
  const bay = LANDMARKS.garage.kerb;
  loadCity(game, stagedSave(8), bay.x - 4, bay.z, Math.PI / 2);
  game.player.cash = 23850;
  const ride = game.vehicles.spawn('rayo', bay.x, bay.z, -Math.PI / 2, '#ff4b1f');
  ride.parked = true;
  ride.stolen = true;
  tryEnterVehicle(game);
  ride.health = ride.maxHealth * 0.64;
  play(game, 0.3);
  game.hud.clearSpeech();
  game.input.pressed.add('KeyE');
  play(game, 2.2);
}

/** The city atlas mid-week: three save slots on file, the second one loaded and its map and progress open. */
function atlasScene(game) {
  for (const [slot, jobs] of [[1, 2], [3, 9], [2, 6]]) {
    loadCity(game, stagedSave(jobs), LANDMARKS.safehouse.x - 7, LANDMARKS.safehouse.z, Math.PI / 2);
    game.saveSlot = slot;
    writeSaveSlot(slot, summarizeGame(game), captureGame(game));
  }
  game.missions.start(missionById('lightsOut'));
  play(game, 0.5);
  game.setState('map');
}

/** The start screen, with saves on file so CONTINUE, LOAD GAME and the slot cards are offered. */
function titleScene(game) {
  for (const [slot, jobs] of [[1, 2], [2, 6]]) {
    loadCity(game, stagedSave(jobs), LANDMARKS.safehouse.x - 7, LANDMARKS.safehouse.z, Math.PI / 2);
    game.saveSlot = slot;
    writeSaveSlot(slot, summarizeGame(game), captureGame(game));
  }
  game.resetWorld();
  game.showTitle();
  play(game, 3);
}

const SCENES = { chase: chaseScene, standoff: standoffScene, workshop: workshopScene, atlas: atlasScene, title: titleScene };

export function stageScreenshot(game, name) {
  (SCENES[name] || titleScene)(game);
  game.input.held.clear();
  game.frozen = true;
  window.__shotReady = true;
}
