// The city atlas (M): the full map of Saros with its districts and the path of totality on the left; on the right
// the save's progress: completion, the five days of eclipse week with each day's story jobs, activity tallies, the
// record of the playthrough and the three save slots.
import { GAME_TITLE } from '../core/config.js';
import { ECLIPSE_WEEK } from '../eclipse/eclipseCalendar.js';
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

  /** The week as five columns, Monday to eclipse Friday: each day's jobs, done, active, open or still locked. */
  weekMarkup() {
    const calendar = this.game.calendar;
    const jobs = this.game.missions.jobList();
    return ECLIPSE_WEEK.map((day, index) => {
      const today = calendar.day === index + 1;
      const cells = jobs.filter((job) => job.day === day.short).map((job) => `<div class="atlas-job ${job.state}"><i>${String(job.number).padStart(2, '0')}</i><b>${job.title}</b><u>${job.state === 'done' ? '✔' : job.state === 'active' ? '▶' : job.state === 'open' ? formatCash(job.reward) : '···'}</u></div>`).join('');
      return `<div class="atlas-day${today ? ' today' : ''}${calendar.day > index + 1 ? ' past' : ''}"><h4>${day.short}${index === ECLIPSE_WEEK.length - 1 ? ' ◐' : ''}</h4>${cells}</div>`;
    }).join('');
  }

  activitiesMarkup() {
    return completionRows(this.game).map((row) => `<div class="atlas-activity"><span>${row.label}</span><i><u style="width:${Math.round((row.done / row.total) * 100)}%"></u></i><b>${row.done}/${row.total}</b></div>`).join('');
  }

  slotsMarkup() {
    return listSaveSlots().map((card, index) => {
      const active = index + 1 === this.game.saveSlot;
      if (!card) return `<div class="atlas-slot${active ? ' active' : ''}"><b>SLOT ${index + 1}</b><span>${active ? 'IN USE' : 'EMPTY'}</span><small>${active ? 'not saved yet' : 'a new week starts here'}</small></div>`;
      return `<div class="atlas-slot${active ? ' active' : ''}"><b>SLOT ${card.slot}</b><span>${card.percent}% · ${card.day || 'MON'}</span><small>RANK ${card.rank} · ${formatCash(card.cash)} · ${formatPlayTime(card.playSeconds)}</small></div>`;
    }).join('');
  }

  render() {
    const game = this.game;
    const percent = completionPercent(game);
    const cred = game.cred;
    const readout = game.calendar.readout();
    const stats = statisticRows(game).filter(([label]) => RECORD_ROWS.includes(label)).map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
    this.caption.textContent = 'CITY ATLAS OF SAROS · M or Esc to close';
    this.side.innerHTML = `
      <div class="atlas-head"><div><h2>${GAME_TITLE}</h2><p>RANK ${cred.rank} · ${cred.title().toUpperCase()} · ${cred.points.toLocaleString('en-US')} CRED · ${formatCash(game.player.cash)}</p></div>
        <div class="atlas-percent"><b>${percent}%</b><span>COMPLETE</span></div></div>
      <div class="atlas-bar"><i style="width:${percent}%"></i></div>
      <h3>ECLIPSE WEEK · ${game.calendar.dayName()} ${game.calendar.clockText()} · ${readout.big} ${readout.line} · STORY ${game.missions.completed.size}/${game.missions.jobList().length}</h3>
      <div class="atlas-week">${this.weekMarkup()}</div>
      <h3>ACTIVITIES</h3><div class="atlas-activities">${this.activitiesMarkup()}</div>
      <h3>RECORD</h3><div class="atlas-stats">${stats}</div>
      <h3>SAVE SLOTS</h3><div class="atlas-slots">${this.slotsMarkup()}</div>`;
  }
}

/** The statistics the atlas has room for; the pause menu's statistics page shows them all. */
const RECORD_ROWS = ['Cash earned', 'Cars stolen', 'Distance driven', 'Highest wanted level', 'Police escapes', 'Officers downed', 'Vane guns downed', 'Time played'];
