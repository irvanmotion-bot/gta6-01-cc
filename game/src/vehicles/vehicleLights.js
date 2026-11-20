// Lights a car carries: the headlight beam on the road ahead at night, glowing tail lamps, and for police
// cars the red and blue flare of the light bar while the siren runs. Also the one real spot lamp on Nova's car.
import * as THREE from 'three';
import { createGlowTexture } from '../render/proceduralTextures.js';

/** Add the light rig to a freshly built car model; returns what vehiclePhysics.js animates. */
export function attachVehicleLights(model, spec) {
  const rig = new THREE.Group();
  const beam = new THREE.Mesh(beamShape, beamMaterial);
  beam.position.set(0, 0.07, spec.length / 2 + 6.2);
  beam.renderOrder = 2;
  const tail = new THREE.Sprite(tailFlareMaterial);
  tail.position.set(0, 0.8, -spec.length / 2 - 0.1);
  tail.scale.set(spec.width * 1.25, 0.7, 1);
  rig.add(beam, tail);
  let flares = null;
  if (spec.police) {
    flares = [new THREE.Sprite(redFlareMaterial), new THREE.Sprite(blueFlareMaterial)];
    flares.forEach((flare, index) => {
      flare.position.set((index ? 1 : -1) * spec.width * 0.2, spec.height + 0.25, 0);
      flare.scale.set(3.7, 3.7, 1);
      flare.visible = false;
      rig.add(flare);
    });
  }
  model.group.add(rig);
  return { rig, flares };
}

/** Flash a police car's flares in step with its light bar. */
export function flashSirenFlares(lights, phase) {
  if (!lights.flares) return;
  lights.flares[0].visible = phase === 0;
  lights.flares[1].visible = phase === 1;
}

/** Headlight beams and tail flares fade in with the night for every car at once. */
export function setVehicleLightsNight(night) {
  beamMaterial.opacity = night * 0.4;
  tailFlareMaterial.opacity = night * 0.45;
  redFlareMaterial.opacity = 0.72 + night * 0.28;
  blueFlareMaterial.opacity = 0.72 + night * 0.28;
}

/** The single real light that travels with the player's car after dark and lights the street ahead. */
export class PlayerHeadlamp {
  constructor(scene) {
    this.lamp = new THREE.SpotLight(0xfff1cf, 0, 70, 0.52, 0.6, 1.4);
    this.lamp.visible = false;
    scene.add(this.lamp, this.lamp.target);
  }

  update(vehicle, night) {
    const on = Boolean(vehicle) && night > 0.15 && !vehicle.dead;
    this.lamp.visible = on;
    if (!on) return;
    const fx = vehicle.forwardX();
    const fz = vehicle.forwardZ();
    this.lamp.position.set(vehicle.position.x + fx * 1.2, 1.3, vehicle.position.z + fz * 1.2);
    this.lamp.target.position.set(vehicle.position.x + fx * 22, 0, vehicle.position.z + fz * 22);
    this.lamp.intensity = night * 1400;
  }
}

const glowTexture = createGlowTexture();
const beamShape = new THREE.PlaneGeometry(5.4, 13);
beamShape.rotateX(-Math.PI / 2);
const beamMaterial = new THREE.MeshBasicMaterial({ map: glowTexture, color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const tailFlareMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const redFlareMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xff3030, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const blueFlareMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0x3a78ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
