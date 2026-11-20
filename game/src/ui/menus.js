// The start screen and the pause menu: new game, continue, map, statistics, controls and settings, by keyboard or mouse.
import { hasSavedGame, saveSettings } from '../core/saveGame.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';

const CONTROLS = [
  ['W A S D', 'Walk · steer, accelerate, brake'], ['Mouse', 'Look around · aim'], ['Shift', 'Sprint'], ['Space', 'Jump · handbrake'],
  ['F', 'Enter / exit vehicle · carjack'], ['Left click', 'Punch · shoot'], ['Right click', 'Aim'], ['1-5 · Q · wheel', 'Switch weapon'],
  ['R', 'Reload · next radio station'], ['E', 'Shop · save at the safehouse'], ['T', 'Taxi fares (in a Sol Cab)'], ['H', 'Horn'],
  ['M', 'City map'], ['Esc · P', 'Pause'],
];

export class Menus {
  constructor(game) {
    this.game = game;
    this.start = document.getElementById('start-menu');
    this.pause = document.getElementById('pause-menu');
    this.mapScreen = document.getElementById('map-screen');
    this.screen = null;
    this.page = 'main';
    this.index = 0;
    this.items = [];
    for (const root of [this.start, this.pause]) {
      root.addEventListener('click', (event) => {
        const row = event.target.closest('[data-index]');
        if (!row) return;
        this.index = Number(row.dataset.index);
        this.activate();
      });
      root.addEventListener('mousemove', (event) => {
        const row = event.target.closest('[data-index]');
        if (row && Number(row.dataset.index) !== this.index) { this.index = Number(row.dataset.index); this.highlight(); }
      });
    }
  }

  /** Open 'start' or 'pause' on its main page; null closes both. */
  show(screen) {
    this.screen = screen;
    this.page = 'main';
    this.index = 0;
    this.start.classList.toggle('visible', screen === 'start');
    this.pause.classList.toggle('visible', screen === 'pause');
    this.mapScreen.classList.remove('visible');
    if (screen) this.render();
  }

  showMap(visible) {
    this.mapScreen.classList.toggle('visible', visible);
    if (visible) this.game.minimap.drawFullMap();
  }

  mainItems() {
    const game = this.game;
    if (this.screen === 'start') {
      const items = [];
      if (hasSavedGame()) items.push({ label: 'CONTINUE', hint: 'Load your save from Casa Reyes', run: () => game.continueGame() });
      items.push({ label: 'NEW GAME', hint: 'Nova Reyes comes home to Solmara', run: () => game.newGame() });
      items.push({ label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') });
      items.push({ label: 'SETTINGS', hint: 'Sound, mouse and graphics', run: () => this.open('settings') });
      return items;
    }
    return [
      { label: 'RESUME', hint: 'Back to the streets', run: () => game.setState('play') },
      { label: 'CITY MAP', hint: 'Districts, shops and objectives', run: () => game.setState('map') },
      { label: 'STATISTICS', hint: 'Your record in Solmara', run: () => this.open('stats') },
      { label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') },
      { label: 'SETTINGS', hint: 'Sound, mouse and graphics', run: () => this.open('settings') },
      { label: 'QUIT TO TITLE', hint: 'Unsaved progress is lost', run: () => game.quitToTitle() },
    ];
  }

  settingsItems() {
    const game = this.game;
    const settings = game.settings;
    const cycle = (key, values) => () => {
      settings[key] = values[(values.indexOf(settings[key]) + 1) % values.length];
      saveSettings(settings);
      game.applySettings();
      this.render();
    };
    return [
      { label: `VOLUME · ${Math.round(settings.volume * 100)}%`, hint: 'Master volume', run: cycle('volume', [0, 0.2, 0.4, 0.6, 0.8, 1]) },
      { label: `MOUSE SPEED · ${settings.sensitivity.toFixed(2)}`, hint: 'Camera sensitivity', run: cycle('sensitivity', [0.5, 0.75, 1, 1.25, 1.5, 2]) },
      { label: `SHADOWS · ${settings.shadows ? 'ON' : 'OFF'}`, hint: 'Turn off for more speed', run: cycle('shadows', [true, false]) },
      { label: 'BACK', hint: '', run: () => this.open('main') },
    ];
  }

  open(page) {
    this.page = page;
    this.index = 0;
    this.render();
  }

  statsMarkup() {
    const game = this.game;
    const s = game.stats;
    const minutes = Math.floor(s.playSeconds / 60);
    const rows = [
      ['Story missions passed', `${game.missions.completed.size} / ${STORY_MISSIONS.length}`], ['Missions failed', s.missionsFailed], ['Cash earned', `$${Math.round(s.earned).toLocaleString('en-US')}`],
      ['Cars stolen', s.carsStolen], ['Taxi fares delivered', s.faresDone], ['Sun Tokens found', game.activities.tokenCount()], ['Highest wanted level', '★'.repeat(s.maxStars) || 'none'],
      ['Officers downed', s.copsDowned], ['Marlin enforcers downed', s.enforcersDowned], ['Helicopters downed', s.choppersDowned], ['Shots fired', s.shotsFired],
      ['Times arrested', s.timesBusted], ['Times wiped out', s.timesWiped], ['Time played', `${Math.floor(minutes / 60)}h ${minutes % 60}m`],
    ];
    return `<div class="menu-table">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  render() {
    const root = this.screen === 'start' ? this.start : this.pause;
    const list = root.querySelector('.menu-list');
    const panel = root.querySelector('.menu-panel');
    if (this.page === 'main') this.items = this.mainItems();
    else if (this.page === 'settings') this.items = this.settingsItems();
    else this.items = [{ label: 'BACK', hint: '', run: () => this.open('main') }];
    list.innerHTML = this.items.map((item, index) => `<button class="menu-item" data-index="${index}"><span>${item.label}</span><small>${item.hint}</small></button>`).join('');
    if (this.page === 'controls') panel.innerHTML = `<div class="menu-table">${CONTROLS.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>`;
    else if (this.page === 'stats') panel.innerHTML = this.statsMarkup();
    else panel.innerHTML = '';
    panel.classList.toggle('visible', this.page === 'controls' || this.page === 'stats');
    this.highlight();
  }

  highlight() {
    const root = this.screen === 'start' ? this.start : this.pause;
    root.querySelectorAll('.menu-item').forEach((row, index) => row.classList.toggle('selected', index === this.index));
  }

  activate() {
    const item = this.items[this.index];
    if (!item) return;
    this.game.audio.unlock();
    this.game.audio.menuSelect();
    item.run();
  }

  /** Keyboard navigation while a menu is open. */
  update() {
    if (!this.screen) return;
    const input = this.game.input;
    const move = (input.wasPressed('ArrowDown', 'KeyS') ? 1 : 0) - (input.wasPressed('ArrowUp', 'KeyW') ? 1 : 0);
    if (move !== 0) {
      this.index = (this.index + move + this.items.length) % this.items.length;
      this.game.audio.menuMove();
      this.highlight();
    }
    if (input.wasPressed('Enter', 'Space')) this.activate();
    if (input.wasPressed('Escape', 'KeyP', 'Backspace')) {
      if (this.page !== 'main') this.open('main');
      else if (this.screen === 'pause') this.game.setState('play');
    }
  }
}
