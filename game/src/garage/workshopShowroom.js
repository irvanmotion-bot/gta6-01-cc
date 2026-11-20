// The yard behind Bravo Motors, shown while the workshop counter is open: the car Nova drove in stands on a
// turntable in the low sun, turning slowly, with the shop wall, tyre stacks and tool chests behind it. The counter's
// upgrade list takes the right half of the screen; this view fills the left.
import * as THREE from 'three';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { buildVehicleModel } from '../vehicles/vehicleModel.js';

/** The yard stands out to sea, beyond the haze, so nothing of it shows from the streets. */
const YARD = { x: -1150, y: 6, z: 380 };
const TURNTABLE_RADIUS = 3.9;
const TURN_SPEED = 0.22;
/** The sign on the shop wall: where its middle hangs and how big it is, so the camera sees all of it over the car. */
const SIGN = { x: -3.1, y: 3.75, width: 6.8, height: 1.28 };
/** The camera: how far aside of the car it stands, how high, how far back, and the height it aims at. */
const VIEW = { aside: 2.75, height: 2.0, back: 10, aimHeight: 0.6 };

export class WorkshopShowroom {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.display = null;
    this.view = new THREE.PerspectiveCamera(34,window.innerWidth / window.innerHeight, 0.3, 2600);
    this.focus = new THREE.Vector3(YARD.x, YARD.y, YARD.z);
    this.yard = new THREE.Group();
    this.yard.position.copy(this.focus);
    this.yard.add(this.buildYard());
    this.table = this.buildTurntable();
    this.yard.add(this.table);
    this.yard.visible = false;
    game.scene.add(this.yard);
  }

  /** The floor, the shop wall with its sign, the roller door, and the clutter of a working yard. */
  buildYard() {
    const batch = new MeshBatcher();
    batch.addBox(0, -0.5, 0, 46, 0.5, 46, '#c9b294');
    // Painted bay lines and a hazard border in front of the turntable.
    for (const x of [-7, 7]) batch.addFlat(x, 0.02, 0, 0.25, 22, '#e08a2c');
    for (let k = -5; k <= 5; k += 1) batch.addFlat(k * 1.6, 0.02, 6.4, 0.8, 0.5, k % 2 ? '#2a2530' : '#e08a2c');
    // The shop wall behind the car, plum below and cream above, with the sign's backing board.
    batch.addBox(0, 0, -9, 46, 2.3, 0.6, '#3b2f4f');
    batch.addBox(0, 2.3, -9, 46, 6.3, 0.6, '#f6e3bf');
    batch.addBox(0, 8.6, -9, 46.4, 0.5, 1, '#2a2530');
    batch.addBox(SIGN.x, SIGN.y - SIGN.height / 2 - 0.2, -8.62, SIGN.width + 0.4, SIGN.height + 0.4, 0.2, '#1b1638');
    // A roller door, half open, and the wall that returns along the side.
    batch.addBox(9, 0, -8.62, 8, 6, 0.2, '#2a2530');
    for (let k = 0; k < 7; k += 1) batch.addBox(9, 3 + k * 0.42, -8.5, 7.6, 0.3, 0.14, k % 2 ? '#8c8496' : '#a59cae');
    batch.addBox(-23, 0, 0, 0.6, 8.6, 46, '#e6d2b0');
    // Tyre stacks, oil drums, a tool chest and a locker: what a car is worked on with.
    const tyre = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14);
    for (const [x, z, count] of [[-6.6, -7.4, 5], [-5.6, -7.2, 3], [-7.4, -6.4, 2], [3.6, -7.5, 4]]) {
      for (let k = 0; k < count; k += 1) batch.addGeometry(tyre, placement(x, 0.15 + k * 0.31, z), '#17161b');
    }
    const drum = new THREE.CylinderGeometry(0.34, 0.34, 1.05, 12);
    for (const [x, z, colour] of [[2.2, -7.7, '#ff6a4d'], [2.9, -7.2, '#ffb547'], [-8.2, -7.6, '#4fb3a5']]) batch.addGeometry(drum, placement(x, 0.53, z), colour);
    batch.addBox(-3.4, 0, -7.7, 2.4, 1.2, 0.9, '#ff6a4d');
    batch.addBox(-3.4, 1.2, -7.7, 2.5, 0.08, 1, '#2a2530');
    for (let k = 0; k < 3; k += 1) batch.addBox(-3.4, 0.18 + k * 0.36, -7.22, 2.1, 0.26, 0.04, '#b9453a');
    batch.addBox(0.4, 0, -7.9, 1.1, 1.9, 0.7, '#3d6f9e');
    const mesh = batch.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.width, SIGN.height), new THREE.MeshBasicMaterial({ map: paintSign() }));
    sign.position.set(SIGN.x, SIGN.y, -8.5);
    const group = new THREE.Group();
    group.add(mesh, sign);
    return group;
  }

  /** The turntable: a steel disc with an amber rim and chevrons that show it turning. */
  buildTurntable() {
    const batch = new MeshBatcher();
    batch.addGeometry(new THREE.CylinderGeometry(TURNTABLE_RADIUS + 0.28, TURNTABLE_RADIUS + 0.4, 0.16, 40), placement(0, 0.08, 0), '#ffb547');
    batch.addGeometry(new THREE.CylinderGeometry(TURNTABLE_RADIUS, TURNTABLE_RADIUS, 0.2, 40), placement(0, 0.1, 0), '#8f8798');
    for (let k = 0; k < 12; k += 1) {
      const angle = (k / 12) * Math.PI * 2;
      batch.addBox(Math.sin(angle) * (TURNTABLE_RADIUS - 0.5), 0.2, Math.cos(angle) * (TURNTABLE_RADIUS - 0.5), 0.16, 0.012, 0.7, '#2a2530', { rotY: angle });
    }
    const mesh = batch.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35 }));
    mesh.matrixAutoUpdate = true;
    return mesh;
  }

  /** Put a copy of `vehicle` on the turntable and take over the view. */
  open(vehicle) {
    this.close();
    const model = buildVehicleModel(vehicle.spec, vehicle.paint);
    model.group.position.set(0, 0.2, 0);
    this.table.add(model.group);
    this.display = model;
    this.table.rotation.y = -0.62;
    this.yard.visible = true;
    this.active = true;
    this.frame();
    // The sun, its shadows and the sky dome follow the yard while it is on screen.
    this.game.sky.update(0, this.focus, this.game.calendar);
  }

  close() {
    if (!this.active) return;
    this.table.remove(this.display.group);
    for (const geometry of this.display.ownGeometries) geometry.dispose();
    this.display = null;
    this.yard.visible = false;
    this.active = false;
  }

  /**
   * Stand the camera off the car's quarter and aim it past the car, so the car sits in the left two fifths of the
   * frame with the shop's sign over it, clear of the counter that stands down the right.
   */
  frame() {
    const view = this.view;
    view.aspect = window.innerWidth / window.innerHeight;
    view.updateProjectionMatrix();
    view.position.set(YARD.x + VIEW.aside, YARD.y + VIEW.height, YARD.z + VIEW.back);
    view.lookAt(YARD.x + VIEW.aside - 0.1, YARD.y + VIEW.aimHeight, YARD.z);
  }

  /** Called every frame while the counter is open: the table turns even though the city is paused. */
  update(dt) {
    if (!this.active) return;
    this.table.rotation.y += dt * TURN_SPEED;
    this.frame();
  }
}

/** The sign on the shop wall, painted on a canvas: the name, the crescent, and what Bravo does. */
function paintSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#1b1638';
  context.fillRect(0, 0, 1024, 192);
  context.fillStyle = '#ffb547';
  context.beginPath();
  context.arc(96, 96, 62, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#1b1638';
  context.beginPath();
  context.arc(124, 80, 58, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f4ecd8';
  context.font = 'italic 112px Impact, "Arial Black", sans-serif';
  context.textBaseline = 'middle';
  context.fillText('BRAVO MOTORS', 190, 84);
  context.fillStyle = '#ffb547';
  context.font = '700 30px "Segoe UI", Arial, sans-serif';
  // The line is held to the width of the board, so its last word is never cut by the board's edge.
  context.fillText('REPAIRS · TUNING · NO QUESTIONS · OPEN THROUGH TOTALITY', 194, 160, 806);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
