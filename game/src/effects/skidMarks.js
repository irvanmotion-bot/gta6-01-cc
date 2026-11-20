// Tyre marks: every sliding car lays dark streaks on the asphalt under its rear wheels. The streaks are instances
// of one small quad, recycled oldest first, so the whole city's rubber draws in one call.
import * as THREE from 'three';

export class SkidMarks {
  constructor(scene) {
    const shape = new THREE.PlaneGeometry(0.3, 1);
    shape.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(shape, new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: 0.5, depthWrite: false }), MARK_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.next = 0;
    this.scratch = new THREE.Object3D();
    this.clear();
    scene.add(this.mesh);
  }

  /** Lay one pair of streaks behind a car: a stretch of `length` metres ending at its rear wheels. */
  lay(vehicle, length) {
    const fx = vehicle.forwardX();
    const fz = vehicle.forwardZ();
    const back = vehicle.spec.length * 0.32 + length / 2;
    for (const side of [-1, 1]) {
      const offset = side * (vehicle.spec.width / 2 - 0.2);
      this.scratch.position.set(vehicle.position.x - fx * back + fz * offset, vehicle.position.y + 0.03, vehicle.position.z - fz * back - fx * offset);
      this.scratch.rotation.set(0, Math.atan2(vehicle.velX, vehicle.velZ), 0);
      this.scratch.scale.set(1, 1, length);
      this.scratch.updateMatrix();
      this.mesh.setMatrixAt(this.next, this.scratch.matrix);
      this.next = (this.next + 1) % MARK_COUNT;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Wash the streets clean: a new game or a load. */
  clear() {
    this.scratch.position.set(0, -50, 0);
    this.scratch.scale.set(0, 0, 0);
    this.scratch.updateMatrix();
    for (let index = 0; index < MARK_COUNT; index += 1) this.mesh.setMatrixAt(index, this.scratch.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.next = 0;
  }
}

const MARK_COUNT = 480;
