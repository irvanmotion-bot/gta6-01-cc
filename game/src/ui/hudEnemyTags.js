// Tags over the heads of the people shooting at Nova: a health bar over every hostile gunman in sight, and over a
// bounty's capo his name and his price as well, so the target of a hit is found in a crowd at a glance.
import * as THREE from 'three';
import { VANE_CAPOS } from '../activities/vaneBounties.js';
import { createElement } from './domBuilder.js';

const RANGE = 48;
const MAX_TAGS = 8;
const HEAD_HEIGHT = 2.15;

export class HudEnemyTags {
  constructor(game, root) {
    this.game = game;
    this.layer = createElement('div', 'enemy-tags', root);
    this.point = new THREE.Vector3();
    this.tags = [];
    for (let index = 0; index < MAX_TAGS; index += 1) {
      const tag = createElement('div', 'enemy-tag', this.layer);
      const name = createElement('b', 'enemy-name', tag);
      const fill = createElement('i', '', createElement('div', 'enemy-bar', tag));
      this.tags.push({ tag, name, fill, shownName: null, shownWidth: null });
    }
  }

  /** The name a tag carries: a capo's own name and price; his guards and the police get the bar alone. */
  nameOf(gunman) {
    if (gunman.kind !== 'capo' || !gunman.missionTag) return '';
    const capo = VANE_CAPOS.find((entry) => `bounty:${entry.id}` === gunman.missionTag);
    return capo ? `${capo.name} · TARGET $${capo.price.toLocaleString('en-US')}` : 'TARGET';
  }

  update() {
    const game = this.game;
    const view = game.camera.view;
    const player = game.player.position;
    const shown = [];
    for (const gunman of game.gunmen.list) {
      if (!gunman.alive || !gunman.hostile) continue;
      const dx = gunman.position.x - player.x;
      const dz = gunman.position.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > RANGE) continue;
      this.point.set(gunman.position.x, gunman.position.y + HEAD_HEIGHT, gunman.position.z).project(view);
      if (this.point.z > 1 || Math.abs(this.point.x) > 0.95 || Math.abs(this.point.y) > 0.95) continue;
      shown.push({ gunman, distance, x: (this.point.x + 1) / 2, y: (1 - this.point.y) / 2 });
    }
    shown.sort((a, b) => a.distance - b.distance);
    this.tags.forEach((entry, index) => {
      const item = shown[index];
      entry.tag.classList.toggle('visible', Boolean(item));
      if (!item) return;
      const { gunman } = item;
      entry.tag.style.left = `${(item.x * 100).toFixed(2)}%`;
      entry.tag.style.top = `${(item.y * 100).toFixed(2)}%`;
      // Nearer heads get bigger tags, as they would in the street.
      entry.tag.style.setProperty('--near', String(Math.max(0.7, Math.min(1.15, 14 / item.distance))));
      const name = this.nameOf(gunman);
      if (name !== entry.shownName) { entry.shownName = name; entry.name.textContent = name; }
      entry.tag.classList.toggle('capo', gunman.kind === 'capo');
      entry.tag.classList.toggle('police', gunman.faction === 'police');
      const width = `${Math.round(Math.max(0, Math.min(1, gunman.health / gunman.spec.health)) * 100)}%`;
      if (width !== entry.shownWidth) { entry.shownWidth = width; entry.fill.style.width = width; }
    });
  }
}
