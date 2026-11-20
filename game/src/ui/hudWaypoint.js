// The HUD's waypoint: a plate that hangs on the screen where the job's next place stands in the world, with the
// place's name and how many metres off it is. When that place is out of view the plate slides to the side of the
// screen it lies toward and points that way. A street race hangs it on the next checkpoint.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { createElement } from './domBuilder.js';

/** The plate keeps to this band of the screen (shares of its width and height), clear of the panels in the corners. */
const BAND = { left: 0.012, right: 0.988, top: 0.58, bottom: 0.6, aheadLeft: 0.3, aheadRight: 0.7, aheadTop: 0.18, aheadBottom: 0.64 };

export class HudWaypoint {
  constructor(game, root, cache) {
    this.game = game;
    this.cache = cache;
    this.plate = createElement('div', 'waypoint', root);
    this.arrow = createElement('i', 'waypoint-arrow', this.plate);
    this.name = createElement('b', 'waypoint-name', this.plate);
    this.metres = createElement('span', 'waypoint-metres', this.plate);
    this.point = new THREE.Vector3();
  }

  /** Where the game is sending her right now: a race's next checkpoint, or the story job's next place. */
  target() {
    const game = this.game;
    const race = game.races.active;
    if (race) {
      const next = race.points[race.index];
      return next && race.countdown <= 0 ? { x: next.x, z: next.z, name: `CHECKPOINT ${race.index + 1}` } : null;
    }
    return game.missions.waypoint();
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const target = game.player.alive ? this.target() : null;
    const player = game.player.position;
    const distance = target ? distance2D(player.x, player.z, target.x, target.z) : 0;
    // On top of the place itself the plate has nothing left to say.
    const shown = Boolean(target) && distance > 14;
    cache.toggle(this.plate, 'visible', shown);
    if (!shown) return;
    const point = this.point.set(target.x, 3, target.z).project(game.camera.view);
    const behind = point.z > 1;
    let x = (behind ? -point.x : point.x) * 0.5 + 0.5;
    let y = 0.5 - (behind ? -point.y : point.y) * 0.5;
    const ahead = !behind && x > BAND.aheadLeft && x < BAND.aheadRight && y > BAND.aheadTop && y < BAND.aheadBottom;
    let arrow = '◆';
    if (!ahead) {
      // Out of view (or behind a panel): the plate goes to the side the place lies on, half-way down the screen.
      const toRight = behind ? point.x < 0 : x >= 0.5;
      x = toRight ? BAND.right : BAND.left;
      y = Math.min(BAND.bottom, Math.max(BAND.top, y));
      arrow = toRight ? '▶' : '◀';
    }
    this.plate.style.left = `${(x * 100).toFixed(2)}%`;
    this.plate.style.top = `${(y * 100).toFixed(2)}%`;
    cache.toggle(this.plate, 'to-left', arrow === '◀');
    cache.toggle(this.plate, 'to-right', arrow === '▶');
    cache.text(this.arrow, arrow);
    cache.text(this.name, target.name);
    cache.text(this.metres, `${Math.round(distance)} M`);
  }
}
