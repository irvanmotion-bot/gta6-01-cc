// Driving stunts: what Nova earns for driving like the getaway ace she is. A NEAR MISS is a car passed at speed
// with less than a metre between the doors, a POWERSLIDE is metres slid with the tail out, FLAT OUT is the car held
// at its top speed. Each pays cash and cred; stunts chained within a few seconds build a combo that multiplies the
// next one, and the HUD pops each one up in the middle of the screen with its pay and the combo's clock.

export class DrivingStunts {
  constructor(game) {
    this.game = game;
    /** For every car near hers: whether it was ahead of her on the last step. */
    this.ahead = new WeakMap();
    this.reset();
  }

  reset() {
    this.combo = 0;
    this.comboClock = 0;
    this.slideMetres = 0;
    this.flatOutClock = 0;
    this.flatOutPaid = false;
    this.latest = null;
    this.latestAge = 0;
  }

  /** Pay a stunt: its cash and cred times the combo, the combo one higher and its clock wound up again. */
  award(name, detail, cash, cred) {
    const game = this.game;
    this.combo = this.comboClock > 0 ? Math.min(COMBO.most, this.combo + 1) : 1;
    this.comboClock = COMBO.seconds;
    const pay = Math.round(cash * this.combo);
    const points = Math.round(cred * this.combo);
    game.player.addCash(pay);
    game.cred.earn(points, name.toLowerCase(), true);
    const stats = game.stats;
    stats.stunts += 1;
    stats.stuntCash += pay;
    stats.bestCombo = Math.max(stats.bestCombo, this.combo);
    if (name === STUNTS.nearMiss.name) stats.nearMisses += 1;
    this.latest = { name, detail, combo: this.combo, cash: pay, cred: points };
    this.latestAge = 0;
    game.audio.checkpoint();
  }

  /**
   * What the HUD pops up: the stunt's name with the combo it was paid at, what it measured and paid, and how much
   * of the combo's clock is left (0 to 1); null once the pop-up has had its time.
   */
  popup() {
    const stunt = this.latest;
    if (!stunt || this.latestAge > POPUP_SECONDS) return null;
    return {
      title: stunt.combo > 1 ? `${stunt.name} ×${stunt.combo}` : stunt.name,
      line: `${stunt.detail} · +$${stunt.cash} · +${stunt.cred} CRED`,
      combo: stunt.combo, share: this.comboClock / COMBO.seconds,
    };
  }

  /** Every car she goes past this step with her door almost on its door, at speed, is a near miss. */
  watchNearMisses(car, speed) {
    const rule = STUNTS.nearMiss;
    const fx = car.forwardX();
    const fz = car.forwardZ();
    for (const other of this.game.vehicles.list) {
      if (other === car || other.dead) continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 18) { this.ahead.delete(other); continue; }
      const isAhead = dx * fx + dz * fz > 0;
      const wasAhead = this.ahead.get(other);
      this.ahead.set(other, isAhead);
      if (wasAhead !== true || isAhead || speed < rule.speed) continue;
      // The gap between the two bodies, side to side, and how fast she came by it.
      const gap = Math.abs(dx * fz - dz * fx) - (car.spec.width + other.spec.width) / 2;
      const closing = speed - (other.velX * fx + other.velZ * fz);
      if (gap > rule.scrape && gap < rule.gap && closing > rule.closing) this.award(rule.name, `${gap.toFixed(1)} M GAP`, rule.cash, rule.cred);
    }
  }

  update(dt) {
    this.latestAge += dt;
    this.comboClock = Math.max(0, this.comboClock - dt);
    if (this.comboClock === 0) this.combo = 0;
    const car = this.game.player.vehicle;
    if (!car || car.dead) { this.slideMetres = 0; this.flatOutClock = 0; return; }
    const speed = Math.abs(car.speed);
    this.watchNearMisses(car, speed);

    // A powerslide is measured in metres and paid when the tail comes back in line.
    const slide = STUNTS.powerslide;
    if (car.skidding && speed > slide.speed) this.slideMetres += speed * dt;
    else {
      if (this.slideMetres >= slide.least) this.award(slide.name, `${Math.round(this.slideMetres)} M`, this.slideMetres * slide.cashPerMetre, this.slideMetres * slide.credPerMetre);
      this.slideMetres = 0;
    }

    // Flat out pays once for each run at top speed: she must lift before it can pay again.
    const flat = STUNTS.flatOut;
    const top = car.spec.maxSpeed * this.game.workshop.tuning.speed;
    if (speed >= top * flat.share) {
      this.flatOutClock += dt;
      if (this.flatOutClock >= flat.seconds && !this.flatOutPaid) {
        this.flatOutPaid = true;
        this.award(flat.name, `${Math.round(speed * 3.6)} KM/H`, flat.cash, flat.cred);
      }
    } else if (speed < top * flat.lift) {
      this.flatOutClock = 0;
      this.flatOutPaid = false;
    }
  }
}

/**
 * The stunts and what they pay before the combo multiplies it. A near miss: at least `speed` m/s, less than `gap`
 * metres between the bodies (under `scrape` is a hit, not a miss), closing at `closing` m/s or more.
 */
export const STUNTS = {
  nearMiss: { name: 'NEAR MISS', speed: 16, gap: 1.1, scrape: 0.12, closing: 6, cash: 25, cred: 4 },
  powerslide: { name: 'POWERSLIDE', speed: 12, least: 20, cashPerMetre: 2, credPerMetre: 0.15 },
  flatOut: { name: 'FLAT OUT', share: 0.93, lift: 0.7, seconds: 3, cash: 30, cred: 5 },
};
/** A stunt within `seconds` of the last one is paid one multiple higher, up to `most`. */
const COMBO = { seconds: 4, most: 5 };
/** How long a stunt's pop-up stays on the HUD. */
const POPUP_SECONDS = 2.8;
