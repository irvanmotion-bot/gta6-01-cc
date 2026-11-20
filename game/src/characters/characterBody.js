// The low-poly person every character shares: body parts, walk and aim animation, walking with collision, falling dead.
import * as THREE from 'three';
import { WORLD_BOUNDS } from '../core/config.js';
import { angleDelta, clamp } from '../core/random.js';
import { groundHeight } from '../world/cityLayout.js';
import { MeshBatcher } from '../render/meshBatcher.js';

/** Every part of every character is vertex-coloured and shares this one material. */
const trunkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

/** How far a cowering citizen sinks onto their heels, in metres. */
const COWER_DROP = 0.46;
const SKINS = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#6b3e1e', '#ffdbac'];
const SHIRTS = ['#ff6b6b', '#ffd93d', '#4ecdc4', '#ff9f1c', '#f15bb5', '#ffffff', '#3a86ff', '#8ac926', '#9b5de5', '#00bbf9', '#fb5607', '#e9c46a'];
const PANTS = ['#2d3142', '#3d5a80', '#e0d5c1', '#5c4d3c', '#1b263b', '#c9ada7', '#588157', '#ef8354'];
const HAIR = ['#1b1b1b', '#3b2314', '#6f4e37', '#d9b380', '#b03a2e', '#e8e8e8', '#ff7eb6'];

/** A random citizen's colours. */
export function randomLook(rng) {
  const outfit = rng.pick(OUTFITS);
  return {
    skin: rng.pick(SKINS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), hair: rng.pick(HAIR),
    hat: rng.chance(0.2) ? rng.pick(['#f5f0e1', '#e63946', '#1d3557', '#ffb703']) : null,
    shorts: outfit === 'beach' || rng.chance(0.45), scale: rng.range(0.88, 1.1), longHair: outfit === 'dress' || rng.chance(0.35), shoes: rng.pick(['#f4f1e8', '#2b2d33', '#ff6b6b', '#3a86ff', '#ffd93d']),
    // Slim to heavy-set, and what they threw on this morning: a sundress, a vest, long sleeves, a pack, a sun hat.
    build: rng.range(0.84, 1.24), dress: outfit === 'dress', sleeves: outfit === 'beach' ? 'none' : outfit === 'office' ? 'long' : 'short',
    backpack: outfit === 'tourist' ? rng.pick(['#2d3142', '#e63946', '#3a86ff', '#588157']) : null, sunHat: outfit === 'tourist' || (outfit === 'dress' && rng.chance(0.5)) ? '#f5e6c4' : null,
    shades: rng.chance(0.3), afro: rng.chance(0.14),
  };
}

/** The wardrobes of Saros; a citizen's outfit decides the cut of their clothes, not the colours. */
const OUTFITS = ['street', 'street', 'beach', 'dress', 'office', 'tourist'];

export const LOOKS = {
  nova: { skin: '#c68642', shirt: '#ff5e5b', pants: '#27324a', hair: '#2a1a12', hat: null, shorts: false, scale: 1, jacket: '#1fb5a6', longHair: true },
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
  // Hair comes down the back of the head (to the shoulders on some), so nobody is a bare block from behind.
  block(look.hair, 0.29, look.longHair ? 0.36 : 0.2, 0.08, 0, 1.66, -0.125);
  if (look.jacket) block(look.jacket, 0.53, 0.5, 0.2, 0, 1.2, -0.06);
  if (look.afro) block(look.hair, 0.4, 0.3, 0.4, 0, 1.86, -0.02);
  if (look.sunHat) {
    block(look.sunHat, 0.33, 0.1, 0.34, 0, 1.85, 0);
    block(look.sunHat, 0.66, 0.03, 0.66, 0, 1.78, 0);
  } else if (look.hat) {
    block(look.hat, 0.31, 0.1, 0.32, 0, 1.84, 0);
    block(look.hat, 0.3, 0.03, 0.2, 0, 1.8, 0.2);
  }
  // A sundress flares from the waist to the knee; a tourist carries a day pack.
  if (look.dress) {
    trunkParts.addBox(0, 0.5, 0, 0.62, 0.42, 0.44, look.shirt);
    trunkParts.taperLastBox(0.8, 0.68);
  }
  if (look.backpack) block(look.backpack, 0.36, 0.42, 0.16, 0, 1.4, -0.21);
  if (look.shades) block('#15161a', 0.24, 0.06, 0.02, 0, 1.565, 0.14);
  // A face: two eyes and a mouth on the front of the head, and a neck under it.
  for (const side of [-1, 1]) block('#1b1b1b', 0.05, 0.055, 0.02, side * 0.065, 1.56, 0.137);
  block('#7a3b2e', 0.1, 0.022, 0.02, 0, 1.43, 0.137);
  block(look.skin, 0.14, 0.08, 0.14, 0, 1.36, 0);
  const trunk = trunkParts.build(trunkMaterial, { receiveShadow: false });
  trunk.matrixAutoUpdate = true;
  // Short sleeves over bare forearms unless a jacket covers them; shorts end above the knee; everyone wears shoes.
  const sleeve = look.jacket || look.shirt;
  const sleeveShare = look.jacket || look.sleeves === 'long' ? 0 : look.sleeves === 'none' ? 0.12 : 0.42;
  const forearm = look.jacket || look.sleeves === 'long' ? sleeve : look.skin;
  // Uniforms and suits come with dark shoes; Nova and anyone unnamed wear pale trainers unless their look says so.
  const shoes = look.shoes || (look.hat && !look.shorts ? '#17181c' : '#f4f1e8');
  const bareLegs = look.shorts || look.dress;
  const thigh = look.dress ? look.skin : look.pants;
  const shin = bareLegs ? look.skin : legColor;
  const legL = limb(thigh, shin, look.shorts && !look.dress ? 0.3 : 0, shoes, 0.2, 0.84, 0.22, 0.14, 0.84);
  const legR = limb(thigh, shin, look.shorts && !look.dress ? 0.3 : 0, shoes, 0.2, 0.84, 0.22, -0.14, 0.84);
  const armL = limb(sleeve, forearm, sleeveShare, look.skin, 0.15, 0.64, 0.17, 0.33, 1.45);
  const armR = limb(sleeve, forearm, sleeveShare, look.skin, 0.15, 0.64, 0.17, -0.33, 1.45);
  armL.castShadow = false;
  armR.castShadow = false;
  group.add(trunk, legL, legR, armL, armR);
  // The gun is held in the right hand and runs on past it, so it follows the aim: a dark body, a grip and a barrel.
  const gunParts = new MeshBatcher();
  gunParts.addBox(0, -0.98, 0.05, 0.085, 0.44, 0.13, '#16181b');
  gunParts.addBox(0, -1.2, 0.04, 0.05, 0.24, 0.06, '#3a3f47');
  gunParts.addBox(0, -0.66, 0.13, 0.07, 0.1, 0.16, '#5a3d2a');
  const gun = gunParts.build(trunkMaterial, { receiveShadow: false });
  gun.visible = false;
  // A long gun (rifle, shotgun, sub-machine gun): a stock back to the elbow, a magazine and a barrel twice as long.
  const longParts = new MeshBatcher();
  longParts.addBox(0, -1.12, 0.06, 0.1, 0.72, 0.15, '#16181b');
  longParts.addBox(0, -1.62, 0.07, 0.055, 0.52, 0.065, '#3a3f47');
  longParts.addBox(0, -0.46, 0.05, 0.085, 0.36, 0.12, '#5a3d2a');
  longParts.addBox(0, -0.98, -0.1, 0.075, 0.12, 0.26, '#2b2f36');
  longParts.addBox(0, -0.7, 0.14, 0.07, 0.1, 0.16, '#5a3d2a');
  const longGun = longParts.build(trunkMaterial, { receiveShadow: false });
  longGun.visible = false;
  // A phone, for the citizens who would rather film a gunfight than run from it.
  const phoneParts = new MeshBatcher();
  phoneParts.addBox(0, -0.82, 0.06, 0.1, 0.2, 0.03, '#14161a');
  phoneParts.addBox(0, -0.8, 0.045, 0.08, 0.16, 0.012, '#9fd8ff');
  const phone = phoneParts.build(trunkMaterial, { receiveShadow: false });
  phone.visible = false;
  armR.add(gun, longGun, phone);
  const scale = look.scale || 1;
  const build = look.build || 1;
  group.scale.set(scale * build, scale, scale * (0.82 + build * 0.18));
  // The body turns about its own axes: first the heading, then a lean forward (a sprint) or a fall onto its back.
  group.rotation.order = 'YXZ';
  return { group, trunk, legL, legR, armL, armR, gun, longGun, phone };
}

/**
 * An arm or a leg hanging from its joint at (x, y): `upper` colours the top `upperShare` of it (a sleeve, a pair of
 * shorts), `lower` the rest, and `end` the hand or the shoe. One mesh, so it swings as one piece.
 */
function limb(upper, lower, upperShare, end, sx, sy, sz, x, y) {
  const parts = new MeshBatcher();
  const endHeight = sx < 0.18 ? 0.11 : 0.1;
  const upperHeight = sy * upperShare;
  if (upperHeight > 0) parts.addBox(0, -upperHeight, 0, sx * 1.12, upperHeight, sz * 1.12, upper);
  parts.addBox(0, -sy + endHeight, 0, sx, sy - endHeight - upperHeight, sz, lower);
  // A hand is a little wider than the wrist; a shoe reaches forward of the ankle.
  if (sx < 0.18) parts.addBox(0, -sy, 0, sx * 1.1, endHeight, sz * 1.1, end);
  else parts.addBox(0, -sy, 0.05, sx * 1.08, endHeight, sz * 1.5, end);
  const mesh = parts.build(trunkMaterial, { receiveShadow: false });
  mesh.matrixAutoUpdate = true;
  mesh.position.set(x, y, 0);
  return mesh;
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
    m.gun.visible = this.armed && !this.longGun;
    m.longGun.visible = this.armed && Boolean(this.longGun);
    m.phone.visible = this.alive && Boolean(this.filming);
    if (!this.alive) {
      this.crouch(0);
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
    // Citizens in fear, each in their own way: hands in the air, a flat-out sprint, or ducked low with an arm over the head.
    let lean = 0;
    let drop = this.cowering ? COWER_DROP : 0;
    let spreadL = this.cowering ? 0.55 : 0;
    let spreadR = this.cowering ? -0.55 : 0;
    if (this.panicking) {
      const style = this.fearStyle || 'handsUp';
      if (style === 'handsUp') {
        m.armL.rotation.x = -2.75 + Math.sin(this.stride * 1.3) * 0.3; m.armR.rotation.x = -2.75 - Math.sin(this.stride * 1.3) * 0.3;
        spreadL = 0.3; spreadR = -0.3;
      } else if (style === 'sprint') {
        lean = 0.3;
        m.armL.rotation.x = -0.5 - swing * 1.5; m.armR.rotation.x = -0.5 + swing * 1.5;
      } else {
        lean = 0.5; drop = 0.2;
        m.armL.rotation.x = -2.5; spreadL = 0.7;
        m.armR.rotation.x = swing * 1.2;
      }
    }
    // The bold ones stand their ground: one films it on a phone held up in front of the face, another points it out.
    if (this.filming) { m.armR.rotation.x = -1.95 + Math.sin(this.game.time * 2 + this.stride) * 0.04; m.armL.rotation.x = -1.5; spreadL = 0.5; spreadR = -0.25; }
    if (this.pointing) { m.armR.rotation.x = -1.62; m.armL.rotation.x = -2.2; spreadL = 0.9; }
    this.crouch(drop);
    if (this.cowering) {
      m.legL.rotation.x = -1.35; m.legR.rotation.x = -1.35;
      m.armL.rotation.x = -2.6; m.armR.rotation.x = -2.6;
    }
    m.armL.rotation.z = spreadL;
    m.armR.rotation.z = spreadR;
    this.mesh.rotation.x += (lean - this.mesh.rotation.x) * Math.min(1, dt * 10);
  }

  /** Lower the whole body by `drop` metres over its feet (0 stands it back up). */
  crouch(drop) {
    if (drop === this.crouched) return;
    this.crouched = drop;
    const m = this.model;
    m.trunk.position.y = -drop;
    m.legL.position.y = 0.84 - drop;
    m.legR.position.y = 0.84 - drop;
    m.armL.position.y = 1.45 - drop;
    m.armR.position.y = 1.45 - drop;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    const m = this.model;
    for (const mesh of [m.trunk, m.legL, m.legR, m.armL, m.armR, m.gun, m.longGun, m.phone]) mesh.geometry.dispose();
  }
}
