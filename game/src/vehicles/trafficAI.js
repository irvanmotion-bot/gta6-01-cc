// Ambient traffic: drivers who keep their lane, turn at intersections, obey the lights, brake for obstacles and panic.
import { CITY, POPULATION } from '../core/config.js';
import { SeededRandom, angleDelta, clamp, distance2D } from '../core/random.js';
import { chooseNextNode, lanePoint, lightState, nearestNode, neighborNodes, nodePosition, randomLaneSpawn, segmentHeading } from '../world/roadNetwork.js';
import { randomTrafficModel } from './vehicleCatalog.js';

/** Steers one car along the road graph. */
export class TrafficDriver {
  constructor(game, from, to, rng) {
    this.game = game;
    this.rng = rng;
    this.from = from;
    this.to = to;
    this.next = chooseNextNode(from, to, rng);
    this.isTraffic = true;
    this.panicTime = 0;
    this.honk = 0;
    this.patience = 0;
  }

  /** Floor it and ignore the lights for a while: shots fired, or the car was rammed. */
  panic(seconds) {
    this.panicTime = Math.max(this.panicTime, seconds);
  }

  drive(vehicle, dt) {
    const position = vehicle.position;
    const toPosition = nodePosition(this.to.i, this.to.j);
    const axisX = Math.sign(this.to.i - this.from.i);
    const axisZ = Math.sign(this.to.j - this.from.j);
    const along = (position.x - this.from.i * P) * axisX + (position.z - this.from.j * P) * axisZ;
    const remaining = P - along;
    if (remaining < 7.5) {
      this.from = this.to;
      this.to = this.next;
      this.next = chooseNextNode(this.from, this.to, this.rng);
      return;
    }
    // Aim a little way down the lane; inside the intersection, at the lane of the road just entered.
    const aim = lanePoint(this.from, this.to, Math.min(Math.max(along, 8) + 9, P));
    const desired = Math.atan2(aim.x - position.x, aim.z - position.z);
    const turn = angleDelta(vehicle.heading, desired);
    const turningAhead = this.next.i - this.to.i !== this.to.i - this.from.i || this.next.j - this.to.j !== this.to.j - this.from.j;
    this.panicTime = Math.max(0, this.panicTime - dt);
    let targetSpeed = this.panicTime > 0 ? 22 : CRUISE;
    if ((turningAhead && remaining < 22) || along < 12) targetSpeed = Math.min(targetSpeed, this.panicTime > 0 ? 12 : 6);
    if (Math.abs(turn) > 0.5) targetSpeed = Math.min(targetSpeed, 5);
    if (this.panicTime === 0) {
      const state = lightState(axisZ !== 0 ? 'ns' : 'ew', this.game.time);
      if (state !== 'go' && remaining > 11 && remaining < 24) targetSpeed = 0;
      const gap = this.obstacleAhead(vehicle);
      if (gap < 4.5) targetSpeed = 0;
      else if (gap < 14) targetSpeed = Math.min(targetSpeed, (gap - 4.5) * 0.9);
      this.patience = gap < 5 ? this.patience + dt : 0;
      // Stuck behind something for too long: nose round it rather than gridlock the junction.
      if (this.patience > 7) targetSpeed = 3.5;
      if (this.patience > 10) this.patience = 0;
      if (this.patience > 4 && this.honk <= 0 && distance2D(position.x, position.z, this.game.player.position.x, this.game.player.position.z) < 30) {
        this.game.audio.horn();
        this.honk = 3 + Math.random() * 3;
      }
      this.honk -= dt;
    }
    const error = targetSpeed - vehicle.speed;
    const throttle = targetSpeed === 0 && vehicle.speed < 0.6 ? 0 : clamp(error * 0.5, -1, 0.75);
    vehicle.setControls(throttle, clamp(turn * 2.4, -1, 1), targetSpeed === 0 && vehicle.speed < 0.6);
  }

  /** Metres to the nearest car or person in the lane ahead; Infinity when the lane is clear. */
  obstacleAhead(vehicle) {
    const fx = vehicle.forwardX();
    const fz = vehicle.forwardZ();
    let nearest = Infinity;
    const check = (x, z, halfWidth) => {
      const dx = x - vehicle.position.x;
      const dz = z - vehicle.position.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 1 || ahead > 16) return;
      if (Math.abs(dx * -fz + dz * fx) > halfWidth) return;
      nearest = Math.min(nearest, ahead - vehicle.spec.length * 0.5);
    };
    for (const other of this.game.vehicles.list) if (other !== vehicle) check(other.position.x, other.position.z, 1.4 + other.spec.width * 0.25);
    for (const person of this.game.allCharacters()) if (person.alive && !person.vehicle) check(person.position.x, person.position.z, 1.5);
    return nearest;
  }
}

/** A driver for a car that is already somewhere on the grid: a retired police cruiser rejoining traffic. */
export function createTrafficDriverFor(game, vehicle, rng) {
  const from = nearestNode(vehicle.position.x, vehicle.position.z);
  let best = null;
  let bestScore = -Infinity;
  for (const node of neighborNodes(from.i, from.j)) {
    const score = Math.cos(angleDelta(vehicle.heading, segmentHeading(from, node)));
    if (score > bestScore) { bestScore = score; best = node; }
  }
  return new TrafficDriver(game, from, best, rng);
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(777);
    this.spawnClock = 0;
  }

  countAmbient() {
    let moving = 0;
    let parked = 0;
    for (const vehicle of this.game.vehicles.list) {
      if (vehicle.ambient && vehicle.parked) parked += 1;
      else if (vehicle.ambient && vehicle.controller && vehicle.controller.isTraffic) moving += 1;
    }
    return { moving, parked };
  }

  spawnMoving(minDistance, maxDistance) {
    const player = this.game.player.position;
    const spot = randomLaneSpawn(player.x, player.z, minDistance, maxDistance, this.rng);
    if (!spot || this.game.vehicles.isOccupied(spot.x, spot.z, 7)) return null;
    const patrol = this.rng.chance(0.06);
    const vehicle = this.game.vehicles.spawn(patrol ? 'centinela' : randomTrafficModel(this.rng), spot.x, spot.z, spot.heading);
    vehicle.driver = patrol ? 'cop' : 'ai';
    vehicle.controller = new TrafficDriver(this.game, spot.from, spot.to, this.rng);
    vehicle.ambient = true;
    vehicle.velX = Math.sin(spot.heading) * 8;
    vehicle.velZ = Math.cos(spot.heading) * 8;
    return vehicle;
  }

  /** A car left at the kerb, free to take. */
  spawnParked(minDistance, maxDistance) {
    const player = this.game.player.position;
    const spot = randomLaneSpawn(player.x, player.z, minDistance, maxDistance, this.rng, 5);
    if (!spot || this.game.vehicles.isOccupied(spot.x, spot.z, 6)) return null;
    const vehicle = this.game.vehicles.spawn(randomTrafficModel(this.rng), spot.x, spot.z, spot.heading);
    vehicle.parked = true;
    vehicle.ambient = true;
    return vehicle;
  }

  /** Fill the streets around the player at once (a new game, a load, a screenshot scene). */
  populate() {
    for (let tries = 0; tries < 80; tries += 1) {
      const count = this.countAmbient();
      if (count.moving < POPULATION.movingCars) this.spawnMoving(22, POPULATION.spawnFar);
      if (count.parked < POPULATION.parkedCars) this.spawnParked(14, POPULATION.spawnFar);
    }
  }

  update(dt) {
    const game = this.game;
    const player = game.player.position;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawnClock = 0.4;
      const count = this.countAmbient();
      if (count.moving < POPULATION.movingCars) this.spawnMoving(POPULATION.spawnNear + 25, POPULATION.spawnFar);
      else if (count.parked < POPULATION.parkedCars) this.spawnParked(POPULATION.spawnNear + 10, POPULATION.spawnFar);
    }
    for (let index = game.vehicles.list.length - 1; index >= 0; index -= 1) {
      const vehicle = game.vehicles.list[index];
      if (!vehicle.ambient || vehicle.driver === 'player' || vehicle.missionTag !== null) continue;
      const limit = POPULATION.despawn + (vehicle.stolen ? 80 : 0);
      if (distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) > limit) game.vehicles.remove(vehicle);
    }
  }
}

const P = CITY.pitch;
const CRUISE = 11.5;
