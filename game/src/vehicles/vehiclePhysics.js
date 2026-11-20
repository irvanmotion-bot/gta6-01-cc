// One drivable car: arcade handling with grip, drift and handbrake, wall impacts, damage, fire and explosion.
import * as THREE from 'three';
import { WORLD_BOUNDS } from '../core/config.js';
import { clamp } from '../core/random.js';
import { groundHeight } from '../world/cityLayout.js';
import { VEHICLE_CATALOG } from './vehicleCatalog.js';
import { buildVehicleModel, TAIL_LAMP } from './vehicleModel.js';
import { attachVehicleLights, flashSirenFlares } from './vehicleLights.js';

const WHEELBASE = 2.7;
const MAX_LATERAL_ACCEL = 22;
const wreckMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 1 });
const STOCK_TUNE = { speed: 1, accel: 1, grip: 1, plating: 1 };

export class Vehicle {
  constructor(game, modelId, x, z, heading, paint) {
    this.game = game;
    this.modelId = modelId;
    this.spec = VEHICLE_CATALOG[modelId];
    this.paint = paint;
    const model = buildVehicleModel(this.spec, paint);
    this.mesh = model.group;
    this.model = model;
    this.mesh.rotation.order = 'YXZ';
    this.mesh.traverse((part) => { if (part.isMesh) part.castShadow = true; });
    this.lights = attachVehicleLights(model, this.spec);
    this.position = this.mesh.position;
    this.position.set(x, groundHeight(x, z), z);
    this.heading = heading;
    this.velX = 0;
    this.velZ = 0;
    this.speed = 0;
    this.steer = 0;
    this.throttle = 0;
    this.steerInput = 0;
    this.handbrake = false;
    this.health = this.spec.health;
    this.maxHealth = this.spec.health;
    this.tiresShredded = false;
    this.boosting = false;
    this.markX = x;
    this.markZ = z;
    this.unit = null;
    this.driver = null;
    this.controller = null;
    this.parked = false;
    this.siren = false;
    this.skidding = false;
    this.burning = 0;
    this.dead = false;
    this.deadTime = 0;
    this.missionTag = null;
    this.stolen = false;
    this.radius = this.spec.length * 0.5;
    this.roll = 0;
    this.pitch = 0;
    this.smokeClock = 0;
    this.mesh.rotation.y = heading;
    game.scene.add(this.mesh);
  }

  setControls(throttle, steer, handbrake) {
    this.throttle = throttle;
    this.steerInput = steer;
    this.handbrake = handbrake;
  }

  forwardX() { return Math.sin(this.heading); }
  forwardZ() { return Math.cos(this.heading); }

  /** The centres of the circles that stand in for the body in collisions: nose, middle, tail. */
  bodyCircles() {
    const reach = this.spec.length * 0.5 - this.spec.width * 0.5;
    const fx = this.forwardX();
    const fz = this.forwardZ();
    return [
      { x: this.position.x + fx * reach, z: this.position.z + fz * reach, lever: 1 },
      { x: this.position.x, z: this.position.z, lever: 0 },
      { x: this.position.x - fx * reach, z: this.position.z - fz * reach, lever: -1 },
    ];
  }

  update(dt) {
    if (this.dead) { this.deadTime += dt; this.smoke(dt, true); return; }
    if (!this.driver) { this.throttle = 0; this.steerInput = 0; this.handbrake = true; }
    const spec = this.spec;
    let fx = this.forwardX();
    let fz = this.forwardZ();
    let vf = this.velX * fx + this.velZ * fz;
    let vl = this.velX * -fz + this.velZ * fx;
    const power = this.health < this.maxHealth * 0.25 ? 0.6 : 1;
    // Nova's cars carry Bravo's workshop tune; shredded tyres and a nitro burn change the numbers on top of it.
    const tune = this.driver === 'player' ? this.game.workshop.tuning : STOCK_TUNE;
    let maxSpeed = spec.maxSpeed * tune.speed;
    let accel = spec.accel * tune.accel;
    let grip = spec.grip * tune.grip;
    if (this.tiresShredded) { maxSpeed *= 0.55; grip *= 0.45; }
    if (this.boosting) { maxSpeed *= 1.22; accel *= 2; }

    let braking = false;
    if (this.throttle > 0) {
      if (vf < -1) { vf += 24 * dt; braking = true; }
      else if (vf < maxSpeed) vf += accel * power * this.throttle * (1 - (vf / maxSpeed) * 0.65) * dt;
      else vf -= (vf - maxSpeed) * Math.min(1, dt * 1.5);
    } else if (this.throttle < 0) {
      if (vf > 1) { vf -= 26 * dt * -this.throttle; braking = true; }
      else if (vf > -maxSpeed * 0.3) vf -= accel * 0.7 * dt;
    } else {
      vf -= vf * 0.55 * dt;
    }
    vf -= vf * Math.abs(vf) * 0.0008 * dt;
    if (this.handbrake) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 11 * dt);
      grip = 1.5;
      braking = true;
    }
    vl *= Math.exp(-grip * dt);
    this.skidding = Math.abs(vl) > 3.2 && Math.abs(vf) > 4;

    this.steer += clamp(this.steerInput - this.steer, -dt * 5, dt * 5);
    const steerAngle = this.steer * (0.58 / (1 + Math.abs(vf) * 0.05));
    let yawRate = (vf * Math.tan(steerAngle)) / WHEELBASE;
    const yawLimit = (MAX_LATERAL_ACCEL * (this.handbrake ? 1.6 : 1)) / Math.max(Math.abs(vf), 4);
    yawRate = clamp(yawRate, -yawLimit, yawLimit);
    this.heading += yawRate * dt;

    this.velX = fx * vf - fz * vl;
    this.velZ = fz * vf + fx * vl;
    this.speed = vf;
    this.position.x += this.velX * dt;
    this.position.z += this.velZ * dt;
    this.collideWithWorld();

    const ground = groundHeight(this.position.x, this.position.z);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 14);
    this.roll += (clamp(-yawRate * vf * 0.006, -0.09, 0.09) - this.roll) * Math.min(1, dt * 6);
    const targetPitch = braking && vf > 2 ? 0.035 : this.throttle > 0 && vf < maxSpeed * 0.5 ? -0.025 : 0;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 5);
    this.mesh.rotation.set(this.pitch, this.heading, this.roll);
    for (const wheel of this.model.wheels) {
      wheel.children[0].rotation.x += (vf / 0.36) * dt;
      wheel.children[1].rotation.x = wheel.children[0].rotation.x;
      if (wheel.userData.front) wheel.rotation.y = steerAngle;
    }
    this.model.tailMaterial.color.setHex(braking ? TAIL_LAMP.braking : TAIL_LAMP.idle);
    if (this.model.lightBar) {
      const phase = this.siren ? Math.floor(this.game.time * 7) % 2 : -1;
      this.model.lightBar[0].color.setHex(phase === 0 ? 0xff2a2a : 0x551010);
      this.model.lightBar[1].color.setHex(phase === 1 ? 0x3a7bff : 0x101c55);
      flashSirenFlares(this.lights, phase);
    }
    this.effects(dt);
  }

  /** Push the body out of buildings and the world's edge, bleed the speed into the wall and take impact damage. */
  collideWithWorld() {
    const radius = this.spec.width * 0.55;
    for (const circle of this.bodyCircles()) {
      const hit = this.game.collision.resolveCircle(circle.x, circle.z, radius, 0.5);
      if (!hit) continue;
      this.position.x += hit.x;
      this.position.z += hit.z;
      const into = -(this.velX * hit.nx + this.velZ * hit.nz);
      if (into > 0) {
        this.velX += hit.nx * into * 1.25;
        this.velZ += hit.nz * into * 1.25;
        this.velX *= 0.985;
        this.velZ *= 0.985;
        // A glancing hit on the nose or tail swings the car along the wall.
        const side = this.forwardX() * hit.nz - this.forwardZ() * hit.nx;
        this.heading += clamp(side * circle.lever * into * 0.012, -0.08, 0.08);
        if (into > 5) this.impact(into, circle.x, circle.z);
      }
    }
    const b = WORLD_BOUNDS;
    if (this.position.x < b.minX) { this.position.x = b.minX; this.velX = Math.abs(this.velX) * 0.3; }
    if (this.position.x > b.maxX) { this.position.x = b.maxX; this.velX = -Math.abs(this.velX) * 0.3; }
    if (this.position.z < b.minZ) { this.position.z = b.minZ; this.velZ = Math.abs(this.velZ) * 0.3; }
    if (this.position.z > b.maxZ) { this.position.z = b.maxZ; this.velZ = -Math.abs(this.velZ) * 0.3; }
  }

  impact(strength, x, z) {
    this.damage((strength - 5) * 2.4);
    this.game.particles.sparks(x, 0.7, z, 6);
    if (this.driver === 'player') {
      this.game.audio.crash(Math.min(strength / 20, 1));
      this.game.camera.shake(Math.min(strength * 0.02, 0.5));
    }
  }

  damage(amount, byPlayer = false) {
    if (this.dead || amount <= 0) return;
    this.health -= amount;
    if (byPlayer) this.hitByPlayer = true;
    if (this.health <= 0 && this.burning === 0) this.burning = 0.001;
  }

  effects(dt) {
    const tailX = this.position.x - this.forwardX() * (this.spec.length * 0.5);
    const tailZ = this.position.z - this.forwardZ() * (this.spec.length * 0.5);
    if (this.skidding) {
      this.game.particles.tireSmoke(tailX, 0.2, tailZ);
      // A fresh pair of tyre streaks for every metre and a half slid.
      const slid = Math.hypot(this.position.x - this.markX, this.position.z - this.markZ);
      if (slid > 1.5) {
        if (slid < 4) this.game.skidMarks.lay(this, slid + 0.2);
        this.markX = this.position.x;
        this.markZ = this.position.z;
      }
    }
    if (this.tiresShredded && Math.abs(this.speed) > 6) this.game.particles.sparks(tailX, 0.15, tailZ, 1);
    if (this.boosting) this.game.particles.nitroFlame(tailX, 0.45, tailZ, this.velX, this.velZ);
    this.smoke(dt, false);
    if (this.burning > 0) {
      this.burning += dt;
      this.game.particles.fire(this.position.x + this.forwardX() * 1.4, 1.1, this.position.z + this.forwardZ() * 1.4);
      if (this.burning > 3.6) this.explode();
    }
  }

  smoke(dt, wreck) {
    if (!wreck && this.health > this.maxHealth * 0.4) return;
    if (wreck && this.deadTime > 14) return;
    this.smokeClock -= dt;
    if (this.smokeClock > 0) return;
    this.smokeClock = wreck ? 0.12 : 0.09;
    const dark = wreck || this.health < this.maxHealth * 0.2;
    this.game.particles.smoke(this.position.x + this.forwardX() * 1.5, 1.2, this.position.z + this.forwardZ() * 1.5, dark);
  }

  explode() {
    if (this.dead) return;
    this.dead = true;
    this.burning = 0;
    this.velX = 0;
    this.velZ = 0;
    this.speed = 0;
    this.siren = false;
    this.lights.rig.visible = false;
    this.mesh.traverse((part) => { if (part.isMesh && part.parent !== this.lights.rig) part.material = wreckMaterial; });
    this.mesh.rotation.z = 0.06;
    this.game.onVehicleExploded(this);
  }

  /** Condition for the HUD: 100 is factory fresh, 0 is about to burn. */
  conditionPercent() {
    return Math.max(0, Math.round((this.health / this.maxHealth) * 100));
  }

  /** A workshop visit: bodywork straight, engine healthy, fresh tyres. */
  repair() {
    this.health = this.maxHealth;
    this.tiresShredded = false;
    this.burning = 0;
  }

  /** A respray: rebuild the body in a new colour where it stands. */
  repaint(paint) {
    const old = this.mesh;
    this.paint = paint;
    this.model = buildVehicleModel(this.spec, paint);
    this.mesh = this.model.group;
    this.mesh.rotation.order = 'YXZ';
    this.mesh.traverse((part) => { if (part.isMesh) part.castShadow = true; });
    this.lights = attachVehicleLights(this.model, this.spec);
    this.mesh.position.copy(old.position);
    this.mesh.rotation.copy(old.rotation);
    this.position = this.mesh.position;
    this.game.scene.remove(old);
    old.children[0].geometry.dispose();
    this.game.scene.add(this.mesh);
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.mesh.children[0].geometry.dispose();
  }
}
