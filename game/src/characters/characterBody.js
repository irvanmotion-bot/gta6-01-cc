// The low-poly person every character shares: body parts, walk and aim animation, walking with collision, falling dead.
import * as THREE from 'three';
import { WORLD_BOUNDS } from '../core/config.js';
import { angleDelta, clamp } from '../core/random.js';
import { groundHeight } from '../world/cityLayout.js';
import { MeshBatcher } from '../render/meshBatcher.js';

const limbGeometry = new THREE.BoxGeometry(1, 1, 1);
limbGeometry.translate(0, -0.5, 0);
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
const trunkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

function materialOf(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  return materials.get(color);
}

function part(geometry, color, sx, sy, sz, x, y, z) {
  const mesh = new THREE.Mesh(geometry, materialOf(color));
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const SKINS = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#6b3e1e', '#ffdbac'];
const SHIRTS = ['#ff6b6b', '#ffd93d', '#4ecdc4', '#ff9f1c', '#f15bb5', '#ffffff', '#3a86ff', '#8ac926', '#9b5de5', '#00bbf9', '#fb5607', '#e9c46a'];
const PANTS = ['#2d3142', '#3d5a80', '#e0d5c1', '#5c4d3c', '#1b263b', '#c9ada7', '#588157', '#ef8354'];
const HAIR = ['#1b1b1b', '#3b2314', '#6f4e37', '#d9b380', '#b03a2e', '#e8e8e8', '#ff7eb6'];

/** A random citizen's colours. */
export function randomLook(rng) {
  return {
    skin: rng.pick(SKINS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), hair: rng.pick(HAIR),
    hat: rng.chance(0.2) ? rng.pick(['#f5f0e1', '#e63946', '#1d3557', '#ffb703']) : null,
    shorts: rng.chance(0.55), scale: rng.range(0.94, 1.06),
  };
}

export const LOOKS = {
  nova: { skin: '#c68642', shirt: '#ff5e5b', pants: '#27324a', hair: '#2a1a12', hat: null, shorts: false, scale: 1, jacket: '#1fb5a6' },
  officer: { skin: '#e0ac69', shirt: '#2e4a7d', pants: '#16203a', hair: '#1b1b1b', hat: '#16203a', shorts: false, scale: 1.02 },
  tactical: { skin: '#c68642', shirt: '#1c2126', pants: '#1c2126', hair: '#1b1b1b', hat: '#2b3138', shorts: false, scale: 1.05 },
  enforcer: { skin: '#e0ac69', shirt: '#7d1f3a', pants: '#15151a', hair: '#1b1b1b', hat: null, shorts: false, scale: 1.04, jacket: '#f2e9dc' },
  guard: { skin: '#8d5524', shirt: '#3a3f47', pants: '#22252b', hair: '#1b1b1b', hat: '#22252b', shorts: false, scale: 1.05 },
  capo: { skin: '#e0ac69', shirt: '#111318', pants: '#f2e9dc', hair: '#e8e8e8', hat: '#f2e9dc', shorts: false, scale: 1.12, jacket: '#d8c06a' },
  racer: { skin: '#c68642', shirt: '#35d0ff', pants: '#15151a', hair: '#ff7eb6', hat: null, shorts: false, scale: 1 },
};

export function buildCharacterModel(look) {
  const group = new THREE.Group();
  const legColor = look.shorts ? look.skin : look.pants;
  // Everything that never bends (torso, hips, head, hair, jacket, hat) is one mesh; only the limbs swing on their own.
  const trunkParts = new MeshBatcher();
  const block = (color, sx, sy, sz, x, y, z) => trunkParts.addBox(x, y - sy / 2, z, sx, sy, sz, color);
  block(look.shirt, 0.5, 0.62, 0.28, 0, 1.16, 0);
  block(look.pants, 0.5, 0.24, 0.29, 0, 0.84, 0);
  block(look.skin, 0.26, 0.28, 0.27, 0, 1.63, 0);
  block(look.hair, 0.29, 0.12, 0.3, 0, 1.76, -0.01);
  if (look.jacket) block(look.jacket, 0.53, 0.5, 0.2, 0, 1.2, -0.06);
  if (look.hat) {
    block(look.hat, 0.31, 0.1, 0.32, 0, 1.84, 0);
    block(look.hat, 0.3, 0.03, 0.2, 0, 1.8, 0.2);
  }
  const trunk = trunkParts.build(trunkMaterial, { receiveShadow: false });
  const legL = part(limbGeometry, legColor, 0.2, 0.84, 0.22, 0.14, 0.84, 0);
  const legR = part(limbGeometry, legColor, 0.2, 0.84, 0.22, -0.14, 0.84, 0);
  const armL = part(limbGeometry, look.jacket || look.shirt, 0.15, 0.64, 0.17, 0.33, 1.45, 0);
  const armR = part(limbGeometry, look.jacket || look.shirt, 0.15, 0.64, 0.17, -0.33, 1.45, 0);
  armL.castShadow = false;
  armR.castShadow = false;
  group.add(trunk, legL, legR, armL, armR);
  // The gun is a child of the right arm, so it follows the aim; scaled against the arm's own scale.
  const gun = new THREE.Mesh(blockGeometry, materialOf('#16181b'));
  gun.scale.set(0.62, 0.8, 0.75);
  gun.position.set(0, -1.28, 0.2);
  gun.visible = false;
  armR.add(gun);
  group.scale.setScalar(look.scale || 1);
  return { group, trunk, legL, legR, armL, armR, gun };
}

export class CharacterBody {
  constructor(game, look, x, z) {
    this.game = game;
    this.model = buildCharacterModel(look);
    this.mesh = this.model.group;
    this.position = this.mesh.position;
    this.position.set(x, groundHeight(x, z), z);
    this.heading = 0;
    this.health = 100;
    this.alive = true;
    this.vehicle = null;
    this.radius = 0.4;
    this.moveSpeed = 0;
    this.stride = Math.random() * 6;
    this.aiming = false;
    this.armed = false;
    this.punching = 0;
    this.deadTime = 0;
    this.airborne = 0;
    this.velY = 0;
    this.flingX = 0;
    this.flingZ = 0;
    game.scene.add(this.mesh);
  }

  /** Walk by (dx, dz), sliding along walls and staying inside the world. */
  step(dx, dz) {
    const p = this.position;
    p.x = clamp(p.x + dx, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    p.z = clamp(p.z + dz, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
    const hit = this.game.collision.resolveCircle(p.x, p.z, this.radius, p.y + 0.4);
    if (hit) { p.x += hit.x; p.z += hit.z; }
    return hit;
  }

  turnToward(angle, dt, rate = 10) {
    this.heading += clamp(angleDelta(this.heading, angle), -rate * dt, rate * dt);
  }

  /** Gravity for jumps and for bodies a car has thrown. */
  fall(dt, gravity) {
    const ground = groundHeight(this.position.x, this.position.z);
    if (this.position.y > ground || this.velY > 0) {
      this.velY -= gravity * dt;
      this.position.y += this.velY * dt;
      this.airborne += dt;
      if (this.position.y <= ground) { this.position.y = ground; this.velY = 0; this.airborne = 0; }
    } else {
      this.position.y = ground;
      this.airborne = 0;
    }
    if (this.flingX || this.flingZ) {
      this.step(this.flingX * dt, this.flingZ * dt);
      const drag = Math.exp(-(this.position.y > ground ? 0.4 : 5) * dt);
      this.flingX *= drag;
      this.flingZ *= drag;
      if (Math.abs(this.flingX) + Math.abs(this.flingZ) < 0.2) { this.flingX = 0; this.flingZ = 0; }
    }
  }

  /** Throw the body with a car's momentum. */
  fling(vehicle, strength) {
    this.flingX = vehicle.velX * 0.75;
    this.flingZ = vehicle.velZ * 0.75;
    this.velY = Math.min(2.5 + strength * 0.22, 8);
    this.position.y += 0.05;
  }

  animate(dt) {
    const m = this.model;
    this.mesh.rotation.y = this.heading;
    if (!this.alive) {
      this.deadTime += dt;
      this.mesh.rotation.x += (-Math.PI / 2 - this.mesh.rotation.x) * Math.min(1, dt * 9);
      this.mesh.position.y = Math.max(this.mesh.position.y, groundHeight(this.position.x, this.position.z) + 0.14);
      m.legL.rotation.x = 0.2; m.legR.rotation.x = -0.1; m.armL.rotation.z = 0.9; m.armR.rotation.z = -0.9; m.armR.rotation.x = 0;
      return;
    }
    this.stride += this.moveSpeed * dt * 2.4;
    const reach = Math.min(this.moveSpeed / 3, 1.25) * 0.62;
    const swing = Math.sin(this.stride) * reach;
    m.legL.rotation.x = this.airborne > 0.05 ? 0.5 : swing;
    m.legR.rotation.x = this.airborne > 0.05 ? -0.3 : -swing;
    m.armL.rotation.x = -swing * 0.9;
    if (this.punching > 0) {
      this.punching -= dt;
      m.armR.rotation.x = -1.5 * Math.sin((this.punching / 0.28) * Math.PI);
    } else {
      m.armR.rotation.x = this.aiming ? -Math.PI / 2 + 0.05 : swing * 0.9;
    }
    if (this.aiming && this.armed) m.armL.rotation.x = -1.1;
    // Eclipse watchers shade their eyes with one hand, and throw both arms up when the sun goes out.
    if (this.gazing) m.armL.rotation.x = -2.35 + Math.sin(this.stride + this.deadTime) * 0.04;
    if (this.cheering) { m.armL.rotation.x = -2.9 + Math.sin(this.game.time * 9 + this.stride) * 0.25; m.armR.rotation.x = -2.9 - Math.sin(this.game.time * 9 + this.stride) * 0.25; }
    m.gun.visible = this.armed;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.model.trunk.geometry.dispose();
  }
}
