// Where cash goes: Ammo Amigo's gun counter, Fresh Coat Customs' respray bay and the save point at Casa Reyes.
import { distance2D } from '../core/random.js';
import { LANDMARKS } from '../world/cityLayout.js';
import { WEAPONS } from '../combat/weapons.js';
import { randomPaint } from '../vehicles/vehicleCatalog.js';

export class Shops {
  constructor(game) {
    this.game = game;
    this.resprayCooldown = 0;
  }

  /** The gun counter's stock: each gun once (some wait for a rank), then its ammo; armor and a medkit always. */
  gunStock() {
    const weapons = this.game.weapons;
    const cred = this.game.cred;
    const items = [];
    for (const [id, spec] of Object.entries(WEAPONS)) {
      if (spec.melee) continue;
      if (!weapons.owned[id]) {
        const detail = `${spec.clip}-round clip · ${spec.auto ? 'automatic' : spec.pellets > 1 ? 'pump action' : 'semi-auto'}`;
        items.push({ id, label: spec.name, detail, price: cred.priceOf(spec.price), locked: cred.hasRank(spec.rank) ? '' : `Needs rank ${spec.rank}` });
      } else items.push({ id: `ammo:${id}`, label: `${spec.name} ammo`, detail: `${spec.ammoPack} rounds`, price: cred.priceOf(spec.ammoPrice) });
    }
    items.push({ id: 'armor', label: 'Body armor', detail: `Soaks most of a bullet · ${cred.maxArmor()} points`, price: cred.priceOf(ARMOR_PRICE) });
    items.push({ id: 'medkit', label: 'Medkit', detail: 'Full health', price: cred.priceOf(MEDKIT_PRICE) });
    return items;
  }

  sellGunItem(item) {
    const game = this.game;
    const id = item.id;
    if (id === 'armor') { if (game.player.armor >= game.cred.maxArmor()) return false; game.player.armor = game.cred.maxArmor(); }
    else if (id === 'medkit') { if (game.player.health >= 100) return false; game.player.health = 100; }
    else if (id.startsWith('ammo:')) game.weapons.give(id.slice(5), WEAPONS[id.slice(5)].ammoPack, false);
    else game.weapons.give(id, WEAPONS[id].clip * 2);
    return true;
  }

  openGunShop() {
    this.game.counter.open({ title: 'AMMO AMIGO', tagline: '"Your friend in a firefight."', accent: '#ff6a4d', stock: () => this.gunStock(), purchase: (item) => this.sellGunItem(item) });
  }

  /** Buy straight from the gun counter by item id (the counter does the same when a row is picked). */
  buy(itemId) {
    this.game.counter.buy(itemId);
  }

  close() {
    this.game.counter.close();
  }

  blips() {
    return ['gunShop', 'respray', 'safehouse', 'garage'].map((id) => ({ x: LANDMARKS[id].x, z: LANDMARKS[id].z, color: LANDMARKS[id].color, label: LANDMARKS[id].icon }));
  }

  /** Drive into Fresh Coat's bay: new paint, repairs, and the police stop looking for this car. */
  respray(vehicle) {
    const game = this.game;
    const price = game.cred.priceOf(RESPRAY_PRICE);
    game.player.cash -= price;
    game.stats.spent += price;
    game.wanted.clear(false);
    vehicle.repair();
    vehicle.repaint(randomPaint(vehicle.modelId, game.vehicles.rng));
    game.audio.cashRegister();
    game.hud.banner('FRESH COAT', `Resprayed and repaired · -$${price}`, '#f4ecd8');
    this.resprayCooldown = 8;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const px = player.position.x;
    const pz = player.position.z;
    const gun = LANDMARKS.gunShop;
    const home = LANDMARKS.safehouse;
    const bay = LANDMARKS.respray.kerb;
    this.resprayCooldown -= dt;
    game.markers.show(gun.x, gun.z, gun.color, 1.5, 9);
    game.markers.show(home.x, home.z, home.color, 1.5, 9);
    const step = game.missions.active && game.missions.active.step;
    if (!step || !step.respray) game.markers.show(bay.x, bay.z, LANDMARKS.respray.color, 3.2, 9);

    if (!player.vehicle && distance2D(px, pz, gun.x, gun.z) < 2) {
      if (game.wanted.stars > 0) game.hud.hint('Ammo Amigo does not serve wanted customers');
      else { game.hud.hint('Press E to shop at Ammo Amigo'); if (game.input.wasPressed('KeyE')) this.openGunShop(); }
    }
    if (!player.vehicle && distance2D(px, pz, home.x, home.z) < 2) {
      if (game.missions.active) game.hud.hint('Finish your job before you rest');
      else if (game.wanted.stars > 0) game.hud.hint('Lose the police before you rest');
      else { game.hud.hint(`Press E to rest and save at Casa Reyes (slot ${game.saveSlot})`); if (game.input.wasPressed('KeyE')) this.rest(); }
    }
    const vehicle = player.vehicle;
    if (vehicle && distance2D(px, pz, bay.x, bay.z) < 4 && Math.abs(vehicle.speed) < 3 && this.resprayCooldown <= 0) {
      const onMission = game.missions.active && game.missions.active.vehicle === vehicle;
      if (onMission) return;
      if (vehicle.spec.police) game.hud.hint('Fresh Coat will not touch a police car');
      else if (player.cash < game.cred.priceOf(RESPRAY_PRICE)) game.hud.hint(`A respray costs $${game.cred.priceOf(RESPRAY_PRICE)}`);
      else this.respray(vehicle);
    }
  }

  rest() {
    const game = this.game;
    game.player.health = 100;
    // Nova sleeps into the next afternoon of eclipse week, unless the story is holding the week on this day.
    game.calendar.sleepUntilNextDay();
    game.watchParties.populate();
    game.saveGame(false);
  }
}

const RESPRAY_PRICE = 300;
const ARMOR_PRICE = 800;
const MEDKIT_PRICE = 150;
