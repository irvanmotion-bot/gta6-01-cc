// The city atlas (M): the full map of Solmara beside the progress of the save: completion percentage, the list of
// story jobs with their state, activity tallies, the record of the playthrough and the three save slots.
import { listSaveSlots } from '../core/saveGame.js';
import { completionPercent, completionRows } from '../progression/completionTracker.js';
import { createElement, formatCash } from './domBuilder.js';
import { formatPlayTime, statisticRows } from './menus.js';

export class CityAtlas {
  constructor(game) {
    this.game = game;
    this.root = createElement('div', 'atlas', document.body);
    const mapFrame = createElement('div', 'atlas-map', this.root);
    const canvas = createElement('canvas', '', mapFrame);
    canvas.id = 'city-map';
    this.caption = createElement('div', 'atlas-caption', mapFrame);
    this.side = createElement('div', 'atlas-side', this.root);
  }

  show(visible) {
    this.root.classList.toggle('visible', visible);
    if (!visible) return;
    this.render();
    this.game.minimap.drawFullMap();
  }

  /** The ten jobs, numbered, each done, active, open or locked. */
  jobsMarkup() {
    const marks = { done: '✔', active: '▶', open: '●', locked: '🔒' };
    return this.game.missions.jobList().map((job) => `<div class="atlas-job ${job.state}"><i>${String(job.number).padStart(2, '0')}</i><b>${job.title}</b><span>${job.giver}</span><u>${job.state === 'done' ? marks.done : job.state === 'active' ? `${marks.active} ACTIVE` : job.state === 'open' ? formatCash(job.reward) : 'LOCKED'}</u></div>`).join('');
  }

  activitiesMarkup() {
    return completionRows(this.game).map((row) => `<div class="atlas-activity"><span>${row.label}</span><i><u style="width:${Math.round((row.done / row.total) * 100)}%"></u></i><b>${row.done}/${row.total}</b></div>`).join('');
  }

  slotsMarkup() {
    return listSaveSlots().map((card, index) => {
      const active = index + 1 === this.game.saveSlot;
      if (!card) return `<div class="atlas-slot${active ? ' active' : ''}"><b>SLOT ${index + 1}</b><span>${active ? 'IN USE · NOT SAVED YET' : 'EMPTY'}</span></div>`;
      return `<div class="atlas-slot${active ? ' active' : ''}"><b>SLOT ${card.slot}</b><span>${card.percent}% · RANK ${card.rank} · ${formatCash(card.cash)} · ${formatPlayTime(card.playSeconds)}</span></div>`;
    }).join('');
  }

  render() {
    const game = this.game;
    const percent = completionPercent(game);
    const cred = game.cred;
    const stats = statisticRows(game).filter(([label]) => RECORD_ROWS.includes(label)).map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
    this.caption.textContent = 'CITY ATLAS · M or Esc to close';
    this.side.innerHTML = `
      <div class="atlas-head"><div><h2>SOLMARA</h2><p>RANK ${cred.rank} · ${cred.title().toUpperCase()} · ${cred.points.toLocaleString('en-US')} CRED · ${formatCash(game.player.cash)}</p></div>
        <div class="atlas-percent"><b>${percent}%</b><span>COMPLETE</span></div></div>
      <div class="atlas-bar"><i style="width:${percent}%"></i></div>
      <h3>STORY JOBS · ${game.missions.completed.size}/${game.missions.jobList().length}</h3><div class="atlas-jobs">${this.jobsMarkup()}</div>
      <h3>ACTIVITIES</h3><div class="atlas-activities">${this.activitiesMarkup()}</div>
      <h3>RECORD</h3><div class="atlas-stats">${stats}</div>
      <h3>SAVE SLOTS</h3><div class="atlas-slots">${this.slotsMarkup()}</div>`;
  }
}

/** The statistics the atlas has room for; the pause menu's statistics page shows them all. */
const RECORD_ROWS = ['Cash earned', 'Cash spent', 'Cars stolen', 'Distance driven', 'Highest wanted level', 'Police escapes', 'Officers downed', 'Marlin guns downed', 'Helicopters downed', 'Shots fired', 'Crew favors called', 'Time played'];
