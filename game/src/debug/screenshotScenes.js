// The scenes behind ?shot=chase|bounty|workshop|atlas|title: each loads a save, stages a moment with the game's
// own systems, plays the real simulation forward for a few seconds with keys held down, then freezes the frame.
import { LANDMARKS } from '../world/cityLayout.js';
import { VANE_CAPOS } from '../activities/vaneBounties.js';
import { STREET_RACES } from '../activities/streetRaces.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { GETAWAY_PAINT, STORY_MISSIONS } from '../missions/storyMissions.js';
import { CONTACTS, ECLIPSE_DAY } from '../eclipse/eclipseCalendar.js';
import { restoreGame, summarizeGame, captureGame } from '../core/gameSnapshot.js';
import { freshStats, writeSaveSlot } from '../core/saveGame.js';

const STEP = 1 / 60;

/** A choice a scene offers in the page's address, such as `?shot=bounty&when=totality`; null when not given. */
function sceneOption(name) {
  return new URLSearchParams(window.location.search).get(name);
}

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

/** Start the last job on eclipse afternoon and play its steps until the one of that kind, or named that, is running. */
function startHeist(game, until) {
  game.missions.start(missionById('totality'));
  for (let guard = 0; guard < 24 && game.missions.active.step.kind !== until && game.missions.active.step.stage !== until; guard += 1) game.missions.advance();
  // Skipping past a fight leaves its gunmen dealt with, as playing it would.
  if (until !== 'eliminate') game.gunmen.removeTagged(game.missions.active.tag);
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
 * A bounty hit on foot, Thursday afternoon at the south end of the Strand: El Anzuelo and his guards have come off
 * the boardwalk into Corona Drive. Nova has dropped one and set their car alight; the capo and two guards shoot
 * back, Saros P.D. answers the noise, a car at the kerb is hers for the taking, and the eclipse crowd scatters.
 */
function bountyScene(game) {
  const seconds = 1.0;
  const capo = VANE_CAPOS.find((entry) => entry.id === 'anzuelo');
  // `?when=totality`: the story is done, the observatory is replaying the eclipse, and El Anzuelo is the last capo
  // standing when the sun goes out. `?when=night`: the same hit on eclipse eve, after dark.
  const when = sceneOption('when') || 'day';
  const afterStory = when === 'totality';
  // By day Nova comes at his corner from the south. In totality she comes from the north instead, so the whole
  // scene is turned half round and the black sun stands in the sky over the fight.
  const turn = afterStory ? -1 : 1;
  const around = afterStory ? Math.PI : 0;
  const x0 = 2.4 * turn;
  const z0 = capo.z + 13 * turn;
  const facing = Math.PI + 0.12 + around;
  /** A place in the scene, given as metres to Nova's side and ahead of her as the scene was first laid out. */
  const at = (x, z) => ({ x: x0 + x * turn, z: z0 + z * turn });
  // In totality the men she is shooting at stand a step further to the ocean side, which swings her aim, and the
  // camera with it, toward the eclipse.
  const lean = afterStory ? 1.5 : 0;
  loadCity(game, stagedSave(afterStory ? 10 : 7, { bounties: afterStory ? ['contadora', 'dosDedos', 'bruma'] : ['contadora'] }), x0, z0, facing);
  if (afterStory) {
    game.calendar.relive();
    game.calendar.setHour(CONTACTS.totalityStart + 0.1);
  } else if (when === 'night') {
    game.calendar.setHour(21.5);
  }
  game.player.cash = 31450;
  game.player.armor = 64;
  // His crew stands on its corner as soon as Nova is this close; the job panel turns to the hit.
  play(game, 0.05);
  game.hud.clearSpeech();
  const crew = game.gunmen.list.filter((gunman) => gunman.missionTag === `bounty:${capo.id}`);
  const boss = crew.find((gunman) => gunman.kind === 'capo');
  const [near, left, right] = crew.filter((gunman) => gunman !== boss);
  // Where each stands as she opens up, and which way he sidesteps while he shoots (the gunmen's own strafe).
  const posts = [[near, 0, -5.4, 1], [left, -2.9, -8.2, -1], [boss, 1.5, -9, 1], [right, 0.9, -12.4, 1]];
  for (const [gunman, x, z, strafe] of posts) {
    const post = at(x + lean, z);
    gunman.position.set(post.x, 0, post.z);
    gunman.heading = around;
    gunman.hostile = true;
    gunman.strafe = strafe;
    gunman.strafeClock = 9;
  }
  // A citizen's Avocet left at the kerb beside her: in reach, so the game rings it and offers F to steal it.
  const kerb = at(3.4, -3.2);
  const parked = game.vehicles.spawn('avocet', kerb.x, kerb.z, Math.PI + 0.32 + around, '#ffd23f');
  parked.parked = true;
  parked.ambient = true;
  // The crew's black Duna up the road: she has shot it up, it is burning, and it goes up as the frame is taken.
  clearLane(game, parked, 0, z0 - 62, z0 + 62);
  const wreck = at(-1.4 + lean * 2, -24.5);
  const crewCar = game.vehicles.spawn('duna', wreck.x, wreck.z, Math.PI - 0.5 + around, '#17181d');
  crewCar.parked = true;
  crewCar.damage(crewCar.maxHealth + 1, true);
  crewCar.burning = 3.6 - (seconds - 0.3);
  game.wanted.setStars(3, 99);
  // Saros P.D. answers the shots: one cruiser has pulled up across the drive and put its two officers on the
  // street (the dispatcher's own rule for a suspect on foot), and another is coming down the drive behind it.
  const pulledUp = at(2.6 + lean, -13.6);
  const coming = at(2.8, -62);
  spawnPursuit(game, 'patrol', 'centinela', pulledUp.x, pulledUp.z, 1.05 + around, 0);
  spawnPursuit(game, 'patrol', 'centinela', coming.x, coming.z, around, 14);
  // The people out for the eclipse are caught in it, each in their own way: a sprint, hands up, ducked low, on the
  // ground, and two who would rather film it.
  const crowd = game.pedestrians;
  const runner = (x, z, style, awayX) => {
    const from = at(x, z);
    const threat = at(awayX, z + 1.5);
    const ped = crowd.spawnFleeing(from.x, from.z, threat);
    ped.fearStyle = style;
    ped.timid = false;
    ped.bold = false;
    ped.heading = Math.atan2(from.x - threat.x, from.z - threat.z);
    return ped;
  };
  runner(-5.6, -5.2, 'sprint', 0);
  runner(-7.4, -11.5, 'handsUp', 0);
  runner(5.6, -12.5, 'duck', 0);
  runner(6.4, -19, 'handsUp', 0);
  const fight = at(0, -8);
  const bystander = (x, z, style) => {
    const spot = at(x, z);
    const ped = spawnStroller(game, spot.x, spot.z);
    ped.timid = false;
    ped.bold = true;
    ped.gawkStyle = style;
    ped.gawk(fight.x, fight.z, 30);
    ped.heading = Math.atan2(fight.x - spot.x, fight.z - spot.z);
    return ped;
  };
  bystander(-10.5, -17.5, 'film');
  bystander(5.2, -24, 'point');
  const corner = at(-4.3, -3.3);
  const coward = spawnStroller(game, corner.x, corner.z);
  coward.timid = true;
  coward.cower(fight.x, fight.z + 2 * turn, 30);
  game.hud.say('JAZZ', 'El Anzuelo, live on Penumbra FM. Twenty-five hundred says he never sees the eclipse!', '#f4ecd8');
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
    for (const gunman of [boss, left, right]) gunman.health = 400;
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

/**
 * The getaway under the black sun: the vault is open, the ledger is in the Rayo, and Nova runs for Casa Reyes down
 * Penumbra Avenue with her lights out, the corona over the dark towers ahead, while Saros P.D. hunts the streets.
 */
function escapeScene(game) {
  const seconds = 1.5;
  const speed = 27;
  const lane = 4 * 80 + 2.9;
  const zEnd = 446;
  const z0 = zEnd - speed * seconds;
  loadCity(game, stagedSave(9), lane - 3, z0, 0);
  startHeist(game, 'Escape to Casa Reyes');
  // The getaway Rayo she left at the door of the Trust: hers to take again, a block on.
  const rayo = game.vehicles.spawn('rayo', lane, z0, 0, GETAWAY_PAINT);
  rayo.parked = true;
  rayo.stolen = true;
  tryEnterVehicle(game);
  play(game, 0.05);
  game.hud.clearSpeech();
  game.calendar.setHour(CONTACTS.totalityStart + (CONTACTS.totalityEnd - CONTACTS.totalityStart) * 0.42);
  game.player.cash = 41250;
  rayo.velZ = speed;
  clearLane(game, rayo, lane, z0 - 60, z0 + 160);
  game.wanted.setStars(4, 99);
  // She runs dark: no headlights, so nothing gives her away but the lamps and the searchlight.
  if (game.darkness.headlightsOn) game.darkness.toggleHeadlights();
  // A cruiser comes up the avenue at her, another turns in from the next street, an interceptor closes from behind,
  // and the helicopter hangs over the road ahead with its searchlight on her.
  spawnPursuit(game, 'patrol', 'centinela', lane - 5.8, zEnd + 40, Math.PI, 13);
  spawnPursuit(game, 'patrol', 'centinela', lane - 30, 480 + 2.9, Math.PI / 2, 12);
  spawnPursuit(game, 'interceptor', 'lince', lane - 0.5, z0 - 46, 0, 22);
  const helicopter = game.police.helicopter;
  helicopter.scramble();
  helicopter.orbit = 1.35;
  helicopter.mesh.position.set(lane + 5, 15, zEnd + 30);
  play(game, seconds, () => {
    if (rayo.speed < speed + 1) game.input.held.add('KeyW'); else game.input.held.delete('KeyW');
    helicopter.cooldown = 1;
    game.player.invulnerable = 1;
    game.camera.idleLook = 2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/**
 * A street race after dark: the Orrery Circuit on a week night, moments off the line. Nova's Corona GT is in the
 * pack down the north side of the square, under the lamps and the neon, with the first checkpoint's beam ahead.
 */
function raceScene(game) {
  const event = STREET_RACES.find((entry) => entry.id === 'orreryCircuit');
  const seconds = Number(sceneOption('at')) || 2.6;
  loadCity(game, stagedSave(6), event.x - 5, event.z, event.heading);
  game.calendar.setHour(21.4);
  game.player.cash = 18650;
  const ride = game.vehicles.spawn('coronaGT', event.x, event.z, event.heading, '#ff3b30');
  ride.parked = true;
  ride.stolen = true;
  tryEnterVehicle(game);
  play(game, 0.2);
  game.hud.clearSpeech();
  game.races.start(event);
  // The lights count down with the grid held; then she floors it with the others down the first straight.
  play(game, 3.45 + seconds, () => {
    game.input.held.add('KeyW');
    game.camera.idleLook = 2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
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
  game.missions.abandon();
  game.setState('pause');
}

const SCENES = { chase: chaseScene, bounty: bountyScene, race: raceScene, escape: escapeScene, workshop: workshopScene, atlas: atlasScene, title: titleScene, pause: pauseScene };
/** The HUD SIZE each scene is taken at: the cover at the standard size, the smaller shots with only the essentials. */
const SCENE_HUD_SIZE = { bounty: 'huge', race: 'huge', escape: 'huge' };

export function stageScreenshot(game, name) {
  // Every scene is drawn at twice the window's pixels (the RENDER SCALE setting) and with the HUD SIZE that suits it;
  // `?hud=` picks another. Neither is written to the player's saved settings.
  const asked = new URLSearchParams(window.location.search).get('hud');
  game.settings = { ...game.settings, renderScale: 2, hudSize: asked || SCENE_HUD_SIZE[name] || 'standard' };
  game.applySettings();
  (SCENES[name] || titleScene)(game);
  game.input.held.clear();
  game.frozen = true;
  window.__shotReady = true;
}
