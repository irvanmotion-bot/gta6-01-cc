// Roadblocks: from four stars the dispatcher parks two cruisers across the street ahead of a fleeing car, posts
// officers behind them and, at five stars, lays a spike strip in front that shreds the tyres of whoever crosses it.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { distance2D } from '../core/random.js';
import { isNode, nearestNode } from '../world/roadNetwork.js';
import { streetNameAt } from '../world/cityLayout.js';
import { MeshBatcher } from '../render/meshBatcher.js';

/** A cruiser parked in a blockade: lights on, brakes on, going nowhere. */
export class BlockadePost {
  constructor() {
    this.isBlockade = true;
    this.deployed = true;
  }

  tacticLabel() {
    return 'ROADBLOCK';
  }

  drive(vehicle) {
    vehicle.siren = true;
    vehicle.setControls(0, 0, true);
  }
}

export class Roadblocks {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.clock = 6;
  }

  /** Where the next blockade goes: the middle of the street segment about 150 m ahead of the player's car. */
  findSpotAhead() {
    const car = this.game.player.vehicle;
    if (!car || Math.abs(car.speed) < 10) return null;
    const fx = car.forwardX();
    const fz = car.forwardZ();
    const alongX = Math.abs(fx) > Math.abs(fz);
    const direction = Math.sign(alongX ? fx : fz);
    const here = nearestNode(car.position.x, car.position.z);
    const steps = 2;
    const from = alongX ? { i: here.i + direction * steps, j: here.j } : { i: here.i, j: here.j + direction * steps };
    const to = alongX ? { i: from.i + direction, j: from.j } : { i: from.i, j: from.j + direction };
    if (!isNode(from.i, from.j) || !isNode(to.i, to.j)) return null;
    const x = ((from.i + to.i) / 2) * P;
    const z = ((from.j + to.j) / 2) * P;
    const distance = distance2D(car.position.x, car.position.z, x, z);
    if (distance < 110 || distance > 260 || this.game.vehicles.isOccupied(x, z, 9)) return null;
    return { x, z, alongX, direction };
  }

  /** Park the cruisers nose to tail across the lanes, put two officers behind them and lay the strip if asked. */
  deploy(spot, withSpikes) {
    const game = this.game;
    const roadHeading = spot.alongX ? Math.PI / 2 : 0;
    const acrossX = spot.alongX ? 0 : 1;
    const acrossZ = spot.alongX ? 1 : 0;
    const backX = spot.alongX ? spot.direction : 0;
    const backZ = spot.alongX ? 0 : spot.direction;
    const block = { x: spot.x, z: spot.z, vehicles: [], strip: null, age: 0, unit: game.police.nameUnit('roadblock'), spikes: withSpikes };
    for (const side of [-1, 1]) {
      const cruiser = game.vehicles.spawn('centinela', spot.x + acrossX * side * 2.6, spot.z + acrossZ * side * 2.6, roadHeading + Math.PI / 2);
      cruiser.driver = 'cop';
      cruiser.siren = true;
      cruiser.parked = true;
      cruiser.controller = new BlockadePost();
      cruiser.unit = block.unit;
      block.vehicles.push(cruiser);
      game.gunmen.spawn('officer', spot.x + backX * 3.4 + acrossX * side * 3.2, spot.z + backZ * 3.4 + acrossZ * side * 3.2);
    }
    // A row of striped barriers with amber lamps a few metres in front of the cruisers, facing whoever comes.
    block.barriers = buildBarrierRow();
    block.barriers.position.set(spot.x - backX * 4.6, 0, spot.z - backZ * 4.6);
    block.barriers.rotation.y = roadHeading;
    game.scene.add(block.barriers);
    if (withSpikes) {
      const strip = new THREE.Mesh(stripGeometry, stripMaterial);
      strip.position.set(spot.x - backX * 13, 0.05, spot.z - backZ * 13);
      strip.rotation.y = spot.alongX ? Math.PI / 2 : 0;
      game.scene.add(strip);
      block.strip = strip;
      block.stripAlongX = spot.alongX;
    }
    this.list.push(block);
    game.hud.notify(`${block.unit.callsign}: ${withSpikes ? 'spike strip' : 'roadblock'} set on ${streetNameAt(spot.x, spot.z)}!`);
    return block;
  }

  /** Crossing the strip in a car bursts its tyres: slower, looser, and sparks from the rims until a workshop fixes it. */
  checkSpikes(block) {
    const car = this.game.player.vehicle;
    if (!block.strip || !car || car.tiresShredded) return;
    const dx = Math.abs(car.position.x - block.strip.position.x);
    const dz = Math.abs(car.position.z - block.strip.position.z);
    const hit = block.stripAlongX ? dx < 1.4 && dz < STRIP_LENGTH / 2 : dz < 1.4 && dx < STRIP_LENGTH / 2;
    if (!hit) return;
    car.tiresShredded = true;
    this.game.particles.sparks(car.position.x, 0.3, car.position.z, 18);
    this.game.audio.crash(0.6);
    this.game.camera.shake(0.4);
    this.game.hud.notify('Spike strip! Tyres shredded: get to a workshop or switch cars.');
  }

  dismiss(block, rejoin) {
    this.liftFromStreet(block);
    for (const cruiser of block.vehicles) {
      if (cruiser.dead || cruiser.driver !== 'cop') continue;
      cruiser.parked = false;
      if (rejoin) this.game.police.enlist(cruiser, 'patrol');
      else this.game.vehicles.remove(cruiser);
    }
  }

  /** Take a blockade's strip and barriers off the street. */
  liftFromStreet(block) {
    if (block.strip) this.game.scene.remove(block.strip);
    if (block.barriers) this.game.scene.remove(block.barriers);
  }

  clear() {
    for (const block of this.list) this.liftFromStreet(block);
    this.list.length = 0;
  }

  /** The blockades still standing, for the dispatch panel and the minimap. */
  active() {
    return this.list.filter((block) => block.vehicles.some((cruiser) => !cruiser.dead && cruiser.driver === 'cop'));
  }

  update(dt, stars) {
    const player = this.game.player.position;
    this.clock -= dt;
    if (stars >= 4 && this.clock <= 0 && this.list.length < 2) {
      const spot = this.findSpotAhead();
      this.clock = spot ? 16 : 1.5;
      if (spot) this.deploy(spot, stars >= 5);
    }
    for (let index = this.list.length - 1; index >= 0; index -= 1) {
      const block = this.list[index];
      block.age += dt;
      this.checkSpikes(block);
      const distance = distance2D(block.x, block.z, player.x, player.z);
      // Passed and left behind, called off, or simply too old: the cruisers join the chase or drive home.
      if (stars < 3 || distance > 250 || block.age > 40) {
        this.dismiss(block, stars >= 3 && distance < 250);
        this.list.splice(index, 1);
      }
    }
  }
}

const P = CITY.pitch;
const STRIP_LENGTH = CITY.road;
const stripGeometry = new THREE.BoxGeometry(STRIP_LENGTH, 0.1, 0.7);
const stripMaterial = new THREE.MeshStandardMaterial({ color: 0x15171a, emissive: 0xffb300, emissiveIntensity: 0.45, roughness: 0.6 });
const barrierMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const barrierLampMaterial = new THREE.MeshBasicMaterial({ color: 0xffb300, toneMapped: false });
const barrierLampGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.2);

/**
 * Four sawhorse barriers across the lanes (the row is built along x; the road runs along z): an orange and white
 * striped board on two legs, each with an amber lamp on top. They are for show: a car goes straight through them.
 */
function buildBarrierRow() {
  const row = new THREE.Group();
  const boards = new MeshBatcher();
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    for (let stripe = 0; stripe < 6; stripe += 1) boards.addBox(x - 1.05 + stripe * 0.42, 0.72, 0, 0.42, 0.42, 0.1, stripe % 2 ? '#f6f3ea' : '#ff7a1a');
    for (const leg of [-1, 1]) boards.addBox(x + leg * 1.05, 0, 0, 0.12, 1.14, 0.5, '#2a2d31');
    const lamp = new THREE.Mesh(barrierLampGeometry, barrierLampMaterial);
    lamp.position.set(x, 1.33, 0);
    row.add(lamp);
  }
  row.add(boards.build(barrierMaterial, { receiveShadow: false }));
  return row;
}
