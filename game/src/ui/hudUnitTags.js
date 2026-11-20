// Callsign tags over the police units hunting Nova: a small plate floating above each of the nearest cruisers,
// interceptors and vans, the blockade and the helicopter, with the unit's radio name and the tactic it is running
// right now. The dispatch panel lists the same units; the tags say which one on the street is which.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { createElement } from './domBuilder.js';

/** How many tags the HUD draws at once (fewer on the huge HUD), and how far away a unit still gets one. */
const MAX_TAGS = 5;
const ESSENTIAL_TAGS = 2;
const TAG_RANGE = 85;

export class HudUnitTags {
  constructor(game, root, cache) {
    this.game = game;
    this.cache = cache;
    this.layer = createElement('div', 'unit-tags', root);
    this.point = new THREE.Vector3();
    this.tags = [];
    for (let index = 0; index < MAX_TAGS; index += 1) {
      const tag = createElement('div', 'unit-tag', this.layer);
      this.tags.push({ tag, name: createElement('b', '', tag), tactic: createElement('em', '', tag) });
    }
    this.found = [];
  }

  /** Every unit in range with a place in the world to hang a tag on, nearest first: [distance, x, y, z, unit, tactic]. */
  unitsInRange() {
    const game = this.game;
    const player = game.player.position;
    const found = this.found;
    found.length = 0;
    const blockades = new Set();
    for (const vehicle of game.vehicles.list) {
      if (vehicle.dead || vehicle.driver !== 'cop' || !vehicle.unit || !vehicle.controller) continue;
      if (!vehicle.controller.isPursuit && !vehicle.controller.isBlockade) continue;
      // The cars of one blockade share a callsign: the first of them carries its tag.
      if (vehicle.controller.isBlockade) { if (blockades.has(vehicle.unit)) continue; blockades.add(vehicle.unit); }
      const distance = distance2D(vehicle.position.x, vehicle.position.z, player.x, player.z);
      if (distance < TAG_RANGE) found.push([distance, vehicle.position.x, vehicle.spec.height + 1.15, vehicle.position.z, vehicle.unit, vehicle.controller.tacticLabel()]);
    }
    const helicopter = game.police.helicopter;
    if (helicopter.active && helicopter.unit) {
      const at = helicopter.mesh.position;
      const distance = distance2D(at.x, at.z, player.x, player.z);
      // The helicopter's tag hangs under it, so the machine itself stays clear against the sky.
      if (distance < TAG_RANGE) found.push([distance, at.x, at.y - 3.6, at.z, helicopter.unit, helicopter.tacticLabel()]);
    }
    return found.sort((a, b) => a[0] - b[0]);
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const limit = game.hud.essentials ? ESSENTIAL_TAGS : MAX_TAGS;
    let used = 0;
    if (game.wanted.stars > 0 && game.player.alive) {
      for (const [, x, y, z, unit, tactic] of this.unitsInRange()) {
        if (used >= limit) break;
        const point = this.point.set(x, y, z).project(game.camera.view);
        if (point.z > 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.96) continue;
        const entry = this.tags[used];
        used += 1;
        entry.tag.style.left = `${((point.x * 0.5 + 0.5) * 100).toFixed(2)}%`;
        entry.tag.style.top = `${((0.5 - point.y * 0.5) * 100).toFixed(2)}%`;
        cache.toggle(entry.tag, 'visible', true);
        cache.toggle(entry.tag, 'air', unit.role === 'air');
        cache.text(entry.name, unit.callsign);
        cache.text(entry.tactic, tactic);
      }
    }
    for (let index = used; index < MAX_TAGS; index += 1) cache.toggle(this.tags[index].tag, 'visible', false);
  }
}
