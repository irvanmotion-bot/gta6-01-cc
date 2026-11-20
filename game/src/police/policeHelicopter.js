// The police helicopter of three stars and up: it circles over the player with a searchlight and opens fire at four.
// In the dark of totality its searchlight is the only way the police find a Nova who keeps out of the light.
import * as THREE from 'three';
import { MeshBatcher } from '../render/meshBatcher.js';
import { distance2D } from '../core/random.js';

export class PoliceHelicopter {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.health = 400;
    this.orbit = 0;
    this.cooldown = 0;
    this.returnClock = 0;
    this.crashing = 0;
    this.aim = new THREE.Vector3();
    this.lastSeen = new THREE.Vector3();
    this.sweep = 0;
    this.searching = false;
    this.firedClock = 0;
    const batch = new MeshBatcher();
    // A white cabin with the force's blue band and yellow pinstripe, a dark glass nose, a blue tail boom with a
    // fin and stabiliser, and skids on struts: a police helicopter from any side, and from underneath.
    batch.addBox(0, -0.9, 0.2, 1.9, 1.9, 4.2, '#f4f6f7');
    batch.taperLastBox(0.8, 0.84, -0.2);
    batch.addBox(0, -0.62, 0.15, 1.96, 0.5, 4.0, '#2e6fd8');
    batch.addBox(0, -0.72, 0.15, 1.98, 0.12, 3.8, '#ffd60a');
    batch.addBox(0, -0.75, 2.2, 1.7, 1.45, 1.5, '#1b2a38');
    batch.taperLastBox(0.7, 0.55, -0.35);
    batch.addBox(0, -0.2, -4, 0.5, 0.55, 5, '#2e6fd8');
    batch.taperLastBox(0.7, 1, 0);
    batch.addBox(0, 0.1, -6.3, 0.16, 1.7, 1.0, '#2e6fd8');
    batch.addBox(0, 0.2, -5.6, 2.1, 0.08, 0.6, '#f4f6f7');
    batch.addBox(0, 1.0, 0.2, 0.3, 0.4, 0.3, '#30343a');
    batch.addBox(0, 0.95, 0.1, 1.1, 0.3, 2.2, '#dfe3e6');
    for (const side of [-1, 1]) {
      batch.addBox(side * 1.15, -1.75, 0.3, 0.14, 0.14, 4.4, '#22262b');
      for (const z of [-0.9, 1.5]) batch.addBox(side * 1.02, -1.7, z, 0.1, 0.85, 0.12, '#22262b');
    }
    this.mesh = new THREE.Group();
    const body = batch.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    body.matrixAutoUpdate = true;
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.07, 0.42), new THREE.MeshBasicMaterial({ color: 0x15171a }));
    this.rotor.position.y = 1.45;
    const rotorB = this.rotor.clone();
    rotorB.position.y = 0;
    rotorB.rotation.y = Math.PI / 2;
    // The blur of the turning blades: a faint dark disc, so the rotor reads from far off and against the sky.
    const blur = new THREE.Mesh(new THREE.CircleGeometry(5.75, 28), new THREE.MeshBasicMaterial({ color: 0x1b2026, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    blur.rotation.x = -Math.PI / 2;
    this.rotor.add(rotorB, blur);
    // The searchlight under the nose, lit whenever the beam is, and a red beacon under the belly.
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfffbe0, toneMapped: false }));
    this.lens.position.set(0, -1.15, 2.6);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }));
    beacon.position.set(0, -1.05, -1.2);
    this.mesh.add(this.lens, beacon);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.16), new THREE.MeshBasicMaterial({ color: 0x15171a }));
    this.tailRotor.position.set(0.2, 0.2, -6.3);
    // A narrow shaft: the walking camera stays outside it, so it reads as a beam on Nova and never as a haze round the lens.
    const beamGeometry = new THREE.ConeGeometry(2.3, HOVER_HEIGHT, 20, 1, true);
    beamGeometry.translate(0, -HOVER_HEIGHT / 2, 0);
    this.beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0xfff6cf, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.renderOrder = 3;
    this.mesh.add(body, this.rotor, this.tailRotor);
    this.mesh.scale.setScalar(1.6);
    this.mesh.visible = false;
    this.beam.visible = false;
    this.mesh.traverse((part) => { if (part.isMesh) part.castShadow = true; });
    // The searchlight really lights the street: a spot lamp on the nose and a bright pool on the ground under it.
    this.lamp = new THREE.SpotLight(0xfff3c4, 0, 90, 0.3, 0.5, 1.2);
    this.lamp.visible = false;
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.visible = false;
    this.pool.renderOrder = 3;
    game.scene.add(this.mesh, this.beam, this.lamp, this.lamp.target, this.pool);
  }

  /** Switch the searchlight's beam, lamp and ground pool on or off together. */
  setSearchlight(on) {
    this.beam.visible = on;
    this.lens.visible = on;
    this.lamp.visible = on;
    this.pool.visible = on;
  }

  distanceToPlayer() {
    const player = this.game.player.position;
    return distance2D(this.mesh.position.x, this.mesh.position.z, player.x, player.z);
  }

  /**
   * Whether the crew can see Nova from up there: in range, and no building tall enough to stand between the cabin
   * and her. Pressed against the far wall of a tower she is out of its sight, as she is from a car in the next street.
   */
  seesPlayer(range) {
    if (!this.active) return false;
    const player = this.game.player.position;
    const from = this.mesh.position;
    const flat = distance2D(from.x, from.z, player.x, player.z);
    if (flat > range) return false;
    const dx = player.x - from.x;
    const dy = player.y + 1.2 - from.y;
    const dz = player.z - from.z;
    const reach = Math.hypot(dx, dy, dz) || 1;
    return this.game.collision.raycast(from.x, from.y, from.z, dx / reach, dy / reach, dz / reach, reach - 1, 1.5) >= reach - 1;
  }

  /** What the dispatch panel prints for the helicopter: its gun when it has just fired, its lamp, or the sweep. */
  tacticLabel() {
    if (this.searching) return 'SWEEPING';
    return this.firedClock > 0 ? 'GUNSHIP' : 'SPOTLIGHT';
  }

  /** Bring it in from over the hills. */
  scramble() {
    const player = this.game.player.position;
    this.active = true;
    this.health = 400;
    this.crashing = 0;
    this.mesh.visible = true;
    this.setSearchlight(true);
    this.aim.copy(player);
    this.lastSeen.copy(player);
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
    this.firedClock = Math.max(0, this.firedClock - dt);
    // With every unit's eyes off her, the helicopter circles the place she was last seen and sweeps it with its lamp.
    const wanted = game.wanted;
    this.searching = wanted.evading || game.darkness.isHidden();
    // Lead a fast car, so the helicopter holds its place over the chase instead of trailing behind it.
    // Over a car chase it comes down low and close, where its lamp can hold the car and its gunner can see it.
    const car = wanted.evading ? null : player.vehicle;
    const centre = wanted.evading ? wanted.lastSeen : player.position;
    const radius = car ? CHASE_ORBIT.radius : ORBIT_RADIUS;
    const hover = car ? CHASE_ORBIT.height : HOVER_HEIGHT;
    const goalX = centre.x + Math.cos(this.orbit) * radius + (car ? car.velX * CHASE_ORBIT.lead : 0);
    const goalZ = centre.z + Math.sin(this.orbit) * radius + (car ? car.velZ * CHASE_ORBIT.lead : 0);
    const ease = Math.min(1, dt * 1.3);
    mesh.position.x += (goalX - mesh.position.x) * ease;
    mesh.position.z += (goalZ - mesh.position.z) * ease;
    mesh.position.y += (hover + Math.sin(game.time * 0.8) * 1.5 - mesh.position.y) * ease;
    const face = Math.atan2(player.position.x - mesh.position.x, player.position.z - mesh.position.z);
    mesh.rotation.set(0.16, face, Math.sin(game.time * 0.6) * 0.06);
    // The searchlight is a cone from the nose down to where the crew is looking. In daylight that is Nova. In the
    // dark, a Nova with no light on her is lost: the beam sweeps the streets round where she was last seen, and
    // finds her again only if its pool of light crosses her.
    const cover = game.darkness;
    const aim = this.aim;
    if (this.searching) {
      if (wanted.evading) this.lastSeen.set(wanted.lastSeen.x, 0, wanted.lastSeen.z);
      this.sweep += dt;
      const goalAimX = this.lastSeen.x + Math.sin(this.sweep * 0.9) * SWEEP_REACH;
      const goalAimZ = this.lastSeen.z + Math.sin(this.sweep * 0.63 + 1.3) * SWEEP_REACH;
      aim.x += (goalAimX - aim.x) * Math.min(1, dt * 1.6);
      aim.z += (goalAimZ - aim.z) * Math.min(1, dt * 1.6);
      aim.y = 0;
      if (distance2D(aim.x, aim.z, player.position.x, player.position.z) < POOL_RADIUS) cover.noteSearchlight();
    } else {
      // In the dark the crew swings the lamp by hand: it lags a running Nova, who can get out from under it.
      const tracking = cover.isDark() ? 1.3 : 9;
      aim.x += (player.position.x - aim.x) * Math.min(1, dt * tracking);
      aim.z += (player.position.z - aim.z) * Math.min(1, dt * tracking);
      aim.y = player.position.y;
      this.lastSeen.copy(player.position);
      if (cover.isDark() && distance2D(aim.x, aim.z, player.position.x, player.position.z) < POOL_RADIUS) cover.noteSearchlight();
    }
    this.beam.position.copy(mesh.position);
    this.beam.position.y -= 1;
    const reach = new THREE.Vector3(aim.x - mesh.position.x, aim.y - mesh.position.y + 1, aim.z - mesh.position.z);
    this.beam.scale.set(1, reach.length() / HOVER_HEIGHT, 1);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), reach.normalize());
    const night = game.sky.night;
    this.beam.material.opacity = 0.19 + night * 0.11;
    this.lamp.position.copy(this.beam.position);
    this.lamp.target.position.set(aim.x, aim.y, aim.z);
    // By day the lamp only warms what it touches; in the dark it is the brightest thing in the street.
    this.lamp.intensity = 90 + night * 890;
    this.pool.position.set(aim.x, aim.y + 0.12, aim.z);
    this.pool.material.opacity = 0.09 + night * 0.31;

    this.cooldown -= dt;
    if (stars >= 4 && this.cooldown <= 0 && player.alive && !this.searching) {
      this.cooldown = 0.3 + Math.random() * 0.5;
      this.firedClock = 2.5;
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

/** How far from Nova's last known place the searchlight sweeps, and how wide its pool of light is on the ground. */
const SWEEP_REACH = 24;
const POOL_RADIUS = 3.6;
const HOVER_HEIGHT = 26;
const ORBIT_RADIUS = 46;
/**
 * Its station over a car chase: the ring it circles on, how high, and how many seconds of the car's travel it aims
 * ahead. It eases toward that point and so trails it by most of a second, which leaves it a little ahead of the car.
 */
const CHASE_ORBIT = { radius: 26, height: 17, lead: 1.2 };
