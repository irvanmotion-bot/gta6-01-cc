// The HUD's police dispatch panel: the force by name with a big count of the units hunting the player and the tier
// of the response, then the nearest units one per row: what kind of unit it is, its callsign, the tactic it is
// running right now and its distance. During a street race the same place shows the running order of the field.
import { POLICE_FORCE } from '../police/unitCallsigns.js';
import { createElement } from './domBuilder.js';

/**
 * What the panel shows for a roster: the total of units (a blockade counts each of its cars, a foot squad each
 * officer), the nearest rows, and how many units the rows leave out. total = units in `shown` + `more`, always.
 */
export function dispatchSummary(roster, maxRows = MAX_ROWS) {
  const total = roster.reduce((sum, row) => sum + row.units, 0);
  const shown = roster.slice(0, maxRows);
  const listed = shown.reduce((sum, row) => sum + row.units, 0);
  return { total, shown, more: total - listed };
}

export class HudDispatchPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.clock = 0;
    this.root = createElement('div', 'hud-panel dispatch-panel', parent);
    const head = createElement('div', 'dispatch-head', this.root);
    this.count = createElement('b', 'dispatch-count', head);
    const names = createElement('div', 'dispatch-names', head);
    this.label = createElement('div', 'dispatch-label', names);
    this.tier = createElement('div', 'dispatch-tier', names);
    this.rows = createElement('div', 'dispatch-rows', this.root);
    this.board = createElement('div', 'hud-panel race-board', parent);
    createElement('div', 'panel-caption', this.board, 'RACE BOARD');
    this.boardRows = createElement('div', 'dispatch-rows', this.board);
  }

  /** One line per unit: kind, callsign, tactic, metres away; then one line counting the units not listed. */
  rosterMarkup(summary) {
    const rows = summary.shown.map((unit) => `<div class="unit unit-${unit.role}"><i>${unit.tag}</i><b>${unit.callsign}</b><em>${unit.tactic}</em><u>${Math.round(unit.distance)} M</u></div>`);
    if (summary.more > 0) rows.push(`<div class="unit unit-more"><i>+</i><b>${summary.more} MORE</b><em>CLOSING IN</em><u></u></div>`);
    return rows.join('');
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const stars = game.wanted.stars;
    cache.toggle(this.root, 'visible', stars > 0);
    const racing = Boolean(game.races.active);
    cache.toggle(this.board, 'visible', racing);
    if (racing) {
      cache.html(this.boardRows, game.races.raceOrder().map((row, index) => `<div class="racer${row.player ? ' me' : ''}"><i>${index + 1}</i><b>${row.name}</b></div>`).join(''));
    }
    // Not wanted: the panel is hidden, and the next time it shows it must count afresh in that same frame, never
    // show what it counted during the last chase.
    if (stars === 0) { this.clock = 0; return; }
    // The unit list is rebuilt a few times a second, not every frame.
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0.25;
    const summary = dispatchSummary(game.police.roster(), game.hud.essentials ? ESSENTIAL_ROWS : MAX_ROWS);
    cache.text(this.count, String(summary.total));
    // Wanted with nobody on the road yet: say the units are on their way instead of a bare zero.
    cache.toggle(this.root, 'en-route', summary.total === 0);
    cache.text(this.label, summary.total === 0 ? `${POLICE_FORCE} · UNITS EN ROUTE` : `${POLICE_FORCE} · ${summary.total} ${summary.total === 1 ? 'UNIT' : 'UNITS'}`);
    cache.text(this.tier, game.wanted.responseTier());
    cache.html(this.rows, this.rosterMarkup(summary));
  }
}

/** Six rows name the pack round the player; the rest of the response is counted in the line under them. */
const MAX_ROWS = 6;
/** The extra-large HUD keeps to the two nearest. */
const ESSENTIAL_ROWS = 2;
