// The HUD's crew panel: the three crew favors with their key, who grants them, and whether each is ready,
// cooling down, active or still locked behind a rank.
import { createElement } from './domBuilder.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel crew-panel', parent);
    createElement('div', 'panel-caption', root, 'CREW FAVORS');
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', root);
      const key = createElement('b', 'favor-key', row, favor.key);
      key.style.background = favor.color;
      const text = createElement('div', 'favor-text', row);
      createElement('span', 'favor-name', text, favor.name);
      createElement('small', 'favor-who', text, favor.who);
      const fill = createElement('i', '', createElement('div', 'favor-track', text));
      fill.style.background = favor.color;
      return { row, fill, state: createElement('em', 'favor-state', row) };
    });
  }

  update() {
    const cache = this.cache;
    this.game.crew.status().forEach((favor, index) => {
      const node = this.rows[index];
      cache.text(node.state, favor.locked ? `RANK ${favor.rank}` : favor.active ? 'ACTIVE' : favor.ready ? 'READY' : `${favor.wait}s`);
      cache.toggle(node.row, 'locked', favor.locked);
      cache.toggle(node.row, 'ready', favor.ready);
      cache.width(node.fill, favor.share);
    });
  }
}
