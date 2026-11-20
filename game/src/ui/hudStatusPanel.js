// The HUD's top-right status panel: wanted stars with the response tier and escape bar, cash, the five weapon
// slots with their rounds, labelled health and armor meters, and the street-cred rank with its progress bar.
import { createElement, createMeter, formatCash } from './domBuilder.js';

export class HudStatusPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.shownCash = 0;
    const root = createElement('div', 'hud-panel status-panel', parent);
    const wanted = createElement('div', 'wanted-row', root);
    this.stars = createElement('div', 'wanted-stars', wanted);
    for (let index = 0; index < 5; index += 1) createElement('i', '', this.stars, '★');
    this.tier = createElement('div', 'wanted-tier', root);
    this.escape = createMeter(root, 'escape-meter', 'EVADING');
    this.cash = createElement('div', 'cash-readout', root);
    this.slots = createElement('div', 'weapon-slots', root);
    this.slotNodes = [];
    for (let index = 0; index < 5; index += 1) {
      const slot = createElement('div', 'weapon-slot', this.slots);
      this.slotNodes.push({ root: slot, key: createElement('b', '', slot), name: createElement('span', '', slot), rounds: createElement('em', '', slot) });
    }
    const weapon = createElement('div', 'weapon-line', root);
    this.weaponName = createElement('span', 'weapon-name', weapon);
    this.weaponAmmo = createElement('b', 'weapon-ammo', weapon);
    this.health = createMeter(root, 'health-meter', 'HEALTH');
    this.armor = createMeter(root, 'armor-meter', 'ARMOR');
    this.rank = createMeter(root, 'rank-meter', 'RANK');
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const player = game.player;
    const wanted = game.wanted;
    const blink = wanted.evading && Math.floor(game.time * 4) % 2 === 0;
    for (let index = 0; index < 5; index += 1) cache.toggle(this.stars.children[index], 'on', index < wanted.stars && !blink);
    cache.toggle(this.tier, 'visible', wanted.stars > 0);
    cache.text(this.tier, wanted.stars > 0 ? `WANTED ${wanted.stars} · ${wanted.responseTier()}` : '');
    cache.toggle(this.escape.root, 'visible', wanted.stars > 0 && wanted.evading);
    cache.width(this.escape.fill, wanted.escapeProgress());
    cache.text(this.escape.value, game.crew.isJamming() ? 'JAMMED' : 'OUT OF SIGHT');

    this.shownCash += (player.cash - this.shownCash) * Math.min(1, dt * 8);
    if (Math.abs(player.cash - this.shownCash) < 1) this.shownCash = player.cash;
    cache.text(this.cash, formatCash(this.shownCash));

    game.weapons.slots().forEach((slot, index) => {
      const node = this.slotNodes[index];
      cache.text(node.key, String(slot.key));
      cache.text(node.name, slot.short);
      cache.text(node.rounds, slot.rounds);
      cache.toggle(node.root, 'owned', slot.owned);
      cache.toggle(node.root, 'current', slot.current);
    });
    const weapon = game.weapons.status();
    cache.text(this.weaponName, weapon.name.toUpperCase());
    cache.text(this.weaponAmmo, weapon.ammo);

    const health = Math.max(0, Math.round(player.health));
    cache.width(this.health.fill, health / 100);
    cache.text(this.health.value, String(health));
    cache.toggle(this.health.root, 'low', health < 30);
    const armor = Math.round(player.armor);
    cache.width(this.armor.fill, armor / game.cred.maxArmor());
    cache.text(this.armor.value, String(armor));
    const cred = game.cred;
    cache.text(this.rank.label, `RANK ${cred.rank} · ${cred.title().toUpperCase()}`);
    cache.text(this.rank.value, `${cred.points.toLocaleString('en-US')} CRED`);
    cache.width(this.rank.fill, cred.progressToNextRank());
  }
}
