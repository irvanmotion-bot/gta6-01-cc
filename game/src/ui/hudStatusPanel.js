// The HUD's status panel, under the eclipse panel: big wanted stars and cash on one line, then whether the police
// can see Nova (SPOTTED, with how many units have eyes on her) or are combing a zone for her (SEARCHING, with the
// escape bar), then the street-cred rank with its points. It also owns the health and armor bars under the minimap.
// (The response is named in the dispatch panel's head; the weapons have their own bar: hudWeaponBar.js.)
import { CRED_RANKS } from '../progression/streetCred.js';
import { createElement, createMeter, formatCash } from './domBuilder.js';

export class HudStatusPanel {
  /** `vitalsParent` is where the health and armor bars go: the radar block, under the minimap. */
  constructor(game, parent, cache, vitalsParent) {
    this.game = game;
    this.cache = cache;
    this.shownCash = 0;
    const root = createElement('div', 'hud-panel status-panel', parent);
    const top = createElement('div', 'status-top', root);
    this.stars = createElement('div', 'wanted-stars', top);
    for (let index = 0; index < 5; index += 1) createElement('i', '', this.stars, '★');
    this.cash = createElement('div', 'cash-readout', top);
    this.sight = createElement('div', 'sight-line', root);
    this.sightLabel = createElement('b', 'sight-label', this.sight);
    this.sightText = createElement('span', 'sight-text', this.sight);
    this.escape = createMeter(root, 'escape-meter', 'EVADING');
    const rank = createElement('div', 'rank-line', root);
    this.rankName = createElement('b', 'rank-name', rank);
    this.rankPoints = createElement('span', 'rank-points', rank);
    this.rankFill = createElement('i', '', createElement('div', 'rank-track', root));
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

    const sight = wanted.sightState();
    cache.toggle(this.sight, 'visible', Boolean(sight));
    cache.toggle(this.sight, 'searching', Boolean(sight && sight.label === 'SEARCHING'));
    cache.text(this.sightLabel, sight ? sight.label : '');
    cache.text(this.sightText, sight ? (game.crew.isJamming() ? 'RADIO JAMMED · THEY ARE DEAF' : sight.line) : '');
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
    cache.text(this.rankName, `RANK ${cred.rank} · ${cred.title().toUpperCase()}`);
    cache.text(this.rankPoints, next ? `${cred.points.toLocaleString('en-US')} / ${next.cred.toLocaleString('en-US')} CRED` : `${cred.points.toLocaleString('en-US')} CRED`);
    cache.width(this.rankFill, cred.progressToNextRank());
  }
}
