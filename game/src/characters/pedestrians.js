// The citizens of Saros: they stroll the sidewalks and the boardwalk, cross at corners, run from danger and can be hurt.
import { CITY, POPULATION } from '../core/config.js';
import { SeededRandom, distance2D } from '../core/random.js';
import { blockRect, blockIndexAt } from '../world/cityLayout.js';
import { CharacterBody, randomLook } from './characterBody.js';

function cornerPosition(i, j, corner) {
  const rect = blockRect(i, j);
  return {
    x: corner === 0 || corner === 3 ? rect.minX + INSET : rect.maxX - INSET,
    z: corner === 0 || corner === 1 ? rect.minZ + INSET : rect.maxZ - INSET,
  };
}

function isBlock(i, j) {
  return i >= 0 && j >= 0 && i < CITY.roadsX - 1 && j < CITY.roadsZ - 1;
}

class Pedestrian extends CharacterBody {
  constructor(game, look, x, z) {
    super(game, look, x, z);
    this.state = 'walk';
    this.pace = 1.2 + Math.random() * 0.7;
    this.goal = null;
    this.targetX = x;
    this.targetZ = z;
    this.timer = 0;
    this.fearX = 0;
    this.fearZ = 0;
    this.boardwalk = false;
  }

  /** Pick the next sidewalk corner: usually on round the block, sometimes across the street. */
  chooseGoal(rng) {
    if (this.boardwalk) {
      this.targetX = -9.5 + rng.range(-1.2, 1.2);
      this.targetZ = this.targetZ > CITY.depth / 2 ? rng.range(10, 200) : rng.range(CITY.depth - 200, CITY.depth - 10);
      return;
    }
    const goal = this.goal;
    let next = null;
    if (rng.chance(0.3)) {
      const [di, dj, corner] = rng.pick(CROSSINGS[goal.corner]);
      if (isBlock(goal.i + di, goal.j + dj)) next = { i: goal.i + di, j: goal.j + dj, corner };
    }
    if (!next) next = { i: goal.i, j: goal.j, corner: (goal.corner + (this.clockwise ? 1 : 3)) % 4 };
    this.goal = next;
    const spot = cornerPosition(next.i, next.j, next.corner);
    this.targetX = spot.x + rng.range(-0.7, 0.7);
    this.targetZ = spot.z + rng.range(-0.7, 0.7);
  }

  update(dt, rng) {
    if (!this.alive) { this.fall(dt, 18); this.animate(dt); return; }
    let speed = this.pace;
    let dirX = this.targetX - this.position.x;
    let dirZ = this.targetZ - this.position.z;
    if (this.state === 'flee') {
      this.timer -= dt;
      dirX = this.position.x - this.fearX;
      dirZ = this.position.z - this.fearZ;
      speed = 5.6;
      if (this.timer <= 0) this.state = 'walk';
    } else if (this.state === 'idle') {
      this.timer -= dt;
      speed = 0;
      if (this.timer <= 0) this.state = 'walk';
    } else if (this.state === 'watch') {
      // An eclipse watcher: stands at a watch party, turned to the sun, one hand up against the glare.
      speed = 0;
      this.turnToward(this.watchHeading, dt, 3);
    } else if (Math.hypot(dirX, dirZ) < 0.9) {
      this.chooseGoal(rng);
      if (rng.chance(0.12)) { this.state = 'idle'; this.timer = rng.range(2, 6); }
    }
    const length = Math.hypot(dirX, dirZ) || 1;
    if (speed > 0) {
      const hit = this.step((dirX / length) * speed * dt, (dirZ / length) * speed * dt);
      if (hit && this.state === 'flee') { this.fearX += hit.nz * 30; this.fearZ -= hit.nx * 30; }
      this.turnToward(Math.atan2(dirX, dirZ), dt, 7);
    }
    this.moveSpeed = speed;
    this.fall(dt, 18);
    this.animate(dt);
  }

  /** Join a watch party: stand still and look where the sun is. */
  watchSky(heading) {
    this.state = 'watch';
    this.watchHeading = heading;
    this.gazing = true;
  }

  /** Leave the party and go back to strolling. */
  stopWatching() {
    this.gazing = false;
    this.cheering = false;
    if (this.state === 'watch') this.state = 'walk';
  }

  scare(x, z, seconds) {
    if (!this.alive) return;
    this.gazing = false;
    this.cheering = false;
    this.state = 'flee';
    this.fearX = x;
    this.fearZ = z;
    this.timer = seconds;
  }

  takeDamage(amount, byPlayer = false) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) this.die(byPlayer);
    else this.scare(this.game.player.position.x, this.game.player.position.z, 12);
  }

  die(byPlayer) {
    this.alive = false;
    this.moveSpeed = 0;
    const game = this.game;
    if (byPlayer) {
      game.stats.peopleHurt += 1;
      game.wanted.reportCrime('killCivilian');
    }
    if (Math.random() < 0.7) game.pickups.drop('cash', this.position.x, this.position.z, 10 + Math.floor(Math.random() * 60));
    game.pedestrians.scareNear(this.position.x, this.position.z, 30, 10);
  }

  onVehicleHit(vehicle, speed) {
    const byPlayer = vehicle.driver === 'player';
    this.fling(vehicle, speed);
    this.game.audio.thud();
    if (speed > 8) { this.health = 0; this.die(byPlayer); }
    else this.takeDamage(speed * 9, byPlayer);
  }
}

export class PedestrianCrowd {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.rng = new SeededRandom(4242);
    this.spawnClock = 0;
  }

  /** A sidewalk position some distance from the player, with its goal corner; null when the try missed. */
  findSpawn(minDistance, maxDistance) {
    const rng = this.rng;
    const player = this.game.player.position;
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(minDistance, maxDistance);
    const x = player.x + Math.cos(angle) * radius;
    const z = player.z + Math.sin(angle) * radius;
    if (x < -4 && z > 10 && z < CITY.depth - 10) return { x: -9.5, z, boardwalk: true };
    const { i, j } = blockIndexAt(x, z);
    if (!isBlock(i, j)) return null;
    const corner = rng.int(0, 3);
    const clockwise = rng.chance(0.5);
    const from = cornerPosition(i, j, corner);
    const to = cornerPosition(i, j, (corner + (clockwise ? 1 : 3)) % 4);
    const t = rng.next();
    const spot = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    const distance = distance2D(spot.x, spot.z, player.x, player.z);
    if (distance < minDistance || distance > maxDistance + 40) return null;
    return { ...spot, goal: { i, j, corner }, clockwise };
  }

  spawnAt(spot) {
    const ped = new Pedestrian(this.game, randomLook(this.rng), spot.x, spot.z);
    ped.boardwalk = Boolean(spot.boardwalk);
    ped.goal = spot.goal || null;
    ped.clockwise = spot.clockwise;
    ped.targetX = spot.x;
    ped.targetZ = spot.z;
    ped.chooseGoal(this.rng);
    ped.heading = Math.atan2(ped.targetX - spot.x, ped.targetZ - spot.z);
    this.list.push(ped);
    return ped;
  }

  /** Fill the streets around the player at once (a new game, a load, a screenshot scene). */
  populate(count = POPULATION.pedestrians) {
    for (let tries = 0; tries < count * 12 && this.list.length < count; tries += 1) {
      const spot = this.findSpawn(8, POPULATION.pedestrianFar * 0.8);
      if (spot) this.spawnAt(spot);
    }
  }

  /** The driver pulled out of a car: a citizen who starts out running away. */
  spawnFleeing(x, z, from) {
    const { i, j } = blockIndexAt(x, z);
    const safeI = Math.min(Math.max(i, 0), CITY.roadsX - 2);
    const safeJ = Math.min(Math.max(j, 0), CITY.roadsZ - 2);
    const ped = this.spawnAt({ x, z, goal: { i: safeI, j: safeJ, corner: 0 }, clockwise: true });
    ped.scare(from.x, from.z, 14);
    return ped;
  }

  scareNear(x, z, radius, seconds = 9) {
    for (const ped of this.list) {
      if (ped.alive && distance2D(x, z, ped.position.x, ped.position.z) < radius) ped.scare(x, z, seconds);
    }
  }

  clear() {
    for (const ped of this.list) { ped.dispose(); ped.gone = true; }
    this.list.length = 0;
  }

  update(dt) {
    const player = this.game.player.position;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.list.length - this.game.watchParties.watcherCount() < POPULATION.pedestrians) {
      this.spawnClock = 0.25;
      const spot = this.findSpawn(POPULATION.spawnNear - 8, POPULATION.pedestrianFar);
      if (spot) this.spawnAt(spot);
    }
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const ped = this.list[index];
      ped.update(dt, this.rng);
      const distance = distance2D(ped.position.x, ped.position.z, player.x, player.z);
      if (distance > POPULATION.pedestrianFar + 45 + (ped.gazing ? 60 : 0) || (!ped.alive && (ped.deadTime > 40 || (ped.deadTime > 8 && distance > 80)))) {
        ped.dispose();
        ped.gone = true;
        this.list.splice(index, 1);
      }
    }
  }
}

const INSET = 1.5;
/** For each corner (NW, NE, SE, SW): the two street crossings that leave it, as [di, dj, corner on the far block]. */
const CROSSINGS = [
  [[-1, 0, 1], [0, -1, 3]],
  [[1, 0, 0], [0, -1, 2]],
  [[1, 0, 3], [0, 1, 1]],
  [[-1, 0, 2], [0, 1, 0]],
];
