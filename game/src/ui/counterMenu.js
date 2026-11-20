// The shop counter card shared by Ammo Amigo and Bravo's workshop: numbered rows with a price, bought by key or click.
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
   * { id, label, detail, price, locked } and `purchase(row)` returning true when the sale went through.
   */
  open(shop) {
    this.shop = shop;
    this.game.setState('shop');
    this.panel.classList.add('visible');
    this.render();
  }

  close() {
    if (!this.shop) return;
    this.shop = null;
    this.panel.classList.remove('visible');
    this.game.setState('play');
  }

  render() {
    const shop = this.shop;
    const cash = this.game.player.cash;
    const rows = shop.stock().map((item, index) => `
      <button class="shop-row${item.locked ? ' locked' : item.price > cash ? ' too-dear' : ''}" data-item="${item.id}">
        <span class="shop-key">${index + 1}</span>
        <span class="shop-label">${item.label}<small>${item.locked || item.detail}</small></span>
        <span class="shop-price">${item.price === null ? '—' : formatCash(item.price)}</span>
      </button>`).join('');
    this.panel.innerHTML = `
      <div class="shop-card" style="border-top-color:${shop.accent}">
        <h2>${shop.title}</h2>
        <p class="shop-tag">${shop.tagline} · Cash ${formatCash(cash)} · Rank ${this.game.cred.rank} ${this.game.cred.title()}</p>
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
