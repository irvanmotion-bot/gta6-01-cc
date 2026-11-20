// Nova Reyes, the player: running, jumping and driving from the keyboard, health and armor, cash and dying.
import { PLAYER, GRAVITY } from '../core/config.js';
import { CharacterBody, LOOKS } from './characterBody.js';
import { tryEnterVehicle, leaveVehicle } from '../vehicles/carjacking.js';

export class Player extends CharacterBody {
  constructor(game, x, z) {
    super(game, LOOKS.nova, x, z);
    this.isPlayer = true;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.cash = 250;
    this.radius = PLAYER.radius;
    this.invulnerable = 0;
    this.hurtFlash = 0;
    this.regenDelay = 0;
  }

  update(dt) {
    const input = this.game.input;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (!this.alive) { this.fall(dt, GRAVITY); this.animate(dt); return; }
    if (this.frozen) {
      // Arrested: hands off the controls until the station lets her go.
      this.moveSpeed = 0;
      if (this.vehicle) { this.vehicle.setControls(0, 0, true); this.position.copy(this.vehicle.position); }
      else { this.fall(dt, GRAVITY); this.animate(dt); }
      return;
    }
    if (input.wasPressed('KeyF', 'Enter')) {
      if (this.vehicle) leaveVehicle(this.game); else tryEnterVehicle(this.game);
    }
    if (this.vehicle) this.drive(input);
    else this.walk(dt, input);
    // A sliver of health comes back when Nova stays out of trouble.
    this.regenDelay -= dt;
    if (this.regenDelay <= 0 && this.health < 35) this.health = Math.min(35, this.health + dt * 2);
  }

  drive(input) {
    const vehicle = this.vehicle;
    const throttle = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const steer = input.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    vehicle.setControls(throttle, steer, input.isHeld('Space'));
    this.position.copy(vehicle.position);
    this.heading = vehicle.heading;
    if (vehicle.dead) leaveVehicle(this.game, true);
  }

  walk(dt, input) {
    const camera = this.game.camera;
    const forward = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const strafe = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const sinYaw = Math.sin(camera.yaw);
    const cosYaw = Math.cos(camera.yaw);
    let moveX = sinYaw * forward - cosYaw * strafe;
    let moveZ = cosYaw * forward + sinYaw * strafe;
    const length = Math.hypot(moveX, moveZ);
    const running = input.isHeld('ShiftLeft', 'ShiftRight') && !this.aiming;
    const speed = length > 0 ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed * (this.aiming ? 0.8 : 1.35)) : 0;
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
      this.step(moveX * speed * dt, moveZ * speed * dt);
      if (!this.aiming) this.turnToward(Math.atan2(moveX, moveZ), dt, 12);
    }
    if (this.aiming) this.turnToward(camera.yaw, dt, 18);
    this.moveSpeed = speed;
    if (input.wasPressed('Space') && this.airborne === 0) this.velY = PLAYER.jumpSpeed;
    const car = this.game.vehicles.nearest(this.position.x, this.position.z, PLAYER.enterRange);
    if (car) this.game.hud.hint(car.driver === 'ai' ? `Press F to pull the driver out of the ${car.spec.name}` : `Press F to take the ${car.spec.name}`);
    else if (!input.locked && !input.lockUnavailable) this.game.hud.hint('Click to look around with the mouse');
    this.fall(dt, GRAVITY);
    this.animate(dt);
  }

  /** Armor soaks most of a hit before health does. */
  takeDamage(amount, source = null) {
    if (!this.alive || this.invulnerable > 0 || this.game.state !== 'play') return;
    if (this.vehicle && source !== 'explosion') amount *= 0.45;
    const soaked = Math.min(this.armor, amount * 0.8);
    this.armor -= soaked;
    this.health -= amount - soaked;
    this.hurtFlash = 0.35;
    this.regenDelay = 8;
    this.game.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      if (this.vehicle) leaveVehicle(this.game, true);
      this.game.onPlayerDown('wasted');
    }
  }

  onVehicleHit(vehicle, speed) {
    if (vehicle.driver === 'player') return;
    this.fling(vehicle, speed * 0.5);
    this.takeDamage(Math.min(speed * 2.2, 60), 'vehicle');
  }

  addCash(amount) {
    this.cash = Math.max(0, Math.round(this.cash + amount));
    this.game.stats.earned += Math.max(0, amount);
  }

  /** Stand Nova back up at a place, healed: after the hospital, the station or a load. */
  revive(x, z, heading = 0) {
    this.alive = true;
    this.health = PLAYER.maxHealth;
    this.deadTime = 0;
    this.vehicle = null;
    this.mesh.visible = true;
    this.mesh.rotation.x = 0;
    this.model.armL.rotation.z = 0;
    this.model.armR.rotation.z = 0;
    this.position.set(x, 0, z);
    this.heading = heading;
    this.flingX = 0; this.flingZ = 0; this.velY = 0;
    this.invulnerable = 3;
  }
}
