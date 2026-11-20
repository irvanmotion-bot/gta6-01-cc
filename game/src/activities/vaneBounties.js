// Bounties: Jazz put a price on four of Cassius Vane's capos. Each holds a corner of Saros with bodyguards; taking one
// down pays cash and cred once, and the map screen keeps the tally.
import { CITY } from '../core/config.js';
import { distance2D } from '../core/random.js';
import { blockRect } from '../world/cityLayout.js';
import { CRED_AWARDS } from '../progression/streetCred.js';

export class VaneBounties {
  constructor(game) {
    this.game = game;
    this.claimed = new Set();
    this.present = new Map();
  }

  reset(claimed = []) {
    this.claimed = new Set(claimed);
    this.present.clear();
  }

  tally() {
    return `${this.claimed.size}/${VANE_CAPOS.length}`;
  }

  /** Stand the capo and the bodyguards on their corner when the player comes near. */
  arrive(capo) {
    const game = this.game;
    const tag = `bounty:${capo.id}`;
    const boss = game.gunmen.spawn('capo', capo.x, capo.z, tag);
    boss.bountyId = capo.id;
    for (let k = 0; k < capo.guards; k += 1) {
      const angle = (k / capo.guards) * Math.PI * 2;
      game.gunmen.spawn('enforcer', capo.x + Math.cos(angle) * 3, capo.z + Math.sin(angle) * 3, tag);
    }
    this.present.set(capo.id, tag);
  }

  /** Called by gunmen.js when a capo falls. */
  onCapoDown(gunman, byPlayer) {
    const capo = VANE_CAPOS.find((entry) => entry.id === gunman.bountyId);
    if (!capo || this.claimed.has(capo.id)) return;
    this.claimed.add(capo.id);
    const game = this.game;
    game.stats.bountiesClaimed = this.claimed.size;
    if (byPlayer) game.player.addCash(capo.price);
    game.hud.banner('BOUNTY CLAIMED', `${capo.name} · +$${capo.price.toLocaleString('en-US')} · ${VANE_CAPOS.length - this.claimed.size} capos left`, '#ff6a4d');
    game.cred.earn(CRED_AWARDS.bounty, `bounty on ${capo.name}`);
    game.hud.say('JAZZ', `${capo.name} is off the air for good. Penumbra FM thanks you.`, '#f4ecd8');
    game.audio.jingle(true);
    game.saveGame(true);
  }

  blips() {
    return VANE_CAPOS.filter((capo) => !this.claimed.has(capo.id)).map((capo) => ({ x: capo.x, z: capo.z, color: '#ff3b30', label: '☠' }));
  }

  update() {
    const game = this.game;
    const player = game.player.position;
    for (const capo of VANE_CAPOS) {
      if (this.claimed.has(capo.id)) continue;
      const distance = distance2D(player.x, player.z, capo.x, capo.z);
      const tag = this.present.get(capo.id);
      if (!tag && distance < 105 && !game.missions.active) this.arrive(capo);
      else if (tag && distance > 190) { game.gunmen.removeTagged(tag); this.present.delete(capo.id); }
      if (tag && distance < 45) game.hud.hint(`BOUNTY: ${capo.name} · $${capo.price.toLocaleString('en-US')}`);
    }
  }
}

function corner(i, j, fx, fz) {
  const rect = blockRect(i, j);
  return { x: rect.minX + (rect.maxX - rect.minX) * fx, z: rect.minZ + (rect.maxZ - rect.minZ) * fz };
}

/** The four capos: their street names, the corner they hold, how many guns stand with them and the price on them. */
export const VANE_CAPOS = [
  { id: 'anzuelo', name: 'EL ANZUELO', guards: 2, price: 2500, ...corner(1, 8, 0.5, 0.04) },
  { id: 'contadora', name: 'LA CONTADORA', guards: 3, price: 4000, ...corner(7, 4, 0.96, 0.5) },
  { id: 'dosDedos', name: 'DOS DEDOS', guards: 3, price: 5000, ...corner(9, 0, 0.5, 0.96) },
  { id: 'bruma', name: 'CAPITÁN BRUMA', guards: 4, price: 7500, x: 620, z: CITY.depth + 30 },
];
