// Owns every car in the world: spawning, car-to-car crashes, running people over and clearing wrecks.
import { SeededRandom, distance2D } from '../core/random.js';
import { Vehicle } from './vehiclePhysics.js';
import { randomPaint } from './vehicleCatalog.js';

export class VehicleFleet {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.rng = new SeededRandom(991);
  }

  spawn(modelId, x, z, heading, paint = null) {
    const vehicle = new Vehicle(this.game, modelId, x, z, heading, paint || randomPaint(modelId, this.rng));
    this.list.push(vehicle);
    return vehicle;
  }

  remove(vehicle) {
    const index = this.list.indexOf(vehicle);
    if (index !== -1) this.list.splice(index, 1);
    vehicle.dispose();
  }

  clear() {
    for (const vehicle of this.list) vehicle.dispose();
    this.list.length = 0;
  }

  /** The closest living car within `range` of a point that passes `filter`. */
  nearest(x, z, range, filter = null) {
    let best = null;
    let bestDistance = range;
    for (const vehicle of this.list) {
      if (vehicle.dead || (filter && !filter(vehicle))) continue;
      const d = distance2D(x, z, vehicle.position.x, vehicle.position.z) - vehicle.spec.width * 0.5;
      if (d < bestDistance) { bestDistance = d; best = vehicle; }
    }
    return best;
  }

  /** True when a circle at (x, z) would overlap any car: spawners ask before placing something. */
  isOccupied(x, z, radius) {
    for (const vehicle of this.list) {
      if (distance2D(x, z, vehicle.position.x, vehicle.position.z) < radius + vehicle.radius) return true;
    }
    return false;
  }

  update(dt) {
    const player = this.game.player;
    for (const vehicle of this.list) {
      if (vehicle.controller && !vehicle.dead) vehicle.controller.drive(vehicle, dt);
      vehicle.update(dt);
    }
    for (let a = 0; a < this.list.length; a += 1) {
      for (let b = a + 1; b < this.list.length; b += 1) this.collidePair(this.list[a], this.list[b]);
    }
    this.hitCharacters();
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const vehicle = this.list[index];
      const far = distance2D(vehicle.position.x, vehicle.position.z, player.position.x, player.position.z);
      if (vehicle.dead && vehicle.missionTag === null && (vehicle.deadTime > 45 || (vehicle.deadTime > 12 && far > 90))) this.remove(vehicle);
    }
  }

  collidePair(a, b) {
    const reach = a.radius + b.radius + 0.6;
    if (Math.abs(a.position.x - b.position.x) > reach || Math.abs(a.position.z - b.position.z) > reach) return;
    const radiusA = a.spec.width * 0.55;
    const radiusB = b.spec.width * 0.55;
    let deepest = 0;
    let nx = 0;
    let nz = 0;
    for (const ca of a.bodyCircles()) {
      for (const cb of b.bodyCircles()) {
        const dx = ca.x - cb.x;
        const dz = ca.z - cb.z;
        const dist = Math.hypot(dx, dz);
        const depth = radiusA + radiusB - dist;
        if (depth > deepest && dist > 0.001) { deepest = depth; nx = dx / dist; nz = dz / dist; }
      }
    }
    if (deepest === 0) return;
    const massA = a.spec.mass * (a.dead || a.parked ? 2.5 : 1);
    const massB = b.spec.mass * (b.dead || b.parked ? 2.5 : 1);
    const shareA = massB / (massA + massB);
    a.position.x += nx * deepest * shareA;
    a.position.z += nz * deepest * shareA;
    b.position.x -= nx * deepest * (1 - shareA);
    b.position.z -= nz * deepest * (1 - shareA);
    const closing = (a.velX - b.velX) * nx + (a.velZ - b.velZ) * nz;
    if (closing >= 0) return;
    const impulse = (-1.3 * closing) / (1 / massA + 1 / massB);
    a.velX += (nx * impulse) / massA;
    a.velZ += (nz * impulse) / massA;
    b.velX -= (nx * impulse) / massB;
    b.velZ -= (nz * impulse) / massB;
    const strength = -closing;
    if (strength > 4) {
      const playerInvolved = a.driver === 'player' || b.driver === 'player';
      a.damage((strength - 4) * 1.6 * shareA * 2, playerInvolved);
      b.damage((strength - 4) * 1.6 * (1 - shareA) * 2, playerInvolved);
      this.game.particles.sparks((a.position.x + b.position.x) / 2, 0.8, (a.position.z + b.position.z) / 2, 8);
      if (playerInvolved) {
        this.game.audio.crash(Math.min(strength / 18, 1));
        this.game.camera.shake(Math.min(strength * 0.02, 0.45));
        const other = a.driver === 'player' ? b : a;
        if (other.spec.police && strength > 7) this.game.wanted.reportCrime('ramPolice');
        else if (other.driver === 'ai' && strength > 9) this.game.wanted.reportCrime('hitAndRun');
        if (other.controller && other.controller.panic) other.controller.panic(5);
      }
    }
  }

  /** A moving car knocks down whoever it touches; a slow one just shoves them aside. */
  hitCharacters() {
    const people = this.game.allCharacters();
    for (const vehicle of this.list) {
      const moving = Math.hypot(vehicle.velX, vehicle.velZ);
      const radius = vehicle.spec.width * 0.55 + 0.35;
      for (const person of people) {
        if (!person.alive || person.vehicle || person.position.y > 1.6) continue;
        if (Math.abs(person.position.x - vehicle.position.x) > 4 || Math.abs(person.position.z - vehicle.position.z) > 4) continue;
        for (const circle of vehicle.bodyCircles()) {
          const dx = person.position.x - circle.x;
          const dz = person.position.z - circle.z;
          const dist = Math.hypot(dx, dz) || 0.001;
          if (dist >= radius) continue;
          person.position.x += (dx / dist) * (radius - dist);
          person.position.z += (dz / dist) * (radius - dist);
          const toward = (vehicle.velX * dx + vehicle.velZ * dz) / dist;
          if (moving > 4.5 && toward > 2 && !vehicle.dead) person.onVehicleHit(vehicle, moving);
          break;
        }
      }
    }
  }
}
