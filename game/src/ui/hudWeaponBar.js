// The HUD's weapon bar, bottom right: the name of the weapon in hand with the slot it sits in, the rounds in the clip
// and in reserve in big figures, and five slots with the silhouette of each weapon and its number key: the one in
// hand lit, the ones not yet bought dimmed.
import { createElement } from './domBuilder.js';
import { WEAPON_ICON_SIZE, drawWeaponIcon } from './weaponIcons.js';

const INK = '#120e24';
const CREAM = '#f4ecd8';

export class HudWeaponBar {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel weapon-bar', parent);
    const line = createElement('div', 'weapon-line', root);
    const names = createElement('div', 'weapon-names', line);
    this.slotLine = createElement('div', 'weapon-slot-line', names);
    this.name = createElement('div', 'weapon-name', names);
    this.ammo = createElement('b', 'weapon-ammo', line);
    const slots = createElement('div', 'weapon-slots', root);
    this.slots = game.weapons.slots().map((slot) => {
      const node = createElement('div', 'weapon-slot', slots);
      createElement('b', 'weapon-key', node, String(slot.key));
      const icon = createElement('canvas', 'weapon-icon', node);
      icon.width = WEAPON_ICON_SIZE.width;
      icon.height = WEAPON_ICON_SIZE.height;
      return { node, icon, id: slot.id, drawn: '' };
    });
  }

  update() {
    const cache = this.cache;
    const weapons = this.game.weapons;
    const slots = weapons.slots();
    let held = 1;
    slots.forEach((slot, index) => {
      const entry = this.slots[index];
      cache.toggle(entry.node, 'owned', slot.owned);
      cache.toggle(entry.node, 'current', slot.current);
      if (slot.current) held = slot.key;
      const color = slot.current ? INK : CREAM;
      if (entry.drawn !== color) { entry.drawn = color; drawWeaponIcon(entry.icon, entry.id, color); }
    });
    const status = weapons.status();
    cache.text(this.slotLine, `WEAPON · SLOT ${held} OF ${slots.length}`);
    cache.text(this.name, status.name.toUpperCase());
    cache.text(this.ammo, status.ammo || 'MELEE');
  }
}
