// Life on the water: sailboats and motor yachts off Playa Dorada that drift on the swell, and a container ship
// tied up at the Puerto Viejo docks.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher } from '../render/meshBatcher.js';

export class BoatsAtSea {
  constructor(scene) {
    const rng = new SeededRandom(CITY.seed + 909);
    this.boats = [];
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    for (let k = 0; k < 9; k += 1) {
      const batch = new MeshBatcher();
      if (k % 3 === 2) buildYacht(batch, rng); else buildSailboat(batch, rng);
      const mesh = batch.build(material);
      mesh.matrixAutoUpdate = true;
      mesh.position.set(rng.range(-420, -130), -0.5, rng.range(-20, CITY.depth + 40));
      mesh.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(mesh);
      this.boats.push({ mesh, phase: rng.range(0, 6), drift: rng.range(0.4, 1.2), heading: mesh.rotation.y });
    }
    const ship = new MeshBatcher();
    buildContainerShip(ship, rng);
    const shipMesh = ship.build(material);
    shipMesh.matrixAutoUpdate = true;
    shipMesh.position.set(430, -0.5, CITY.depth + 150);
    scene.add(shipMesh);
  }

  /** Rock every boat on the swell and let it creep along its heading, turning back before it leaves the bay. */
  update(dt, time) {
    for (const boat of this.boats) {
      const mesh = boat.mesh;
      mesh.rotation.z = Math.sin(time * 0.9 + boat.phase) * 0.06;
      mesh.rotation.x = Math.sin(time * 0.7 + boat.phase * 2) * 0.03;
      mesh.position.y = -0.5 + Math.sin(time * 1.1 + boat.phase) * 0.18;
      mesh.position.x += Math.sin(boat.heading) * boat.drift * dt;
      mesh.position.z += Math.cos(boat.heading) * boat.drift * dt;
      if (mesh.position.x > -120 || mesh.position.x < -460 || mesh.position.z < -60 || mesh.position.z > CITY.depth + 80) {
        boat.heading += Math.PI;
        mesh.rotation.y = boat.heading;
      }
    }
  }
}

function buildSailboat(batch, rng) {
  const hull = rng.pick(['#ffffff', '#1f6fd8', '#e74c3c', '#f5f0e1']);
  batch.addBox(0, 0, 0, 2.6, 1.3, 8.5, hull);
  batch.taperLastBox(1, 0.8);
  batch.addBox(0, 1.3, -0.6, 1.8, 0.8, 3, '#f5f0e1');
  batch.addBox(0, 1.3, 0.8, 0.16, 11, 0.16, '#d9d4c7');
  batch.addBox(0, 2.6, -1.4, 0.08, 8.4, 4.2, rng.pick(['#ffffff', '#ffe9b0', '#ffd1dc']));
  batch.taperLastBox(1, 0.1, 1.9);
  batch.addBox(0, 2.6, 2.4, 0.08, 6.4, 2.8, '#ffffff');
  batch.taperLastBox(1, 0.1, -1.3);
}

function buildYacht(batch, rng) {
  batch.addBox(0, 0, 0, 4.2, 1.8, 15, '#ffffff');
  batch.taperLastBox(1, 0.86);
  batch.addBox(0, 1.8, -1, 3.4, 1.5, 8, '#f2f4f7');
  batch.addBox(0, 2.1, -1, 3.45, 0.6, 7.4, '#1b2a38');
  batch.addBox(0, 3.3, -2, 2.6, 1.2, 4.4, '#ffffff');
  batch.addBox(0, 0.9, 0, 4.25, 0.3, 14.6, rng.pick(['#1fb5a6', '#ff5e5b', '#1f6fd8']));
}

function buildContainerShip(batch, rng) {
  const colors = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#e67e22', '#ecf0f1'];
  batch.addBox(0, 0, 0, 150, 9, 24, '#243447');
  batch.addBox(0, 2.2, 0, 150.4, 1.2, 24.4, '#b03a2e');
  batch.addBox(-58, 9, 0, 14, 16, 20, '#f2f4f7');
  batch.addBox(-58, 25, 0, 5, 7, 6, '#e67e22');
  for (let x = -42; x < 68; x += 12.6) {
    for (let z = -8.4; z <= 8.4; z += 2.8) {
      const levels = rng.int(1, 4);
      for (let level = 0; level < levels; level += 1) batch.addBox(x, 9 + level * 2.6, z, 12, 2.55, 2.6, rng.pick(colors));
    }
  }
}
