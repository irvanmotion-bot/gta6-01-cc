// The city atlas (M): the full map of Saros with its districts and the path of totality on the left; on the right
// the game's logo and the save's progress: completion, the five days of eclipse week with each day's story jobs,
// activity tallies and the three save slots as big cards. (The full record is the pause menu's statistics page.)
import { GAME_TITLE } from '../core/config.js';
import { ECLIPSE_WEEK } from '../eclipse/eclipseCalendar.js';
import { listSaveSlots } from '../core/saveGame.js';
import { completionPercent, completionRows } from '../progression/completionTracker.js';
import { createElement, formatCash } from './domBuilder.js';
import { formatPlayTime } from './menus.js';

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

  /**
   * The three save slots as big cards: the slot's number, how far its week has come as a figure and a bar, the day
   * and job it stands at, and its rank, cash and hours. The slot being played is lit and tagged.
   */
  slotsMarkup() {
    const total = this.game.missions.jobList().length;
    return listSaveSlots().map((card, index) => {
      const active = index + 1 === this.game.saveSlot;
      const tag = active ? '<strong>PLAYING</strong>' : '';
      if (!card) return `<div class="atlas-slot empty${active ? ' active' : ''}"><b>${index + 1}</b><span>${active ? 'NEW' : 'EMPTY'}</span><i><u style="width:0"></u></i><em>${active ? 'NOT SAVED YET' : 'A NEW WEEK'}</em><small>Rest at Casa Reyes to save</small>${tag}</div>`;
      return `<div class="atlas-slot${active ? ' active' : ''}"><b>${card.slot}</b><span>${card.percent}%</span><i><u style="width:${card.percent}%"></u></i><em>${card.day || 'MON'} · JOB ${card.jobs}/${total}</em><small>RANK ${card.rank} · ${formatCash(card.cash)} · ${formatPlayTime(card.playSeconds)}</small>${tag}</div>`;
    }).join('');
  }

  render() {
    const game = this.game;
    const percent = completionPercent(game);
    const cred = game.cred;
    const readout = game.calendar.readout();
    this.caption.textContent = 'CITY ATLAS OF SAROS · M or Esc to close';
    this.side.innerHTML = `
      <div class="atlas-head"><div class="atlas-logo"><i class="atlas-disc"></i><h2>${GAME_TITLE}</h2><p>RANK ${cred.rank} · ${cred.title().toUpperCase()} · ${formatCash(game.player.cash)}</p></div>
        <div class="atlas-percent"><b>${percent}%</b><span>COMPLETE</span></div></div>
      <div class="atlas-bar"><i style="width:${percent}%"></i></div>
      <h3>ECLIPSE WEEK · ${game.calendar.dayName()} ${game.calendar.clockText()} · ${readout.big} ${readout.line}</h3>
      <div class="atlas-week">${this.weekMarkup()}</div>
      <h3>ACTIVITIES</h3><div class="atlas-activities">${this.activitiesMarkup()}</div>
      <h3>SAVE SLOTS · REST AT CASA REYES TO SAVE</h3><div class="atlas-slots">${this.slotsMarkup()}</div>`;
  }
}
