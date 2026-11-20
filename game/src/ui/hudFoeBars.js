// Health bars over the heads of the gunmen Nova is fighting on foot: a short bar for every hostile in view and in
// range, red for Vane's men and blue for Saros P.D., and over a capo with a price on him, his name.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { createElement } from './domBuilder.js';

/** How many bars the HUD draws at once, and how far away a gunman still gets one. */
const MAX_BARS = 8;
const BAR_RANGE = 48;
/** Metres above a gunman's feet at which his bar floats. */
const HEAD_ROOM = 2.2;

export class HudFoeBars {
  constructor(game, root, cache) {
    this.game = game;
    this.cache = cache;
    this.layer = createElement('div', 'foe-bars', root);
    this.point = new THREE.Vector3();
    this.bars = [];
    for (let index = 0; index < MAX_BARS; index += 1) {
      const bar = createElement('div', 'foe-bar', this.layer);
      const name = createElement('b', 'foe-name', bar);
      const fill = createElement('i', '', createElement('span', 'foe-track', bar));
      this.bars.push({ bar, name, fill });
    }
  }

  /** Where a point of the world falls on the screen, as shares of its width and height; null when out of view. */
  screenSpot(x, y, z) {
    const point = this.point.set(x, y, z).project(this.game.camera.view);
    if (point.z > 1 || Math.abs(point.x) > 0.98 || Math.abs(point.y) > 0.98) return null;
    return { x: point.x * 0.5 + 0.5, y: 0.5 - point.y * 0.5 };
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const player = game.player;
    let used = 0;
    if (!player.vehicle && player.alive) {
      for (const gunman of game.gunmen.list) {
        if (used >= MAX_BARS) break;
        if (!gunman.alive || !gunman.hostile) continue;
        if (distance2D(gunman.position.x, gunman.position.z, player.position.x, player.position.z) > BAR_RANGE) continue;
        const spot = this.screenSpot(gunman.position.x, gunman.position.y + HEAD_ROOM, gunman.position.z);
        if (!spot) continue;
        const entry = this.bars[used];
        used += 1;
        entry.bar.style.left = `${(spot.x * 100).toFixed(2)}%`;
        entry.bar.style.top = `${(spot.y * 100).toFixed(2)}%`;
        cache.toggle(entry.bar, 'visible', true);
        cache.toggle(entry.bar, 'police', gunman.faction === 'police');
        cache.text(entry.name, gunman.nameTag || '');
        cache.width(entry.fill, gunman.health / gunman.spec.health);
      }
    }
    for (let index = used; index < MAX_BARS; index += 1) cache.toggle(this.bars[index].bar, 'visible', false);
  }
}
