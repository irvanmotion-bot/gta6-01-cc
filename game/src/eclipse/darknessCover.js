// The rules of the dark: when the moon's shadow (or the night) falls on Saros, Nova can only be seen where there
// is light on her: under a street lamp, behind her own headlights, by her own muzzle flash or in the helicopter's
// searchlight. Out of the light the police see a quarter as far and give up the search twice as fast.
import { distance2D } from '../core/random.js';

/** How dark the street must be before the dark hides anybody, 0 to 1. */
const HIDING_DEPTH = 0.55;
/** Metres from a lamp head inside which its pool of light shows Nova up. */
const LAMP_REACH = 6.5;
const SIGHT_SHARE_HIDDEN = 0.25;
const ESCAPE_PACE_HIDDEN = 2.2;
const MUZZLE_FLASH_SECONDS = 2.5;
const SEARCHLIGHT_SECONDS = 2;

export class DarknessCover {
  constructor(game) {
    this.game = game;
    this.headlightsOn = true;
    this.litBy = '';
    this.muzzleFlash = 0;
    this.searchlight = 0;
    this.lampClock = 0;
    this.underLamp = false;
  }

  /** How dark the streets are right now, 0 to 1: full inside totality, most of the way at night. */
  depth() {
    const game = this.game;
    return Math.max(game.calendar.darkness(), game.sky.night * 0.8);
  }

  isDark() {
    return this.depth() >= HIDING_DEPTH;
  }

  /** True while it is dark and no light is on Nova: nobody can see her from a distance. */
  isHidden() {
    return this.isDark() && this.litBy === '';
  }

  /** L in a car: run dark, or switch the headlights back on. */
  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn;
    const hud = this.game.hud;
    if (this.headlightsOn) hud.notify('Headlights on.');
    else hud.notify(this.isDark() ? 'Headlights off: you are running dark.' : 'Headlights off.');
    this.game.audio.click();
  }

  /** A shot lights up the shooter for a moment. */
  noteGunfire() {
    this.muzzleFlash = MUZZLE_FLASH_SECONDS;
  }

  /** The helicopter's beam has found her. */
  noteSearchlight() {
    this.searchlight = SEARCHLIGHT_SECONDS;
  }

  /** How far a police unit sees Nova, given how far it sees in daylight. */
  sightRange(daylightRange) {
    return this.isHidden() ? daylightRange * SIGHT_SHARE_HIDDEN : daylightRange;
  }

  /** How fast the unseen clock of the wanted level runs: faster for someone the dark is hiding. */
  escapePace() {
    return this.isHidden() ? ESCAPE_PACE_HIDDEN : 1;
  }

  /** Whether a street lamp's pool of light reaches (x, z). */
  lampLightAt(x, z) {
    for (const lamp of this.game.props.lampSpots) {
      if (Math.abs(lamp.x - x) < LAMP_REACH && distance2D(lamp.x, lamp.z, x, z) < LAMP_REACH) return true;
    }
    return false;
  }

  update(dt) {
    const player = this.game.player;
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    this.searchlight = Math.max(0, this.searchlight - dt);
    this.lampClock -= dt;
    if (this.lampClock <= 0) {
      this.lampClock = 0.15;
      this.underLamp = this.isDark() && this.lampLightAt(player.position.x, player.position.z);
    }
    if (this.searchlight > 0) this.litBy = 'SEARCHLIGHT';
    else if (this.muzzleFlash > 0) this.litBy = 'MUZZLE FLASH';
    else if (player.vehicle && this.headlightsOn) this.litBy = 'HEADLIGHTS';
    else if (this.underLamp) this.litBy = 'STREET LAMP';
    else this.litBy = '';
  }

  /** What the HUD's eclipse panel says about it: null in daylight, else whether Nova is hidden and why not. */
  readout() {
    if (!this.isDark()) return null;
    if (this.isHidden()) return { hidden: true, text: 'UNSEEN IN THE DARK' };
    return { hidden: false, text: this.litBy === 'HEADLIGHTS' ? 'LIT · HEADLIGHTS (L)' : `LIT · ${this.litBy}` };
  }
}
