// Things to grab off the street: dropped cash, health, armor, ammo and the hidden Sun Tokens.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { groundHeight } from './cityLayout.js';

const SHAPES = {
  cash: { geometry: new THREE.BoxGeometry(0.5, 0.12, 0.28), color: 0x2ecc71 },
  health: { geometry: new THREE.BoxGeometry(0.42, 0.42, 0.42), color: 0xff4d6d },
  armor: { geometry: new THREE.BoxGeometry(0.46, 0.5, 0.22), color: 0x4dabf7 },
  ammo: { geometry: new THREE.BoxGeometry(0.4, 0.26, 0.26), color: 0xf4a261 },
  token: { geometry: new THREE.OctahedronGeometry(0.5, 0), color: 0xffd60a },
};

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.materials = {};
    for (const [type, shape] of Object.entries(SHAPES)) {
      this.materials[type] = new THREE.MeshStandardMaterial({ color: shape.color, emissive: shape.color, emissiveIntensity: 0.55, roughness: 0.4 });
    }
  }

  /** Put a pickup down. `keep` pickups never time out (tokens); `id` names one that a save remembers. */
  drop(type, x, z, value = 0, keep = false, id = null) {
    const mesh = new THREE.Mesh(SHAPES[type].geometry, this.materials[type]);
    mesh.position.set(x, groundHeight(x, z) + 0.9, z);
    mesh.castShadow = true;
    this.game.scene.add(mesh);
    const pickup = { type, mesh, value, keep, id, age: 0 };
    this.list.push(pickup);
    return pickup;
  }

  clear() {
    for (const pickup of this.list) this.game.scene.remove(pickup.mesh);
    this.list.length = 0;
  }

  update(dt) {
    const player = this.game.player;
    const reach = player.vehicle ? 2.6 : 1.4;
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const pickup = this.list[index];
      pickup.age += dt;
      pickup.mesh.rotation.y += dt * 2.4;
      pickup.mesh.position.y = groundHeight(pickup.mesh.position.x, pickup.mesh.position.z) + 0.85 + Math.sin(pickup.age * 3) * 0.12;
      const taken = player.alive && distance2D(player.position.x, player.position.z, pickup.mesh.position.x, pickup.mesh.position.z) < reach && this.collect(pickup);
      if (taken || (!pickup.keep && pickup.age > 45)) {
        this.game.scene.remove(pickup.mesh);
        this.list.splice(index, 1);
      }
    }
  }

  /** Give the pickup's worth to the player; false when they cannot use it yet (full health). */
  collect(pickup) {
    const game = this.game;
    const player = game.player;
    if (pickup.type === 'cash') {
      player.addCash(pickup.value);
      game.hud.notify(`+$${pickup.value}`);
    } else if (pickup.type === 'health') {
      if (player.health >= 100) return false;
      player.health = Math.min(100, player.health + 50);
    } else if (pickup.type === 'armor') {
      if (player.armor >= 100) return false;
      player.armor = 100;
    } else if (pickup.type === 'ammo') {
      game.weapons.addAmmoForCurrent(pickup.value);
    } else if (pickup.type === 'token') {
      game.activities.collectToken(pickup.id);
    }
    game.audio.pickup();
    return true;
  }
}
