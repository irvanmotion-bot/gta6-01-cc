// Builds each car from its catalog entry: the sculpted body (carBodyLoft.js) with its trim (bumpers, arches, mirrors,
// grille, plates, a wing on the fast ones), the lamps, the wheels, and a cab's roof sign or a police car's light bar.
import * as THREE from 'three';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { buildCarBody } from './carBodyLoft.js';

const wheelGeometry = buildWheelGeometry();
/** The dark disc behind a wheel: it shows above the tyre as the round of the wheel arch. */
const archShape = new THREE.CylinderGeometry(0.5, 0.5, 0.09, 20).rotateZ(Math.PI / 2);
const wheelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const lightBarGeometry = new THREE.BoxGeometry(1, 0.26, 0.4);
const IDENTITY = new THREE.Matrix4();

/** One wheel as a single shape: the tyre, a bright rim and a cross of spokes that shows it turning. */
function buildWheelGeometry() {
  const parts = new MeshBatcher();
  const turned = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  parts.addGeometry(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18), turned, '#15171a');
  parts.addGeometry(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), turned, '#c8ccd0');
  parts.addBox(0, -0.27, 0, 0.32, 0.54, 0.09, '#8d949b');
  parts.addBox(0, -0.045, 0, 0.32, 0.09, 0.54, '#8d949b');
  return parts.build(null).geometry;
}
/** Every car body shares this lacquer; main.js hands it the sky to reflect. */
export const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.22 });
/** Tail lamp colours: running and under braking. */
export const TAIL_LAMP = { idle: 0xb81414, braking: 0xff4a30 };
const POLICE_BLUE = '#2e6fd8';

/**
 * Proportions per body shape. `cabin` is where the glasshouse starts and ends along the length (0 = tail, 1 = nose);
 * `shell` the share of the body's height below the shoulder; `rake` the roof's [width, length, shift] as shares of
 * the cabin's; `nose` and `tail` are [how far the bonnet or boot falls toward its end, as a share of the shell's
 * height; how much it narrows].
 */
const SHAPES = {
  hatch: { cabin: [0.06, 0.72], shell: 0.52, bed: false, rake: [0.84, 0.74, -0.04], nose: [0.3, 0.9], tail: [0, 1] },
  sedan: { cabin: [0.16, 0.72], shell: 0.5, bed: false, rake: [0.84, 0.64, -0.03], nose: [0.26, 0.9], tail: [0.16, 0.93] },
  coupe: { cabin: [0.16, 0.66], shell: 0.52, bed: false, rake: [0.82, 0.58, -0.06], nose: [0.3, 0.88], tail: [0.2, 0.92] },
  sports: { cabin: [0.2, 0.68], shell: 0.55, bed: false, rake: [0.8, 0.5, -0.07], nose: [0.46, 0.84], tail: [0.2, 0.92] },
  suv: { cabin: [0.04, 0.74], shell: 0.5, bed: false, rake: [0.88, 0.8, -0.03], nose: [0.18, 0.93], tail: [0, 1] },
  pickup: { cabin: [0.4, 0.76], shell: 0.48, bed: true, rake: [0.88, 0.7, -0.02], nose: [0.16, 0.93], tail: [0, 1] },
  van: { cabin: [0.03, 0.9], shell: 0.45, bed: false, rake: [0.92, 0.9, -0.03], nose: [0.3, 0.92], tail: [0, 1] },
};

function shade(hex, amount) {
  const color = new THREE.Color(hex);
  color.multiplyScalar(amount);
  return `#${color.getHexString()}`;
}

/** The small parts every body carries: bumpers, wheel arches, mirrors, the grille, the plates and the tail strip. */
function addBodyTrim(batch, spec, shape, paint, frame) {
  const { width } = spec;
  const { at, clearance, shellHeight, cabinEnd, noseHeight, tailHeight } = frame;
  batch.addBox(0, clearance - 0.06, 0, width * 0.9, 0.2, spec.length * 0.88, '#1d2024');
  batch.addBox(0, clearance + 0.06, at(1) - 0.07, width * shape.nose[1] * 0.9, noseHeight * 0.36, 0.24, '#2b2f34');
  batch.addBox(0, clearance + 0.06, at(0) + 0.07, width * shape.tail[1] * 0.9, tailHeight * 0.3, 0.24, '#2b2f34');
  for (const side of [-1, 1]) {
    // A round arch over each wheel, dark against the flank, with a lip of paint standing proud over it.
    const archRadius = Math.max(0.4, Math.min(0.5, clearance + shellHeight - 0.42));
    for (const t of [0.82, 0.18]) {
      batch.addGeometry(archShape, placement(side * (width / 2 - 0.05), 0.36, at(t), 0, 1, archRadius / 0.5, archRadius / 0.5), '#121416');
      batch.addBox(side * (width / 2 - 0.01), 0.34 + archRadius, at(t), 0.07, 0.05, archRadius * 1.5, shade(paint, 0.8));
    }
    batch.addBox(side * (width / 2 + 0.08), clearance + shellHeight + 0.03, cabinEnd - 0.22, 0.2, 0.12, 0.14, shade(paint, 0.85));
  }
  batch.addBox(0, clearance + noseHeight * 0.5, at(1) - 0.02, width * 0.34, noseHeight * 0.3, 0.07, '#101214');
  batch.addBox(0, clearance + shellHeight * 0.1, at(1) + 0.06, 0.52, 0.13, 0.03, '#f4f1e4');
  batch.addBox(0, clearance + tailHeight * 0.24, at(0) - 0.06, 0.52, 0.13, 0.03, '#f4f1e4');
  batch.addBox(0, clearance + tailHeight * 0.66, at(0) - 0.015, width * 0.74 * shape.tail[1], tailHeight * 0.1, 0.05, '#2a0b0b');
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
  const batch = new MeshBatcher();
  const at = (t) => (t - 0.5) * length;

  const cabinStart = at(shape.cabin[0]);
  const cabinEnd = at(shape.cabin[1]);
  const cabinCenter = (cabinStart + cabinEnd) / 2;
  const roofCenter = cabinCenter + shape.rake[2] * (cabinEnd - cabinStart);
  // How high the body stands at its nose and at its tail, once the bonnet and the boot have fallen away.
  const noseHeight = shellHeight * (1 - shape.nose[0]);
  const tailHeight = shellHeight * (1 - shape.tail[0]);
  // A police car wears a blue roof and a blue band along its doors; a cab a black band.
  const livery = spec.police ? { roof: POLICE_BLUE, band: POLICE_BLUE } : spec.taxi ? { band: '#1a1a1a' } : {};
  const skin = buildCarBody(spec, shape, { clearance, shellHeight }, paint, livery);
  batch.addGeometry(skin, IDENTITY, null);
  skin.dispose();
  if (shape.bed) {
    batch.addBox(0, clearance + shellHeight - 0.02, at(0.2), width * 0.95, 0.3, length * 0.38, shade(paint, 0.8));
    batch.addBox(0, clearance + shellHeight + 0.26, at(0.2), width * 0.83, 0.04, length * 0.34, '#22262a');
  }
  addBodyTrim(batch, spec, shape, paint, { at, clearance, shellHeight, cabinEnd, noseHeight, tailHeight });
  const sporty = spec.shape === 'sports' || spec.shape === 'coupe';
  if (sporty) {
    // A wing on two posts over the tail, intakes ahead of the rear wheels, a dark diffuser and twin exhausts.
    const wingLift = spec.shape === 'sports' ? 0.34 : 0.2;
    batch.addBox(0, clearance + shellHeight + wingLift, at(0.04), width * 0.92, 0.07, 0.46, shade(paint, 0.62));
    batch.addBox(0, clearance - 0.04, at(0) - 0.02, width * 0.62, 0.18, 0.12, '#101214');
    for (const side of [-1, 1]) {
      batch.addBox(side * width * 0.31, clearance + tailHeight, at(0.05), 0.07, shellHeight - tailHeight + wingLift, 0.2, '#1d2024');
      batch.addBox(side * (width / 2 - 0.005), clearance + shellHeight * 0.42, at(0.36), 0.05, shellHeight * 0.34, 0.5, '#15171a');
      batch.addBox(side * width * 0.2, clearance + 0.02, at(0) - 0.08, 0.2, 0.13, 0.16, '#9aa0a6');
    }
  }
  if (spec.police) {
    // A yellow pinstripe under the blue band, a push bar on the nose and the bar the roof lamps sit on.
    batch.addBox(0, clearance + shellHeight * 0.5, cabinCenter, width + 0.02, shellHeight * 0.07, (cabinEnd - cabinStart) * 0.9, '#ffd60a');
    batch.addBox(0, clearance - 0.02, at(1) + 0.14, width * 0.6, noseHeight * 0.95, 0.09, '#15171a');
    batch.addBox(0, height, roofCenter, width * 0.72, 0.08, 0.36, '#15171a');
  }
  if (spec.taxi) batch.addBox(0, height, cabinCenter, 0.9, 0.3, 0.38, '#fff6c2');
  const body = batch.build(bodyMaterial);
  body.matrixAutoUpdate = true;
  group.add(body);

  // Lights are their own meshes so they can glow: head lamps, tail lamps that brighten on braking.
  const headMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const tailMaterial = new THREE.MeshBasicMaterial({ color: TAIL_LAMP.idle });
  const headLamps = new MeshBatcher();
  const tailLamps = new MeshBatcher();
  for (const side of [-1, 1]) {
    headLamps.addBox(side * width * 0.3 * shape.nose[1], clearance + noseHeight * 0.6, at(1) + 0.01, width * 0.22, noseHeight * 0.28, 0.08, '#ffffff');
    tailLamps.addBox(side * width * 0.29 * shape.tail[1], clearance + tailHeight * 0.58, at(0) - 0.01, width * 0.26, tailHeight * 0.28, 0.08, '#ffffff');
  }
  const lampOptions = { castShadow: false, receiveShadow: false };
  const lamps = [headLamps.build(headMaterial, lampOptions), tailLamps.build(tailMaterial, lampOptions)];
  group.add(...lamps);

  const wheels = [];
  for (const [t, isFront] of [[0.82, true], [0.18, false]]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(wheelGeometry, wheelMaterial);
      // Fast cars stand on wide tyres that fill their arches and show past the body from behind.
      const stance = sporty ? (isFront ? 1.25 : 1.55) : 1;
      tyre.scale.x = stance;
      wheel.add(tyre);
      wheel.position.set(side * (width / 2 - 0.1 + (sporty ? 0.05 : 0)), 0.36, at(t));
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
      lamp.scale.x = width * 0.34;
      lamp.position.set((index ? 1 : -1) * width * 0.19, height + 0.16, roofCenter);
      group.add(lamp);
    });
  }
  body.castShadow = true;
  return { group, body, wheels, lightBar, tailMaterial, headMaterial, ownGeometries: [body.geometry, lamps[0].geometry, lamps[1].geometry] };
}
