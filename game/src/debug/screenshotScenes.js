// The scenes behind ?shot=chase|bounty|workshop|atlas|title: each loads a save, stages a moment with the game's
// own systems, plays the real simulation forward for a few seconds with keys held down, then freezes the frame.
import { LANDMARKS } from '../world/cityLayout.js';
import { VANE_CAPOS } from '../activities/vaneBounties.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { GETAWAY_PAINT, STORY_MISSIONS } from '../missions/storyMissions.js';
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

/** A citizen's car on the road with a traffic driver at the wheel; `panics` floors it, as a near miss would. */
function spawnCivilianCar(game, model, x, z, heading, paint, panics = false) {
  const car = game.vehicles.spawn(model, x, z, heading, paint);
  car.driver = 'ai';
  car.ambient = true;
  car.controller = createTrafficDriverFor(game, car, game.traffic.rng);
  car.velX = Math.sin(heading) * 9;
  car.velZ = Math.cos(heading) * 9;
  if (panics) car.controller.panic(6);
  return car;
}

/** One more citizen out for the eclipse, on the pavement or (with `boardwalk`) on the boards by the beach. */
function spawnStroller(game, x, z, boardwalk = false) {
  return game.pedestrians.spawnAt(boardwalk ? { x, z, boardwalk: true } : { x, z, goal: { i: 0, j: Math.floor(z / 80), corner: 0 }, clockwise: z % 2 < 1 });
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
  const seconds = 1.6;
  const speed = 40;
  // She straddles the centre line of the drive, the ocean and the sun on her right.
  const lane = 0;
  // Where the Rayo is when the frame is taken (just across Second Contact Street), and where it starts from.
  const zEnd = 406;
  const blockadeZ = 432;
  const z0 = zEnd - speed * seconds;
  loadCity(game, stagedSave(9), lane, z0 - 4, 0);
  startHeist(game, 'steal');
  const rayo = game.missions.active.vehicle;
  rayo.position.set(lane, 0, z0);
  rayo.heading = 0;
  tryEnterVehicle(game);
  // Jazz comes on the radio the moment the door shuts: her line is in the crew's ribbon when the frame is taken.
  play(game, 0.05);
  game.calendar.setHour(hourOfCoverage(0.6));
  rayo.velZ = speed;
  rayo.health = rayo.maxHealth * 0.78;
  clearLane(game, rayo, 0, z0 - 90, z0 + 220);
  game.wanted.setStars(5, 99);
  const pack = [];
  // Up the block: a blockade with barriers, officers and a spike strip, a cab caught in front of it and the
  // traffic it has stopped on the far side.
  game.police.roadblocks.deploy({ x: 0, z: blockadeZ, alongX: false, direction: 1 }, true);
  const traffic = [
    ['sarosCab', -3.3, blockadeZ - 11, 0, null, false], ['caravana', -3.0, blockadeZ + 14, 0, '#3a86ff', false],
    ['duna', 3.0, blockadeZ + 9, Math.PI, '#1abc9c', false], ['toro', 3.0, blockadeZ + 20, Math.PI, '#ff7eb6', false],
  ];
  for (const [model, x, z, heading, paint, panics] of traffic) spawnCivilianCar(game, model, x, z, heading, paint, panics);
  // Two citizens coming the other way in the ocean-side lane: she threads past each at a door's width, and the
  // stunt score pays both as near misses, the second on the combo.
  const oncoming = [['caravana', z0 + 47, '#e9e4d8'], ['toro', z0 + 66, '#ff9f1c']].map(([model, z, paint]) => {
    const car = spawnCivilianCar(game, model, 3.1, z, Math.PI, paint);
    car.velZ = -12;
    return car;
  });
  // The pavement and the boardwalk are full on eclipse afternoon; the people nearest the chase are already running.
  for (const [x, z] of [[7.3, 6], [8.1, 10], [7.6, 14], [8.4, 18], [7.2, 23], [8.0, 29], [7.5, 36], [8.3, 44], [7.4, 53]]) {
    if (z < 20) game.pedestrians.spawnFleeing(x, zEnd + z, { x: lane, z: zEnd }); else spawnStroller(game, x, zEnd + z);
  }
  for (const z of [5, 9, 14, 20, 27, 35, 44]) spawnStroller(game, -9.5 + (z % 3) * 0.6, zEnd + z, true);
  const helicopter = game.police.helicopter;
  helicopter.scramble();
  // The helicopter is already on station: ahead of the car and a little to the city side, as its orbit holds it.
  helicopter.orbit = 1.1;
  helicopter.mesh.position.set(lane + Math.cos(helicopter.orbit) * 26, 17, z0 + Math.sin(helicopter.orbit) * 26 + speed * 0.45);
  game.crew.cooldowns.jam = 96;
  const closeIn = seconds - 0.45;
  play(game, seconds, (t) => {
    // She holds the Rayo at the pace the interceptors can match, feathering the throttle.
    if (rayo.speed < speed + 1) game.input.held.add('KeyW'); else game.input.held.delete('KeyW');
    // The oncoming drivers hold their lane and their pace; neither sees her coming in time to brake.
    for (const car of oncoming) { car.velX = 0; car.velZ = Math.min(car.velZ, -11); }
    // The pack catches her as she reaches the junction: an interceptor draws level on her ocean side and a
    // cruiser on the other, each a door's width away and about to turn in.
    if (t >= closeIn && !pack.length) {
      const at = rayo.position;
      pack.push(
        spawnPursuit(game, 'interceptor', 'lince', at.x - 3.3, at.z + 1.2, 0, rayo.speed, 'flankRight'),
        spawnPursuit(game, 'patrol', 'centinela', at.x + 3.3, at.z + 2.6, 0, rayo.speed, 'flankLeft'),
      );
    }
    // The gunship holds its fire for this frame; the officer in the interceptor's window fires as it is taken.
    helicopter.cooldown = 1;
    for (const cruiser of pack) if (cruiser.controller && cruiser.controller.isPursuit) cruiser.controller.windowClock = cruiser === pack[0] && t > seconds - STEP * 1.5 ? 0 : 1;
    // No hit in the last moments, so the red damage vignette does not tint the frame.
    game.player.invulnerable = 1;
    // The mouse is left alone: the chase camera settles behind the car by itself.
    game.camera.idleLook = 2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/**
 * A bounty hit on foot in the two minutes of totality, at the south end of the Strand: the sun is a black disc in
 * its corona over Corona Drive and the street lamps are on. El Anzuelo and his guards have come off the boardwalk
 * into the drive. Nova has dropped one and set their car alight; the capo and two guards shoot back, Saros P.D.
 * answers the noise, a car at the kerb is hers for the taking, and the eclipse crowd scatters.
 * The scene is laid out looking north, up the drive and into the eclipsed sun: `at(x, z)` is x across the drive
 * from Nova and z metres ahead of her.
 */
function bountyScene(game) {
  const seconds = 1.0;
  const capo = VANE_CAPOS.find((entry) => entry.id === 'anzuelo');
  const x0 = 2.4;
  const z0 = capo.z - 13;
  const at = (x, z) => [x0 + x, z0 + z];
  const facing = -0.12;
  loadCity(game, stagedSave(7, { bounties: ['contadora'], day: ECLIPSE_DAY, hour: CONTACTS.totalityStart + 0.07 }), x0, z0, facing);
  game.calendar.setHour(CONTACTS.totalityStart + 0.07);
  game.player.cash = 31450;
  game.player.armor = 64;
  // His crew stands on its corner as soon as Nova is this close; the job panel turns to the hit.
  play(game, 0.05);
  game.hud.clearSpeech();
  const crew = game.gunmen.list.filter((gunman) => gunman.missionTag === `bounty:${capo.id}`);
  const boss = crew.find((gunman) => gunman.kind === 'capo');
  const [near, left, right] = crew.filter((gunman) => gunman !== boss);
  // Where each stands as she opens up, and which way he sidesteps while he shoots (the gunmen's own strafe).
  // They stand on the beach side of the drive, so her aim on them looks straight into the black sun.
  const posts = [[near, -4.4, 8, 1], [left, -7.6, 11.6, -1], [boss, -3.4, 12.8, 1], [right, -4.8, 16.5, 1]];
  for (const [gunman, x, z, strafe] of posts) {
    const [px, pz] = at(x, z);
    gunman.position.set(px, 0, pz);
    gunman.heading = Math.PI;
    gunman.hostile = true;
    gunman.strafe = strafe;
    gunman.strafeClock = 9;
  }
  // A citizen's Avocet left at the kerb beside her: in reach, so the game rings it and offers F to steal it.
  const parked = game.vehicles.spawn('avocet', ...at(3.4, 3.2), -0.32, '#ffd23f');
  parked.parked = true;
  parked.ambient = true;
  // The crew's black Duna up the road: she has shot it up, it is burning, and it goes up as the frame is taken.
  clearLane(game, parked, 0, z0 - 20, z0 + 60);
  const crewCar = game.vehicles.spawn('duna', ...at(-1.4, 24.5), 0.5, '#17181d');
  crewCar.parked = true;
  crewCar.damage(crewCar.maxHealth + 1, true);
  crewCar.burning = 3.6 - (seconds - 0.3);
  game.wanted.setStars(3, 99);
  // Saros P.D. answers the shots: one cruiser has pulled up across the drive and put its two officers on the
  // street (the dispatcher's own rule for a suspect on foot), and another is coming down the drive behind it.
  spawnPursuit(game, 'patrol', 'centinela', ...at(2.6, 13.6), Math.PI - 1.05, 0);
  spawnPursuit(game, 'patrol', 'centinela', ...at(2.8, 62), Math.PI, 14);
  // The people out for the eclipse are caught in it, each in their own way: a sprint, hands up, ducked low, on the
  // ground, and two who would rather film it.
  const crowd = game.pedestrians;
  const runner = (x, z, style, awayX) => { const [px, pz] = at(x, z); const ped = crowd.spawnFleeing(px, pz, { x: x0 + awayX, z: pz - 1.5 }); ped.fearStyle = style; ped.timid = false; ped.bold = false; ped.heading = Math.atan2(x - awayX, 1.5); return ped; };
  runner(-5.6, 5.2, 'sprint', 0);
  runner(-7.4, 11.5, 'handsUp', 0);
  runner(5.6, 12.5, 'duck', 0);
  runner(6.4, 19, 'handsUp', 0);
  const bystander = (x, z, style) => { const ped = spawnStroller(game, ...at(x, z)); ped.timid = false; ped.bold = true; ped.gawkStyle = style; ped.gawk(x0, z0 + 8, 30); ped.heading = Math.atan2(-x, 8 - z); return ped; };
  bystander(-10.5, 17.5, 'film');
  bystander(5.2, 24, 'point');
  const coward = spawnStroller(game, ...at(-4.3, 3.3));
  coward.timid = true;
  coward.cower(x0, z0 + 6, 30);
  game.hud.say('JAZZ', 'Lights out on the Strand! El Anzuelo is yours, two and a half grand says he never sees the sun come back.', '#f4ecd8');
  // Nova holds the aim (right mouse) on the near guard and drops him, then swings onto the capo behind him: the
  // frame is her next shot, with the first man down in the road between them.
  play(game, seconds, (t) => {
    const camera = game.camera;
    const target = near.alive ? near : boss;
    for (let pass = 0; pass < 2; pass += 1) {
      const focusX = game.player.position.x - Math.cos(camera.yaw) * 1.15;
      const focusZ = game.player.position.z + Math.sin(camera.yaw) * 1.15;
      camera.yaw = Math.atan2(target.position.x - focusX, target.position.z - focusZ);
    }
    camera.pitch = 0.03;
    game.input.buttons[2] = true;
    game.input.buttons[0] = t > seconds - 0.55;
    near.health = t > seconds - 0.5 ? Math.min(near.health, 20) : 400;
    // They hold up under her fire until the frame, which finds each one as hurt as the fight has left him.
    const last = t > seconds - STEP * 1.5;
    for (const [gunman, share] of [[boss, 0.62], [left, 0.38], [right, 0.8]]) gunman.health = last ? gunman.spec.health * share : 400;
    if (t > seconds - STEP * 1.5) game.weapons.cooldown = 0;
    // The crew holds its fire until she has shown herself; the three still standing answer as the frame is taken.
    for (const gunman of game.gunmen.list) if (gunman.alive) gunman.cooldown = gunman !== near && t > seconds - STEP * 2.5 ? 0 : 1;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
    game.player.health = Math.max(game.player.health, 58);
    game.player.invulnerable = 1;
  });
  game.input.buttons[0] = false;
  game.input.buttons[2] = false;
}

/** Bravo's workshop on eclipse eve: the Rayo on the turntable, the upgrade list and its prices beside it. */
function workshopScene(game) {
  const bay = LANDMARKS.garage.kerb;
  loadCity(game, stagedSave(8), bay.x - 4, bay.z, Math.PI / 2);
  game.player.cash = 23850;
  const ride = game.vehicles.spawn('rayo', bay.x, bay.z, -Math.PI / 2, GETAWAY_PAINT);
  ride.parked = true;
  ride.stolen = true;
  tryEnterVehicle(game);
  ride.health = ride.maxHealth * 0.64;
  play(game, 0.3);
  game.hud.clearSpeech();
  game.input.pressed.add('KeyE');
  play(game, 2.2);
}

/**
 * Wednesday's job done: Nova rolls the police Lince she took from Saros P.D.'s front door into Bravo's yard, the
 * job director pays out on its result card and Tío Bravo's closing line plays in the crew's ribbon.
 */
function passScene(game) {
  const bay = LANDMARKS.garage.kerb;
  loadCity(game, stagedSave(5, { hour: 17.45 }), bay.x + 9, bay.z, -Math.PI / 2);
  game.calendar.setHour(17.45);
  game.missions.start(missionById('borrowedSirens'));
  const run = game.missions.active;
  const lince = run.vehicle;
  lince.position.set(bay.x + 5, 0, bay.z + 0.4);
  lince.heading = -Math.PI / 2;
  tryEnterVehicle(game);
  // Into the seat (the steal step raises the alarm), then the pursuit shaken off, as the job's middle plays out.
  for (let guard = 0; guard < 240 && run.step.kind !== 'deliver'; guard += 1) {
    play(game, STEP);
    if (game.wanted.stars > 0) game.wanted.clear(false);
  }
  game.police.clear();
  game.hud.clearSpeech();
  // The last metres into the yard at walking pace, then the brake: the director sees the car stopped in the bay.
  play(game, 1.3, (t) => {
    game.camera.idleLook = 2;
    if (t < 0.7) { lince.velX = -6 * (1 - t / 0.7); lince.velZ = 0; } else game.input.held.add('Space');
  });
  game.input.held.clear();
  play(game, 0.6, () => { game.camera.idleLook = 2; });
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

/** The start screen with three saves on file: CONTINUE and LOAD GAME are offered and every slot card is filled. */
function titleScene(game) {
  for (const [slot, jobs] of [[1, 2], [3, 9], [2, 6]]) {
    loadCity(game, stagedSave(jobs), LANDMARKS.safehouse.x - 7, LANDMARKS.safehouse.z, Math.PI / 2);
    game.saveSlot = slot;
    writeSaveSlot(slot, summarizeGame(game), captureGame(game));
  }
  game.resetWorld();
  game.showTitle();
  play(game, 3);
}

/** The pause menu over a week in progress: SAVE GAME and LOAD GAME beside the slot being played. */
function pauseScene(game) {
  atlasScene(game);
  game.missions.reset();
  game.setState('pause');
}

const SCENES = { chase: chaseScene, bounty: bountyScene, workshop: workshopScene, passed: passScene, atlas: atlasScene, title: titleScene, pause: pauseScene };

export function stageScreenshot(game, name) {
  // The HUD SIZE a scene is taken at (?hud=standard|large|huge), large unless asked; the player's own setting is
  // left as it is saved.
  game.settings.hudSize = new URLSearchParams(window.location.search).get('hud') || 'large';
  game.applySettings();
  (SCENES[name] || titleScene)(game);
  game.input.held.clear();
  game.frozen = true;
  window.__shotReady = true;
}
