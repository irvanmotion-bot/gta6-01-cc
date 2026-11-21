// Crew favors: three abilities Nova's crew grants as her rank rises, each on its own key and cooldown.
// Z calls Bravo for a getaway car, X has Jazz jam the police radio, C gets a patch-up from Doc Inés.
import { randomLaneSpawn } from '../world/roadNetwork.js';
import { SeededRandom } from '../core/random.js';

export class CrewFavors {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(4242);
    this.cooldowns = { wheels: 0, jam: 0, patch: 0 };
    this.jamTime = 0;
  }

  reset() {
    this.cooldowns = { wheels: 0, jam: 0, patch: 0 };
    this.jamTime = 0;
  }

  /** While Jazz jams the radio no unit can report a sighting. */
  isJamming() {
    return this.jamTime > 0;
  }

  /** The three favors as the HUD's crew panel shows them: key, name, who grants it and its state. */
  status() {
    return CREW_FAVORS.map((favor) => {
      const locked = !this.game.cred.hasRank(favor.rank);
      const wait = Math.ceil(this.cooldowns[favor.id]);
      const active = favor.id === 'jam' && this.jamTime > 0;
      return { ...favor, locked, wait, active, ready: !locked && wait <= 0, share: locked ? 0 : 1 - Math.max(0, this.cooldowns[favor.id]) / favor.cooldown };
    });
  }

  /** Bravo sends a tuned Coyote to the nearest kerb. */
  callWheels() {
    const game = this.game;
    const player = game.player.position;
    const spot = randomLaneSpawn(player.x, player.z, 9, 34, this.rng, 5);
    if (!spot || game.vehicles.isOccupied(spot.x, spot.z, 5)) { game.hud.notify('Bravo: "No kerb free near you. Move and call again."'); return false; }
    const ride = game.vehicles.spawn('coyote', spot.x, spot.z, spot.heading, '#f39c12');
    ride.parked = true;
    ride.stolen = true;
    ride.ambient = true;
    game.hud.say('TÍO BRAVO', 'Orange Coyote, at the kerb. Try to bring this one back.', '#ffb547');
    return true;
  }

  /** Jazz floods the police band: twelve seconds unseen and one star gone. */
  jamSignal() {
    const game = this.game;
    if (game.wanted.stars === 0) { game.hud.notify('Jazz: "Nobody is looking for you, baby."'); return false; }
    this.jamTime = 12;
    game.wanted.dropStar();
    game.hud.say('JAZZ', 'Penumbra is all over their band. They are deaf for twelve seconds!', '#f4ecd8');
    return true;
  }

  /** Doc Inés: full health, half a vest and a quick fix for the car Nova sits in. */
  patchUp() {
    const game = this.game;
    const player = game.player;
    if (player.health >= 100 && player.armor >= 50) { game.hud.notify('Inés: "You look fine to me, mija."'); return false; }
    player.health = 100;
    player.armor = Math.max(player.armor, 50);
    if (player.vehicle) player.vehicle.health = Math.max(player.vehicle.health, player.vehicle.maxHealth * 0.6);
    game.hud.say('DOC INÉS', 'Hold still. There. Now stop getting shot.', '#cfe8d8');
    return true;
  }

  use(favor) {
    const game = this.game;
    if (!game.cred.hasRank(favor.rank)) { game.hud.notify(`${favor.name} unlocks at rank ${favor.rank}.`); return; }
    if (this.cooldowns[favor.id] > 0) { game.hud.notify(`${favor.name} is ready in ${Math.ceil(this.cooldowns[favor.id])}s.`); return; }
    const done = favor.id === 'wheels' ? this.callWheels() : favor.id === 'jam' ? this.jamSignal() : this.patchUp();
    if (!done) return;
    this.cooldowns[favor.id] = favor.cooldown;
    game.stats.favorsUsed += 1;
    game.audio.checkpoint();
  }

  update(dt) {
    const input = this.game.input;
    this.jamTime = Math.max(0, this.jamTime - dt);
    for (const favor of CREW_FAVORS) {
      this.cooldowns[favor.id] = Math.max(0, this.cooldowns[favor.id] - dt);
      if (input.wasPressed(favor.code) && this.game.player.alive) this.use(favor);
    }
  }
}

/** The favors: the key that calls each, the crew member who grants it, the rank it unlocks at and its cooldown. */
export const CREW_FAVORS = [
  { id: 'wheels', key: 'Z', code: 'KeyZ', name: 'GETAWAY CAR', who: 'BRAVO', role: 'MECHANIC', portrait: 'TÍO BRAVO', rank: 2, cooldown: 120, color: '#ffb547' },
  { id: 'jam', key: 'X', code: 'KeyX', name: 'SIGNAL JAM', who: 'JAZZ', role: 'HACKER', portrait: 'JAZZ', rank: 3, cooldown: 150, color: '#ff7eb6' },
  { id: 'patch', key: 'C', code: 'KeyC', name: 'PATCH-UP', who: 'DOC INÉS', role: 'MEDIC', portrait: 'DOC INÉS', rank: 4, cooldown: 180, color: '#7be0c3' },
];
