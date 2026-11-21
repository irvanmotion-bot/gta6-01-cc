// The wanted level: crimes add heat, heat becomes one to five stars, and staying unseen long enough clears them.
// What "unseen" means changes with the light: eclipse/darknessCover.js shortens police sight when the sun is gone.
import { CRED_AWARDS } from '../progression/streetCred.js';
import { responseTierName } from './unitCallsigns.js';

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
    this.peakStars = 0;
    this.seenBy = 0;
    this.lastSeen = null;
    this.searchRadius = SEARCH_RADIUS;
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
    // A fresh crime gives her away: the search starts again from where she is.
    this.lastSeen = null;
    this.refresh();
  }

  /** Set the stars outright: missions that begin with the police already coming. */
  setStars(stars, lockSeconds = 0) {
    this.heat = STAR_HEAT[stars];
    this.unseen = 0;
    this.locked = lockSeconds;
    this.refresh();
  }

  /** Lose one star at once: Jazz's signal jam. */
  dropStar() {
    if (this.stars === 0) return;
    this.heat = this.stars > 1 ? STAR_HEAT[this.stars - 1] : 0;
    this.locked = 0;
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
    this.peakStars = 0;
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

  /** Seconds out of sight it takes to lose the current level. */
  escapeTime() {
    return 9 + this.stars * 5;
  }

  /** How far the escape has come, 0 to 1: the HUD's "evading" bar. */
  escapeProgress() {
    return this.stars === 0 ? 0 : Math.min(1, this.unseen / this.escapeTime());
  }

  /** The name of the response at this level, e.g. TACTICAL LOCKDOWN at four stars. */
  responseTier() {
    return responseTierName(this.stars);
  }

  /**
   * What the HUD says about the hunt: SPOTTED with the count of units that can see her, or SEARCHING with the
   * zone they are combing, or nothing when nobody is looking.
   */
  sightState() {
    if (this.stars === 0) return null;
    if (this.evading) return { label: 'SEARCHING', line: `ZONE ${Math.round(this.searchRadius)} M · LOST YOU ${Math.floor(this.unseen)}s AGO` };
    const eyes = this.seenBy;
    return { label: 'SPOTTED', line: eyes > 0 ? `${eyes} ${eyes === 1 ? 'UNIT HAS' : 'UNITS HAVE'} EYES ON YOU` : 'LAST SEEN SECONDS AGO' };
  }

  /** Where the police last saw her, and how wide the circle they search has grown: the minimap draws it. */
  searchZone() {
    return this.stars > 0 && this.evading && this.lastSeen ? { x: this.lastSeen.x, z: this.lastSeen.z, radius: this.searchRadius } : null;
  }

  update(dt) {
    if (this.stars === 0) { this.evading = false; this.seenBy = 0; this.lastSeen = null; return; }
    this.locked = Math.max(0, this.locked - dt);
    const jammed = this.game.crew.isJamming();
    const player = this.game.player.position;
    // In the dark of totality or of the night, a Nova no light is on is seen from a quarter as far and lost twice as fast.
    // A unit with a building between it and her does not see her at all.
    const cover = this.game.darkness;
    this.seenBy = jammed ? 0 : this.game.police.unitsWithEyesOn(cover.sightRange(SEEN_RANGE));
    const seen = !jammed && (this.seenBy > 0 || this.locked > 0);
    if (seen || !this.lastSeen) {
      this.lastSeen = { x: player.x, z: player.z };
      this.searchRadius = SEARCH_RADIUS;
    } else {
      // The search circle widens the longer she stays hidden; once she is outside it the trail goes cold twice as fast.
      this.searchRadius += dt * 2.5;
    }
    const outside = Math.hypot(player.x - this.lastSeen.x, player.z - this.lastSeen.z) > this.searchRadius;
    this.unseen = seen ? 0 : this.unseen + dt * (jammed ? 1.6 : 1) * (outside ? 2 : 1) * cover.escapePace();
    this.evading = this.unseen > 3;
    if (this.unseen > this.escapeTime()) this.clear();
  }
}

const SEARCH_RADIUS = 45;

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
