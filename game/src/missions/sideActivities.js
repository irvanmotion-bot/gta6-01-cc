// Things to do between missions: taxi fares in a Sol Cab, the twelve hidden Sun Tokens and rampage cash for stunts.
import { CITY } from '../core/config.js';
import { SeededRandom, distance2D } from '../core/random.js';
import { blockRect, districtNameAt, kerbSpot } from '../world/cityLayout.js';
import { CRED_AWARDS } from '../progression/streetCred.js';

export class SideActivities {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(8086);
    this.tokens = new Set();
    this.fare = null;
    this.faresDone = 0;
    this.airTime = 0;
  }

  reset(tokens = [], faresDone = 0) {
    this.tokens = new Set(tokens);
    this.faresDone = faresDone;
    this.fare = null;
    this.placeTokens();
    // The beach always has a few things lying around.
    this.game.pickups.drop('health', -30, 318, 0, true);
    this.game.pickups.drop('armor', -52, 142, 0, true);
    this.game.pickups.drop('health', 610, 735, 0, true);
  }

  placeTokens() {
    TOKEN_SPOTS.forEach(([i, j, ox, oz], index) => {
      if (this.tokens.has(index)) return;
      const rect = blockRect(i, j);
      this.game.pickups.drop('token', rect.minX + ox, rect.minZ + oz, 0, true, index);
    });
  }

  collectToken(index) {
    this.tokens.add(index);
    this.game.player.addCash(TOKEN_REWARD);
    const left = TOKEN_SPOTS.length - this.tokens.size;
    this.game.hud.banner('SUN TOKEN', left > 0 ? `+$${TOKEN_REWARD} · ${left} still hidden in Solmara` : 'All twelve found! +$10,000 bonus', '#ffd60a');
    if (left === 0) this.game.player.addCash(10000);
    this.game.cred.earn(CRED_AWARDS.token, 'Sun Token');
  }

  tokenCount() {
    return `${this.tokens.size}/${TOKEN_SPOTS.length}`;
  }

  /** Start or stop taking fares; only a Sol Cab can. */
  toggleTaxi() {
    const game = this.game;
    const vehicle = game.player.vehicle;
    if (this.fare) { this.fare = null; game.hud.notify('Taxi duty off.'); return; }
    if (!vehicle || !vehicle.spec.taxi) return;
    if (game.missions.active || game.races.active) { game.hud.notify('Finish what you started first.'); return; }
    this.newFare();
    game.hud.notify('Taxi duty on. Pick up the fare.');
  }

  randomKerb(nearX, nearZ, minDistance, maxDistance) {
    for (let tries = 0; tries < 40; tries += 1) {
      const spot = kerbSpot(this.rng.int(0, CITY.roadsX - 2), this.rng.int(0, CITY.roadsZ - 2), this.rng.range(0.25, 0.75));
      const d = distance2D(nearX, nearZ, spot.x, spot.z);
      if (d > minDistance && d < maxDistance) return spot;
    }
    return kerbSpot(5, 4);
  }

  newFare() {
    const player = this.game.player.position;
    const pickup = this.randomKerb(player.x, player.z, 60, 260);
    const drop = this.randomKerb(pickup.x, pickup.z, 180, 520);
    const distance = distance2D(pickup.x, pickup.z, drop.x, drop.z);
    this.fare = { stage: 'pickup', pickup, drop, pay: Math.round(40 + distance * 0.35), timer: 30 + distance / 9, to: districtNameAt(drop.x, drop.z) };
  }

  /** What the job panel shows on taxi duty: the fare's two stages, the pay and the clock. */
  panelInfo() {
    const fare = this.fare;
    if (!fare) return null;
    const pickup = fare.stage === 'pickup';
    return {
      header: `SOL CAB · FARE ${this.faresDone + 1}`, title: 'Taxi duty', stageLine: pickup ? 'STAGE 1/2 · PICK UP' : 'STAGE 2/2 · DROP OFF', share: pickup ? 0.1 : 0.55,
      objective: pickup ? 'Stop at the yellow marker for your fare' : `Drive the fare to ${fare.to}`, next: pickup ? `Drop off in ${fare.to}` : `$${fare.pay} + tip for speed`, timer: pickup ? null : fare.timer, counting: 'down',
    };
  }

  timer() {
    return this.fare && this.fare.stage === 'drop' ? this.fare.timer : null;
  }

  blips() {
    if (!this.fare) return [];
    const spot = this.fare.stage === 'pickup' ? this.fare.pickup : this.fare.drop;
    return [{ x: spot.x, z: spot.z, color: '#ffcc00', label: '', pinned: true }];
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const vehicle = player.vehicle;
    if (game.input.wasPressed('KeyT')) this.toggleTaxi();
    if (vehicle && vehicle.spec.taxi && !this.fare && !game.missions.active) game.hud.hint('Press T to take taxi fares');
    this.updateStunts(dt, vehicle);
    if (!this.fare) return;
    if (!vehicle || !vehicle.spec.taxi) { this.fare = null; game.hud.notify('Taxi duty off.'); return; }
    const fare = this.fare;
    const spot = fare.stage === 'pickup' ? fare.pickup : fare.drop;
    game.markers.show(spot.x, spot.z, '#ffcc00', 3.4, 20);
    const arrived = distance2D(player.position.x, player.position.z, spot.x, spot.z) < 5 && Math.abs(vehicle.speed) < 3;
    if (fare.stage === 'pickup') {
      if (arrived) { fare.stage = 'drop'; game.audio.carDoor(); game.hud.say('FARE', `${fare.to}, and step on it.`, '#ffcc00'); }
      return;
    }
    fare.timer -= dt;
    if (fare.timer <= 0) { game.hud.notify('Too slow. The fare walked.'); this.newFare(); return; }
    if (arrived) {
      const tip = Math.round(fare.timer * 2);
      player.addCash(fare.pay + tip);
      this.faresDone += 1;
      game.stats.faresDone = this.faresDone;
      game.audio.cashRegister();
      game.hud.banner('FARE DELIVERED', `+$${fare.pay} fare · +$${tip} tip`, '#ffcc00');
      game.cred.earn(CRED_AWARDS.fare, 'fare delivered');
      this.newFare();
    }
  }

  /** A long powerslide pays a little stunt money. */
  updateStunts(dt, vehicle) {
    if (vehicle && vehicle.skidding && Math.abs(vehicle.speed) > 12) {
      this.airTime += dt;
    } else {
      if (this.airTime > 1.6) {
        const bonus = Math.round(this.airTime * 40);
        this.game.player.addCash(bonus);
        this.game.hud.notify(`Powerslide ${this.airTime.toFixed(1)}s · +$${bonus}`);
        this.game.cred.earn(Math.round(this.airTime * CRED_AWARDS.powerslide), 'powerslide');
      }
      this.airTime = 0;
    }
  }
}

/** Where the Sun Tokens hide: [block i, block j, offset x, offset z] from the block's north-west kerb. */
const TOKEN_SPOTS = [
  [0, 0, 34, 1.6], [1, 7, 1.6, 34], [3, 3, 20, 20], [3, 4, 48, 50], [5, 1, 66.4, 30], [7, 4, 34, 66.4],
  [9, 8, 1.6, 12], [10, 0, 40, 1.6], [10, 5, 66.4, 60], [6, 8, 30, 66.4], [2, 6, 1.6, 50], [8, 3, 50, 1.6],
];
const TOKEN_REWARD = 500;
