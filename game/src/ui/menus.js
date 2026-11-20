// The start screen and the pause menu: continue, new game and load across three save slots (shown as cards with
// rank, cash, completion and time played), statistics, controls and settings, by keyboard or mouse.
import { SAVE_SLOT_COUNT, deleteSaveSlot, freeSaveSlot, latestSaveSlot, listSaveSlots, saveSettings } from '../core/saveGame.js';
import { GAME_TITLE } from '../core/config.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { createElement, formatCash } from './domBuilder.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.start = this.buildScreen('start-menu', `<h1>SOLMARA<em>HEAT</em></h1><p>An open-world crime story · Solmara, the sun coast</p>`);
    this.pause = this.buildScreen('pause-menu', '<h2>PAUSED</h2><p>Solmara waits for nobody.</p>');
    createElement('footer', 'title-footer', this.start, 'WASD move · Mouse look · F steal a car · Click to shoot · M city atlas · Z X C crew favors · Esc pause');
    this.screen = null;
    this.page = 'main';
    this.index = 0;
    this.items = [];
  }

  /** One menu screen: a header, the list of items on the left and a panel for cards and tables on the right. */
  buildScreen(id, headerMarkup) {
    const root = createElement('section', 'menu', document.body);
    root.id = id;
    createElement('header', 'menu-logo', root).innerHTML = headerMarkup;
    createElement('nav', 'menu-list', root);
    createElement('div', 'menu-panel', root);
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
    return root;
  }

  /** Open 'start' or 'pause' on its main page; null closes both. */
  show(screen) {
    this.screen = screen;
    this.page = 'main';
    this.index = 0;
    this.start.classList.toggle('visible', screen === 'start');
    this.pause.classList.toggle('visible', screen === 'pause');
    if (screen) this.render();
  }

  mainItems() {
    const game = this.game;
    if (this.screen === 'start') {
      const items = [];
      const latest = latestSaveSlot();
      if (latest) items.push({ label: 'CONTINUE', hint: `Load slot ${latest}, your latest save`, run: () => game.continueGame(latest) });
      items.push({ label: 'NEW GAME', hint: 'Nova Reyes comes home to Solmara', run: () => (latest ? this.open('new') : game.newGame(freeSaveSlot())) });
      if (latest) items.push({ label: 'LOAD GAME', hint: 'Pick one of three save slots', run: () => this.open('load') });
      items.push({ label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') });
      items.push({ label: 'SETTINGS', hint: 'Sound, mouse and graphics', run: () => this.open('settings') });
      return items;
    }
    return [
      { label: 'RESUME', hint: 'Back to the streets', run: () => game.setState('play') },
      { label: 'CITY ATLAS', hint: 'Map, jobs, progress and save slots', run: () => game.setState('map') },
      { label: 'STATISTICS', hint: 'Your record in Solmara', run: () => this.open('stats') },
      { label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') },
      { label: 'SETTINGS', hint: 'Sound, mouse and graphics', run: () => this.open('settings') },
      { label: 'QUIT TO TITLE', hint: 'Progress since the last save is lost', run: () => game.quitToTitle() },
    ];
  }

  /** One item per save slot: load it, or start a new game in it. */
  slotItems(mode) {
    const cards = listSaveSlots();
    const items = [];
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      const card = cards[slot - 1];
      if (mode === 'load') {
        if (card) items.push({ label: `LOAD SLOT ${slot}`, hint: slotLine(card), run: () => this.game.continueGame(slot) });
      } else {
        items.push({ label: `NEW GAME · SLOT ${slot}`, hint: card ? `Overwrites: ${slotLine(card)}` : 'Empty slot', run: () => { deleteSaveSlot(slot); this.game.newGame(slot); } });
      }
    }
    items.push({ label: 'BACK', hint: '', run: () => this.open('main') });
    return items;
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

  /** The three save slots as cards: rank, cash, completion, jobs done and time played, or EMPTY. */
  slotCardsMarkup() {
    const cards = listSaveSlots().map((card, index) => {
      if (!card) return `<div class="slot-card empty"><b>SLOT ${index + 1}</b><span>EMPTY</span><small>A new story starts here</small></div>`;
      return `<div class="slot-card${card.slot === latestSaveSlot() ? ' latest' : ''}"><b>SLOT ${card.slot}</b><span>${card.percent}% COMPLETE</span>
        <i><u style="width:${card.percent}%"></u></i>
        <small>RANK ${card.rank} ${card.title.toUpperCase()} · ${formatCash(card.cash)}</small>
        <small>${card.jobs}/${STORY_MISSIONS.length} jobs · ${card.district} · ${formatPlayTime(card.playSeconds)}</small></div>`;
    }).join('');
    return `<div class="panel-title">SAVE SLOTS</div><div class="slot-cards">${cards}</div><p class="panel-note">Rest at Casa Reyes to save. Jobs, races and bounties autosave.</p>`;
  }

  statsMarkup() {
    return `<div class="panel-title">STATISTICS</div><div class="menu-table">${statisticRows(this.game).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  render() {
    const root = this.screen === 'start' ? this.start : this.pause;
    const list = root.querySelector('.menu-list');
    const panel = root.querySelector('.menu-panel');
    if (this.page === 'main') this.items = this.mainItems();
    else if (this.page === 'settings') this.items = this.settingsItems();
    else if (this.page === 'load' || this.page === 'new') this.items = this.slotItems(this.page);
    else this.items = [{ label: 'BACK', hint: '', run: () => this.open('main') }];
    list.innerHTML = this.items.map((item, index) => `<button class="menu-item" data-index="${index}"><span>${item.label}</span><small>${item.hint}</small></button>`).join('');
    if (this.page === 'controls') panel.innerHTML = `<div class="panel-title">CONTROLS</div><div class="menu-table">${CONTROLS.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>`;
    else if (this.page === 'stats') panel.innerHTML = this.statsMarkup();
    else if (this.screen === 'start') panel.innerHTML = this.slotCardsMarkup();
    else panel.innerHTML = this.statsMarkup();
    panel.classList.add('visible');
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

/** The record of a playthrough as label and value pairs: the pause menu and the city atlas both show it. */
export function statisticRows(game) {
  const s = game.stats;
  return [
    ['Story jobs passed', `${game.missions.completed.size} / ${STORY_MISSIONS.length}`], ['Jobs failed', s.missionsFailed], ['Cash earned', formatCash(s.earned)], ['Cash spent', formatCash(s.spent)],
    ['Cars stolen', s.carsStolen], ['Distance driven', `${(s.metresDriven / 1000).toFixed(1)} km`], ['Street races won', `${s.racesWon} of ${s.racesRun}`], ['Taxi fares delivered', s.faresDone],
    ['Sun Tokens found', game.activities.tokenCount()], ['Bounties claimed', game.bounties.tally()], ['Highest wanted level', '★'.repeat(s.maxStars) || 'none'], ['Police escapes', s.escapes],
    ['Officers downed', s.copsDowned], ['Marlin guns downed', s.enforcersDowned], ['Helicopters downed', s.choppersDowned], ['Shots fired', s.shotsFired],
    ['Crew favors called', s.favorsUsed], ['Times arrested', s.timesBusted], ['Times wiped out', s.timesWiped], ['Time played', formatPlayTime(s.playSeconds)],
  ];
}

export function formatPlayTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function slotLine(card) {
  return `${card.percent}% · rank ${card.rank} ${card.title} · ${formatCash(card.cash)} · ${formatPlayTime(card.playSeconds)}`;
}

const CONTROLS = [
  ['W A S D', 'Walk · steer, accelerate, brake'], ['Mouse', 'Look around · aim'], ['Shift', 'Sprint · nitro in a car'], ['Space', 'Jump · handbrake'],
  ['F', 'Enter / exit vehicle · carjack'], ['Left click', 'Punch · shoot'], ['Right click', 'Aim'], ['1-5 · Q · wheel', 'Switch weapon'],
  ['R', 'Reload · next radio station'], ['E', 'Shop · workshop · race · save'], ['T', 'Taxi fares (in a Sol Cab)'], ['Z · X · C', 'Crew favors: car, signal jam, patch-up'],
  ['H', 'Horn'], ['M · Tab', `${GAME_TITLE} city atlas`], ['Esc · P', 'Pause'],
];
