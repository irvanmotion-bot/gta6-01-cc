// The HUD's combat tags: while Nova is on foot, a health bar floats over the head of every gunman who is shooting
// at her (coral for Vane's guns, blue for Saros P.D.), and a capo with a price on him carries his name over his bar.
// The nearest eight in view get a tag; the bars empty as they are hit.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { VANE_CAPOS } from '../activities/vaneBounties.js';
import { createElement } from './domBuilder.js';

/** How many tags the HUD keeps, how far away a gunman still gets one, and how high over the ground it floats. */
const MAX_TAGS = 8;
const TAG_RANGE = 55;
const HEAD_HEIGHT = 2.15;

export class HudCombatTags {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.point = new THREE.Vector3();
    this.layer = createElement('div', 'combat-tags', parent);
    this.tags = [];
    for (let index = 0; index < MAX_TAGS; index += 1) {
      const root = createElement('div', 'combat-tag', this.layer);
      const name = createElement('b', 'combat-name', root);
      const fill = createElement('i', '', createElement('div', 'combat-bar', root));
      this.tags.push({ root, name, fill });
    }
  }

  /** The name a gunman's tag carries: a capo's street name, nothing for the rank and file. */
  nameOf(gunman) {
    if (gunman.kind !== 'capo') return '';
    const capo = VANE_CAPOS.find((entry) => entry.id === gunman.bountyId);
    return capo ? capo.name : 'CAPO';
  }

  /** The gunmen who get a tag this frame: alive, hostile and near, the nearest first. None while she drives. */
  tagged() {
    const game = this.game;
    const player = game.player;
    if (player.vehicle || !player.alive) return [];
    const list = [];
    for (const gunman of game.gunmen.list) {
      if (!gunman.alive || !gunman.hostile) continue;
      const distance = distance2D(gunman.position.x, gunman.position.z, player.position.x, player.position.z);
      if (distance < TAG_RANGE) list.push({ gunman, distance });
    }
    return list.sort((a, b) => a.distance - b.distance).slice(0, MAX_TAGS);
  }

  update() {
    const cache = this.cache;
    const view = this.game.camera.view;
    const tagged = this.tagged();
    this.tags.forEach((tag, index) => {
      const entry = tagged[index];
      let shown = false;
      if (entry) {
        const gunman = entry.gunman;
        // Where his head is on the screen; behind the camera or off the frame he gets no tag.
        const point = this.point.set(gunman.position.x, gunman.position.y + HEAD_HEIGHT, gunman.position.z).project(view);
        shown = point.z < 1 && Math.abs(point.x) < 0.96 && Math.abs(point.y) < 0.96;
        if (shown) {
          tag.root.style.left = `${((point.x * 0.5 + 0.5) * 100).toFixed(2)}%`;
          tag.root.style.top = `${((0.5 - point.y * 0.5) * 100).toFixed(2)}%`;
          cache.text(tag.name, this.nameOf(gunman));
          cache.width(tag.fill, gunman.health / gunman.spec.health);
          cache.toggle(tag.root, 'police', gunman.faction === 'police');
          cache.toggle(tag.root, 'named', gunman.kind === 'capo');
        }
      }
      cache.toggle(tag.root, 'visible', shown);
    });
  }
}
