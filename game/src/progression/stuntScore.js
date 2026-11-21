// Stunt score: the driving that pays on the street. A car flashing past within a door's width at speed is a NEAR
// MISS, a slide held at speed is a DRIFT measured in metres, and each one inside four seconds of the last raises the
// combo. Every stunt pays cash at once and shows as a popup over the road.

/** Centre to centre, closer than this at closing speed is a near miss; closer than SCRAPE is a touch, not a miss. */
const MISS_RANGE = 3.7;
const SCRAPE_RANGE = 2.2;
const MIN_PASS_SPEED = 14;
const MIN_OWN_SPEED = 12;
const COMBO_WINDOW = 4;
const POPUP_SECONDS = 2.6;
const MIN_DRIFT_METRES = 12;

export class StuntScore {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.passes = new Map();
    this.drift = 0;
    this.driftGap = 0;
    this.combo = 0;
    this.comboClock = 0;
    this.popups = [];
    this.best = { nearMisses: 0, drift: 0 };
  }

  /** Pay a stunt: the combo raises the payout, the popup names it. */
  award(title, detail, base) {
    const game = this.game;
    this.combo = this.comboClock > 0 ? this.combo + 1 : 1;
    this.comboClock = COMBO_WINDOW;
    const cash = Math.round(base * this.combo);
    game.player.cash += cash;
    game.stats.stuntCash = (game.stats.stuntCash || 0) + cash;
    this.popups.unshift({ title, detail, cash, combo: this.combo, clock: POPUP_SECONDS });
    this.popups.length = Math.min(this.popups.length, 3);
    game.audio.checkpoint();
  }

  /** Track every car near Nova's: closest approach while closing, judged the moment it starts to pull away. */
  checkNearMisses(car) {
    const game = this.game;
    const seen = new Set();
    for (const other of game.vehicles.list) {
      if (other === car || other.dead) continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 14) continue;
      seen.add(other);
      const relX = other.velX - car.velX;
      const relZ = other.velZ - car.velZ;
      const closing = dx * relX + dz * relZ < 0;
      let pass = this.passes.get(other);
      if (!pass) { pass = { nearest: distance, speed: 0, paid: false }; this.passes.set(other, pass); }
      pass.nearest = Math.min(pass.nearest, distance);
      pass.speed = Math.max(pass.speed, Math.hypot(relX, relZ));
      if (!closing && !pass.paid && pass.nearest < MISS_RANGE) {
        pass.paid = true;
        if (pass.nearest > SCRAPE_RANGE && pass.speed > MIN_PASS_SPEED && Math.abs(car.speed) > MIN_OWN_SPEED) {
          game.stats.nearMisses = (game.stats.nearMisses || 0) + 1;
          this.best.nearMisses += 1;
          const gap = Math.max(0.1, pass.nearest - 1.9);
          const label = other.driver === 'cop' ? 'NEAR MISS · SAROS P.D.' : `NEAR MISS · ${other.spec.name.toUpperCase()}`;
          this.award(label, `${gap.toFixed(1)} M AT ${Math.round(pass.speed * 3.6)} KM/H`, other.driver === 'cop' ? 250 : 150);
        }
      }
    }
    for (const other of this.passes.keys()) if (!seen.has(other)) this.passes.delete(other);
  }

  /** A slide held at speed adds its metres; it is paid when the tyres have gripped again for a moment. */
  checkDrift(car, dt) {
    if (car.skidding && Math.abs(car.speed) > 8) {
      this.drift += Math.hypot(car.velX, car.velZ) * dt;
      this.driftGap = 0;
      return;
    }
    if (this.drift === 0) return;
    this.driftGap += dt;
    if (this.driftGap < 0.4) return;
    const metres = Math.round(this.drift);
    this.drift = 0;
    if (metres < MIN_DRIFT_METRES) return;
    this.best.drift = Math.max(this.best.drift, metres);
    this.award('DRIFT', `${metres} M SLIDE`, metres * 4);
  }

  /** The popups the HUD shows over the road, newest first, while their time lasts. */
  visiblePopups() {
    return this.popups;
  }

  update(dt) {
    this.comboClock = Math.max(0, this.comboClock - dt);
    for (const popup of this.popups) popup.clock -= dt;
    this.popups = this.popups.filter((popup) => popup.clock > 0);
    const car = this.game.player.vehicle;
    if (!car || car.dead) { this.passes.clear(); this.drift = 0; return; }
    this.checkNearMisses(car);
    this.checkDrift(car, dt);
  }
}
