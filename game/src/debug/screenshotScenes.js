// The scenes behind ?shot=chase|shootout|carjack|title: each stages a moment with the game's own systems, plays the
// real simulation forward for a few seconds with keys held down, then freezes the frame for the screenshot.
import { LANDMARKS } from '../world/cityLayout.js';
import { tryEnterVehicle } from '../vehicles/carjacking.js';
import { PursuitDriver } from '../police/policeDispatch.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';

const STEP = 1 / 60;

/** Run the game loop for `seconds` of simulated time; `each` runs before every step (to hold keys, pin the camera). */
function play(game, seconds, each = null) {
  for (let t = 0; t < seconds; t += STEP) {
    if (each) each(t);
    game.update(STEP);
  }
}

function freshCity(game, hour, x, z, heading) {
  game.resetWorld();
  game.activities.reset();
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

function spawnPursuit(game, model, x, z, heading, speed) {
  const cruiser = game.vehicles.spawn(model, x, z, heading);
  cruiser.driver = 'cop';
  cruiser.siren = true;
  cruiser.controller = new PursuitDriver(game);
  cruiser.velX = Math.sin(heading) * speed;
  cruiser.velZ = Math.cos(heading) * speed;
  return cruiser;
}

/** The cover: Nova in Marlin's stolen Rayo on Ocean Drive, four stars, cruisers and the helicopter behind her. */
function chaseScene(game) {
  freshCity(game, 17.25, 2.6, 232, 0);
  game.missions.reset(['homecoming', 'hotPlates', 'pierPressure']);
  game.player.cash = 18450;
  game.player.armor = 64;
  game.weapons.give('pistol', 60);
  game.weapons.give('smg', 128);
  game.missions.start(missionById('paintItGone'));
  const rayo = game.missions.active.vehicle;
  rayo.position.set(2.6, 0, 236);
  rayo.heading = 0;
  tryEnterVehicle(game);
  game.hud.clearSpeech();
  rayo.velZ = 33;
  for (const other of [...game.vehicles.list]) {
    if (other !== rayo && Math.abs(other.position.x) < 8 && other.position.z > 150 && other.position.z < 330) game.vehicles.remove(other);
  }
  spawnPursuit(game, 'centinela', -2.6, 223, 0, 35);
  spawnPursuit(game, 'centinela', 2.8, 211, 0, 35);
  spawnPursuit(game, 'bastion', -2.4, 196, 0, 35);
  spawnPursuit(game, 'centinela', 2.6, 182, 0, 35);
  play(game, 0.2);
  game.wanted.setStars(4, 99);
  game.police.helicopter.scramble();
  game.police.helicopter.orbit = -1.86;
  game.police.helicopter.mesh.position.set(-12, 26, 196);
  const yaw = Math.PI - 0.34;
  play(game, 1.5, () => {
    game.input.held.add('KeyW');
    game.camera.yaw = yaw;
    game.camera.pitch = 0.13;
    game.camera.idleLook = 0;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/** The Sundown Heist's gunfight outside Banco Marlin: guards, tracers, a burning car and the police arriving. */
function shootoutScene(game) {
  const bank = LANDMARKS.bank;
  freshCity(game, 13.2, bank.x - 31, bank.z + 5.5, Math.PI / 2);
  game.missions.reset(['homecoming', 'hotPlates', 'pierPressure', 'paintItGone', 'coastlineClassic']);
  game.player.cash = 61200;
  game.weapons.give('pistol', 60);
  game.weapons.give('smg', 128);
  game.missions.start(missionById('sundownHeist'));
  game.hud.clearSpeech();
  const wreck = game.vehicles.spawn('duna', bank.x - 10, bank.z + 10.2, Math.PI / 2, '#3498db');
  wreck.health = 0;
  wreck.hitByPlayer = false;
  wreck.burning = 2.75;
  spawnPursuit(game, 'centinela', bank.x + 46, bank.z + 5, -Math.PI / 2, 14);
  game.wanted.setStars(2, 99);
  play(game, 1.35, (t) => {
    game.camera.yaw = Math.PI / 2 + 0.1;
    game.camera.pitch = 0.1;
    game.input.buttons[0] = t > 0.2;
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
    game.player.health = Math.max(game.player.health, 58);
    if (t > 0.9) game.player.invulnerable = 1;
  });
  game.input.buttons[0] = false;
}

/** On foot in Playa Dorada, opening the first mission: the gold Estela waits at the kerb, the ocean beyond. */
function carjackScene(game) {
  freshCity(game, 12.4, 66, 322.5, -Math.PI / 2);
  game.player.cash = 250;
  game.missions.start(missionById('homecoming'));
  play(game, 3.4, (t) => {
    game.camera.yaw = -Math.PI / 2 + 0.1;
    game.camera.pitch = 0.1;
    if (t < 1.6) game.input.held.add('KeyW'); else game.input.held.delete('KeyW');
    game.hud.bannerClock = Math.min(game.hud.bannerClock, 0.01);
  });
}

/** The start screen, with a save on file so CONTINUE is offered. */
function titleScene(game) {
  game.saveGame(true);
  game.showTitle();
  play(game, 3);
}

const SCENES = { chase: chaseScene, shootout: shootoutScene, carjack: carjackScene, title: titleScene };

export function stageScreenshot(game, name) {
  (SCENES[name] || titleScene)(game);
  game.input.held.clear();
  game.frozen = true;
  window.__shotReady = true;
}
