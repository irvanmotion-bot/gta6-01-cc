// The HUD's crew bar, along the foot of the screen between the radar and the car's dial: Nova's three crew members,
// a cell each. A cell gives the key that calls the member's favor, their name and role in the crew, the favor itself
// and whether it is READY, ACTIVE, cooling down (seconds left, with a bar that fills) or still locked behind a rank.
import { createElement } from './domBuilder.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'crew-panel', parent);
    this.caption = createElement('div', 'crew-caption', root, 'CREW');
    const cells = createElement('div', 'crew-cells', root);
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', cells);
      const who = createElement('div', 'favor-who', row);
      createElement('b', 'favor-key', who, favor.key);
      createElement('b', 'favor-member', who, favor.who);
      createElement('span', 'favor-role', who, favor.role);
      const does = createElement('div', 'favor-does', row);
      createElement('span', 'favor-name', does, favor.name);
      const state = createElement('em', 'favor-state', does);
      const fill = createElement('u', '', createElement('i', 'favor-track', row));
      return { row, state, fill };
    });
  }

  update() {
    const cache = this.cache;
    const favors = this.game.crew.status();
    cache.text(this.caption, `CREW · ${favors.filter((favor) => favor.ready).length} OF ${favors.length} FAVORS READY`);
    favors.forEach((favor, index) => {
      const node = this.rows[index];
      cache.text(node.state, favor.locked ? `RANK ${favor.rank}` : favor.active ? 'ACTIVE' : favor.ready ? 'READY' : `${favor.wait}s`);
      cache.width(node.fill, favor.share);
      cache.toggle(node.row, 'locked', favor.locked);
      cache.toggle(node.row, 'ready', favor.ready);
      cache.toggle(node.row, 'waiting', !favor.locked && !favor.ready && !favor.active);
    });
  }
}
