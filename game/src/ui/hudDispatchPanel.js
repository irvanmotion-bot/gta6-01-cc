// The HUD's police dispatch panel: every unit hunting the player with its callsign, kind, tactic and distance,
// and, during a street race, the running order of the field.
import { createElement } from './domBuilder.js';

const MAX_ROWS = 6;

export class HudDispatchPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.clock = 0;
    this.root = createElement('div', 'hud-panel dispatch-panel', parent);
    this.head = createElement('div', 'panel-caption', this.root);
    this.rows = createElement('div', 'dispatch-rows', this.root);
    this.board = createElement('div', 'hud-panel race-board', parent);
    createElement('div', 'panel-caption', this.board, 'RACE BOARD');
    this.boardRows = createElement('div', 'dispatch-rows', this.board);
  }

  /** One line per unit: icon, callsign, kind, tactic, metres away. */
  rosterMarkup(roster) {
    return roster.slice(0, MAX_ROWS).map((unit) => `<div class="unit unit-${unit.role}"><i>${unit.icon}</i><b>${unit.callsign}</b><span>${unit.kind}</span><em>${unit.tactic}</em><u>${Math.round(unit.distance)} m</u></div>`).join('');
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
    // The unit list is rebuilt a few times a second, not every frame.
    this.clock -= dt;
    if (this.clock > 0 || stars === 0) return;
    this.clock = 0.25;
    const roster = game.police.roster();
    cache.text(this.head, `SOLMARA P.D. DISPATCH · ${roster.length} ${roster.length === 1 ? 'UNIT' : 'UNITS'}`);
    cache.html(this.rows, this.rosterMarkup(roster));
  }
}
