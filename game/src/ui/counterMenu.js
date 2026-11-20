// The shop counter shared by Ammo Amigo and Bravo's workshop: numbered rows with a price, bought by key or click.
// The gun counter is a card in the middle of the screen; the workshop's fills the right half, beside the car on its
// turntable, with the car's spec sheet above the upgrade rows.
import { createElement, formatCash } from './domBuilder.js';

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

  render() {
    const shop = this.shop;
    const game = this.game;
    const cash = game.player.cash;
    const rows = shop.stock().map((item, index) => `
      <button class="shop-row${item.locked ? ' locked' : item.price > cash ? ' too-dear' : ''}" data-item="${item.id}">
        <span class="shop-key">${index + 1}</span>
        <span class="shop-label">${item.label}<small>${item.locked || item.detail}</small></span>
        ${this.pipsMarkup(item.tier)}
        <span class="shop-price">${item.price === null ? '—' : formatCash(item.price)}</span>
      </button>`).join('');
    const sheet = shop.summary ? this.specSheetMarkup(shop.summary()) : { plate: '', bars: '' };
    this.panel.innerHTML = `
      ${sheet.plate}
      <div class="shop-card" style="border-top-color:${shop.accent}">
        <h2>${shop.title}</h2>
        <p class="shop-tag">${shop.tagline} · Rank ${game.cred.rank} ${game.cred.title()}</p>
        <div class="shop-cash"><span>CASH</span><b>${formatCash(cash)}</b></div>
        ${sheet.bars}
        ${rows}
        <button class="shop-close" data-close="1">Leave (Esc)</button>
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
