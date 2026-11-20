// The HUD's weapon bar, bottom right: which of the five slots is in hand, the weapon's name with the rounds in the
// clip and in reserve in big figures, then the five slots with the silhouette of each weapon and its number key:
// the one in hand lit, the ones not yet bought dimmed and marked as locked.
import { createElement } from './domBuilder.js';
import { WEAPON_ICON_SIZE, drawWeaponIcon } from './weaponIcons.js';

const INK = '#120e24';
const CREAM = '#f4ecd8';

export class HudWeaponBar {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel weapon-bar', parent);
    this.caption = createElement('div', 'panel-caption weapon-caption', root);
    const line = createElement('div', 'weapon-line', root);
    this.name = createElement('span', 'weapon-name', line);
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
    let inHand = 1;
    let locked = 0;
    slots.forEach((slot, index) => {
      const entry = this.slots[index];
      cache.toggle(entry.node, 'owned', slot.owned);
      cache.toggle(entry.node, 'current', slot.current);
      if (slot.current) inHand = slot.key;
      if (!slot.owned) locked += 1;
      const color = slot.current ? INK : CREAM;
      if (entry.drawn !== color) { entry.drawn = color; drawWeaponIcon(entry.icon, entry.id, color); }
    });
    const status = weapons.status();
    cache.text(this.caption, locked > 0 ? `WEAPON · SLOT ${inHand} OF ${slots.length} · ${locked} LOCKED` : `WEAPON · SLOT ${inHand} OF ${slots.length}`);
    cache.text(this.name, status.name.toUpperCase());
    cache.text(this.ammo, status.ammo);
  }
}
