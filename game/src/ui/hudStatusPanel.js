// The HUD's status panel, under the eclipse panel: the wanted stars and cash on one line; what the police know right
// now (SPOTTED with the units that have eyes on her, or OUT OF SIGHT with the seconds until a star drops and the
// size of the search zone) with the bar that fills as a star falls away; then street cred as numbers, rank and bar.
// It also owns the health and armor bars, which sit under the minimap.
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
    // What the police know: one line with the state in bold, a second with what follows from it.
    this.sight = createElement('div', 'wanted-sight', root);
    this.sightLabel = createElement('b', 'sight-label', this.sight);
    this.sightDetail = createElement('span', 'sight-detail', this.sight);
    this.escape = createMeter(root, 'escape-meter', 'STAR DROPS');
    this.tier = createElement('div', 'wanted-tier', root);
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
    cache.toggle(this.tier, 'visible', wanted.stars > 0);
    cache.text(this.tier, wanted.stars > 0 ? wanted.responseTier() : '');
    const report = wanted.sightReport();
    cache.toggle(this.root, 'wanted', wanted.stars > 0);
    cache.toggle(this.sight, 'searching', report.state === 'searching');
    cache.text(this.sightLabel, wanted.stars > 0 ? `WANTED ${wanted.stars}★ · ${report.label}` : report.label);
    cache.text(this.sightDetail, report.detail);
    cache.toggle(this.escape.root, 'visible', wanted.stars > 0 && wanted.evading);
    cache.width(this.escape.fill, wanted.escapeProgress());
    cache.text(this.escape.value, `${Math.max(0, Math.ceil(wanted.escapeTime() - wanted.unseen))}s`);

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
    // Street cred as the numbers behind the bar: the points held, the points the next rank asks for, the rank's name.
    const cred = game.cred;
    const next = CRED_RANKS[cred.rank];
    cache.text(this.rank.label, `RANK ${cred.rank} · ${cred.title().toUpperCase()}`);
    cache.text(this.rank.value, next ? `CRED ${cred.points.toLocaleString('en-US')} / ${next.cred.toLocaleString('en-US')}` : `CRED ${cred.points.toLocaleString('en-US')} · TOP RANK`);
    cache.width(this.rank.fill, cred.progressToNextRank());
  }
}
