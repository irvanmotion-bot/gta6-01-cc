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

  /** The capo whose corner Nova is fighting on right now, with the guns still standing round him; null otherwise. */
  engaged() {
    const game = this.game;
    const player = game.player.position;
    for (const capo of VANE_CAPOS) {
      const tag = this.present.get(capo.id);
      if (!tag || this.claimed.has(capo.id) || distance2D(player.x, player.z, capo.x, capo.z) > ENGAGE_RANGE) continue;
      return { capo, tag, left: game.gunmen.countAlive(tag), total: capo.guards + 1 };
    }
    return null;
  }

  /** What the job panel shows during a bounty hit: the capo's name, the price on him and the guns left standing. */
  panelInfo() {
    const hit = this.engaged();
    if (!hit) return null;
    const { capo, left, total } = hit;
    const guards = Math.max(0, left - 1);
    return {
      header: `BOUNTY HUNT ${this.claimed.size + 1}/${VANE_CAPOS.length} · JAZZ PAYS $${capo.price.toLocaleString('en-US')}`, title: capo.name, stageLine: `${capo.turf} · ${left} OF ${total} GUNS STANDING`,
      steps: total, stepsDone: total - left, share: (total - left) / total, face: 'VANE CAPO', faceColor: '#ff6a4d',
      objective: guards > 0 ? `Take down ${capo.name} and his ${guards} ${guards === 1 ? 'guard' : 'guards'}` : `Take down ${capo.name}`, next: 'Cash and cred on the kill', timer: null, kind: 'bounty',
      reward: `$${capo.price.toLocaleString('en-US')} CASH · BOUNTY ${this.claimed.size + 1} OF ${VANE_CAPOS.length}`,
    };
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
      // Coming up on his corner the prompt names him; once Nova is in the fight the job panel carries the hit.
      if (tag && distance < ENGAGE_RANGE + 30 && distance >= ENGAGE_RANGE) game.hud.hint(`BOUNTY AHEAD: ${capo.name} · $${capo.price.toLocaleString('en-US')}`);
    }
  }
}

function corner(i, j, fx, fz) {
  const rect = blockRect(i, j);
  return { x: rect.minX + (rect.maxX - rect.minX) * fx, z: rect.minZ + (rect.maxZ - rect.minZ) * fz };
}

/** Within this many metres of a capo's corner the job panel turns to the hit. */
const ENGAGE_RANGE = 62;

/**
 * The four capos: their street names, the corner they hold, how many guns stand with them and the price on them.
 * El Anzuelo works the south end of the Strand boardwalk, where the eclipse crowds are thickest.
 */
export const VANE_CAPOS = [
  { id: 'contadora', name: 'LA CONTADORA', turf: 'ORRERY SQUARE', guards: 3, price: 4000, ...corner(7, 4, 0.96, 0.5) },
  { id: 'anzuelo', name: 'EL ANZUELO', turf: 'STRAND BOARDWALK', guards: 3, price: 2500, x: -9.4, z: 498 },
  { id: 'dosDedos', name: 'DOS DEDOS', turf: 'OBSERVATORY HILL', guards: 3, price: 5000, ...corner(9, 0, 0.5, 0.96) },
  { id: 'bruma', name: 'CAPITÁN BRUMA', turf: 'CORMORANT DOCKS', guards: 4, price: 7500, x: 620, z: CITY.depth + 30 },
];
