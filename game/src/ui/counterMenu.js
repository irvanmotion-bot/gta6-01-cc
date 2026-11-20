// The shop counter shared by Ammo Amigo and Bravo's workshop: numbered rows with a price, bought by key or click.
// The gun counter is a card in the middle of the screen; the workshop's fills the right half, beside the car on its
// turntable, with the car's spec sheet above the upgrade rows.
import { createElement, formatCash } from './domBuilder.js';

/** The pictures on the workshop's cards, drawn on a 48 by 48 grid: a spanner, an engine, a shield, a wheel, a flame. */
const UPGRADE_ICONS = {
  repair: '<path d="M31 4a11 11 0 0 0-10 15L5 35l8 8 16-16a11 11 0 0 0 15-10l-7 6-7-2-2-7 6-7a11 11 0 0 0-3-3z"/>',
  engine: '<path d="M14 8h18v6h-6v4h10l4 5h4v14h-4l-4 5H14l-6-6H4V20h4v-2h10v-4h-4z"/>',
  plating: '<path d="M24 3l18 6v14c0 11-8 18-18 22C14 41 6 34 6 23V9z"/><path d="M24 10v28c7-3 11-8 11-15V13z" fill="#17122b" opacity="0.35"/>',
  tires: '<path d="M24 3a21 21 0 1 0 0 42 21 21 0 0 0 0-42zm0 9a12 12 0 1 1 0 24 12 12 0 0 1 0-24z"/><circle cx="24" cy="24" r="5"/>',
  nitro: '<path d="M26 2c4 11 14 15 11 28-2 9-8 15-15 15-8 0-13-6-12-14 1-6 6-9 7-16 4 3 5 7 5 10 3-5 5-13 4-23z"/>',
};

export class CounterMenu {
  constructor(game) {
    this.game = game;
    this.panel = createElement('div', 'counter-menu', document.body);
    this.panel.id = 'shop-menu';
    this.shop = null;
    this.panel.addEventListener('click', (event) => {
      const row = event.target.closest('[data-item]');
      if (row) this.buy(row.dataset.item);
      if (event.target.closest('[data-close]')) this.close();
    });
  }

  isOpen() {
    return this.shop !== null;
  }

  /**
   * Open a counter. `shop` gives its `title`, `tagline`, `accent` colour, `stock()` returning rows
   * { id, label, detail, price, locked, tier } and `purchase(row)` returning true when the sale went through.
   * A shop with `layout: 'showroom'` also gives `summary()` (the spec sheet of the car on show) and `onClose()`.
   */
  open(shop) {
    this.shop = shop;
    this.game.setState('shop');
    this.panel.classList.add('visible');
    this.panel.classList.toggle('showroom', shop.layout === 'showroom');
    this.render();
  }

  close() {
    if (!this.shop) return;
    const shop = this.shop;
    this.shop = null;
    this.panel.classList.remove('visible');
    if (shop.onClose) shop.onClose();
    this.game.setState('play');
  }

  /** The car on the turntable: its name plate at the foot of the picture and four stat bars above the rows. */
  specSheetMarkup(sheet) {
    const bars = sheet.bars.map(([label, value, share]) => `<div class="spec-bar"><span>${label}</span><i><u style="width:${Math.round(Math.min(1, share) * 100)}%"></u></i><b>${value}</b></div>`).join('');
    return {
      plate: `<div class="showroom-plate"><small>ON THE TURNTABLE</small><b>${sheet.name}</b><span>${sheet.kind} · CONDITION ${sheet.condition}%</span></div>`,
      bars: `<div class="spec-bars">${bars}</div>`,
    };
  }

  /** Three pips for an upgrade line: filled for every tier already fitted. */
  pipsMarkup(tier) {
    if (tier === undefined) return '';
    return `<span class="shop-pips">${[0, 1, 2].map((index) => `<i class="${index < tier ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  /**
   * One line of a counter as a wide row in big type: the key that buys it (over a picture of the part, in the
   * workshop), its name with what it does in small print under it, the tier on sale with three pips for the tiers
   * fitted, and the price.
   */
  rowMarkup(item, index, cash, pictured) {
    const state = item.locked ? ' locked' : item.price > cash ? ' too-dear' : '';
    const [name, tier] = item.label.split(' · ');
    const picture = pictured ? `<svg class="upgrade-icon" viewBox="0 0 48 48">${UPGRADE_ICONS[item.id] || UPGRADE_ICONS.repair}</svg>` : '';
    return `<button class="shop-row${pictured ? ' pictured' : ''}${state}" data-item="${item.id}">
        <span class="shop-mark">${picture}<span class="shop-key">${index + 1}</span></span>
        <span class="shop-label"><b>${name.toUpperCase()}</b><small>${item.locked || item.detail}</small></span>
        ${tier ? `<span class="shop-tier">${tier.toUpperCase()}${this.pipsMarkup(item.tier)}</span>` : ''}
        <span class="shop-price">${item.price === null ? (item.tier === undefined ? 'DONE' : 'FITTED') : formatCash(item.price)}</span>
      </button>`;
  }

  render() {
    const shop = this.shop;
    const game = this.game;
    const cash = game.player.cash;
    const showroom = shop.layout === 'showroom';
    const rows = shop.stock().map((item, index) => this.rowMarkup(item, index, cash, showroom)).join('');
    const sheet = shop.summary ? this.specSheetMarkup(shop.summary()) : { plate: '', bars: '' };
    this.panel.innerHTML = `
      ${sheet.plate}
      <div class="shop-card" style="border-top-color:${shop.accent}">
        <div class="shop-head"><h2>${shop.title}</h2><div class="shop-cash"><span>CASH</span><b>${formatCash(cash)}</b></div></div>
        <p class="shop-tag">${shop.tagline} · RANK ${game.cred.rank} ${game.cred.title().toUpperCase()} · KEYS 1 TO ${shop.stock().length} BUY</p>
        ${sheet.bars}
        <div class="shop-rows">${rows}</div>
        <button class="shop-close" data-close="1">LEAVE · ESC</button>
      </div>`;
  }

  buy(itemId) {
    const game = this.game;
    const item = this.shop.stock().find((entry) => entry.id === itemId);
    if (!item || item.locked || item.price === null || game.player.cash < item.price) { game.audio.click(); return; }
    if (!this.shop.purchase(item)) { game.audio.click(); return; }
    game.player.cash -= item.price;
    game.stats.spent += item.price;
    game.audio.cashRegister();
    this.render();
  }

  /** While a counter is open the world is paused: number keys buy, Escape or E leaves. */
  updateMenu() {
    if (!this.shop) return;
    const input = this.game.input;
    if (input.wasPressed('Escape', 'KeyE')) { this.close(); return; }
    this.shop.stock().forEach((item, index) => { if (input.wasPressed(`Digit${index + 1}`)) this.buy(item.id); });
  }
}
