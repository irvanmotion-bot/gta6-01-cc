// The wanted level: crimes add heat, heat becomes one to five stars, and the police must keep eyes on Nova to hold
// them. With a unit's line of sight on her she is SPOTTED; behind a building, out of range or in the dark she is only
// HUNTED: the units close on the place she was last seen, a search zone grows round it on the radar, and the stars
// fall away one at a time. What "seen" means changes with the light: eclipse/darknessCover.js shortens police sight.
import { CRED_AWARDS } from '../progression/streetCred.js';
import { responseTierName } from './unitCallsigns.js';

export class WantedLevel {
  constructor(game) {
    this.game = game;
    this.lastKnown = { x: 0, z: 0 };
    this.reset();
  }

  reset() {
    this.heat = 0;
    this.stars = 0;
    this.unseen = 0;
    this.lostFor = 0;
    this.evading = false;
    this.seen = false;
    this.spotters = 0;
    this.sightClock = 0;
    this.lastCrime = {};
    this.locked = 0;
    this.peakStars = 0;
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
    // Somebody called it in: the search starts again from here.
    this.pinDown();
    this.refresh();
  }

  /** Set the stars outright: missions that begin with the police already coming. */
  setStars(stars, lockSeconds = 0) {
    this.heat = STAR_HEAT[stars];
    this.locked = lockSeconds;
    this.pinDown();
    this.refresh();
  }

  /** The police know where she is this moment: the search zone shrinks back onto her. */
  pinDown() {
    const player = this.game.player.position;
    this.lastKnown.x = player.x;
    this.lastKnown.z = player.z;
    this.unseen = 0;
    this.lostFor = 0;
  }

  /** Lose one star at once: Jazz's signal jam, or long enough out of sight. */
  dropStar() {
    if (this.stars === 0) return;
    this.heat = this.stars > 1 ? STAR_HEAT[this.stars - 1] : 0;
    this.locked = 0;
    this.unseen = 0;
    this.refresh();
  }

  /** The search is called off; an escape on the player's own wheels pays cred for every star shaken. */
  clear(earned = true) {
    if (this.stars > 0) {
      this.game.hud.notify('You lost the police.');
      if (earned) {
        this.game.stats.escapes += 1;
        this.game.cred.earn(this.peakStars * CRED_AWARDS.escapePerStar, `escaped ${this.peakStars}★`);
      }
    }
    this.heat = 0;
    this.unseen = 0;
    this.lostFor = 0;
    this.peakStars = 0;
    this.seen = false;
    this.spotters = 0;
    this.refresh();
  }

  refresh() {
    let stars = 0;
    while (stars < 5 && this.heat >= STAR_HEAT[stars + 1]) stars += 1;
    if (stars !== this.stars) {
      if (stars > this.stars) this.game.audio.wantedUp();
      this.stars = stars;
      this.peakStars = Math.max(this.peakStars, stars);
      this.game.stats.maxStars = Math.max(this.game.stats.maxStars, stars);
    }
  }

  /** Seconds out of sight it takes to lose the next star: the more stars, the longer they look. */
  escapeTime() {
    return 5 + this.stars * 1.5;
  }

  /** How far the next star is from falling, 0 to 1: the HUD's "out of sight" bar. */
  escapeProgress() {
    return this.stars === 0 ? 0 : Math.min(1, this.unseen / this.escapeTime());
  }

  /** Metres from the last known position the police are searching: the ring on the radar. */
  searchRadius() {
    return Math.min(SEARCH_ZONE.widest, SEARCH_ZONE.start + this.lostFor * SEARCH_ZONE.growth);
  }

  /** A place inside the search zone for the unit numbered `slot` to check: each one takes its own bearing. */
  searchPoint(slot) {
    const sweep = Math.floor(this.lostFor / 6);
    const bearing = slot * 2.4 + sweep * 1.3;
    const reach = this.searchRadius() * (0.35 + ((slot + sweep) % 3) * 0.25);
    return { x: this.lastKnown.x + Math.sin(bearing) * reach, z: this.lastKnown.z + Math.cos(bearing) * reach };
  }

  /** The name of the response at this level, e.g. TACTICAL LOCKDOWN at four stars. */
  responseTier() {
    return responseTierName(this.stars);
  }

  /**
   * What the police know right now, for the HUD's status line and the radar:
   * 'clear', 'spotted' (a unit has eyes on her), 'responding' (units on their way to a call) or 'searching'.
   */
  sightState() {
    if (this.stars === 0) return 'clear';
    if (this.seen) return this.spotters > 0 ? 'spotted' : 'responding';
    return 'searching';
  }

  /** The status line under the stars: the state in two or three words, and what follows from it. */
  sightReport() {
    const state = this.sightState();
    if (state === 'clear') return { state, label: 'NOT WANTED', detail: '' };
    if (state === 'spotted') return { state, label: 'SPOTTED', detail: `${this.spotters} ${this.spotters === 1 ? 'UNIT HAS' : 'UNITS HAVE'} EYES ON YOU` };
    if (state === 'responding') return { state, label: 'CALLED IN', detail: 'UNITS RESPONDING' };
    const left = Math.max(0, Math.ceil(this.escapeTime() - this.unseen));
    const why = this.game.crew.isJamming() ? 'RADIO JAMMED' : 'OUT OF SIGHT';
    return { state, label: why, detail: `STAR DROPS IN ${left}s · SEARCH ZONE ${Math.round(this.searchRadius())} M` };
  }

  update(dt) {
    if (this.stars === 0) { this.evading = false; this.seen = false; this.spotters = 0; return; }
    this.locked = Math.max(0, this.locked - dt);
    const jammed = this.game.crew.isJamming();
    // In the dark of totality or of the night, a Nova no light is on is seen from a quarter as far and lost twice as fast.
    const cover = this.game.darkness;
    this.sightClock -= dt;
    if (this.sightClock <= 0) {
      this.sightClock = SIGHT_CHECK_SECONDS;
      this.spotters = jammed ? 0 : this.game.police.unitsWithEyesOn(cover.sightRange(SEEN_RANGE));
    }
    this.seen = !jammed && (this.spotters > 0 || this.locked > 0);
    if (this.seen) {
      this.pinDown();
      this.evading = false;
      return;
    }
    const pace = (jammed ? 1.6 : 1) * cover.escapePace();
    this.unseen += dt * pace;
    this.lostFor += dt;
    this.evading = true;
    if (this.unseen < this.escapeTime()) return;
    if (this.stars > 1) {
      this.dropStar();
      this.game.hud.notify(`Out of sight: the search drops to ${this.stars}★.`);
    } else {
      this.clear();
    }
  }
}

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
/** How far a unit sees in daylight, and how often the lines of sight are checked. */
const SEEN_RANGE = 80;
const SIGHT_CHECK_SECONDS = 0.2;
/** The search zone round the last known position: its radius at the start, how fast it grows and where it stops. */
const SEARCH_ZONE = { start: 45, growth: 7, widest: 160 };
