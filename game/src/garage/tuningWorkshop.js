// Bravo Motors' workshop: repairs, and four upgrade lines (engine, plating, tyres, nitro) in three tiers that follow
// Nova into every car she drives. Rank gates the tiers; the nitro tank burns on Shift and refills on its own.
import { distance2D } from '../core/random.js';
import { LANDMARKS } from '../world/cityLayout.js';

export class TuningWorkshop {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset(levels = null) {
    this.levels = { engine: 0, plating: 0, tires: 0, nitro: 0, ...(levels || {}) };
    this.nitroCharge = 1;
    this.retune();
  }

  /** Recompute the multipliers vehiclePhysics.js applies to the player's car. */
  retune() {
    const { engine, plating, tires } = this.levels;
    this.tuning = { speed: 1 + engine * 0.05, accel: 1 + engine * 0.1, grip: 1 + tires * 0.08, plating: 1 + plating * 0.3 };
  }

  /** Fit the plating to a car Nova has just taken: more health, the damage it already has kept. */
  fit(vehicle) {
    const maxHealth = vehicle.spec.health * this.tuning.plating;
    vehicle.health += maxHealth - vehicle.maxHealth;
    vehicle.maxHealth = maxHealth;
  }

  totalLevels() {
    return this.levels.engine + this.levels.plating + this.levels.tires + this.levels.nitro;
  }

  hasNitro() {
    return this.levels.nitro > 0;
  }

  /** Burn the tank while the boost key is held; returns whether the car is boosting this frame. */
  burnNitro(dt, wanted, vehicle) {
    if (!this.hasNitro()) return false;
    const seconds = 1.2 + this.levels.nitro * 0.9;
    if (wanted && this.nitroCharge > 0 && vehicle.speed > 3) {
      this.nitroCharge = Math.max(0, this.nitroCharge - dt / seconds);
      return true;
    }
    if (!wanted) this.nitroCharge = Math.min(1, this.nitroCharge + dt / 16);
    return false;
  }

  repairPrice(vehicle) {
    const missing = 1 - vehicle.health / vehicle.maxHealth;
    return Math.round(60 + missing * 340 + (vehicle.tiresShredded ? 150 : 0));
  }

  /** The counter's rows: a repair for the car in the bay, then the next tier of each upgrade line. */
  stock() {
    const cred = this.game.cred;
    const vehicle = this.game.player.vehicle;
    const rows = [];
    if (vehicle) {
      const worn = vehicle.health < vehicle.maxHealth - 1 || vehicle.tiresShredded;
      rows.push({ id: 'repair', label: `Repair the ${vehicle.spec.name}`, detail: worn ? `Condition ${vehicle.conditionPercent()}%${vehicle.tiresShredded ? ' · tyres shredded' : ''}` : 'Nothing to fix', price: worn ? cred.priceOf(this.repairPrice(vehicle)) : null });
    }
    for (const line of UPGRADE_LINES) {
      const level = this.levels[line.id];
      if (level >= 3) { rows.push({ id: line.id, label: `${line.name} · MAX`, detail: line.detail, price: null }); continue; }
      const rank = line.ranks[level];
      rows.push({ id: line.id, label: `${line.name} · tier ${level + 1}`, detail: line.detail, price: cred.priceOf(line.prices[level]), locked: cred.hasRank(rank) ? '' : `Needs rank ${rank}` });
    }
    return rows;
  }

  purchase(row) {
    const vehicle = this.game.player.vehicle;
    if (row.id === 'repair') { if (!vehicle) return false; vehicle.repair(); return true; }
    this.levels[row.id] += 1;
    this.retune();
    if (vehicle) this.fit(vehicle);
    this.game.hud.notify(`Workshop: ${row.label} fitted.`);
    return true;
  }

  blips() {
    return [];
  }

  /** In a stopped car at the workshop bay, E opens the counter. */
  update() {
    const game = this.game;
    const player = game.player;
    const bay = LANDMARKS.garage.kerb;
    const vehicle = player.vehicle;
    if (!vehicle || distance2D(player.position.x, player.position.z, bay.x, bay.z) > 6 || Math.abs(vehicle.speed) > 3) return;
    if (game.wanted.stars > 0) { game.hud.hint('Bravo will not open the bay with the police on you'); return; }
    game.hud.hint('Press E for Bravo\'s workshop: repairs and upgrades');
    if (game.input.wasPressed('KeyE')) game.counter.open({ title: 'BRAVO MOTORS', tagline: '"If it rolls, I can make it fly."', accent: '#f39c12', stock: () => this.stock(), purchase: (row) => this.purchase(row) });
  }
}

/** The upgrade lines: the price and the rank each of the three tiers asks for. */
export const UPGRADE_LINES = [
  { id: 'engine', name: 'Engine tune', detail: '+10% acceleration, +5% top speed per tier', prices: [1500, 4000, 9000], ranks: [2, 3, 5] },
  { id: 'plating', name: 'Armor plating', detail: '+30% vehicle health per tier', prices: [1200, 3500, 8000], ranks: [2, 3, 5] },
  { id: 'tires', name: 'Grip tyres', detail: '+8% cornering grip per tier', prices: [1000, 3000, 7000], ranks: [2, 3, 5] },
  { id: 'nitro', name: 'Nitro tank', detail: 'Hold Shift to burn · longer burn per tier', prices: [3000, 6500, 12000], ranks: [4, 4, 5] },
];
