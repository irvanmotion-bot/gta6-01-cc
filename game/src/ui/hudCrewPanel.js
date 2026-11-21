// The HUD's crew strip along the foot of the screen: how many of the three favors are ready, then each crew member
// by face, name and role, the favor they grant with the key that calls it, and whether it is ready, cooling down
// (seconds left), active or still locked behind a rank.
import { createElement } from './domBuilder.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

export class HudCrewPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel crew-panel', parent);
    this.caption = createElement('div', 'crew-caption', root);
    const rows = createElement('div', 'crew-rows', root);
    this.rows = game.crew.status().map((favor) => {
      const row = createElement('div', 'favor', rows);
      const face = createElement('canvas', 'favor-face', row);
      face.width = 48;
      face.height = 48;
      drawSpeakerPortrait(face, favor.portrait, favor.color);
      const text = createElement('div', 'favor-text', row);
      const who = createElement('div', 'favor-who', text);
      createElement('b', '', who, favor.who);
      createElement('span', 'favor-role', who, favor.role);
      const power = createElement('div', 'favor-power', text);
      createElement('b', 'favor-key', power, favor.key);
      createElement('span', 'favor-name', power, favor.name);
      return { row, state: createElement('em', 'favor-state', row) };
    });
  }

  update() {
    const cache = this.cache;
    const favors = this.game.crew.status();
    const ready = favors.filter((favor) => favor.ready).length;
    cache.text(this.caption, `CREW · ${ready} OF ${favors.length} FAVORS READY`);
    favors.forEach((favor, index) => {
      const node = this.rows[index];
      cache.text(node.state, favor.locked ? `RANK ${favor.rank}` : favor.active ? 'ACTIVE' : favor.ready ? 'READY' : `${favor.wait}s`);
      cache.toggle(node.row, 'locked', favor.locked);
      cache.toggle(node.row, 'ready', favor.ready || favor.active);
    });
  }
}
