// Street races: three events with a starting grid, a countdown, AI rivals who drive the checkpoints, live
// positions, a purse by finishing place and a best result saved per event.
import { CITY } from '../core/config.js';
import { SeededRandom, angleDelta, clamp, distance2D } from '../core/random.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { CRED_AWARDS } from '../progression/streetCred.js';

/** Drives one rival round the checkpoints: flat out on the straights, braking for the corners, easing off when far ahead. */
export class RaceRivalDriver {
  constructor(race, name, pace) {
    this.race = race;
    this.name = name;
    this.pace = pace;
    this.isRacer = true;
    this.index = 0;
    this.finishTime = null;
    this.stuck = 0;
    this.reversing = 0;
  }

  /** Checkpoints passed plus the share of the way to the next: what the positions are sorted by. */
  progress(vehicle) {
    return raceProgress(this.race.points, this.index, vehicle.position.x, vehicle.position.z);
  }

  drive(vehicle, dt) {
    const race = this.race;
    const point = race.points[this.index];
    if (race.countdown > 0 || !point) { vehicle.setControls(0, 0, true); return; }
    const position = vehicle.position;
    const distance = distance2D(position.x, position.z, point.x, point.z);
    if (distance < 11) {
      this.index += 1;
      if (this.index >= race.points.length) this.finishTime = race.clock;
      return;
    }
    if (this.reversing > 0) { this.reversing -= dt; vehicle.setControls(-1, this.reverseSteer, false); return; }
    const turn = angleDelta(vehicle.heading, Math.atan2(point.x - position.x, point.z - position.z));
    const after = race.points[this.index + 1];
    const cornerAhead = after && Math.abs(angleDelta(Math.atan2(point.x - position.x, point.z - position.z), Math.atan2(after.x - point.x, after.z - point.z))) > 0.7;
    // Rubber band: a rival far ahead of the player lifts a little, one far behind pushes harder.
    const gap = this.progress(vehicle) - race.playerProgress;
    let target = vehicle.spec.maxSpeed * this.pace * (gap > 0.8 ? 0.82 : gap < -0.8 ? 1.06 : 1);
    if (cornerAhead && distance < 16 + vehicle.speed * 1.15) target = Math.min(target, 13);
    if (Math.abs(turn) > 0.6) target = Math.min(target, 9);
    const throttle = vehicle.speed < target ? 1 : vehicle.speed > target + 3 ? -1 : 0;
    vehicle.setControls(throttle, clamp(turn * 2.4, -1, 1), Math.abs(turn) > 1.2 && vehicle.speed > 12);
    this.stuck = Math.abs(vehicle.speed) < 1.2 ? this.stuck + dt : 0;
    if (this.stuck > 1.4) { this.stuck = 0; this.reversing = 1.2; this.reverseSteer = turn > 0 ? -1 : 1; }
  }
}

export class StreetRaces {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(5150);
    this.best = {};
    this.active = null;
  }

  reset(best = {}) {
    this.cancel();
    this.best = { ...best };
  }

  winsCount() {
    return STREET_RACES.filter((event) => this.best[event.id] && this.best[event.id].place === 1).length;
  }

  /** Line the player's car and three rivals up on the grid and start the countdown. */
  start(event) {
    const game = this.game;
    const car = game.player.vehicle;
    const points = event.route.map(([i, j]) => ({ x: i * P, z: j * P }));
    const race = { event, points, countdown: 3.4, clock: 0, index: 0, rivals: [], order: [], playerProgress: 0, place: 4, car, lastCount: 4 };
    const fx = Math.sin(event.heading);
    const fz = Math.cos(event.heading);
    const slot = (row, side) => ({ x: event.x - fx * row * 8 + fz * side * 2.7, z: event.z - fz * row * 8 - fx * side * 2.7 });
    for (const other of [...game.vehicles.list]) {
      if (other !== car && distance2D(other.position.x, other.position.z, event.x, event.z) < 30) game.vehicles.remove(other);
    }
    const mine = slot(1, 1);
    car.position.set(mine.x, 0, mine.z);
    car.heading = event.heading;
    car.velX = 0;
    car.velZ = 0;
    const grid = [slot(0, -1), slot(0, 1), slot(1, -1)];
    event.rivals.forEach(([name, model, paint, pace], index) => {
      const rival = game.vehicles.spawn(model, grid[index].x, grid[index].z, event.heading, paint);
      rival.driver = 'ai';
      rival.missionTag = 'race';
      rival.controller = new RaceRivalDriver(race, name, pace);
      race.rivals.push(rival);
    });
    this.active = race;
    game.camera.snapBehind(event.heading);
    game.hud.banner(event.name.toUpperCase(), `Street race · ${points.length} checkpoints · purse $${event.purse.toLocaleString('en-US')}`, '#35d0ff');
  }

  /** Stop the race without a result: the rivals drive off into traffic. */
  cancel(reason = '') {
    const race = this.active;
    if (!race) return;
    for (const rival of race.rivals) {
      rival.missionTag = null;
      rival.ambient = true;
      if (!rival.dead) rival.controller = createTrafficDriverFor(this.game, rival, this.rng);
    }
    this.active = null;
    this.game.player.frozen = false;
    if (reason) this.game.hud.banner('RACE OVER', reason, '#ff3b30');
  }

  /** The player crossed the line: pay by place, keep the best place and time, hand out cred. */
  finish() {
    const game = this.game;
    const race = this.active;
    const place = race.place;
    const event = race.event;
    const payout = Math.round(event.purse * PURSE_SHARE[place - 1]);
    const best = this.best[event.id];
    if (!best || place < best.place || (place === best.place && race.clock < best.time)) this.best[event.id] = { place, time: race.clock };
    game.player.addCash(payout);
    game.stats.racesRun += 1;
    if (place === 1) game.stats.racesWon += 1;
    game.hud.banner(place === 1 ? 'RACE WON' : `FINISHED ${PLACE_NAMES[place - 1]}`, `${event.name} · ${race.clock.toFixed(1)}s · +$${payout.toLocaleString('en-US')}`, place === 1 ? '#ffd60a' : '#35d0ff');
    if (place <= 3) game.cred.earn(place === 1 ? CRED_AWARDS.raceWin : CRED_AWARDS.racePodium, `${PLACE_NAMES[place - 1]} in ${event.name}`);
    game.audio.jingle(place <= 3);
    this.cancel();
    game.saveGame(true);
  }

  /** What the job panel shows while racing: place, checkpoint count, the clock and the gap to the leader. */
  panelInfo() {
    const race = this.active;
    if (!race) return null;
    const count = race.points.length;
    return {
      header: 'STREET RACE', title: race.event.name, stageLine: `POSITION ${race.place}/${race.rivals.length + 1}`, share: race.index / count,
      objective: race.countdown > 0 ? 'Hold the line… engines hot' : `Checkpoint ${Math.min(race.index + 1, count)} of ${count}`, next: `Purse $${race.event.purse.toLocaleString('en-US')} for first`, timer: race.clock, counting: 'up',
    };
  }

  /** The running order, leader first: it sets the player's place and fills the HUD's race board. */
  standings() {
    const race = this.active;
    if (!race) return [];
    const rows = race.rivals.map((rival) => ({ name: rival.controller.name, progress: rival.controller.finishTime !== null ? 1000 - rival.controller.finishTime : rival.controller.progress(rival), player: false }));
    rows.push({ name: 'NOVA', progress: race.playerProgress, player: true });
    return rows.sort((a, b) => b.progress - a.progress);
  }

  /** The order as last worked out by update, so the panel and the board always agree. */
  raceOrder() {
    return this.active ? this.active.order : [];
  }

  blips() {
    const race = this.active;
    if (!race) return STREET_RACES.map((event) => ({ x: event.x, z: event.z, color: '#35d0ff', label: 'R' }));
    const list = race.rivals.filter((rival) => !rival.dead).map((rival) => ({ x: rival.position.x, z: rival.position.z, color: '#35d0ff', label: '', size: 0.9 }));
    const point = race.points[race.index];
    if (point) list.push({ x: point.x, z: point.z, color: '#ffd60a', label: '', pinned: true });
    return list;
  }

  /** Offer the events at their start lines; E in a stopped car enters. */
  offer() {
    const game = this.game;
    const player = game.player;
    const car = player.vehicle;
    for (const event of STREET_RACES) {
      game.markers.show(event.x, event.z, '#35d0ff', 3, 12);
      if (distance2D(player.position.x, player.position.z, event.x, event.z) > 6) continue;
      const best = this.best[event.id];
      const record = best ? ` · best: ${PLACE_NAMES[best.place - 1]} ${best.time.toFixed(1)}s` : '';
      if (!car) game.hud.hint(`${event.name}: bring a car to race${record}`);
      else if (car.spec.police) game.hud.hint('Nobody races a police car');
      else if (game.wanted.stars > 0) game.hud.hint('Lose the police before you race');
      else if (Math.abs(car.speed) < 3) {
        game.hud.hint(`Press E to race ${event.name} · purse $${event.purse.toLocaleString('en-US')}${record}`);
        if (game.input.wasPressed('KeyE')) this.start(event);
      }
    }
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const race = this.active;
    if (!race) {
      if (!game.missions.active && !game.activities.fare && player.alive) this.offer();
      return;
    }
    if (player.vehicle !== race.car || race.car.dead || !player.alive) { this.cancel('You left your car.'); return; }
    if (race.countdown > 0) {
      race.countdown -= dt;
      player.frozen = race.countdown > 0;
      const count = Math.ceil(race.countdown);
      if (count !== race.lastCount) {
        race.lastCount = count;
        game.audio.checkpoint();
        game.hud.banner(count > 0 ? String(count) : 'GO!', race.event.name, count > 0 ? '#ffffff' : '#2ecc71');
      }
      return;
    }
    race.clock += dt;
    const point = race.points[race.index];
    game.markers.show(point.x, point.z, '#ffd60a', 6, 34);
    if (race.points[race.index + 1]) game.markers.show(race.points[race.index + 1].x, race.points[race.index + 1].z, '#ff9f1c', 4, 12);
    if (distance2D(player.position.x, player.position.z, point.x, point.z) < 10) { race.index += 1; game.audio.checkpoint(); }
    race.playerProgress = raceProgress(race.points, race.index, player.position.x, player.position.z);
    race.order = this.standings();
    race.place = race.order.findIndex((row) => row.player) + 1;
    if (race.index >= race.points.length) this.finish();
    else if (race.clock > race.event.limit) this.cancel('Too slow: the others went home.');
  }
}

/** Checkpoints passed plus how far along the current leg a car is. */
function raceProgress(points, index, x, z) {
  const point = points[index];
  if (!point) return points.length;
  const before = points[index - 1];
  const leg = before ? distance2D(before.x, before.z, point.x, point.z) : 160;
  return index + clamp(1 - distance2D(x, z, point.x, point.z) / Math.max(leg, 1), 0, 0.999);
}

const P = CITY.pitch;
const PURSE_SHARE = [1, 0.4, 0.15, 0];
const PLACE_NAMES = ['1ST', '2ND', '3RD', '4TH'];

/**
 * The events: a start line (position and heading), the route as street-grid junctions, the purse for first,
 * the time limit, and the rivals as [name, car, paint, pace].
 */
export const STREET_RACES = [
  {
    id: 'oceanDash', name: 'Ocean Drive Dash', x: 2.7, z: 100, heading: 0, purse: 2000, limit: 200,
    route: [[0, 3], [0, 6], [0, 9], [3, 9], [3, 6], [3, 3], [3, 1], [1, 1], [0, 1]],
    rivals: [['VEGA', 'coyote', '#35d0ff', 0.74], ['KIKO', 'estela', '#ff2d95', 0.78], ['LUZ', 'brisa', '#b6ff3b', 0.8]],
  },
  {
    id: 'centroCircuit', name: 'Centro Circuit', x: 334, z: 242.7, heading: Math.PI / 2, purse: 4000, limit: 210,
    route: [[6, 3], [8, 3], [8, 6], [6, 6], [4, 6], [4, 3], [6, 3], [8, 3], [8, 6], [4, 6], [4, 3]],
    rivals: [['VEGA', 'marlinGT', '#35d0ff', 0.72], ['DUQUE', 'coyote', '#ffd60a', 0.8], ['ROSA', 'coyote', '#ff2d95', 0.77]],
  },
  {
    id: 'harborSprint', name: 'Harbor Night Sprint', x: 786, z: 637.3, heading: -Math.PI / 2, purse: 6500, limit: 220,
    route: [[8, 8], [5, 8], [2, 8], [2, 6], [5, 6], [8, 6], [10, 6], [10, 8], [8, 8]],
    rivals: [['VEGA', 'rayo', '#35d0ff', 0.7], ['DUQUE', 'marlinGT', '#ffd60a', 0.76], ['SOMBRA', 'marlinGT', '#8a5cff', 0.78]],
  },
];
