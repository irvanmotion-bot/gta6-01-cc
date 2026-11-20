// What a blast does: the fireball, the sound, the shake, and damage to every car and person near it.
import { distance2D } from '../core/random.js';

const BLAST_RADIUS = 9;

export function detonate(game, x, z, byPlayer = false) {
  game.particles.explosion(x, 0.8, z);
  const player = game.player;
  const toPlayer = distance2D(x, z, player.position.x, player.position.z);
  game.audio.explosion(Math.max(0.1, 1 - toPlayer / 140));
  if (toPlayer < 60) game.camera.shake(Math.max(0.15, 1 - toPlayer / 40));
  for (const vehicle of game.vehicles.list) {
    if (vehicle.dead) continue;
    const d = distance2D(x, z, vehicle.position.x, vehicle.position.z);
    if (d < BLAST_RADIUS) {
      vehicle.damage(140 * (1 - d / BLAST_RADIUS), byPlayer);
      vehicle.velX += ((vehicle.position.x - x) / (d || 1)) * 5;
      vehicle.velZ += ((vehicle.position.z - z) / (d || 1)) * 5;
    }
  }
  for (const person of game.allCharacters()) {
    if (!person.alive) continue;
    const d = distance2D(x, z, person.position.x, person.position.z);
    if (d >= BLAST_RADIUS) continue;
    const force = 1 - d / BLAST_RADIUS;
    if (!person.vehicle) {
      person.flingX = ((person.position.x - x) / (d || 1)) * 9 * force;
      person.flingZ = ((person.position.z - z) / (d || 1)) * 9 * force;
      person.velY = 5 * force;
    }
    if (person.isPlayer) person.takeDamage(120 * force, 'explosion');
    else person.takeDamage(160 * force, byPlayer);
  }
  game.pedestrians.scareNear(x, z, 60, 14);
  if (byPlayer) game.wanted.reportCrime('explosion');
}
