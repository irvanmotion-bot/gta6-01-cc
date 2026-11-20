// Where cash goes: Ammo Amigo's gun counter, Fresh Coat Customs' respray bay and the save point at Casa Reyes.
import { distance2D } from '../core/random.js';
import { LANDMARKS } from '../world/cityLayout.js';
import { WEAPONS } from '../combat/weapons.js';
import { randomPaint } from '../vehicles/vehicleCatalog.js';

const RESPRAY_PRICE = 300;
const ARMOR_PRICE = 800;
const MEDKIT_PRICE = 150;

export class Shops {
  constructor(game) {
    this.game = game;
    this.panel = document.getElementById('shop-menu');
    this.open = false;
    this.resprayCooldown = 0;
    this.panel.addEventListener('click', (event) => {
      const row = event.target.closest('[data-item]');
      if (row) this.buy(row.dataset.item);
      if (event.target.closest('[data-close]')) this.close();
    });
  }

  /** The gun counter's stock: each gun once, then its ammo; armor and a medkit always. */
  stock() {
    const weapons = this.game.weapons;
    const items = [];
    for (const [id, spec] of Object.entries(WEAPONS)) {
      if (spec.melee) continue;
      if (!weapons.owned[id]) items.push({ id, label: spec.name, detail: `${spec.clip}-round clip · ${spec.auto ? 'automatic' : spec.pellets > 1 ? 'pump action' : 'semi-auto'}`, price: spec.price });
      else items.push({ id: `ammo:${id}`, label: `${spec.name} ammo`, detail: `${spec.ammoPack} rounds`, price: spec.ammoPrice });
    }
    items.push({ id: 'armor', label: 'Body armor', detail: 'Soaks most of a bullet', price: ARMOR_PRICE });
    items.push({ id: 'medkit', label: 'Medkit', detail: 'Full health', price: MEDKIT_PRICE });
    return items;
  }

  render() {
    const cash = this.game.player.cash;
    const rows = this.stock().map((item, index) => `
      <button class="shop-row${item.price > cash ? ' too-dear' : ''}" data-item="${item.id}">
        <span class="shop-key">${index + 1}</span>
        <span class="shop-label">${item.label}<small>${item.detail}</small></span>
        <span class="shop-price">$${item.price.toLocaleString('en-US')}</span>
      </button>`).join('');
    this.panel.innerHTML = `
      <div class="shop-card">
        <h2>AMMO AMIGO</h2>
        <p class="shop-tag">"Your friend in a firefight." · Cash $${cash.toLocaleString('en-US')}</p>
        ${rows}
        <button class="shop-close" data-close="1">Leave shop (Esc)</button>
      </div>`;
  }

  openGunShop() {
    this.open = true;
    this.game.setState('shop');
    this.panel.classList.add('visible');
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.panel.classList.remove('visible');
    this.game.setState('play');
  }

  buy(itemId) {
    const game = this.game;
    const item = this.stock().find((entry) => entry.id === itemId);
    if (!item) return;
    if (game.player.cash < item.price) { game.audio.click(); return; }
    if (itemId === 'armor') { if (game.player.armor >= 100) return; game.player.armor = 100; }
    else if (itemId === 'medkit') { if (game.player.health >= 100) return; game.player.health = 100; }
    else if (itemId.startsWith('ammo:')) game.weapons.give(itemId.slice(5), WEAPONS[itemId.slice(5)].ammoPack, false);
    else game.weapons.give(itemId, WEAPONS[itemId].clip * 2);
    game.player.cash -= item.price;
    game.audio.cashRegister();
    this.render();
  }

  /** While the shop is open the game is paused: number keys buy, Escape or E leaves. */
  updateMenu() {
    const input = this.game.input;
    if (input.wasPressed('Escape', 'KeyE')) { this.close(); return; }
    this.stock().forEach((item, index) => { if (input.wasPressed(`Digit${index + 1}`)) this.buy(item.id); });
  }

  blips() {
    return ['gunShop', 'respray', 'safehouse'].map((id) => ({ x: LANDMARKS[id].x, z: LANDMARKS[id].z, color: LANDMARKS[id].color, label: LANDMARKS[id].icon }));
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
    if (!game.missions.active || game.missions.active.step.kind !== 'goto' || !game.missions.active.step.respray) game.markers.show(bay.x, bay.z, LANDMARKS.respray.color, 3.2, 9);

    if (!player.vehicle && distance2D(px, pz, gun.x, gun.z) < 2) {
      if (game.wanted.stars > 0) game.hud.hint('Ammo Amigo does not serve wanted customers');
      else { game.hud.hint('Press E to shop at Ammo Amigo'); if (game.input.wasPressed('KeyE')) this.openGunShop(); }
    }
    if (!player.vehicle && distance2D(px, pz, home.x, home.z) < 2) {
      if (game.missions.active) game.hud.hint('Finish your mission before you rest');
      else if (game.wanted.stars > 0) game.hud.hint('Lose the police before you rest');
      else { game.hud.hint('Press E to save your game at Casa Reyes'); if (game.input.wasPressed('KeyE')) this.rest(); }
    }
    const vehicle = player.vehicle;
    if (vehicle && distance2D(px, pz, bay.x, bay.z) < 4 && Math.abs(vehicle.speed) < 3 && this.resprayCooldown <= 0) {
      const onMission = game.missions.active && game.missions.active.vehicle === vehicle;
      if (onMission) return;
      if (vehicle.spec.police) game.hud.hint('Fresh Coat will not touch a police car');
      else if (player.cash < RESPRAY_PRICE) game.hud.hint(`A respray costs $${RESPRAY_PRICE}`);
      else {
        player.cash -= RESPRAY_PRICE;
        game.wanted.clear();
        vehicle.health = vehicle.spec.health;
        vehicle.repaint(randomPaint(vehicle.modelId, game.vehicles.rng));
        game.audio.cashRegister();
        game.hud.banner('FRESH COAT', `Resprayed and repaired · -$${RESPRAY_PRICE}`, '#16a085');
        this.resprayCooldown = 8;
      }
    }
  }

  rest() {
    const game = this.game;
    game.player.health = 100;
    game.sky.hour = (game.sky.hour + 6) % 24;
    game.saveGame(false);
  }
}
