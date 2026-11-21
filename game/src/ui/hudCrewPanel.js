// The HUD's crew panel: Nova's three crew members by name and face, the favor each one grants, the key that calls
// it, and whether it is ready, cooling down, active or still locked behind a rank.
import { createElement } from './domBuilder.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel crew-panel', parent);
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', root);
      const face = createElement('canvas', 'favor-face', row);
      face.width = 48;
      face.height = 48;
      drawSpeakerPortrait(face, favor.portrait, favor.color);
      createElement('b', 'favor-key', row, favor.key);
      const text = createElement('div', 'favor-text', row);
      createElement('span', 'favor-who', text, favor.who);
      createElement('span', 'favor-name', text, favor.name);
      const fill = createElement('i', '', createElement('div', 'favor-track', text));
      return { row, fill, state: createElement('em', 'favor-state', text) };
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
