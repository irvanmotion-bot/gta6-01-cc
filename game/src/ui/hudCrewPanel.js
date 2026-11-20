// The HUD's crew panel: Nova's three crew members, one row each. A row gives the member's face, name and role in the
// crew, the favor they grant, the key that calls it, and whether it is READY, ACTIVE, cooling down (seconds left) or
// still locked behind a rank.
import { createElement } from './domBuilder.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel crew-panel', parent);
    this.caption = createElement('div', 'panel-caption', root, 'CREW');
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', root);
      const face = createElement('canvas', 'favor-face', row);
      face.width = 48;
      face.height = 48;
      drawSpeakerPortrait(face, favor.portrait, favor.color);
      const text = createElement('div', 'favor-text', row);
      const who = createElement('div', 'favor-who', text);
      createElement('b', '', who, favor.who);
      createElement('span', 'favor-role', who, favor.role);
      const does = createElement('div', 'favor-does', text);
      createElement('b', 'favor-key', does, favor.key);
      createElement('span', 'favor-name', does, favor.name);
      return { row, state: createElement('em', 'favor-state', does) };
    });
  }

  update() {
    const cache = this.cache;
    const favors = this.game.crew.status();
    cache.text(this.caption, `CREW · ${favors.filter((favor) => favor.ready).length} OF ${favors.length} FAVORS READY`);
    favors.forEach((favor, index) => {
      const node = this.rows[index];
      cache.text(node.state, favor.locked ? `RANK ${favor.rank}` : favor.active ? 'ACTIVE' : favor.ready ? 'READY' : `${favor.wait}s`);
      cache.toggle(node.row, 'locked', favor.locked);
      cache.toggle(node.row, 'ready', favor.ready);
      cache.toggle(node.row, 'waiting', !favor.locked && !favor.ready && !favor.active);
    });
  }
}
