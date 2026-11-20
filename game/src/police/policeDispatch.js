// The Saros P.D. dispatcher: scales the response with the wanted level, names each unit, hands out pursuit tactics,
// orders roadblocks and the helicopter, and reports the whole force to the HUD's dispatch panel and the minimap.
import { PursuitDriver, assignPursuitTactics } from './pursuitTactics.js';
import { Roadblocks } from './roadblocks.js';
import { PoliceHelicopter } from './policeHelicopter.js';
import { UNIT_ROLES, assignCallsign } from './unitCallsigns.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { randomLaneSpawn } from '../world/roadNetwork.js';
import { SeededRandom, angleDelta, distance2D } from '../core/random.js';

export class PoliceDispatch {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(1312);
    this.spawnClock = 0;
    this.tacticClock = 0;
    this.callsignCounters = {};
    this.helicopter = new PoliceHelicopter(game);
    this.helicopter.unit = this.nameUnit('air');
    this.roadblocks = new Roadblocks(game);
  }

  nameUnit(role) {
    return assignCallsign(role, this.callsignCounters);
  }

  /** Put a police vehicle into the chase: a callsign for the radio and a pursuit driver at the wheel. */
  enlist(vehicle, role) {
    vehicle.driver = 'cop';
    vehicle.siren = true;
    vehicle.ambient = false;
    vehicle.controller = new PursuitDriver(this.game);
    if (!vehicle.unit || vehicle.unit.role === 'roadblock') vehicle.unit = this.nameUnit(role);
    return vehicle;
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

  /** Which kind of unit answers the next call at this wanted level. */
  chooseRole(stars) {
    const roll = this.rng.next();
    if (stars >= 4 && roll < 0.3) return 'tactical';
    if (stars >= 3 && roll < 0.62) return 'interceptor';
    return 'patrol';
  }

  /** Put a pursuit unit on a road near the player, sirens on. */
  spawnUnit(minDistance = 85, maxDistance = 140, role = null) {
    const player = this.game.player.position;
    const spot = randomLaneSpawn(player.x, player.z, minDistance, maxDistance, this.rng);
    if (!spot || this.game.vehicles.isOccupied(spot.x, spot.z, 7)) return null;
    const unitRole = role || this.chooseRole(this.game.wanted.stars);
    const toward = Math.atan2(player.x - spot.x, player.z - spot.z);
    const heading = Math.abs(angleDelta(spot.heading, toward)) < Math.PI / 2 ? spot.heading : spot.heading + Math.PI;
    return this.enlist(this.game.vehicles.spawn(UNIT_ROLES[unitRole].model, spot.x, spot.z, heading), unitRole);
  }

  /**
   * Every unit hunting the player, nearest first, as the dispatch panel lists them:
   * callsign, kind, the tactic it is running and its distance in metres.
   */
  roster() {
    const game = this.game;
    const player = game.player.position;
    const rows = [];
    const blocks = new Map();
    for (const vehicle of game.vehicles.list) {
      if (vehicle.dead || vehicle.driver !== 'cop' || !vehicle.unit || !vehicle.controller) continue;
      const distance = distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z);
      if (vehicle.controller.isBlockade) {
        // The cars of one blockade share a callsign and a row; the row counts each of them.
        const row = blocks.get(vehicle.unit);
        if (row) { row.units += 1; row.distance = Math.min(row.distance, distance); continue; }
      } else if (!vehicle.controller.isPursuit) continue;
      const row = { ...vehicle.unit, units: 1, tactic: vehicle.controller.tacticLabel(), distance };
      if (vehicle.controller.isBlockade) blocks.set(vehicle.unit, row);
      rows.push(row);
    }
    for (const block of this.roadblocks.active()) {
      const row = rows.find((entry) => entry.callsign === block.unit.callsign);
      if (row && block.spikes) row.tactic = 'SPIKE STRIP';
    }
    if (this.helicopter.active) {
      rows.push({ ...this.helicopter.unit, units: 1, tactic: game.wanted.stars >= 4 ? 'GUNSHIP' : 'SPOTLIGHT', distance: this.helicopter.distanceToPlayer() });
    }
    let officers = 0;
    let nearest = Infinity;
    for (const gunman of game.gunmen.list) {
      if (gunman.faction !== 'police' || !gunman.alive) continue;
      officers += 1;
      nearest = Math.min(nearest, distance2D(gunman.position.x, gunman.position.z, player.x, player.z));
    }
    if (officers > 0) rows.push({ role: 'foot', kind: 'OFFICERS', icon: UNIT_ROLES.foot.icon, callsign: `FOOT ×${officers}`, units: officers, tactic: game.wanted.stars <= 1 ? 'ARREST' : 'OPEN FIRE', distance: nearest });
    return rows.sort((a, b) => a.distance - b.distance);
  }

  /**
   * How many units are after the player right now, counted from the world itself and not from the roster's rows:
   * every live police car in pursuit or holding a blockade, the helicopter while it flies, every officer on foot.
   */
  unitsOnPlayer() {
    const game = this.game;
    let count = this.helicopter.active ? 1 : 0;
    for (const vehicle of game.vehicles.list) {
      if (vehicle.dead || vehicle.driver !== 'cop' || !vehicle.unit || !vehicle.controller) continue;
      if (vehicle.controller.isPursuit || vehicle.controller.isBlockade) count += 1;
    }
    for (const gunman of game.gunmen.list) if (gunman.faction === 'police' && gunman.alive) count += 1;
    return count;
  }

  clear() {
    this.helicopter.dismiss(true);
    this.roadblocks.clear();
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
          && distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) < 120) this.enlist(vehicle, 'patrol');
      }
      this.spawnClock -= dt;
      if (this.spawnClock <= 0 && units.length < UNITS_BY_STARS[stars]) {
        this.spawnClock = this.spawnUnit() ? (stars >= 3 ? 1.6 : 3.2) : 0.25;
      }
      for (const vehicle of units) {
        if (distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z) > 260) game.vehicles.remove(vehicle);
      }
      this.tacticClock -= dt;
      if (this.tacticClock <= 0) {
        this.tacticClock = 1.2;
        units.sort((a, b) => distance2D(a.position.x, a.position.z, player.x, player.z) - distance2D(b.position.x, b.position.z, player.x, player.z));
        assignPursuitTactics(units, stars, Boolean(game.player.vehicle));
      }
    } else {
      // The search is off: sirens down, back on patrol.
      for (const vehicle of units) {
        vehicle.siren = false;
        vehicle.controller = createTrafficDriverFor(game, vehicle, this.rng);
        vehicle.ambient = true;
        vehicle.unit = null;
      }
    }
    this.roadblocks.update(dt, stars);
    this.helicopter.update(dt, stars);
  }
}

/** Pursuit vehicles on the road at each wanted level. */
const UNITS_BY_STARS = [0, 1, 2, 4, 5, 7];
