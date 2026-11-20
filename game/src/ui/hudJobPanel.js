// The HUD's top-left job panel: which job of how many and who gave it, its title, one bar cut into the job's steps
// with the step in hand named under it, then labelled rows: NOW (the objective), NEXT (the step after), TIME LIMIT
// (the clock and what it runs to) and FAIL IF (everything that fails the step). A street race, a taxi fare or a
// bounty hit takes the panel over while it runs; in free roam it points at the next job.
import { completionPercent } from '../progression/completionTracker.js';
import { CHARACTERS, STORY_MISSIONS } from '../missions/storyMissions.js';
import { ECLIPSE_WEEK, formatCountdown } from '../eclipse/eclipseCalendar.js';
import { createElement } from './domBuilder.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

/** A bar is cut into steps up to this many; a longer run (a race's checkpoints) fills one plain bar. */
const MAX_SEGMENTS = 12;
/** The labelled rows the panel has room for under the step's name. */
const ROW_COUNT = 4;

export class HudJobPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel job-panel', parent);
    this.root = root;
    const top = createElement('div', 'job-top', root);
    this.face = createElement('canvas', 'job-face', top);
    this.face.width = 64;
    this.face.height = 64;
    this.drawnFace = '';
    const name = createElement('div', 'job-name', top);
    this.header = createElement('div', 'job-header', name);
    this.title = createElement('div', 'job-title', name);
    this.track = createElement('div', 'job-track', root);
    this.stage = createElement('div', 'job-stage', root);
    this.rows = [];
    for (let index = 0; index < ROW_COUNT; index += 1) {
      const row = createElement('div', 'job-row', root);
      this.rows.push({ row, label: createElement('b', '', row), text: createElement('span', '', row) });
    }
    // The one line the biggest HUD size keeps under the objective: the clock, the reward or the step to come.
    this.accent = createElement('div', 'job-accent', root);
  }

  /** The story job in progress, in the panel's own terms. */
  storyInfo() {
    const missions = this.game.missions;
    const info = missions.stageInfo();
    if (!info) return null;
    const giver = CHARACTERS[missions.active.mission.giver];
    const limit = missions.timeLimit();
    const rows = [['NOW', missions.objectiveText()], ['NEXT', info.next.toUpperCase()]];
    if (limit) rows.push(['TIME LIMIT', `${formatCountdown(limit.seconds)} · ${limit.until}`]);
    rows.push(['FAIL IF', missions.failConditions().join(' · ')]);
    return {
      header: `STORY JOB ${info.number}/${info.total} · ${giver.name}`, title: info.title, stageLine: `STEP ${info.stage} OF ${info.count} · ${info.name.toUpperCase()}`,
      steps: info.count, stepsDone: info.stage - 1, stepShare: missions.stepShare(), face: giver.name, faceColor: giver.color, share: info.share, rows,
      accent: limit ? `${formatCountdown(limit.seconds)} TO ${limit.until}` : `NEXT: ${info.next.toUpperCase()}`, urgent: Boolean(limit) && limit.seconds < 20, kind: 'story',
    };
  }

  /** Nothing running: point at the next job on offer and count the save's completion. */
  freeRoamInfo() {
    const game = this.game;
    const offer = game.missions.offers()[0];
    const waiting = game.missions.waitingForDay();
    const percent = completionPercent(game);
    const now = offer ? `Find ${offer.at.name} (${offer.at.icon} on the radar) for the job ${offer.title.toUpperCase()}`
      : waiting ? `${waiting.title.toUpperCase()} opens ${ECLIPSE_WEEK[waiting.day - 1].name}: rest at CASA REYES (H) to sleep till then` : 'The story is done. The city is yours.';
    return {
      header: `FREE ROAM · ${percent}% COMPLETE`, title: 'Saros is open', stageLine: `STORY JOBS ${game.missions.completed.size}/${STORY_MISSIONS.length} DONE`, share: percent / 100,
      rows: [['NOW', now], ['ALSO', 'STREET RACES R · BOUNTIES ☠ · TAXI FARES T']], accent: `${percent}% COMPLETE`, kind: 'roam',
    };
  }

  /** The bar as markup: one cell per step (done, in hand with its own fill, or still to come), or one plain fill. */
  trackMarkup(info) {
    const percent = (share) => Math.round(Math.max(0, Math.min(1, share)) * 100);
    if (!info.steps || info.steps > MAX_SEGMENTS) return `<i class="whole"><u style="width:${percent(info.share)}%"></u></i>`;
    let cells = '';
    for (let step = 0; step < info.steps; step += 1) {
      const state = step < info.stepsDone ? 'done' : step === info.stepsDone ? 'now' : '';
      cells += `<i class="${state}">${state === 'now' ? `<u style="width:${percent(info.stepShare || 0)}%"></u>` : ''}</i>`;
    }
    return cells;
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const info = this.storyInfo() || game.races.panelInfo() || game.activities.panelInfo() || game.bounties.panelInfo() || this.freeRoamInfo();
    cache.text(this.header, info.header);
    cache.text(this.title, info.title.toUpperCase());
    cache.text(this.stage, info.stageLine);
    cache.toggle(this.stage, 'empty', !info.stageLine);
    cache.html(this.track, this.trackMarkup(info));
    this.rows.forEach((entry, index) => {
      const row = info.rows[index];
      cache.toggle(entry.row, 'empty', !row);
      cache.toggle(entry.row, 'now', index === 0);
      cache.text(entry.label, row ? row[0] : '');
      cache.text(entry.text, row ? row[1] : '');
      cache.toggle(entry.row, 'clock', Boolean(row) && row[0].startsWith('TIME'));
      cache.toggle(entry.row, 'urgent', Boolean(row) && row[0].startsWith('TIME') && Boolean(info.urgent));
    });
    cache.text(this.accent, info.accent || '');
    cache.toggle(this.root, 'roam', info.kind === 'roam');
    // Whose job it is: the giver of a story job, the capo with a price on him, or Nova herself between jobs.
    const face = info.face || 'NOVA';
    if (face !== this.drawnFace) {
      this.drawnFace = face;
      drawSpeakerPortrait(this.face, face, info.faceColor || '#ff9e7a');
    }
  }
}
