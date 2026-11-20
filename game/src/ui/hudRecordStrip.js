// The HUD's record strip, along the foot of the screen between the radar and the car's dial: the save slot being
// played and how much of its week is done as one percentage, then each activity as done-of-total: story jobs, street
// races won, bounties claimed, Corona Tokens found and taxi fares driven. It is the completion tracker's own count,
// refreshed twice a second.
import { completionPercent, completionRows } from '../progression/completionTracker.js';
import { createElement } from './domBuilder.js';

/** The strip's one-word names for the completion tracker's rows; a row not named here is left to the atlas. */
const STRIP_LABELS = { 'Story jobs': 'JOBS', 'Street races won': 'RACES', 'Vane bounties': 'BOUNTIES', 'Corona Tokens': 'TOKENS', 'Taxi fares': 'TAXI' };

export class HudRecordStrip {
  constructor(game, root, cache) {
    this.game = game;
    this.cache = cache;
    this.clock = 0;
    this.root = createElement('div', 'record-strip', root);
  }

  /** The strip as markup: the percentage, then a label and a count for each activity. */
  markup() {
    const game = this.game;
    const cells = completionRows(game).filter((row) => STRIP_LABELS[row.label]).map((row) => `<span>${STRIP_LABELS[row.label]} <b>${row.done}/${row.total}</b></span>`);
    return `<span class="record-percent">SAVE SLOT ${game.saveSlot} · <b>${completionPercent(game)}%</b></span>${cells.join('')}`;
  }

  update(dt) {
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0.5;
    this.cache.html(this.root, this.markup());
  }
}
