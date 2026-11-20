// Armed characters who fight the player: police officers, tactical units, Vane enforcers and bank guards.
import * as THREE from 'three';
import { distance2D } from '../core/random.js';
import { CharacterBody, LOOKS } from '../characters/characterBody.js';
import { CRED_AWARDS } from '../progression/streetCred.js';

class Gunman extends CharacterBody {
  constructor(game, kind, x, z) {
    super(game, LOOKS[KINDS[kind].look], x, z);
    this.kind = kind;
    this.spec = KINDS[kind];
    this.faction = this.spec.faction;
    this.health = this.spec.health;
    this.armed = true;
    this.hostile = false;
    this.cooldown = 0.6 + Math.random();
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeClock = 1 + Math.random() * 2;
    this.arrestClock = 0;
    this.idleTime = 0;
    this.missionTag = null;
    this.homeX = x;
    this.homeZ = z;
  }

  update(dt) {
    if (!this.alive) { this.fall(dt, 18); this.animate(dt); return; }
    const game = this.game;
    const player = game.player;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dz) || 0.01;
    const stars = game.wanted.stars;
    if (this.faction === 'police') this.hostile = stars > 0 && player.alive;
    else if (!this.hostile && player.alive && distance < 26 && game.collision.hasLineOfSight(this.position.x, this.position.z, player.position.x, player.position.z)) this.hostile = true;

    let speed = 0;
    this.aiming = false;
    if (this.hostile && player.alive) {
      const sees = distance < this.spec.range && game.collision.hasLineOfSight(this.position.x, this.position.z, player.position.x, player.position.z);
      const arresting = this.faction === 'police' && stars <= 1;
      const keep = arresting ? 1.2 : 11;
      this.turnToward(Math.atan2(dx, dz), dt, 9);
      this.strafeClock -= dt;
      if (this.strafeClock <= 0) { this.strafe = -this.strafe; this.strafeClock = 1 + Math.random() * 2.5; }
      if (!sees || distance > keep + 6) {
        speed = this.spec.speed;
        this.step((dx / distance) * speed * dt, (dz / distance) * speed * dt);
      } else if (!arresting) {
        speed = 1.6;
        this.step((-dz / distance) * this.strafe * speed * dt, (dx / distance) * this.strafe * speed * dt);
      }
      this.aiming = !arresting && sees;
      this.cooldown -= dt;
      if (this.aiming && this.cooldown <= 0) this.fire(player, distance);
      this.tryArrest(dt, player, distance, stars);
    } else {
      this.idleTime += dt;
    }
    this.moveSpeed = speed;
    this.fall(dt, 18);
    this.animate(dt);
  }

  /** At one or two stars an officer who reaches a player on foot, or in a stopped car, makes the arrest. */
  tryArrest(dt, player, distance, stars) {
    if (this.faction !== 'police' || stars > 2) return;
    const slow = !player.vehicle || Math.abs(player.vehicle.speed) < 2;
    if (distance < 2.3 && slow) {
      this.arrestClock += dt;
      if (this.arrestClock > 1.1) this.game.onPlayerDown('busted');
    } else {
      this.arrestClock = Math.max(0, this.arrestClock - dt);
    }
  }

  fire(player, distance) {
    const game = this.game;
    this.cooldown = this.spec.rate * (0.8 + Math.random() * 0.5);
    const fast = player.vehicle ? Math.abs(player.vehicle.speed) > 12 : player.moveSpeed > 5;
    const chance = this.spec.accuracy * (1 - (distance / this.spec.range) * 0.55) * (fast ? 0.55 : 1);
    const hit = Math.random() < chance;
    const from = new THREE.Vector3(this.position.x + Math.sin(this.heading) * 0.6, this.position.y + 1.45, this.position.z + Math.cos(this.heading) * 0.6);
    const miss = hit ? 0 : 1.6;
    const to = new THREE.Vector3(player.position.x + (Math.random() - 0.5) * miss * 2, player.position.y + 1.1 + (Math.random() - 0.5) * miss, player.position.z + (Math.random() - 0.5) * miss * 2);
    game.particles.tracer(from, to, this.faction === 'police' ? 0xbfd8ff : 0xffc9a8);
    game.particles.muzzleFlash(from.x, from.y, from.z);
    game.audio.gunshot('distant', Math.max(0.15, 1 - distance / 60));
    if (!hit) return;
    if (player.vehicle) {
      player.vehicle.damage(this.spec.damage * 0.7);
      game.particles.sparks(to.x, to.y, to.z, 3);
    }
    player.takeDamage(this.spec.damage, 'bullet');
  }

  takeDamage(amount, byPlayer = false) {
    if (!this.alive) return;
    this.health -= amount;
    this.hostile = true;
    if (byPlayer && this.faction === 'police') this.game.wanted.reportCrime('shootPolice');
    if (byPlayer) this.game.gunmen.alertFaction(this.faction, this.position.x, this.position.z);
    if (this.health <= 0) this.die(byPlayer);
  }

  die(byPlayer) {
    this.alive = false;
    this.moveSpeed = 0;
    const game = this.game;
    if (byPlayer) {
      if (this.faction === 'police') { game.wanted.reportCrime('killPolice'); game.stats.copsDowned += 1; game.cred.earn(CRED_AWARDS.officer, 'officer down'); }
      else { game.stats.enforcersDowned += 1; game.cred.earn(CRED_AWARDS.enforcer, 'Vane gun down'); }
    }
    if (this.kind === 'capo') game.bounties.onCapoDown(this, byPlayer);
    game.pickups.drop(Math.random() < 0.6 ? 'ammo' : 'cash', this.position.x, this.position.z, Math.random() < 0.6 ? 24 : 80);
    game.missions.onGunmanDown(this);
  }

  onVehicleHit(vehicle, speed) {
    this.fling(vehicle, speed);
    this.game.audio.thud();
    this.takeDamage(speed * 11, vehicle.driver === 'player');
  }
}

export class Gunmen {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(kind, x, z, missionTag = null) {
    const gunman = new Gunman(this.game, kind, x, z);
    gunman.missionTag = missionTag;
    gunman.heading = Math.random() * Math.PI * 2;
    this.list.push(gunman);
    return gunman;
  }

  /** A shot at one member wakes every member of that faction within earshot. */
  alertFaction(faction, x, z) {
    for (const gunman of this.list) {
      if (gunman.faction === faction && distance2D(x, z, gunman.position.x, gunman.position.z) < 70) gunman.hostile = true;
    }
  }

  countAlive(missionTag) {
    return this.list.filter((g) => g.alive && g.missionTag === missionTag).length;
  }

  removeTagged(missionTag) {
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      if (this.list[index].missionTag === missionTag) { this.list[index].dispose(); this.list.splice(index, 1); }
    }
  }

  clear() {
    for (const gunman of this.list) gunman.dispose();
    this.list.length = 0;
  }

  update(dt) {
    const player = this.game.player.position;
    const stars = this.game.wanted.stars;
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const gunman = this.list[index];
      gunman.update(dt);
      const distance = distance2D(gunman.position.x, gunman.position.z, player.x, player.z);
      const standDown = gunman.faction === 'police' && gunman.alive && stars === 0 && (gunman.idleTime > 12 || distance > 70);
      const gone = !gunman.alive && (gunman.deadTime > 40 || (gunman.deadTime > 8 && distance > 80));
      const lost = gunman.faction === 'police' && distance > 190;
      if (standDown || gone || lost) { gunman.dispose(); this.list.splice(index, 1); }
    }
  }
}

/** Every kind of gunman: whose side they are on, how tough they are and how well they shoot. */
const KINDS = {
  officer: { look: 'officer', faction: 'police', health: 90, damage: 7, rate: 0.75, range: 42, accuracy: 0.42, speed: 5.4 },
  tactical: { look: 'tactical', faction: 'police', health: 160, damage: 9, rate: 0.22, range: 55, accuracy: 0.34, speed: 5 },
  enforcer: { look: 'enforcer', faction: 'gang', health: 100, damage: 8, rate: 0.6, range: 45, accuracy: 0.4, speed: 4.6 },
  guard: { look: 'guard', faction: 'gang', health: 130, damage: 9, rate: 0.5, range: 45, accuracy: 0.45, speed: 4.4 },
  capo: { look: 'capo', faction: 'gang', health: 240, damage: 11, rate: 0.4, range: 48, accuracy: 0.5, speed: 4.8 },
};
