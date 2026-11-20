// The wanted level: crimes add heat, heat becomes one to five stars, and staying unseen long enough clears them.

/** Heat each crime adds; `floor` forces at least that many stars at once. */
const CRIMES = {
  gunfire: { heat: 1.6, throttle: 0.4 },
  assault: { heat: 6 },
  stealParked: { heat: 2.5 },
  carjack: { heat: 9 },
  hitAndRun: { heat: 4, throttle: 1 },
  killCivilian: { heat: 15 },
  stealPolice: { heat: 30, floor: 2 },
  ramPolice: { heat: 9, throttle: 1.5, floor: 1 },
  shootPolice: { heat: 12, throttle: 0.5, floor: 2 },
  killPolice: { heat: 36, floor: 3 },
  explosion: { heat: 26, floor: 2 },
  heist: { heat: 200, floor: 4 },
};
const STAR_HEAT = [0, 8, 28, 62, 112, 185];
const SEEN_RANGE = 80;

export class WantedLevel {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.heat = 0;
    this.stars = 0;
    this.unseen = 0;
    this.evading = false;
    this.lastCrime = {};
    this.locked = 0;
  }

  reportCrime(type) {
    const crime = CRIMES[type];
    const now = this.game.time;
    if (crime.throttle && now - (this.lastCrime[type] || -99) < crime.throttle) return;
    this.lastCrime[type] = now;
    // A quiet crime with no officer near only counts once someone is already looking for you.
    if ((type === 'gunfire' || type === 'stealParked' || type === 'hitAndRun') && this.stars === 0 && !this.game.police.anyUnitWithin(60) && Math.random() < 0.6) return;
    this.heat = Math.min(this.heat + crime.heat, STAR_HEAT[5] + 40);
    if (crime.floor) this.heat = Math.max(this.heat, STAR_HEAT[crime.floor]);
    this.unseen = 0;
    this.refresh();
  }

  /** Set the stars outright: missions that begin with the police already coming. */
  setStars(stars, lockSeconds = 0) {
    this.heat = STAR_HEAT[stars];
    this.unseen = 0;
    this.locked = lockSeconds;
    this.refresh();
  }

  clear() {
    if (this.stars > 0) this.game.hud.notify('You lost the police.');
    this.heat = 0;
    this.unseen = 0;
    this.refresh();
  }

  refresh() {
    let stars = 0;
    while (stars < 5 && this.heat >= STAR_HEAT[stars + 1]) stars += 1;
    if (stars !== this.stars) {
      if (stars > this.stars) this.game.audio.wantedUp();
      this.stars = stars;
      this.game.stats.maxStars = Math.max(this.game.stats.maxStars, stars);
    }
  }

  /** Seconds out of sight it takes to lose the current level. */
  escapeTime() {
    return 9 + this.stars * 5;
  }

  update(dt) {
    if (this.stars === 0) { this.evading = false; return; }
    this.locked = Math.max(0, this.locked - dt);
    const seen = this.game.police.anyUnitWithin(SEEN_RANGE) || this.locked > 0;
    this.unseen = seen ? 0 : this.unseen + dt;
    this.evading = this.unseen > 3;
    if (this.unseen > this.escapeTime()) this.clear();
  }
}
