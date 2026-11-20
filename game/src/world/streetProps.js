// Street furniture: palms and shade trees, lamp posts that glow at night, working traffic lights and the park.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { blockRect, districtOfBlock } from './cityLayout.js';
import { lightState } from './roadNetwork.js';

const P = CITY.pitch;
const trunkShape = new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
const canopyShape = new THREE.IcosahedronGeometry(1, 0);
const LAMP_COLORS = { red: [0xff3b30, 0x3a0d0b], amber: [0xffc400, 0x3a2e05], green: [0x30e070, 0x0a3018] };

export class StreetProps {
  constructor(scene) {
    this.rng = new SeededRandom(CITY.seed + 11);
    this.props = new MeshBatcher();
    this.lampHeads = new MeshBatcher();
    this.lampSpots = [];
    this.signalLamps = {};
    this.signalMaterials = {};
    for (const axis of ['ns', 'ew']) {
      for (const color of ['red', 'amber', 'green']) {
        this.signalLamps[`${axis}_${color}`] = new MeshBatcher();
        this.signalMaterials[`${axis}_${color}`] = new THREE.MeshBasicMaterial({ color: LAMP_COLORS[color][1] });
      }
    }
    for (let z = 12; z < CITY.depth; z += 16) {
      this.addPalm(-8.6, z, 0.22);
      if (z % 32 === 12) this.addStreetLamp(-7.4, z, 1, 0);
    }
    for (let i = 0; i < CITY.roadsX - 1; i += 1) {
      for (let j = 0; j < CITY.roadsZ - 1; j += 1) this.decorateBlock(i, j, districtOfBlock(i, j));
    }
    for (let i = 0; i < CITY.roadsX; i += 1) {
      for (let j = 0; j < CITY.roadsZ; j += 1) this.addTrafficLights(i * P, j * P);
    }
    scene.add(this.props.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })));
    this.lampMaterial = new THREE.MeshBasicMaterial({ color: 0x777066 });
    scene.add(this.lampHeads.build(this.lampMaterial, { castShadow: false, receiveShadow: false }));
    for (const key of Object.keys(this.signalLamps)) {
      scene.add(this.signalLamps[key].build(this.signalMaterials[key], { castShadow: false, receiveShadow: false }));
    }
  }

  addPalm(x, z, base) {
    const rng = this.rng;
    const height = rng.range(7.5, 11.5);
    const lean = rng.range(-0.08, 0.08);
    this.props.addGeometry(trunkShape, placement(x, base + height / 2, z, 0, 1, height, 1, lean, lean), '#9c7a54');
    const turn = rng.range(0, Math.PI);
    for (let k = 0; k < 7; k += 1) {
      const angle = turn + (k / 7) * Math.PI * 2;
      const reach = rng.range(2.6, 3.6);
      const matrix = placement(x + Math.sin(angle) * reach * 0.5 + lean * height, base + height - 0.35, z + Math.cos(angle) * reach * 0.5 + lean * height, angle, 0.7, 0.08, reach, 0.42);
      this.props.addBox(0, -0.5, 0, 1, 1, 1, k % 2 ? '#3f9b4b' : '#4fb35a');
      // Re-place the unit box just added with the frond's own matrix.
      this.retransformLastBox(matrix);
    }
    this.props.addGeometry(canopyShape, placement(x + lean * height, base + height - 0.2, z + lean * height, 0, 0.5, 0.4, 0.5), '#6b4f2e');
  }

  /** Move the last 24 vertices (one unit box at the origin) by a full matrix: fronds need a tilt addBox cannot give. */
  retransformLastBox(matrix) {
    const positions = this.props.positions;
    const normals = this.props.normals;
    const start = positions.length - 72;
    const point = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    for (let k = start; k < positions.length; k += 3) {
      point.set(positions[k], positions[k + 1], positions[k + 2]).applyMatrix4(matrix);
      positions[k] = point.x; positions[k + 1] = point.y; positions[k + 2] = point.z;
      point.set(normals[k], normals[k + 1], normals[k + 2]).applyMatrix3(normalMatrix).normalize();
      normals[k] = point.x; normals[k + 1] = point.y; normals[k + 2] = point.z;
    }
  }

  addShadeTree(x, z, base, scale = 1) {
    const rng = this.rng;
    const height = rng.range(3, 4.4) * scale;
    this.props.addGeometry(trunkShape, placement(x, base + height / 2, z, 0, 1.3, height, 1.3), '#6e5238');
    const size = rng.range(2.1, 3) * scale;
    this.props.addGeometry(canopyShape, placement(x, base + height + size * 0.55, z, rng.range(0, 3), size, size * 0.85, size), rng.pick(['#3f8f3f', '#4fa34a', '#5cab52', '#2f7d3b', '#e06a9a']));
  }

  /** A lamp post whose arm reaches (dx, dz) over the road. */
  addStreetLamp(x, z, dx, dz) {
    this.props.addBox(x, CITY.curb, z, 0.18, 7, 0.18, '#4a4f55');
    this.props.addBox(x + dx * 1.1, 7.1, z + dz * 1.1, dx ? 2.4 : 0.14, 0.14, dz ? 2.4 : 0.14, '#4a4f55');
    this.lampHeads.addBox(x + dx * 2.1, 6.86, z + dz * 2.1, 0.7, 0.2, 0.7, '#ffffff');
    this.lampSpots.push({ x: x + dx * 2.1, y: 6.8, z: z + dz * 2.1 });
  }

  decorateBlock(i, j, district) {
    const rng = this.rng;
    const rect = blockRect(i, j);
    if (district === 'jardin') { this.plantPark(rect); return; }
    const edge = 0.9;
    for (let t = 9; t < rect.maxX - rect.minX - 6; t += 13) {
      const lamp = Math.round(t / 13) % 3 === 1;
      const spots = [
        [rect.minX + t, rect.minZ + edge, 0, -1], [rect.minX + t, rect.maxZ - edge, 0, 1],
        [rect.minX + edge, rect.minZ + t, -1, 0], [rect.maxX - edge, rect.minZ + t, 1, 0],
      ];
      for (const [x, z, dx, dz] of spots) {
        if (lamp) this.addStreetLamp(x, z, dx, dz);
        else if (district === 'playa') this.addPalm(x, z, CITY.curb);
        else if (district === 'puerto') { if (rng.chance(0.15)) this.addShadeTree(x, z, CITY.curb, 0.8); }
        else if (district === 'centro') { if (rng.chance(0.5)) this.addPalm(x, z, CITY.curb); else if (rng.chance(0.4)) this.addShadeTree(x, z, CITY.curb, 0.8); }
        else if (rng.chance(0.62)) { if (rng.chance(0.3)) this.addPalm(x, z, CITY.curb); else this.addShadeTree(x, z, CITY.curb); }
      }
    }
    if (district === 'colinas') {
      for (let k = 0; k < 7; k += 1) this.addShadeTree(rng.range(rect.minX + 8, rect.maxX - 8), rng.range(rect.minZ + 8, rect.maxZ - 8), CITY.curb, 1.2);
    }
  }

  /** Jardín del Sol: lawns, crossing paths, a fountain plaza, benches and a grove of trees. */
  plantPark(rect) {
    const rng = this.rng;
    const cx = (rect.minX + rect.maxX) / 2;
    const cz = (rect.minZ + rect.maxZ) / 2;
    this.props.addFlat(cx, CITY.curb + 0.06, cz, 4, rect.maxZ - rect.minZ - 2, '#e2d2a8');
    this.props.addFlat(cx, CITY.curb + 0.06, cz, rect.maxX - rect.minX - 2, 4, '#e2d2a8');
    const basin = new THREE.CylinderGeometry(5, 5.4, 0.8, 14);
    this.props.addGeometry(basin, placement(cx, CITY.curb + 0.4, cz), '#d8d2c4');
    this.props.addGeometry(basin, placement(cx, CITY.curb + 0.52, cz, 0, 0.9, 0.8, 0.9), '#4fc3e8');
    this.props.addGeometry(trunkShape, placement(cx, CITY.curb + 1.6, cz, 0, 2.4, 3, 2.4), '#e8e2d4');
    for (let k = 0; k < 26; k += 1) {
      const x = rng.range(rect.minX + 4, rect.maxX - 4);
      const z = rng.range(rect.minZ + 4, rect.maxZ - 4);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || Math.hypot(x - cx, z - cz) < 9) continue;
      if (rng.chance(0.3)) this.addPalm(x, z, CITY.curb); else this.addShadeTree(x, z, CITY.curb, 1.3);
    }
    for (const [bx, bz] of [[cx - 9, cz - 3.2], [cx + 9, cz + 3.2], [cx - 3.2, cz + 12], [cx + 3.2, cz - 12]]) {
      this.props.addBox(bx, CITY.curb, bz, 2, 0.5, 0.6, '#8a5a3a');
    }
  }

  /** Four signal posts at an intersection, one facing each approach from its near-right corner. */
  addTrafficLights(x, z) {
    const corner = CITY.road / 2 + 0.7;
    const approaches = [
      ['ns', x - corner, z - corner, 0, -1], ['ns', x + corner, z + corner, 0, 1],
      ['ew', x - corner, z + corner, -1, 0], ['ew', x + corner, z - corner, 1, 0],
    ];
    for (const [axis, px, pz, fx, fz] of approaches) {
      if (px < -8 || pz < -8 || px > CITY.width + 8 || pz > CITY.depth + 8) continue;
      this.props.addBox(px, 0, pz, 0.2, 5.4, 0.2, '#30343a');
      this.props.addBox(px, 4, pz, 0.5, 1.5, 0.5, '#22252a');
      ['green', 'amber', 'red'].forEach((color, index) => {
        this.signalLamps[`${axis}_${color}`].addBox(px + fx * 0.27, 4.15 + index * 0.44, pz + fz * 0.27, fx ? 0.08 : 0.3, 0.3, fz ? 0.08 : 0.3, '#ffffff');
      });
    }
  }

  /** Switch the signal lamps to the current phase and glow the street lamps at night. */
  update(time, night) {
    for (const axis of ['ns', 'ew']) {
      const state = lightState(axis, time);
      const lit = state === 'go' ? 'green' : state === 'slow' ? 'amber' : 'red';
      for (const color of ['red', 'amber', 'green']) {
        this.signalMaterials[`${axis}_${color}`].color.setHex(LAMP_COLORS[color][color === lit ? 0 : 1]);
      }
    }
    this.lampMaterial.color.setRGB(0.47 + night * 0.53, 0.44 + night * 0.5, 0.4 + night * 0.3);
  }
}
