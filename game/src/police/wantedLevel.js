// The wanted level: crimes add heat and heat becomes one to five stars. While any unit has eyes on Nova she is
// SPOTTED. Once every unit has lost her behind the buildings the force is SEARCHING: it works a zone round the
// place she was last seen, the zone grows, and the stars come off one at a time for as long as she stays unseen.
// What "seen" means changes with the light: eclipse/darknessCover.js shortens police sight when the sun is gone.
import { CRED_AWARDS } from '../progression/streetCred.js';
import { distance2D } from '../core/random.js';
import { responseTierName } from './unitCallsigns.js';

export class WantedLevel {
  constructor(game) {
    this.game = game;
    this.lastSeen = { x: 0, z: 0 };
    this.reset();
  }

  reset() {
    this.heat = 0;
    this.stars = 0;
    this.unseen = 0;
    this.sinceSeen = 0;
    this.evading = false;
    this.sighted = false;
    this.eyes = 0;
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
    this.markSeen();
    this.refresh();
  }

  /** The force knows where Nova is this instant: a crime called in, or a unit with eyes on her. */
  markSeen() {
    const player = this.game.player.position;
    this.lastSeen.x = player.x;
    this.lastSeen.z = player.z;
    this.unseen = 0;
    this.sinceSeen = 0;
  }

  /** Set the stars outright: missions that begin with the police already coming. */
  setStars(stars, lockSeconds = 0) {
    this.heat = STAR_HEAT[stars];
    this.locked = lockSeconds;
    this.markSeen();
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

  /** Seconds out of sight it takes to shake the next star off. */
  escapeTime() {
    return STAR_OFF.base + this.stars * STAR_OFF.perStar;
  }

  /** How far the next star is from coming off, 0 to 1: the HUD's bar while the force is searching. */
  escapeProgress() {
    return this.stars === 0 ? 0 : Math.min(1, this.unseen / this.escapeTime());
  }

  /** The radius in metres of the zone the force is searching round the place Nova was last seen. */
  searchRadius() {
    return Math.min(SEARCH_ZONE.widest, SEARCH_ZONE.first + this.sinceSeen * SEARCH_ZONE.growth);
  }

  /** The zone as the radar draws it, or null while she is in sight or not wanted. */
  searchZone() {
    if (this.stars === 0 || this.sighted) return null;
    return { x: this.lastSeen.x, z: this.lastSeen.z, radius: this.searchRadius() };
  }

  /** The name of the response at this level, e.g. TACTICAL LOCKDOWN at four stars. */
  responseTier() {
    return responseTierName(this.stars);
  }

  /** What the HUD's status panel says: CLEAR, SPOTTED, SEARCHING or JAMMED, and one line of detail under it. */
  status() {
    if (this.stars === 0) return { state: 'CLEAR', line: 'NO POLICE HEAT' };
    const jam = this.game.crew.jamTime;
    if (jam > 0) return { state: 'JAMMED', line: `POLICE RADIO DOWN ${Math.ceil(jam)} S` };
    if (this.sighted) {
      if (this.eyes === 0) return { state: 'SPOTTED', line: 'ALL UNITS HAVE YOUR DESCRIPTION' };
      return { state: 'SPOTTED', line: `${this.eyes} ${this.eyes === 1 ? 'UNIT HAS' : 'UNITS HAVE'} EYES ON YOU` };
    }
    const left = Math.max(1, Math.ceil((this.escapeTime() - this.unseen) / this.pace()));
    return { state: 'SEARCHING', line: `ZONE ${Math.round(this.searchRadius())} M · STAR OFF IN ${left} S` };
  }

  /** How fast the unseen clock runs: faster jammed, in the dark, and outside the zone being searched. */
  pace() {
    const game = this.game;
    const player = game.player.position;
    const outside = distance2D(player.x, player.z, this.lastSeen.x, this.lastSeen.z) > this.searchRadius();
    return (game.crew.isJamming() ? 1.6 : 1) * game.darkness.escapePace() * (outside ? OUTSIDE_ZONE_PACE : 1);
  }

  /** One star comes off; the last one calls the search off. */
  loseStar() {
    if (this.stars <= 1) { this.clear(); return; }
    this.heat = STAR_HEAT[this.stars - 1];
    this.unseen = 0;
    this.refresh();
    this.game.hud.notify(`Saros P.D. is losing you: down to ${this.stars}★`);
  }

  update(dt) {
    if (this.stars === 0) { this.evading = false; this.sighted = false; this.eyes = 0; return; }
    this.locked = Math.max(0, this.locked - dt);
    const game = this.game;
    const jammed = game.crew.isJamming();
    // In the dark of totality or of the night, a Nova no light is on is seen from a quarter as far.
    this.eyes = jammed ? 0 : game.police.unitsSeeing(game.darkness.sightRange(SEEN_RANGE));
    this.sighted = !jammed && (this.eyes > 0 || this.locked > 0);
    this.evading = !this.sighted;
    if (this.sighted) { this.markSeen(); return; }
    this.sinceSeen += dt;
    this.unseen += dt * this.pace();
    if (this.unseen >= this.escapeTime()) this.loseStar();
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
/** How far a unit sees Nova in daylight, with nothing solid in between. */
const SEEN_RANGE = 80;
/** Seconds unseen before a star comes off: more at a higher level. */
const STAR_OFF = { base: 5, perStar: 1.5 };
/** The search zone: its first radius in metres, how fast it grows each second and how wide it gets. */
const SEARCH_ZONE = { first: 45, growth: 5, widest: 150 };
const OUTSIDE_ZONE_PACE = 1.6;
