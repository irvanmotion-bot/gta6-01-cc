// The HUD's status panel, under the eclipse panel: big wanted stars and cash on one line, the response tier and
// escape bar while wanted, thick health and armor bars side by side, and the street-cred rank on one thin line.
// (The weapons have their own bar: hudWeaponBar.js.)
import { createElement, createMeter, formatCash } from './domBuilder.js';

export class HudStatusPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.shownCash = 0;
    const root = createElement('div', 'hud-panel status-panel', parent);
    // Stars and cash share the top line; the tier badge and the escape bar appear under it only while wanted.
    const top = createElement('div', 'status-top', root);
    this.stars = createElement('div', 'wanted-stars', top);
    for (let index = 0; index < 5; index += 1) createElement('i', '', this.stars, '★');
    this.cash = createElement('div', 'cash-readout', top);
    this.tier = createElement('div', 'wanted-tier', root);
    this.escape = createMeter(root, 'escape-meter', 'EVADING');
    const vitals = createElement('div', 'vitals', root);
    this.health = createMeter(vitals, 'health-meter', 'HEALTH');
    this.armor = createMeter(vitals, 'armor-meter', 'ARMOR');
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
    cache.text(this.tier, wanted.stars > 0 ? wanted.responseTier() : '');
    cache.toggle(this.escape.root, 'visible', wanted.stars > 0 && wanted.evading);
    cache.width(this.escape.fill, wanted.escapeProgress());
    cache.text(this.escape.value, game.crew.isJamming() ? 'JAMMED' : 'OUT OF SIGHT');

    this.shownCash += (player.cash - this.shownCash) * Math.min(1, dt * 8);
    if (Math.abs(player.cash - this.shownCash) < 1) this.shownCash = player.cash;
    cache.text(this.cash, formatCash(this.shownCash));

    const health = Math.max(0, Math.round(player.health));
    cache.width(this.health.fill, health / 100);
    cache.text(this.health.value, String(health));
    cache.toggle(this.health.root, 'low', health < 30);
    const armor = Math.round(player.armor);
    cache.width(this.armor.fill, armor / game.cred.maxArmor());
    cache.text(this.armor.value, String(armor));
    const cred = game.cred;
    cache.text(this.rank.label, `RANK ${cred.rank} · ${cred.title().toUpperCase()}`);
    cache.text(this.rank.value, cred.points.toLocaleString('en-US'));
    cache.width(this.rank.fill, cred.progressToNextRank());
  }
}
