// The glowing beams and ground rings that mark mission starts, objectives, checkpoints and shop doors in the world.
import * as THREE from 'three';
import { groundHeight } from './cityLayout.js';

const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
beamGeometry.translate(0, 0.5, 0);
const ringGeometry = new THREE.RingGeometry(0.82, 1, 28);
ringGeometry.rotateX(-Math.PI / 2);

export class WorldMarkers {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.used = 0;
    this.time = 0;
  }

  /** Forget last frame's markers; systems then call `show` for each marker they want this frame. */
  begin(dt) {
    this.used = 0;
    this.time += dt;
  }

  show(x, z, color, radius = 2.2, height = 26) {
    if (this.used === this.pool.length) {
      const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      beam.renderOrder = 3;
      ring.renderOrder = 3;
      this.scene.add(beam, ring);
      this.pool.push({ beam, ring });
    }
    const marker = this.pool[this.used];
    this.used += 1;
    const y = groundHeight(x, z) + 0.06;
    const pulse = 1 + Math.sin(this.time * 4) * 0.06;
    marker.beam.visible = true;
    marker.ring.visible = true;
    marker.beam.material.color.set(color);
    marker.ring.material.color.set(color);
    marker.beam.position.set(x, y, z);
    marker.beam.scale.set(radius * 0.92, height, radius * 0.92);
    marker.ring.position.set(x, y, z);
    marker.ring.scale.set(radius * pulse, 1, radius * pulse);
  }

  /** Hide whatever was not asked for this frame. */
  end() {
    for (let index = this.used; index < this.pool.length; index += 1) {
      this.pool[index].beam.visible = false;
      this.pool[index].ring.visible = false;
    }
  }
}
