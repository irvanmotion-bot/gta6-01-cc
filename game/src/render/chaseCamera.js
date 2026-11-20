// The third-person camera: mouse orbit on foot, a chase view that settles behind the car, wall avoidance and shake.
import * as THREE from 'three';
import { angleDelta, clamp } from '../core/random.js';

export class ChaseCamera {
  constructor(aspect) {
    this.view = new THREE.PerspectiveCamera(62, aspect, 0.3, 2600);
    this.yaw = 0;
    this.pitch = 0.2;
    this.distance = 5;
    this.sensitivity = 1;
    this.idleLook = 0;
    this.shakeAmount = 0;
    this.target = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, 1);
  }

  shake(amount) {
    this.shakeAmount = Math.min(1, Math.max(this.shakeAmount, amount));
  }

  /** Put the camera straight behind a heading (after a load, a respawn or entering a car). */
  snapBehind(heading) {
    this.yaw = heading;
    this.pitch = 0.2;
    this.snap = true;
  }

  update(dt, game) {
    const input = game.input;
    const player = game.player;
    const vehicle = player.vehicle;
    const moved = Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 0;
    this.yaw -= input.mouseDX * 0.0024 * this.sensitivity;
    this.pitch = clamp(this.pitch + input.mouseDY * 0.002 * this.sensitivity, -0.55, 1.15);
    this.idleLook = moved ? 0 : this.idleLook + dt;

    let wanted;
    let height;
    if (vehicle) {
      wanted = 6.2 + vehicle.spec.length * 0.75;
      height = vehicle.spec.height + 0.7;
      // With the mouse still, swing round behind the car; look back while reversing.
      if (this.idleLook > 1.1 && Math.abs(vehicle.speed) > 2.5) {
        const behind = vehicle.speed < -2.5 ? vehicle.heading + Math.PI : vehicle.heading;
        this.yaw += angleDelta(this.yaw, behind) * Math.min(1, dt * 3.2);
        this.pitch += (0.17 - this.pitch) * Math.min(1, dt * 2);
      }
    } else {
      wanted = player.aiming ? 3.3 : 5;
      height = 1.66;
    }
    this.distance += (wanted - this.distance) * Math.min(1, dt * 6);

    const cosPitch = Math.cos(this.pitch);
    this.direction.set(Math.sin(this.yaw) * cosPitch, -Math.sin(this.pitch), Math.cos(this.yaw) * cosPitch);
    const shoulder = vehicle ? 0 : player.aiming ? 0.9 : 0.5;
    const focusX = player.position.x - Math.cos(this.yaw) * shoulder;
    const focusY = player.position.y + height;
    const focusZ = player.position.z + Math.sin(this.yaw) * shoulder;
    if (this.snap) { this.target.set(focusX, focusY, focusZ); this.snap = false; }
    const follow = Math.min(1, dt * (vehicle ? 14 : 18));
    this.target.x += (focusX - this.target.x) * follow;
    this.target.y += (focusY - this.target.y) * follow;
    this.target.z += (focusZ - this.target.z) * follow;

    // Pull in when a building stands between the camera and its target.
    const clear = game.collision.raycast(this.target.x, this.target.y, this.target.z, -this.direction.x, -this.direction.y, -this.direction.z, this.distance, 0.4);
    const distance = Math.max(0.8, clear - 0.3);
    const view = this.view;
    view.position.set(this.target.x - this.direction.x * distance, Math.max(this.target.y - this.direction.y * distance, 0.35), this.target.z - this.direction.z * distance);
    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount * 0.5;
      view.position.x += (Math.random() - 0.5) * s;
      view.position.y += (Math.random() - 0.5) * s;
      view.position.z += (Math.random() - 0.5) * s;
      this.shakeAmount *= Math.exp(-dt * 5);
    }
    view.lookAt(view.position.x + this.direction.x * 10, view.position.y + this.direction.y * 10, view.position.z + this.direction.z * 10);
    const speedShare = vehicle ? clamp(Math.abs(vehicle.speed) / 50, 0, 1) : 0;
    const fov = (player.aiming && !vehicle ? 50 : 62) + speedShare * 16;
    if (Math.abs(view.fov - fov) > 0.05) {
      view.fov += (fov - view.fov) * Math.min(1, dt * 5);
      view.updateProjectionMatrix();
    }
  }
}
