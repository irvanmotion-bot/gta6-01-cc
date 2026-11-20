// The start screen and the pause menu: the logo over a column of big buttons (continue, new game, resume, save,
// load, city map, stats, controls, settings, quit) with the chosen button's hint under them and, beside them, the
// three save slots as rows that load on a click, over the district map of Saros. By keyboard or mouse.
import { SAVE_SLOT_COUNT, deleteSaveSlot, freeSaveSlot, latestSaveSlot, listSaveSlots, saveSettings } from '../core/saveGame.js';
import { CITY_NAME, GAME_TITLE } from '../core/config.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { completionPercent } from '../progression/completionTracker.js';
import { DISTRICTS } from '../world/cityLayout.js';
import { createElement, formatCash } from './domBuilder.js';
import { HUD_SIZES } from './hud.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.start = this.buildScreen('start-menu', `<div class="logo-disc"></div><h1>${GAME_TITLE}</h1><p><b>${CITY_NAME}</b>OPEN-WORLD CRIME GAME</p>`);
    this.pause = this.buildScreen('pause-menu', `<div class="logo-disc"></div><h1>${GAME_TITLE}</h1><p><b>PAUSED</b><span class="pause-where"></span></p>`);
    createElement('footer', 'title-footer', this.start, 'WASD MOVE · MOUSE LOOK · F STEAL A CAR · CLICK SHOOT · M MAP · ESC PAUSE');
    this.screen = null;
    this.page = 'main';
    this.index = 0;
    this.items = [];
  }

  /**
   * One menu screen: the logo, the list of buttons on the left with a line for the chosen button's hint under it,
   * and a panel for the save slots, the map and the tables on the right.
   */
  buildScreen(id, headerMarkup) {
    const root = createElement('section', 'menu', document.body);
    root.id = id;
    createElement('header', 'menu-logo', root).innerHTML = headerMarkup;
    createElement('nav', 'menu-list', root);
    createElement('div', 'menu-hint', root);
    createElement('div', 'menu-panel', root);
    root.addEventListener('click', (event) => {
      // A save-slot row loads its slot; an empty one starts a new week in it.
      const card = event.target.closest('[data-slot]');
      if (card) { this.game.audio.unlock(); this.game.audio.menuSelect(); this.game.continueGame(Number(card.dataset.slot)); return; }
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
    if (screen === 'pause') {
      // Beside PAUSED: the day and hour the week stands at, the slot being played and how much of the game is done.
      const game = this.game;
      this.pause.querySelector('.pause-where').textContent = `${game.calendar.dayName()} ${game.calendar.clockText()} · SLOT ${game.saveSlot} · ${completionPercent(game)}%`;
    }
    if (screen) this.render();
  }

  mainItems() {
    const game = this.game;
    if (this.screen === 'start') {
      const items = [];
      const latest = latestSaveSlot();
      if (latest) items.push({ label: 'CONTINUE', value: `SLOT ${latest}`, hint: `Load slot ${latest}, your latest save`, run: () => game.continueGame(latest) });
      items.push({ label: 'NEW GAME', hint: 'Monday of eclipse week: Nova Reyes comes home', run: () => (latest ? this.open('new') : game.newGame(freeSaveSlot())) });
      if (latest) items.push({ label: 'LOAD GAME', hint: 'Pick one of three save slots', run: () => this.open('load') });
      items.push({ label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') });
      items.push({ label: 'SETTINGS', hint: 'Sound, mouse, HUD size and graphics', run: () => this.open('settings') });
      return items;
    }
    const blocked = game.saveBlockedBy();
    return [
      { label: 'RESUME', hint: 'Back to the streets of Saros', run: () => game.setState('play') },
      { label: 'SAVE GAME', value: `SLOT ${game.saveSlot}`, hint: blocked ? `Cannot save now: ${blocked.toLowerCase()}` : `Write slot ${game.saveSlot} now`, run: () => { if (blocked) game.audio.menuMove(); else { game.saveGame(false, true); this.render(); } } },
      { label: 'LOAD GAME', hint: 'Pick one of three save slots', run: () => this.open('load') },
      { label: 'CITY MAP', hint: 'The atlas: streets, jobs, the week and your progress', run: () => game.setState('map') },
      { label: 'STATS', hint: `Your record in ${CITY_NAME}`, run: () => this.open('stats') },
      { label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') },
      { label: 'SETTINGS', hint: 'Sound, mouse, HUD size and graphics', run: () => this.open('settings') },
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
        if (card) items.push({ label: `LOAD SLOT ${slot}`, value: `${card.percent}%`, hint: slotLine(card), run: () => this.game.continueGame(slot) });
      } else {
        items.push({ label: `NEW IN SLOT ${slot}`, value: card ? `${card.percent}%` : 'EMPTY', hint: card ? `Overwrites: ${slotLine(card)}` : 'Empty slot', run: () => { deleteSaveSlot(slot); this.game.newGame(slot); } });
      }
    }
    items.push({ label: 'BACK', hint: 'To the main menu', run: () => this.open('main') });
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
      { label: 'VOLUME', value: `${Math.round(settings.volume * 100)}%`, hint: 'Master volume', run: cycle('volume', [0, 0.2, 0.4, 0.6, 0.8, 1]) },
      { label: 'MOUSE SPEED', value: settings.sensitivity.toFixed(2), hint: 'Camera sensitivity', run: cycle('sensitivity', [0.5, 0.75, 1, 1.25, 1.5, 2]) },
      { label: 'HUD SIZE', value: (HUD_SIZES[settings.hudSize] || HUD_SIZES.large).label, hint: 'Standard, large, or huge with the essentials only', run: cycle('hudSize', Object.keys(HUD_SIZES)) },
      { label: 'SHADOWS', value: settings.shadows ? 'ON' : 'OFF', hint: 'Turn off for more speed', run: cycle('shadows', [true, false]) },
      { label: 'RENDER SCALE', value: `${Math.round(settings.renderScale * 100)}%`, hint: 'More pixels for smoother edges, fewer for more speed', run: cycle('renderScale', [0.75, 1, 1.5, 2]) },
      { label: 'BACK', hint: 'To the main menu', run: () => this.open('main') },
    ];
  }

  open(page) {
    this.page = page;
    this.index = 0;
    this.render();
  }

  /**
   * The menu's home panel. On top the three save slots as rows, each a button that loads its slot: the slot's
   * number, its completion as a figure and a bar along its foot, the day and job it stands at, and a tag on the
   * slot being played (or the latest one). Under them the district map of Saros, the districts named on it.
   */
  homeMarkup() {
    const paused = this.screen === 'pause';
    const lit = paused ? this.game.saveSlot : latestSaveSlot();
    const cards = listSaveSlots().map((card, index) => {
      const slot = index + 1;
      const tag = slot === lit ? `<strong>${paused ? 'PLAYING' : 'LATEST'}</strong>` : '';
      if (!card) return `<button class="save-card empty${slot === lit ? ' lit' : ''}" data-slot="${slot}"><b>SLOT ${slot}</b><span>NEW</span><em>EMPTY · START HERE</em>${tag}<i><u style="width:0"></u></i></button>`;
      return `<button class="save-card${slot === lit ? ' lit' : ''}" data-slot="${slot}"><b>SLOT ${slot}</b><span>${card.percent}%</span><em>${card.day || 'MON'} · JOB ${card.jobs}/${STORY_MISSIONS.length}</em>${tag}
        <i><u style="width:${card.percent}%"></u></i><small>${formatPlayTime(card.playSeconds)} PLAYED · RANK ${card.rank} · ${formatCash(card.cash)}</small></button>`;
    }).join('');
    return `<div class="save-cards"><div class="save-caption">SAVE SLOTS · CLICK ONE TO LOAD IT</div>${cards}</div>
      <div class="menu-map"><canvas class="menu-map-canvas"></canvas><div class="menu-map-caption">${CITY_NAME.toUpperCase()} · ${Object.keys(DISTRICTS).length} DISTRICTS · PATH OF TOTALITY FRI 17:12</div></div>`;
  }

  statsMarkup() {
    return `<div class="panel-title">STATS · YOUR RECORD</div><div class="menu-table">${statisticRows(this.game).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  render() {
    const root = this.screen === 'start' ? this.start : this.pause;
    const list = root.querySelector('.menu-list');
    const panel = root.querySelector('.menu-panel');
    if (this.page === 'main') this.items = this.mainItems();
    else if (this.page === 'settings') this.items = this.settingsItems();
    else if (this.page === 'load' || this.page === 'new') this.items = this.slotItems(this.page);
    else this.items = [{ label: 'BACK', hint: 'To the main menu', run: () => this.open('main') }];
    list.innerHTML = this.items.map((item, index) => `<button class="menu-item" data-index="${index}"><span>${item.label}</span>${item.value ? `<em>${item.value}</em>` : ''}</button>`).join('');
    if (this.page === 'controls') panel.innerHTML = `<div class="panel-title">CONTROLS</div><div class="menu-table keys">${CONTROLS.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>`;
    else if (this.page === 'stats') panel.innerHTML = this.statsMarkup();
    else panel.innerHTML = this.homeMarkup();
    panel.classList.add('visible');
    panel.classList.toggle('home', this.page !== 'controls' && this.page !== 'stats');
    const map = panel.querySelector('.menu-map-canvas');
    if (map) this.game.minimap.drawDistrictMap(map);
    this.highlight();
  }

  /** Light the chosen button and print its hint on the line under the list. */
  highlight() {
    const root = this.screen === 'start' ? this.start : this.pause;
    root.querySelectorAll('.menu-item').forEach((row, index) => row.classList.toggle('selected', index === this.index));
    const item = this.items[this.index];
    root.querySelector('.menu-hint').textContent = item ? `${item.label}: ${item.hint}` : '';
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

/** The record of a playthrough as label and value pairs: the pause menu's STATS page shows it. */
export function statisticRows(game) {
  const s = game.stats;
  return [
    ['Story jobs passed', `${game.missions.completed.size} / ${STORY_MISSIONS.length}`], ['Jobs failed', s.missionsFailed], ['Cash earned', formatCash(s.earned)], ['Cash spent', formatCash(s.spent)],
    ['Cars stolen', s.carsStolen], ['Distance driven', `${(s.metresDriven / 1000).toFixed(1)} km`], ['Near misses · best combo', `${s.nearMisses} · ×${s.bestCombo}`], ['Stunt money', formatCash(s.stuntCash)],
    ['Street races won', `${s.racesWon} of ${s.racesRun}`], ['Taxi fares delivered', s.faresDone],
    ['Corona Tokens found', game.activities.tokenCount()], ['Bounties claimed', game.bounties.tally()], ['Highest wanted level', '★'.repeat(s.maxStars) || 'none'], ['Police escapes', s.escapes],
    ['Officers downed', s.copsDowned], ['Vane guns downed', s.enforcersDowned], ['Helicopters downed', s.choppersDowned], ['Shots fired', s.shotsFired],
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
  ['W A S D', 'Walk · steer, accelerate, brake'], ['MOUSE', 'Look around · aim'], ['SHIFT', 'Sprint · nitro in a car'], ['SPACE', 'Jump · handbrake'],
  ['F', 'Enter / exit vehicle · carjack'], ['LEFT CLICK', 'Punch · shoot'], ['RIGHT CLICK', 'Aim'], ['1-5 · Q · WHEEL', 'Switch weapon'],
  ['R', 'Reload · next radio station'], ['E', 'Shop · workshop · race · save'], ['T', 'Taxi fares (in a Saros Cab)'], ['L', 'Headlights off and on: run dark'], ['Z · X · C', 'Crew favors: car, signal jam, patch-up'],
  ['H', 'Horn'], ['M · TAB', 'City map'], ['ESC · P', 'Pause'],
];
