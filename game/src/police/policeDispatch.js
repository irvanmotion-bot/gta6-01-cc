// Solmara P.D.'s response: cruisers and tactical vans that hunt the player through the streets, ram and deploy officers.
import { SeededRandom, angleDelta, clamp, distance2D } from '../core/random.js';
import { nearestNode, nodePosition, randomLaneSpawn, stepToward } from '../world/roadNetwork.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { PoliceHelicopter } from './policeHelicopter.js';

/** Pursuit vehicles on the road at each wanted level. */
const UNITS_BY_STARS = [0, 1, 2, 3, 4, 6];

/** Drives one police vehicle after the player: by road when far, straight at them when in sight. */
export class PursuitDriver {
  constructor(game) {
    this.game = game;
    this.isPursuit = true;
    this.node = null;
    this.deployed = false;
    this.redeploy = 0;
    this.stuck = 0;
    this.reversing = 0;
  }

  drive(vehicle, dt) {
    const game = this.game;
    const player = game.player;
    const position = vehicle.position;
    vehicle.siren = true;
    let targetX = player.position.x;
    let targetZ = player.position.z;
    if (player.vehicle) { targetX += player.vehicle.velX * 0.5; targetZ += player.vehicle.velZ * 0.5; }
    const distance = distance2D(position.x, position.z, player.position.x, player.position.z);
    const playerSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : player.moveSpeed;
    this.redeploy -= dt;

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
    // Close to a player on foot or stopped: brake, then put the officers on the street.
    if (distance < 17 && playerSpeed < 5 && this.redeploy <= 0) {
      vehicle.setControls(vehicle.speed > 1 ? -1 : 0, 0, true);
      if (Math.abs(vehicle.speed) < 2) this.deploy(vehicle);
      return;
    }
    let aimX = targetX;
    let aimZ = targetZ;
    const direct = distance < 60 && game.collision.hasLineOfSight(position.x, position.z, player.position.x, player.position.z, 1);
    if (!direct) {
      if (!this.node) this.node = nearestNode(position.x, position.z);
      let spot = nodePosition(this.node.i, this.node.j);
      if (distance2D(position.x, position.z, spot.x, spot.z) < 11) {
        this.node = stepToward(this.node, targetX, targetZ);
        spot = nodePosition(this.node.i, this.node.j);
      }
      aimX = spot.x;
      aimZ = spot.z;
    } else {
      this.node = null;
    }
    const turn = angleDelta(vehicle.heading, Math.atan2(aimX - position.x, aimZ - position.z));
    const sharp = Math.abs(turn) > 0.85;
    const throttle = sharp && vehicle.speed > 11 ? -0.7 : 1;
    vehicle.setControls(throttle, clamp(turn * 2.2, -1, 1), sharp && vehicle.speed > 9 && Math.abs(turn) > 1.3);
    this.stuck = Math.abs(vehicle.speed) < 1.2 ? this.stuck + dt : 0;
    if (this.stuck > 1.5) {
      this.stuck = 0;
      this.reversing = 1.3;
      this.reverseSteer = turn > 0 ? -1 : 1;
    }
  }

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

export class PoliceDispatch {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(1312);
    this.spawnClock = 0;
    this.helicopter = new PoliceHelicopter(game);
  }

  pursuitUnits() {
    return this.game.vehicles.list.filter((v) => !v.dead && v.controller && v.controller.isPursuit);
  }

  /** True when a cruiser, an officer on foot or the helicopter is within `range` of the player. */
  anyUnitWithin(range) {
    const player = this.game.player.position;
    for (const vehicle of this.game.vehicles.list) {
      if (vehicle.spec.police && !vehicle.dead && vehicle.driver === 'cop' && distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) < range) return true;
    }
    for (const gunman of this.game.gunmen.list) {
      if (gunman.faction === 'police' && gunman.alive && distance2D(gunman.position.x, gunman.position.z, player.x, player.z) < range) return true;
    }
    return this.helicopter.active && this.helicopter.distanceToPlayer() < range * 1.5;
  }

  /** Put a pursuit unit on a road near the player, sirens on. */
  spawnUnit(minDistance = 85, maxDistance = 140, modelId = null) {
    const player = this.game.player.position;
    const spot = randomLaneSpawn(player.x, player.z, minDistance, maxDistance, this.rng);
    if (!spot || this.game.vehicles.isOccupied(spot.x, spot.z, 7)) return null;
    const stars = this.game.wanted.stars;
    const model = modelId || (stars >= 4 && this.rng.chance(0.35) ? 'bastion' : 'centinela');
    const toward = Math.atan2(player.x - spot.x, player.z - spot.z);
    const heading = Math.abs(angleDelta(spot.heading, toward)) < Math.PI / 2 ? spot.heading : spot.heading + Math.PI;
    const vehicle = this.game.vehicles.spawn(model, spot.x, spot.z, heading);
    vehicle.driver = 'cop';
    vehicle.controller = new PursuitDriver(this.game);
    vehicle.siren = true;
    return vehicle;
  }

  clear() {
    this.helicopter.dismiss(true);
  }

  update(dt) {
    const game = this.game;
    const stars = game.wanted.stars;
    const player = game.player.position;
    const units = this.pursuitUnits();
    if (stars > 0) {
      // Patrol cars already in traffic join the chase.
      for (const vehicle of game.vehicles.list) {
        if (vehicle.spec.police && vehicle.driver === 'cop' && vehicle.controller && vehicle.controller.isTraffic
          && distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) < 120) {
          vehicle.controller = new PursuitDriver(game);
          vehicle.ambient = false;
        }
      }
      this.spawnClock -= dt;
      if (this.spawnClock <= 0 && units.length < UNITS_BY_STARS[stars]) {
        this.spawnClock = this.spawnUnit() ? (stars >= 3 ? 1.6 : 3.2) : 0.25;
      }
      for (const vehicle of units) {
        if (distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) > 260) game.vehicles.remove(vehicle);
      }
    } else {
      // The search is off: sirens down, back on patrol.
      for (const vehicle of units) {
        vehicle.siren = false;
        vehicle.controller = createTrafficDriverFor(game, vehicle, this.rng);
        vehicle.ambient = true;
      }
    }
    this.helicopter.update(dt, stars);
  }
}
