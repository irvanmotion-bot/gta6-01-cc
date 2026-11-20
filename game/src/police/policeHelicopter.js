// The police helicopter of three stars and up: it circles over the player with a searchlight and opens fire at four.
import * as THREE from 'three';
import { MeshBatcher } from '../render/meshBatcher.js';
import { distance2D } from '../core/random.js';

const HOVER_HEIGHT = 26;
const ORBIT_RADIUS = 46;

export class PoliceHelicopter {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.health = 400;
    this.orbit = 0;
    this.cooldown = 0;
    this.returnClock = 0;
    this.crashing = 0;
    const batch = new MeshBatcher();
    batch.addBox(0, -0.9, 0.2, 1.9, 1.9, 4.2, '#f4f6f7');
    batch.addBox(0, -0.5, 1.9, 1.7, 1.2, 1.4, '#1b2a38');
    batch.addBox(0, -0.2, -4, 0.45, 0.5, 5, '#2e6fd8');
    batch.addBox(0, 0.1, -6.3, 0.14, 1.6, 0.9, '#2e6fd8');
    batch.addBox(0, -1.5, 0.2, 2.2, 0.1, 3.2, '#30343a');
    batch.addBox(0, 1.0, 0.2, 0.25, 0.35, 0.25, '#30343a');
    this.mesh = new THREE.Group();
    const body = batch.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    body.matrixAutoUpdate = true;
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.06, 0.34), new THREE.MeshBasicMaterial({ color: 0x15171a }));
    this.rotor.position.y = 1.35;
    const rotorB = this.rotor.clone();
    rotorB.position.y = 0;
    rotorB.rotation.y = Math.PI / 2;
    this.rotor.add(rotorB);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.16), new THREE.MeshBasicMaterial({ color: 0x15171a }));
    this.tailRotor.position.set(0.2, 0.2, -6.3);
    const beamGeometry = new THREE.ConeGeometry(7, HOVER_HEIGHT, 18, 1, true);
    beamGeometry.translate(0, -HOVER_HEIGHT / 2, 0);
    this.beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0xfff6cf, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.add(body, this.rotor, this.tailRotor);
    this.mesh.visible = false;
    this.beam.visible = false;
    this.mesh.traverse((part) => { if (part.isMesh) part.castShadow = true; });
    // The searchlight really lights the street: a spot lamp on the nose and a bright pool on the ground under it.
    this.lamp = new THREE.SpotLight(0xfff3c4, 0, 90, 0.3, 0.5, 1.2);
    this.lamp.visible = false;
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 28), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.visible = false;
    this.pool.renderOrder = 3;
    game.scene.add(this.mesh, this.beam, this.lamp, this.lamp.target, this.pool);
  }

  /** Switch the searchlight's beam, lamp and ground pool on or off together. */
  setSearchlight(on) {
    this.beam.visible = on;
    this.lamp.visible = on;
    this.pool.visible = on;
  }

  distanceToPlayer() {
    const player = this.game.player.position;
    return distance2D(this.mesh.position.x, this.mesh.position.z, player.x, player.z);
  }

  /** Bring it in from over the hills. */
  scramble() {
    const player = this.game.player.position;
    this.active = true;
    this.health = 400;
    this.crashing = 0;
    this.mesh.visible = true;
    this.setSearchlight(true);
    this.mesh.position.set(player.x + 150, HOVER_HEIGHT + 30, player.z - 120);
    this.mesh.rotation.set(0, 0, 0);
  }

  dismiss(instant = false) {
    if (!this.active && !instant) return;
    this.active = false;
    this.setSearchlight(false);
    if (instant) this.mesh.visible = false;
  }

  damage(amount) {
    if (!this.active) return;
    this.health -= amount;
    this.game.wanted.reportCrime('shootPolice');
    if (this.health <= 0) {
      this.active = false;
      this.setSearchlight(false);
      this.crashing = 0.001;
      this.returnClock = 45;
      this.game.stats.choppersDowned += 1;
      this.game.hud.notify('Police helicopter down!');
    }
  }

  update(dt, stars) {
    const game = this.game;
    const mesh = this.mesh;
    this.rotor.rotation.y += dt * 28;
    this.tailRotor.rotation.x += dt * 40;
    this.returnClock -= dt;
    if (this.crashing > 0) {
      this.crashing += dt;
      mesh.position.y -= (6 + this.crashing * 9) * dt;
      mesh.rotation.y += dt * 5;
      game.particles.smoke(mesh.position.x, mesh.position.y, mesh.position.z, true);
      if (mesh.position.y < 1.5) {
        this.crashing = 0;
        mesh.visible = false;
        game.detonate(mesh.position.x, mesh.position.z, true);
      }
      return;
    }
    if (!this.active) {
      if (stars >= 3 && this.returnClock <= 0) this.scramble();
      else if (mesh.visible) {
        // Called off: climb away east until out of sight.
        mesh.position.x += 30 * dt;
        mesh.position.y += 9 * dt;
        mesh.rotation.y = Math.PI / 2;
        if (mesh.position.y > 150) mesh.visible = false;
      }
      return;
    }
    if (stars < 3) { this.dismiss(); return; }
    const player = game.player;
    this.orbit += dt * 0.22;
    const goalX = player.position.x + Math.cos(this.orbit) * ORBIT_RADIUS;
    const goalZ = player.position.z + Math.sin(this.orbit) * ORBIT_RADIUS;
    const ease = Math.min(1, dt * 1.3);
    mesh.position.x += (goalX - mesh.position.x) * ease;
    mesh.position.z += (goalZ - mesh.position.z) * ease;
    mesh.position.y += (HOVER_HEIGHT + Math.sin(game.time * 0.8) * 1.5 - mesh.position.y) * ease;
    const face = Math.atan2(player.position.x - mesh.position.x, player.position.z - mesh.position.z);
    mesh.rotation.set(0.16, face, Math.sin(game.time * 0.6) * 0.06);
    // The searchlight is a cone from the nose down to the player.
    this.beam.position.copy(mesh.position);
    this.beam.position.y -= 1;
    const reach = new THREE.Vector3(player.position.x - mesh.position.x, player.position.y - mesh.position.y + 1, player.position.z - mesh.position.z);
    this.beam.scale.set(1, reach.length() / HOVER_HEIGHT, 1);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), reach.normalize());
    const night = game.sky.night;
    this.beam.material.opacity = 0.13 + night * 0.16;
    this.lamp.position.copy(this.beam.position);
    this.lamp.target.position.set(player.position.x, player.position.y, player.position.z);
    this.lamp.intensity = 900 + night * 5200;
    this.pool.position.set(player.position.x, player.position.y + 0.12, player.position.z);
    this.pool.material.opacity = 0.1 + night * 0.3;

    this.cooldown -= dt;
    if (stars >= 4 && this.cooldown <= 0 && player.alive) {
      this.cooldown = 0.3 + Math.random() * 0.5;
      const hit = Math.random() < 0.13;
      const from = new THREE.Vector3(mesh.position.x, mesh.position.y - 1.4, mesh.position.z);
      const to = new THREE.Vector3(player.position.x + (hit ? 0 : (Math.random() - 0.5) * 7), player.position.y + 0.8, player.position.z + (hit ? 0 : (Math.random() - 0.5) * 7));
      game.particles.tracer(from, to, 0xbfd8ff);
      game.particles.dust(to.x, 0.1, to.z);
      game.audio.gunshot('distant', 0.5);
      if (hit) player.takeDamage(6, 'bullet');
    }
  }
}
