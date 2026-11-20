// The HUD's status panel, under the eclipse panel: the wanted stars and the cash on one line; the wanted level in
// words with its state (SPOTTED, SEARCHING, JAMMED) and a line of detail (how many units have eyes on Nova, or the
// search zone and the seconds until a star comes off); then the street-cred rank with its points and the points
// the next rank asks for. It also owns the health and armor bars, which sit under the minimap.
import { CRED_RANKS } from '../progression/streetCred.js';
import { createElement, createMeter, formatCash } from './domBuilder.js';

export class HudStatusPanel {
  /** `vitalsParent` is where the health and armor bars go: the radar block, under the minimap. */
  constructor(game, parent, cache, vitalsParent) {
    this.game = game;
    this.cache = cache;
    this.shownCash = 0;
    const root = createElement('div', 'hud-panel status-panel', parent);
    this.root = root;
    const top = createElement('div', 'status-top', root);
    this.stars = createElement('div', 'wanted-stars', top);
    for (let index = 0; index < 5; index += 1) createElement('i', '', this.stars, '★');
    this.cash = createElement('div', 'cash-readout', top);
    this.state = createElement('div', 'wanted-state', root);
    this.detail = createElement('div', 'wanted-detail', root);
    this.escape = createMeter(root, 'escape-meter', 'STAR COMING OFF');
    this.rank = createMeter(root, 'rank-meter', 'RANK');
    const vitals = createElement('div', 'vitals', vitalsParent);
    this.health = createMeter(vitals, 'health-meter', 'HEALTH');
    this.armor = createMeter(vitals, 'armor-meter', 'ARMOR');
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const player = game.player;
    const wanted = game.wanted;
    const blink = wanted.evading && Math.floor(game.time * 4) % 2 === 0;
    for (let index = 0; index < 5; index += 1) cache.toggle(this.stars.children[index], 'on', index < wanted.stars && !blink);
    const status = wanted.status();
    cache.text(this.state, wanted.stars > 0 ? `WANTED ${wanted.stars}★ · ${status.state}` : 'NOT WANTED · CLEAR');
    cache.text(this.detail, status.line);
    cache.toggle(this.root, 'wanted', wanted.stars > 0);
    cache.toggle(this.root, 'searching', status.state === 'SEARCHING' || status.state === 'JAMMED');
    cache.toggle(this.escape.root, 'visible', wanted.stars > 0 && wanted.evading);
    cache.width(this.escape.fill, wanted.escapeProgress());
    cache.text(this.escape.value, `${Math.round(wanted.escapeProgress() * 100)}%`);

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
    const next = CRED_RANKS[cred.rank];
    cache.text(this.rank.label, `RANK ${cred.rank} · ${cred.title().toUpperCase()}`);
    cache.text(this.rank.value, next ? `CRED ${cred.points.toLocaleString('en-US')} / ${next.cred.toLocaleString('en-US')}` : `CRED ${cred.points.toLocaleString('en-US')} · TOP RANK`);
    cache.width(this.rank.fill, cred.progressToNextRank());
  }
}
