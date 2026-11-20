// The player's arsenal: fists and four guns, aiming, hitscan shots, reloading, drive-by fire and weapon switching.
import * as THREE from 'three';
import { distance2D, angleDelta } from '../core/random.js';

export const WEAPONS = {
  fists: { name: 'Fists', short: 'FIST', slot: 1, melee: true, damage: 26, rate: 0.4 },
  pistol: { name: 'Viper 9', short: 'V9', rank: 1, slot: 2, damage: 27, rate: 0.26, clip: 12, range: 95, spread: 0.01, auto: false, pellets: 1, price: 450, ammoPack: 48, ammoPrice: 90, sound: 'pistol' },
  smg: { name: 'Hornet SMG', short: 'SMG', rank: 3, slot: 3, damage: 15, rate: 0.085, clip: 32, range: 80, spread: 0.028, auto: true, pellets: 1, price: 1600, ammoPack: 128, ammoPrice: 180, sound: 'smg' },
  shotgun: { name: 'Boomstick 12', short: '12G', rank: 4, slot: 4, damage: 14, rate: 0.85, clip: 6, range: 38, spread: 0.075, auto: false, pellets: 8, price: 2400, ammoPack: 24, ammoPrice: 160, sound: 'shotgun' },
  rifle: { name: 'Longshot AR', short: 'AR', rank: 5, slot: 5, damage: 34, rate: 0.115, clip: 30, range: 130, spread: 0.012, auto: true, pellets: 1, price: 4800, ammoPack: 120, ammoPrice: 260, sound: 'rifle' },
};
const ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export class Weapons {
  constructor(game) {
    this.game = game;
    this.reset();
    this.origin = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.muzzle = new THREE.Vector3();
  }

  reset() {
    this.current = 'fists';
    this.owned = { fists: true };
    this.clip = {};
    this.reserve = {};
    this.cooldown = 0;
    this.reloading = 0;
    this.aimHold = 0;
  }

  /** Own a gun (with one clip loaded) or top up its reserve. */
  give(id, ammo = 0, select = true) {
    const spec = WEAPONS[id];
    if (!this.owned[id]) { this.owned[id] = true; this.clip[id] = spec.clip; this.reserve[id] = 0; }
    this.reserve[id] += ammo;
    if (select) this.current = id;
  }

  addAmmoForCurrent(amount) {
    const id = this.current === 'fists' ? ORDER.find((w) => w !== 'fists' && this.owned[w]) : this.current;
    if (!id) { this.game.player.addCash(amount * 2); return; }
    this.reserve[id] += amount;
    this.game.hud.notify(`+${amount} ${WEAPONS[id].name} rounds`);
  }

  select(id) {
    if (!this.owned[id] || id === this.current) return;
    this.current = id;
    this.reloading = 0;
    this.game.audio.click();
  }

  cycle(step) {
    const owned = ORDER.filter((id) => this.owned[id]);
    this.select(owned[(owned.indexOf(this.current) + step + owned.length) % owned.length]);
  }

  /** What the HUD shows: the weapon's name and "clip / reserve". */
  status() {
    const spec = WEAPONS[this.current];
    if (spec.melee) return { name: spec.name, ammo: '' };
    return { name: spec.name, ammo: this.reloading > 0 ? 'RELOADING' : `${this.clip[this.current]} / ${this.reserve[this.current]}` };
  }

  nameOf(id) {
    return WEAPONS[id].name;
  }

  /** The five weapon slots for the HUD's weapon wheel: key, short name, whether owned, in hand, and rounds held. */
  slots() {
    return ORDER.map((id) => {
      const spec = WEAPONS[id];
      const owned = Boolean(this.owned[id]);
      return { id, key: spec.slot, short: spec.short, owned, current: id === this.current, rounds: spec.melee || !owned ? '' : String(this.clip[id] + this.reserve[id]) };
    });
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const player = game.player;
    this.cooldown -= dt;
    if (!player.alive) return;
    for (const id of ORDER) if (input.wasPressed(`Digit${WEAPONS[id].slot}`)) this.select(id);
    if (input.wheel !== 0) this.cycle(input.wheel > 0 ? 1 : -1);
    if (input.wasPressed('KeyQ')) this.cycle(1);
    const spec = WEAPONS[this.current];
    player.armed = !spec.melee;

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.finishReload();
    } else if (!spec.melee && input.wasPressed('KeyR') && !player.vehicle && this.clip[this.current] < spec.clip) {
      this.startReload();
    }
    const trigger = spec.auto ? input.buttons[0] : input.buttonPressed[0];
    const wantsFire = trigger && (input.locked || input.lockUnavailable);
    if (wantsFire) this.aimHold = 0.9;
    this.aimHold -= dt;
    player.aiming = !player.vehicle && !spec.melee && (input.buttons[2] || this.aimHold > 0);
    if (wantsFire && this.cooldown <= 0 && this.reloading <= 0) {
      if (spec.melee) { if (!player.vehicle) this.punch(spec); }
      else if (this.clip[this.current] > 0) this.shoot(spec);
      else if (this.reserve[this.current] > 0) this.startReload();
      else { game.audio.click(); this.cooldown = 0.3; }
    }
  }

  startReload() {
    if (this.reserve[this.current] <= 0) return;
    this.reloading = 1.1;
    this.game.audio.reload();
  }

  finishReload() {
    const spec = WEAPONS[this.current];
    const need = Math.min(spec.clip - this.clip[this.current], this.reserve[this.current]);
    this.clip[this.current] += need;
    this.reserve[this.current] -= need;
  }

  punch(spec) {
    const game = this.game;
    const player = game.player;
    this.cooldown = spec.rate;
    player.punching = 0.28;
    game.audio.punch();
    for (const person of game.allCharacters()) {
      if (person === player || !person.alive) continue;
      const dx = person.position.x - player.position.x;
      const dz = person.position.z - player.position.z;
      if (Math.hypot(dx, dz) > 1.9 || Math.abs(angleDelta(player.heading, Math.atan2(dx, dz))) > 1.1) continue;
      person.takeDamage(spec.damage, true);
      person.flingX = Math.sin(player.heading) * 3;
      person.flingZ = Math.cos(player.heading) * 3;
      game.particles.dust(person.position.x, 1.3, person.position.z);
      game.wanted.reportCrime('assault');
      break;
    }
  }

  shoot(spec) {
    const game = this.game;
    const player = game.player;
    const camera = game.camera;
    this.cooldown = spec.rate;
    this.clip[this.current] -= 1;
    game.stats.shotsFired += 1;
    if (!player.vehicle) player.heading = camera.yaw;
    // On foot the shot leaves the gun in her right hand, a forearm's length ahead of her; in a car, the window.
    const side = player.vehicle ? 0 : 0.33;
    const ahead = player.vehicle ? 0.7 : 1.2;
    this.muzzle.set(player.position.x + Math.sin(camera.yaw) * ahead - Math.cos(camera.yaw) * side, player.position.y + (player.vehicle ? 1.2 : 1.43), player.position.z + Math.cos(camera.yaw) * ahead + Math.sin(camera.yaw) * side);
    for (let pellet = 0; pellet < spec.pellets; pellet += 1) {
      const dx = camera.direction.x + (Math.random() - 0.5) * spec.spread * 2;
      const dy = camera.direction.y + (Math.random() - 0.5) * spec.spread * 2;
      const dz = camera.direction.z + (Math.random() - 0.5) * spec.spread * 2;
      const length = Math.hypot(dx, dy, dz);
      this.castShot(spec, dx / length, dy / length, dz / length);
    }
    game.particles.lightFlash(this.muzzle.x, this.muzzle.y, this.muzzle.z, 9, 0.06);
    game.particles.muzzleFlash(this.muzzle.x, this.muzzle.y, this.muzzle.z);
    game.audio.gunshot(spec.sound);
    camera.pitch -= 0.006;
    camera.shake(0.05);
    game.pedestrians.scareNear(player.position.x, player.position.z, 38, 9, 16);
    game.wanted.reportCrime('gunfire');
    game.darkness.noteGunfire();
    if (this.clip[this.current] === 0 && this.reserve[this.current] > 0) this.startReload();
  }

  /** One bullet along a ray from the camera: the nearest of wall, person, car or helicopter takes it. */
  castShot(spec, dx, dy, dz) {
    const game = this.game;
    const view = game.camera.view.position;
    const skip = game.camera.distance * 0.7;
    let best = game.collision.raycast(view.x, view.y, view.z, dx, dy, dz, spec.range, 0.5);
    let victim = null;
    let kind = best < spec.range ? 'wall' : 'none';
    const sphere = (cx, cy, cz, radius) => {
      const t = (cx - view.x) * dx + (cy - view.y) * dy + (cz - view.z) * dz;
      if (t < skip || t > best) return -1;
      const px = view.x + dx * t - cx;
      const py = view.y + dy * t - cy;
      const pz = view.z + dz * t - cz;
      return px * px + py * py + pz * pz < radius * radius ? t : -1;
    };
    for (const person of game.allCharacters()) {
      if (person.isPlayer || !person.alive || person.vehicle) continue;
      const t = Math.max(sphere(person.position.x, person.position.y + 1.0, person.position.z, 0.6), sphere(person.position.x, person.position.y + 1.6, person.position.z, 0.34));
      if (t > 0) { best = t; victim = person; kind = 'person'; }
    }
    for (const vehicle of game.vehicles.list) {
      if (vehicle === game.player.vehicle) continue;
      for (const circle of vehicle.bodyCircles()) {
        const t = sphere(circle.x, vehicle.position.y + 0.8, circle.z, vehicle.spec.width * 0.62);
        if (t > 0) { best = t; victim = vehicle; kind = 'vehicle'; }
      }
    }
    const chopper = game.police.helicopter;
    if (chopper.active) {
      const t = sphere(chopper.mesh.position.x, chopper.mesh.position.y, chopper.mesh.position.z, 3.2);
      if (t > 0) { best = t; victim = chopper; kind = 'chopper'; }
    }
    this.end.set(view.x + dx * best, view.y + dy * best, view.z + dz * best);
    game.particles.tracer(this.muzzle, this.end);
    if (kind === 'person') {
      const headshot = this.end.y - victim.position.y > 1.5;
      victim.takeDamage(spec.damage * (headshot ? 2.5 : 1), true);
      game.particles.blood(this.end.x, this.end.y, this.end.z);
      game.hud.hitMarker();
    } else if (kind === 'vehicle') {
      victim.damage(spec.damage * 0.55, true);
      game.particles.sparks(this.end.x, this.end.y, this.end.z, 4);
      if (victim.controller && victim.controller.panic) victim.controller.panic(8);
      if (victim.spec.police) game.wanted.reportCrime('shootPolice');
      game.hud.hitMarker();
    } else if (kind === 'chopper') {
      victim.damage(spec.damage);
      game.particles.sparks(this.end.x, this.end.y, this.end.z, 5);
      game.hud.hitMarker();
    } else if (kind === 'wall') {
      game.particles.dust(this.end.x, this.end.y, this.end.z);
    }
  }

  /** Whether the player is close enough to anyone that drawing a gun matters; police use it to decide to fire. */
  isThreatening() {
    return this.current !== 'fists';
  }

  serialize() {
    return { current: this.current, owned: this.owned, clip: this.clip, reserve: this.reserve };
  }

  restore(data) {
    this.reset();
    if (!data) return;
    this.owned = { fists: true, ...data.owned };
    this.clip = { ...data.clip };
    this.reserve = { ...data.reserve };
    this.current = this.owned[data.current] ? data.current : 'fists';
  }
}

export function nearestOf(list, x, z, range) {
  let best = null;
  let bestDistance = range;
  for (const item of list) {
    const d = distance2D(x, z, item.position.x, item.position.z);
    if (d < bestDistance) { bestDistance = d; best = item; }
  }
  return best;
}
