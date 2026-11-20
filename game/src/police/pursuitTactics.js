// How one police vehicle hunts the player: it tails, rams, flanks for a side-swipe or cuts the road off ahead,
// follows the street grid when it has no line of sight, shoots from its window at three stars and up, and puts its
// officers on the street when the player stops.
import * as THREE from 'three';
import { nearestNode, nodePosition, stepToward } from '../world/roadNetwork.js';
import { angleDelta, clamp, distance2D } from '../core/random.js';
import { MeshBatcher } from '../render/meshBatcher.js';

/** Drives one pursuit vehicle with the tactic the dispatcher gave it. */
export class PursuitDriver {
  constructor(game) {
    this.game = game;
    this.isPursuit = true;
    this.tactic = 'respond';
    this.node = null;
    this.deployed = false;
    this.redeploy = 0;
    this.stuck = 0;
    this.reversing = 0;
    this.reverseSteer = 0;
    this.swerving = false;
    this.windowClock = 0.4 + Math.random() * 0.8;
    // Which corner of a search zone this car takes when the suspect is lost: every unit a different one.
    this.searchSlot = nextSearchSlot;
    nextSearchSlot = (nextSearchSlot + 1) % 12;
    this.burstLeft = 0;
    this.shotsFired = 0;
    this.muzzle = new THREE.Vector3();
    this.impact = new THREE.Vector3();
  }

  /** What the dispatch panel prints for this unit right now: the verb of what it is doing. */
  tacticLabel() {
    if (this.deployed) return 'CREW ON FOOT';
    if (this.game.wanted.evading) return 'SEARCHING';
    if (this.swerving) return 'SIDE-SWIPING';
    return TACTIC_LABELS[this.tactic];
  }

  drive(vehicle, dt) {
    const game = this.game;
    const player = game.player;
    const position = vehicle.position;
    vehicle.siren = true;
    const distance = distance2D(position.x, position.z, player.position.x, player.position.z);
    const playerSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : player.moveSpeed;
    this.redeploy -= dt;
    this.swerving = false;
    this.tuckIn(vehicle, dt);

    if (this.deployed) {
      vehicle.setControls(0, 0, true);
      if (distance > 55) { this.deployed = false; this.redeploy = 10; }
      return;
    }
    if (this.reversing > 0) {
      this.reversing -= dt;
      vehicle.setControls(-1, this.reverseSteer, false);
      return;
    }
    // A crew sees her at seventy metres by day; in the dark, with no light on her, at a quarter of that.
    const direct = distance < game.darkness.sightRange(70) && game.collision.hasLineOfSight(position.x, position.z, player.position.x, player.position.z, 1);
    // Close to a player on foot or stopped, and with eyes on her: brake, then put the officers on the street.
    if (distance < 17 && playerSpeed < 5 && this.redeploy <= 0 && (direct || game.wanted.seen)) {
      vehicle.setControls(vehicle.speed > 1 ? -1 : 0, 0, true);
      if (Math.abs(vehicle.speed) < 2) this.deploy(vehicle);
      return;
    }
    if (direct) this.fireFromWindow(vehicle, player, distance, dt);
    const aim = direct ? this.aimInSight(vehicle, player, distance) : this.aimByRoad(vehicle, player);
    const turn = angleDelta(vehicle.heading, Math.atan2(aim.x - position.x, aim.z - position.z));
    const sharp = Math.abs(turn) > 0.85;
    let throttle = sharp && vehicle.speed > 11 ? -0.7 : 1;
    if (aim.holdBack && vehicle.speed > playerSpeed + 1) throttle = distance < 8 ? -0.6 : 0;
    // Closing on someone on foot or parked: come in under control and pull up, do not plough into the kerb beside them.
    if (playerSpeed < 6 && vehicle.speed > Math.max(7, distance * 0.42)) throttle = -1;
    vehicle.setControls(throttle, clamp(turn * 2.2, -1, 1), sharp && vehicle.speed > 9 && Math.abs(turn) > 1.3);
    this.stuck = Math.abs(vehicle.speed) < 1.2 ? this.stuck + dt : 0;
    if (this.stuck > 1.5) {
      this.stuck = 0;
      this.reversing = 1.3;
      this.reverseSteer = turn > 0 ? -1 : 1;
    }
  }

  /**
   * From three stars the officer riding shotgun leans out and shoots while the car is still chasing: short bursts
   * from the window on the player's side, wild at speed, that chip at the player's car or at Nova on foot.
   */
  fireFromWindow(vehicle, player, distance, dt) {
    const game = this.game;
    if (game.wanted.stars < WINDOW_FIRE.fromStars || distance > WINDOW_FIRE.range || !player.alive) return;
    this.windowClock -= dt;
    if (this.windowClock > 0) return;
    this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : WINDOW_FIRE.burst - 1;
    this.windowClock = this.burstLeft > 0 ? WINDOW_FIRE.rate : WINDOW_FIRE.pause * (0.7 + Math.random() * 0.6);
    const position = vehicle.position;
    // The window on whichever side of the car the player is.
    const leftX = vehicle.forwardZ();
    const leftZ = -vehicle.forwardX();
    const side = (player.position.x - position.x) * leftX + (player.position.z - position.z) * leftZ > 0 ? 1 : -1;
    const reach = vehicle.spec.width / 2 + 0.25;
    const from = this.muzzle.set(position.x + leftX * side * reach + vehicle.forwardX() * 0.5, position.y + vehicle.spec.height * 0.72, position.z + leftZ * side * reach + vehicle.forwardZ() * 0.5);
    const fast = Math.abs(vehicle.speed) > 14 || (player.vehicle ? Math.abs(player.vehicle.speed) > 14 : player.moveSpeed > 5);
    const hit = Math.random() < WINDOW_FIRE.accuracy * (1 - (distance / WINDOW_FIRE.range) * 0.5) * (fast ? 0.6 : 1);
    const miss = hit ? 0.3 : 2.2;
    // A round at a car strikes the side of it that faces the gun, not its middle.
    const gap = Math.hypot(player.position.x - from.x, player.position.z - from.z) || 1;
    const short = player.vehicle ? Math.min(player.vehicle.spec.width * 0.5, gap * 0.5) / gap : 0;
    const aimX = player.position.x - (player.position.x - from.x) * short;
    const aimZ = player.position.z - (player.position.z - from.z) * short;
    const to = this.impact.set(aimX + (Math.random() - 0.5) * miss * 2, player.position.y + 0.9 + (Math.random() - 0.5) * miss * 0.6, aimZ + (Math.random() - 0.5) * miss * 2);
    game.particles.tracer(from, to, 0xbfd8ff);
    game.particles.muzzleFlash(from.x, from.y, from.z, 0.6);
    game.audio.gunshot('distant', Math.max(0.2, 1 - distance / 50));
    this.shotsFired += 1;
    this.leanOut(vehicle, side);
    if (!hit) return;
    if (player.vehicle) {
      player.vehicle.damage(WINDOW_FIRE.damage * 0.7);
      game.particles.sparks(to.x, to.y, to.z, 3);
    }
    player.takeDamage(WINDOW_FIRE.damage, 'bullet');
  }

  /**
   * Show the officer who is shooting: head, shoulders and gun arm out of the window on `side` of the car, for as
   * long as the burst lasts and a moment after it.
   */
  leanOut(vehicle, side) {
    if (!this.gunner || this.gunner.parent !== vehicle.mesh) {
      this.gunner = new THREE.Mesh(windowGunnerShape, windowGunnerMaterial);
      vehicle.mesh.add(this.gunner);
      // The car itself pulls him back in if it loses its pursuit driver (stolen, wrecked): see vehiclePhysics.js.
      vehicle.windowGunner = this.gunner;
    }
    this.gunner.position.set(side * (vehicle.spec.width / 2 - 0.12), vehicle.spec.height * 0.72 - 0.3, 0.45);
    this.gunner.rotation.y = side > 0 ? 0 : Math.PI;
    this.gunner.visible = true;
    this.gunnerClock = 1.1;
  }

  /** Back inside once the shooting stops (and at once when the crew gets out or the car is wrecked). */
  tuckIn(vehicle, dt) {
    if (!this.gunner || !this.gunner.visible) return;
    this.gunnerClock -= dt;
    if (this.gunnerClock <= 0 || this.deployed || vehicle.dead) this.gunner.visible = false;
  }

  /** The point to steer at with the player in view, by tactic. */
  aimInSight(vehicle, player, distance) {
    this.node = null;
    const car = player.vehicle;
    const px = player.position.x;
    const pz = player.position.z;
    if (!car) return { x: px, z: pz };
    const leadX = px + car.velX * 0.5;
    const leadZ = pz + car.velZ * 0.5;
    const tactic = this.tactic;
    if (tactic === 'tail') {
      return { x: px - car.forwardX() * 7, z: pz - car.forwardZ() * 7, holdBack: distance < 13 };
    }
    if (tactic === 'flankLeft' || tactic === 'flankRight') {
      const side = tactic === 'flankLeft' ? 1 : -1;
      const fx = car.forwardX();
      const fz = car.forwardZ();
      const along = (vehicle.position.x - px) * fx + (vehicle.position.z - pz) * fz;
      const lateral = ((vehicle.position.x - px) * fz - (vehicle.position.z - pz) * fx) * side;
      // Level with the target and beside it: turn in across its nose.
      if (along > -2.5 && lateral > 0 && lateral < 6) {
        this.swerving = true;
        return { x: px + fx * 7 + car.velX * 0.3, z: pz + fz * 7 + car.velZ * 0.3 };
      }
      return { x: leadX + fz * side * 3.6 + fx * 5, z: leadZ - fx * side * 3.6 + fz * 5 };
    }
    return { x: leadX, z: leadZ };
  }

  /**
   * No line of sight. While any unit still has eyes on her the radio says where she is: follow the street grid to
   * her, or to the junction ahead of her when cutting off. Once every unit has lost her, each car drives to its own
   * corner of the search zone round the place she was last seen.
   */
  aimByRoad(vehicle, player) {
    let goalX = player.position.x;
    let goalZ = player.position.z;
    const car = player.vehicle;
    const wanted = this.game.wanted;
    if (!wanted.seen && wanted.stars > 0) {
      const corner = wanted.searchPoint(this.searchSlot);
      goalX = corner.x;
      goalZ = corner.z;
    } else if (this.tactic === 'cutOff' && car && Math.abs(car.speed) > 8) {
      goalX += car.forwardX() * 120;
      goalZ += car.forwardZ() * 120;
    }
    if (!this.node) this.node = nearestNode(vehicle.position.x, vehicle.position.z);
    let spot = nodePosition(this.node.i, this.node.j);
    if (distance2D(vehicle.position.x, vehicle.position.z, spot.x, spot.z) < 11) {
      this.node = stepToward(this.node, goalX, goalZ);
      spot = nodePosition(this.node.i, this.node.j);
    }
    return spot;
  }

  /** Stop and send the crew out: two officers from a cruiser, a four-strong squad from a tactical van. */
  deploy(vehicle) {
    this.deployed = true;
    const tactical = vehicle.modelId === 'bastion';
    const crew = tactical ? 4 : 2;
    const leftX = vehicle.forwardZ();
    const leftZ = -vehicle.forwardX();
    for (let k = 0; k < crew; k += 1) {
      const side = k % 2 ? 1 : -1;
      const back = Math.floor(k / 2) * 1.4 - 0.5;
      const x = vehicle.position.x + leftX * side * (vehicle.spec.width / 2 + 0.9) - vehicle.forwardX() * back;
      const z = vehicle.position.z + leftZ * side * (vehicle.spec.width / 2 + 0.9) - vehicle.forwardZ() * back;
      this.game.gunmen.spawn(tactical ? 'tactical' : 'officer', x, z);
    }
    this.game.audio.carDoor();
  }
}

/**
 * Give every unit in the chase its job for the next moments, nearest first. One star only tails for an arrest;
 * two send the lead car to ram; from three the pack splits into a rammer, two flankers and a car cutting ahead.
 */
export function assignPursuitTactics(units, stars, playerDriving) {
  let slot = 0;
  for (const vehicle of units) {
    const driver = vehicle.controller;
    if (!playerDriving) driver.tactic = 'respond';
    else if (stars <= 1) driver.tactic = 'tail';
    else if (vehicle.modelId === 'bastion') driver.tactic = 'ram';
    else if (stars === 2) { driver.tactic = slot === 0 ? 'ram' : 'tail'; slot += 1; }
    else { driver.tactic = PACK_PATTERN[slot % PACK_PATTERN.length]; slot += 1; }
  }
}

/** The officer at the window, from the sill up and leaning out along +x: shoulders, head and cap, the gun arm. */
function buildWindowGunner() {
  const parts = new MeshBatcher();
  parts.addBox(0.14, 0, 0, 0.4, 0.42, 0.34, '#2e4a7d');
  parts.addBox(0.24, 0.44, 0.03, 0.25, 0.27, 0.26, '#e0ac69');
  parts.addBox(0.24, 0.69, 0.03, 0.29, 0.1, 0.3, '#16203a');
  parts.addBox(0.56, 0.25, 0.12, 0.52, 0.13, 0.13, '#2e4a7d');
  parts.addBox(0.86, 0.25, 0.12, 0.14, 0.13, 0.13, '#e0ac69');
  parts.addBox(1.02, 0.27, 0.12, 0.3, 0.1, 0.07, '#16181b');
  return parts.build(null, { receiveShadow: false }).geometry;
}
const windowGunnerShape = buildWindowGunner();
const windowGunnerMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

/** Shooting from a moving cruiser: the wanted level it starts at, reach in metres, shots a burst and their odds. */
const WINDOW_FIRE = { fromStars: 3, range: 40, burst: 3, rate: 0.12, pause: 1.5, accuracy: 0.22, damage: 5 };
const PACK_PATTERN =['ram', 'flankLeft', 'flankRight', 'cutOff', 'ram', 'cutOff'];
const TACTIC_LABELS = { respond: 'RESPONDING', tail: 'TAILING', ram: 'RAMMING', flankLeft: 'FLANKING LEFT', flankRight: 'FLANKING RIGHT', cutOff: 'CUTTING OFF' };
let nextSearchSlot = 0;
