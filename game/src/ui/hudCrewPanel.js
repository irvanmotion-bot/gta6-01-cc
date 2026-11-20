// The HUD's crew bar along the foot of the screen: how many of the three favors can be called, then one cell per
// crew member: the key that calls them, their name, their role in the crew with READY or the seconds still to wait,
// and the favor they grant.
import { createElement } from './domBuilder.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel crew-bar', parent);
    this.head = createElement('div', 'crew-head', root);
    const cells = createElement('div', 'crew-cells', root);
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', cells);
      const who = createElement('div', 'favor-who', row);
      createElement('b', 'favor-key', who, favor.key);
      createElement('span', '', who, favor.who);
      const duty = createElement('div', 'favor-duty', row);
      createElement('span', 'favor-role', duty, favor.role);
      const state = createElement('em', 'favor-state', duty);
      createElement('div', 'favor-name', row, favor.name);
      return { row, state };
    });
  }

  update() {
    const cache = this.cache;
    const favors = this.game.crew.status();
    cache.text(this.head, `CREW · ${favors.filter((favor) => favor.ready).length} OF ${favors.length} FAVORS READY`);
    favors.forEach((favor, index) => {
      const node = this.rows[index];
      cache.text(node.state, favor.locked ? `RANK ${favor.rank}` : favor.active ? 'ACTIVE' : favor.ready ? 'READY' : `${favor.wait} S`);
      cache.toggle(node.row, 'locked', favor.locked);
      cache.toggle(node.row, 'ready', favor.ready);
    });
  }
}
