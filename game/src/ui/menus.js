// The start screen and the pause menu: the logo over a column of buttons (continue, new game, save, load, atlas,
// statistics, controls, settings) and, beside them, the three save slots as cards that load on a click and the
// district map of Saros with its legend. By keyboard or mouse.
import { SAVE_SLOT_COUNT, deleteSaveSlot, freeSaveSlot, latestSaveSlot, listSaveSlots, saveSettings } from '../core/saveGame.js';
import { CITY_NAME, GAME_TITLE } from '../core/config.js';
import { CHARACTERS, STORY_MISSIONS } from '../missions/storyMissions.js';
import { STREET_RACES } from '../activities/streetRaces.js';
import { VANE_CAPOS } from '../activities/vaneBounties.js';
import { completionPercent, completionRows } from '../progression/completionTracker.js';
import { CRED_RANKS } from '../progression/streetCred.js';
import { DISTRICTS } from '../world/cityLayout.js';
import { createElement, formatCash } from './domBuilder.js';
import { HUD_SIZES } from './hud.js';

/** The pause menu's short names for the first rows of the completion tracker. */
const RECORD_LABELS = { 'Story jobs': 'STORY JOBS', 'Street races won': 'RACES WON', 'Vane bounties': 'BOUNTIES', 'Corona Tokens': 'TOKENS' };

export class Menus {
  constructor(game) {
    this.game = game;
    this.start = this.buildScreen('start-menu', `<div class="logo-disc"></div><h1>${GAME_TITLE}</h1><p>Open-world crime · ${CITY_NAME}, eclipse week</p>`);
    this.pause = this.buildScreen('pause-menu', `<div class="logo-disc"></div><h1>${GAME_TITLE}</h1><p>Game paused</p>`);
    createElement('footer', 'title-footer', this.start, 'WASD move · Mouse look · F steal a car · Click to shoot · M city atlas · Esc pause');
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
      // A save-slot card loads its slot; an empty one starts a new week in it.
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
    if (screen) this.render();
  }

  mainItems() {
    const game = this.game;
    if (this.screen === 'start') {
      const items = [];
      const latest = latestSaveSlot();
      if (latest) items.push({ label: 'CONTINUE', hint: `Load slot ${latest}, your latest save`, run: () => game.continueGame(latest) });
      items.push({ label: 'NEW GAME', hint: 'Monday of eclipse week: Nova Reyes comes home', run: () => (latest ? this.open('new') : game.newGame(freeSaveSlot())) });
      if (latest) items.push({ label: 'LOAD GAME', hint: 'Pick one of three save slots', run: () => this.open('load') });
      items.push({ label: 'CONTROLS', hint: 'Keyboard and mouse', run: () => this.open('controls') });
      items.push({ label: 'SETTINGS', hint: 'Sound, mouse and graphics', run: () => this.open('settings') });
      return items;
    }
    const blocked = game.saveBlockedBy();
    return [
      { label: 'RESUME', hint: 'Back to the streets', run: () => game.setState('play') },
      { label: 'SAVE GAME', hint: blocked || `Write slot ${game.saveSlot} now`, run: () => { if (blocked) game.audio.menuMove(); else { game.saveGame(false, true); this.render(); } } },
      { label: 'LOAD GAME', hint: 'Pick one of three save slots', run: () => this.open('load') },
      { label: 'CITY ATLAS', hint: 'Map, jobs, progress and save slots', run: () => game.setState('map') },
      { label: 'STATISTICS', hint: `Your record in ${CITY_NAME}`, run: () => this.open('stats') },
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
      { label: `HUD SIZE · ${(HUD_SIZES[settings.hudSize] || HUD_SIZES.standard).label}`, hint: 'Standard, large, or huge with only the essentials', run: cycle('hudSize', Object.keys(HUD_SIZES)) },
      { label: `RENDER SCALE · ${Math.round(settings.renderScale * 100)}%`, hint: 'Draw the city at more pixels for smoother edges', run: cycle('renderScale', [1, 1.5, 2]) },
      { label: 'BACK', hint: '', run: () => this.open('main') },
    ];
  }

  open(page) {
    this.page = page;
    this.index = 0;
    this.render();
  }

  /**
   * The menu's home panel. On top the three save slots, a wide row each and a button that loads its slot: SAVE SLOT
   * and its number, the day and job it stands at, its completion as a big figure and a bar. Under them, the district
   * map of Saros with its legend; and beside the map, on the pause menu, the record of the week being played.
   */
  homeMarkup() {
    const lit = this.screen === 'pause' ? this.game.saveSlot : latestSaveSlot();
    const rows = listSaveSlots().map((card, index) => {
      const slot = index + 1;
      const tag = slot === lit ? `<strong>${this.screen === 'pause' ? 'PLAYING' : 'LATEST'}</strong>` : '';
      if (!card) return `<button class="save-row empty${slot === lit ? ' lit' : ''}" data-slot="${slot}"><b>SAVE SLOT ${slot}</b><em>EMPTY · NEW WEEK</em><span>NEW</span><i><u style="width:0"></u></i>${tag}</button>`;
      return `<button class="save-row${slot === lit ? ' lit' : ''}" data-slot="${slot}"><b>SAVE SLOT ${slot}</b><em>${card.day || 'MON'} · JOB ${card.jobs}/${STORY_MISSIONS.length}</em><span>${card.percent}%</span>
        <i><u style="width:${card.percent}%"></u></i><small>${formatPlayTime(card.playSeconds)} PLAYED · RANK ${card.rank} ${card.title.toUpperCase()} · ${formatCash(card.cash)}</small>${tag}</button>`;
    }).join('');
    // The legend names each district by the word that tells it apart: Strand, Square, Market, Hill, Yards, Gardens.
    const districts = Object.values(DISTRICTS).map((district) => `<li><i style="background:${district.map}"></i>${district.name.split(' ')[1]}</li>`).join('');
    const legend = `<ul class="menu-legend">${districts}<li><i class="sea"></i>Sound</li><li><i class="path"></i>Totality</li><li><i class="place"></i>Landmark</li></ul>`;
    const record = this.screen === 'pause' ? this.recordMarkup() : this.weekMarkup();
    return `<div class="save-rows">${rows}</div>
      <div class="menu-lower"><div class="menu-map"><div class="menu-map-title">MAP OF ${CITY_NAME.toUpperCase()} · 6 DISTRICTS</div><canvas class="menu-map-canvas"></canvas>${legend}</div>${record}</div>`;
  }

  /**
   * The pause menu's record of the week in play, in big figures: rank and street cred, the share of the game done,
   * then story jobs, races, bounties and tokens as done-of-total, and the crew's contacts.
   */
  recordMarkup() {
    const game = this.game;
    const cred = game.cred;
    const tallies = completionRows(game).slice(0, 4).map((row) => `<div><span>${RECORD_LABELS[row.label] || row.label.toUpperCase()}</span><b>${row.done}/${row.total}</b></div>`).join('');
    const contacts = Object.values(CHARACTERS).filter((character) => character.name !== 'NOVA').map((character) => `<li><b>${character.name}</b>${character.job}</li>`).join('');
    return `<div class="menu-record"><div class="record-rank">NOVA · ${cred.title().toUpperCase()}</div>
      <div class="record-rows"><div><span>RANK</span><b>${cred.rank} OF ${CRED_RANKS.length}</b></div><div><span>STREET CRED</span><b>${cred.points.toLocaleString('en-US')}</b></div><div><span>COMPLETE</span><b>${completionPercent(game)}%</b></div>${tallies}</div>
      <div class="record-title">CONTACTS</div><ul class="record-contacts">${contacts}</ul></div>`;
  }

  /** The start screen's side of the map: what the week holds, as one figure a line. */
  weekMarkup() {
    const lines = [[STORY_MISSIONS.length, 'STORY JOBS'], [STREET_RACES.length, 'STREET RACES'], [VANE_CAPOS.length, 'BOUNTIES'], [12, 'CORONA TOKENS'], [5, 'WEAPONS'], [3, 'CREW FAVORS']];
    return `<div class="menu-record"><div class="record-rank">ECLIPSE WEEK IN ${CITY_NAME.toUpperCase()}</div>
      <div class="record-rows">${lines.map(([count, label]) => `<div><span>${label}</span><b>${count}</b></div>`).join('')}</div>
      <div class="record-title">TOTALITY · FRIDAY 17:12</div></div>`;
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
    else panel.innerHTML = this.homeMarkup();
    panel.classList.add('visible');
    panel.classList.toggle('home', this.page !== 'controls' && this.page !== 'stats');
    const map = panel.querySelector('.menu-map-canvas');
    if (map) this.game.minimap.drawDistrictMap(map);
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
  ['W A S D', 'Walk · steer, accelerate, brake'], ['Mouse', 'Look around · aim'], ['Shift', 'Sprint · nitro in a car'], ['Space', 'Jump · handbrake'],
  ['F', 'Enter / exit vehicle · carjack'], ['Left click', 'Punch · shoot'], ['Right click', 'Aim'], ['1-5 · Q · wheel', 'Switch weapon'],
  ['R', 'Reload · next radio station'], ['E', 'Shop · workshop · race · save'], ['T', 'Taxi fares (in a Saros Cab)'], ['L', 'Headlights off and on: run dark'], ['Z · X · C', 'Crew favors: car, signal jam, patch-up'],
  ['H', 'Horn'], ['M · Tab', `${GAME_TITLE} city atlas`], ['Esc · P', 'Pause'],
];
