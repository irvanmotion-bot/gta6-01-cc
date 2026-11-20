// Builds each car's low-poly body from its catalog entry: shell, cabin glass, lights, wheels, taxi sign or police light bar.
import * as THREE from 'three';
import { MeshBatcher } from '../render/meshBatcher.js';

const wheelGeometry = buildWheelGeometry();
const wheelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const lightBarGeometry = new THREE.BoxGeometry(1, 0.2, 0.32);

/** One wheel as a single shape: the tyre, a bright rim and a cross of spokes that shows it turning. */
function buildWheelGeometry() {
  const parts = new MeshBatcher();
  const turned = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  parts.addGeometry(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), turned, '#15171a');
  parts.addGeometry(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10), turned, '#c8ccd0');
  parts.addBox(0, -0.27, 0, 0.32, 0.54, 0.09, '#8d949b');
  parts.addBox(0, -0.045, 0, 0.32, 0.09, 0.54, '#8d949b');
  return parts.build(null).geometry;
}
/** Every car body shares this lacquer; main.js hands it the sky to reflect. */
export const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.3 });
const GLASS = '#16242f';
/** Tail lamp colours: running and under braking. */
export const TAIL_LAMP = { idle: 0xb81414, braking: 0xff4a30 };

/** Cabin proportions per body shape: [start, end] along the length (0 = rear, 1 = nose), and the shell's height share. */
const SHAPES = {
  hatch: { cabin: [0.06, 0.72], shell: 0.52, bed: false, rake: [0.84, 0.74, -0.04] },
  sedan: { cabin: [0.16, 0.72], shell: 0.5, bed: false, rake: [0.84, 0.64, -0.03] },
  coupe: { cabin: [0.16, 0.66], shell: 0.52, bed: false, rake: [0.82, 0.58, -0.06] },
  sports: { cabin: [0.2, 0.68], shell: 0.55, bed: false, rake: [0.8, 0.5, -0.07] },
  suv: { cabin: [0.04, 0.74], shell: 0.5, bed: false, rake: [0.88, 0.8, -0.03] },
  pickup: { cabin: [0.4, 0.76], shell: 0.48, bed: true, rake: [0.88, 0.7, -0.02] },
  van: { cabin: [0.03, 0.9], shell: 0.45, bed: false, rake: [0.92, 0.9, -0.03] },
};

function shade(hex, amount) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(amount);
  return `#${color.getHexString()}`;
}

/** The small parts every body carries: wheel arches, a crease and sills, door seams, mirrors, grille and plates. */
function addBodyTrim(batch, spec, shape, paint, frame) {
  const { length, width } = spec;
  const { at, clearance, shellHeight, cabinEnd, cabinStart, cabinCenter } = frame;
  for (const side of [-1, 1]) {
    const flank = side * (width / 2 - 0.01);
    for (const t of [0.82, 0.18]) batch.addBox(flank, clearance - 0.08, at(t), 0.09, 0.52, 0.98, '#121416');
    batch.addBox(flank, clearance + shellHeight * 0.78, 0, 0.05, 0.05, length * 0.9, shade(paint, 1.18));
    batch.addBox(flank, clearance + 0.02, 0, 0.06, 0.12, length * 0.5, shade(paint, 0.6));
    batch.addBox(flank, clearance + shellHeight * 0.2, cabinCenter, 0.045, shellHeight * 0.72, 0.03, shade(paint, 0.5));
    if (!shape.bed) batch.addBox(flank, clearance + shellHeight * 0.2, cabinStart + 0.15, 0.045, shellHeight * 0.72, 0.03, shade(paint, 0.5));
    batch.addBox(side * (width / 2 + 0.1), clearance + shellHeight + 0.04, cabinEnd - 0.25, 0.2, 0.12, 0.14, shade(paint, 0.85));
  }
  batch.addBox(0, clearance + shellHeight * 0.36, at(1) - 0.02, width * 0.4, shellHeight * 0.3, 0.07, '#101214');
  batch.addBox(0, clearance + shellHeight * 0.06, at(1) + 0.07, 0.52, 0.13, 0.03, '#f4f1e4');
  batch.addBox(0, clearance + shellHeight * 0.3, at(0) - 0.07, 0.52, 0.13, 0.03, '#f4f1e4');
  batch.addBox(0, clearance + shellHeight * 0.62, at(0) - 0.015, width * 0.86, shellHeight * 0.08, 0.05, '#2a0b0b');
}

/**
 * The model of one car, its nose toward +z. Returns the group with `wheels` (front pair first), `lightBar`
 * materials for a police car, and `brakeLights`.
 */
export function buildVehicleModel(spec, paint) {
  const group = new THREE.Group();
  const shape = SHAPES[spec.shape];
  const { length, width, height } = spec;
  const clearance = 0.3;
  const shellHeight = (height - clearance) * shape.shell;
  const cabinHeight = height - clearance - shellHeight;
  const batch = new MeshBatcher();
  const at = (t) => (t - 0.5) * length;

  batch.addBox(0, clearance, 0, width, shellHeight, length, paint);
  batch.taperLastBox(0.94, 0.97);
  batch.addBox(0, clearance - 0.06, 0, width * 1.02, 0.2, length * 0.9, '#1d2024');
  batch.addBox(0, clearance + shellHeight * 0.1, at(1) - 0.05, width * 0.96, shellHeight * 0.35, 0.22, '#2b2f34');
  batch.addBox(0, clearance + shellHeight * 0.1, at(0) + 0.05, width * 0.96, shellHeight * 0.35, 0.22, '#2b2f34');
  const cabinStart = at(shape.cabin[0]);
  const cabinEnd = at(shape.cabin[1]);
  const cabinLength = cabinEnd - cabinStart;
  const cabinCenter = (cabinStart + cabinEnd) / 2;
  // The glasshouse leans in toward the roof; the roof panel sits on its narrowed top.
  const [rakeX, rakeZ, rakeShift] = shape.rake;
  const roofShift = rakeShift * cabinLength;
  batch.addBox(0, clearance + shellHeight, cabinCenter, width * 0.92, cabinHeight * 0.9, cabinLength, GLASS);
  batch.taperLastBox(rakeX, rakeZ, roofShift);
  batch.addBox(0, clearance + shellHeight + cabinHeight * 0.88, cabinCenter + roofShift, width * 0.92 * rakeX + 0.04, cabinHeight * 0.12, cabinLength * rakeZ + 0.04, spec.police ? '#2e6fd8' : paint);
  batch.addBox(0, clearance + shellHeight, cabinCenter + roofShift * 0.5, width * 0.93, cabinHeight * 0.9, 0.09, shade(paint, 0.85));
  batch.taperLastBox(rakeX, 1, roofShift * 0.5);
  if (shape.bed) {
    batch.addBox(0, clearance + shellHeight, at(0.2), width, 0.28, length * 0.38, shade(paint, 0.8));
    batch.addBox(0, clearance + shellHeight - 0.02, at(0.2), width * 0.86, 0.04, length * 0.34, '#22262a');
  }
  addBodyTrim(batch, spec, shape, paint, { at, clearance, shellHeight, cabinEnd, cabinStart, cabinCenter });
  if (spec.shape === 'sports' || spec.shape === 'coupe') {
    // A wing on two posts over the tail, a dark bonnet vent, intakes ahead of the rear wheels and twin exhausts.
    const wingLift = spec.shape === 'sports' ? 0.34 : 0.2;
    batch.addBox(0, clearance + shellHeight + wingLift, at(0.04), width * 0.96, 0.07, 0.46, shade(paint, 0.62));
    for (const side of [-1, 1]) {
      batch.addBox(side * width * 0.33, clearance + shellHeight, at(0.05), 0.07, wingLift, 0.2, '#1d2024');
      batch.addBox(side * (width / 2 + 0.005), clearance + shellHeight * 0.42, at(0.36), 0.05, shellHeight * 0.36, 0.5, '#15171a');
      batch.addBox(side * width * 0.2, clearance + 0.02, at(0) - 0.08, 0.2, 0.13, 0.16, '#9aa0a6');
    }
    batch.addBox(0, clearance + shellHeight + 0.005, at(0.82), width * 0.5, 0.03, length * 0.2, shade(paint, 0.72));
  }
  if (spec.police) {
    batch.addBox(0, clearance + shellHeight * 0.28, 0, width + 0.03, shellHeight * 0.3, length * 0.62, '#2e6fd8');
    batch.addBox(0, clearance + shellHeight * 0.38, 0, width + 0.05, shellHeight * 0.1, length * 0.5, '#ffd60a');
    // A push bar on the nose and the bar the roof lamps sit on.
    batch.addBox(0, clearance - 0.02, at(1) + 0.14, width * 0.62, shellHeight * 0.8, 0.09, '#15171a');
    batch.addBox(0, height, cabinCenter + roofShift, width * 0.8, 0.07, 0.36, '#15171a');
  }
  if (spec.taxi) {
    batch.addBox(0, clearance + shellHeight * 0.3, 0, width + 0.03, shellHeight * 0.22, length * 0.5, '#1a1a1a');
    batch.addBox(0, height, cabinCenter, 0.9, 0.3, 0.38, '#fff6c2');
  }
  const body = batch.build(bodyMaterial);
  body.matrixAutoUpdate = true;
  group.add(body);

  // Lights are their own meshes so they can glow: head lamps, tail lamps that brighten on braking.
  const headMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const tailMaterial = new THREE.MeshBasicMaterial({ color: TAIL_LAMP.idle });
  const headLamps = new MeshBatcher();
  const tailLamps = new MeshBatcher();
  for (const side of [-1, 1]) {
    headLamps.addBox(side * width * 0.33, clearance + shellHeight * 0.56, at(1) + 0.01, width * 0.27, shellHeight * 0.24, 0.08, '#ffffff');
    tailLamps.addBox(side * width * 0.33, clearance + shellHeight * 0.58, at(0) - 0.01, width * 0.27, shellHeight * 0.24, 0.08, '#ffffff');
  }
  const lampOptions = { castShadow: false, receiveShadow: false };
  const lamps = [headLamps.build(headMaterial, lampOptions), tailLamps.build(tailMaterial, lampOptions)];
  group.add(...lamps);

  const wheels = [];
  for (const [t, isFront] of [[0.82, true], [0.18, false]]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(wheelGeometry, wheelMaterial));
      wheel.position.set(side * (width / 2 - 0.1), 0.36, at(t));
      wheel.userData.front = isFront;
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  let lightBar = null;
  if (spec.police) {
    lightBar = [new THREE.MeshBasicMaterial({ color: 0xff2020 }), new THREE.MeshBasicMaterial({ color: 0x2060ff })];
    lightBar.forEach((material, index) => {
      const lamp = new THREE.Mesh(lightBarGeometry, material);
      lamp.scale.x = width * 0.36;
      lamp.position.set((index ? 1 : -1) * width * 0.2, height + 0.14, cabinCenter + roofShift);
      group.add(lamp);
    });
  }
  body.castShadow = true;
  return { group, body, wheels, lightBar, tailMaterial, headMaterial, ownGeometries: [body.geometry, lamps[0].geometry, lamps[1].geometry] };
}
