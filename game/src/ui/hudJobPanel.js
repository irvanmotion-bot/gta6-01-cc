// The HUD's top-left job panel: who gave the job (their portrait), its name, one bar cut into the job's steps with
// the step in hand named under it, the objective and the timer. A street race, a taxi fare or a bounty hit takes the
// panel over while it runs; in free roam it points at the next job.
import { completionPercent } from '../progression/completionTracker.js';
import { CHARACTERS, STORY_MISSIONS } from '../missions/storyMissions.js';
import { ECLIPSE_WEEK } from '../eclipse/eclipseCalendar.js';
import { createElement, formatClock } from './domBuilder.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

/** A bar is cut into steps up to this many; a longer run (a race's checkpoints) fills one plain bar. */
const MAX_SEGMENTS = 12;

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
    const head = createElement('div', 'job-head', name);
    this.header = createElement('span', 'job-header', head);
    this.timer = createElement('b', 'job-timer', head);
    this.title = createElement('div', 'job-title', name);
    this.track = createElement('div', 'job-track', root);
    this.stage = createElement('div', 'job-stage', root);
    this.objective = createElement('div', 'job-objective', root);
    this.next = createElement('div', 'job-next', root);
  }

  /** The story job in progress, in the panel's own terms. */
  storyInfo() {
    const missions = this.game.missions;
    const info = missions.stageInfo();
    if (!info) return null;
    const giver = CHARACTERS[missions.active.mission.giver];
    return {
      header: `STORY JOB ${info.number} · FROM ${giver.name}`, title: info.title, stageLine: `STEP ${info.stage} OF ${info.count} · ${info.name.toUpperCase()}`,
      steps: info.count, stepsDone: info.stage - 1, stepShare: missions.stepShare(), face: giver.name, faceColor: giver.color,
      share: info.share, objective: missions.objectiveText(), next: info.next, timer: missions.active.timer, counting: 'down', kind: 'story',
    };
  }

  /** Nothing running: point at the next job on offer and count the save's completion. */
  freeRoamInfo() {
    const game = this.game;
    const offer = game.missions.offers()[0];
    const waiting = game.missions.waitingForDay();
    const percent = completionPercent(game);
    return {
      header: 'FREE ROAM', title: 'Saros is open', stageLine: `STORY ${game.missions.completed.size}/${STORY_MISSIONS.length} · ${percent}% COMPLETE`, share: percent / 100,
      objective: offer ? `Next job: ${offer.title} · find ${offer.at.name} (${offer.at.icon} on the radar)`
        : waiting ? `${waiting.title} opens ${ECLIPSE_WEEK[waiting.day - 1].name} · rest at CASA REYES (H) to sleep till then` : 'The story is done. The city is yours.',
      next: 'Races R · bounties ☠ · taxi fares T', timer: null, kind: 'roam',
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
    cache.text(this.objective, `▸ ${info.objective}`);
    cache.text(this.next, info.kind === 'roam' ? info.next : `NEXT ▸ ${info.next}`);
    cache.text(this.timer, info.timer === null || info.timer === undefined ? '' : formatClock(info.timer));
    cache.toggle(this.timer, 'urgent', info.counting === 'down' && info.timer !== null && info.timer < 20);
    cache.toggle(this.root, 'roam', info.kind === 'roam');
    // Whose job it is: the giver of a story job, the capo with a price on him, or Nova herself between jobs.
    const face = info.face || 'NOVA';
    if (face !== this.drawnFace) {
      this.drawnFace = face;
      drawSpeakerPortrait(this.face, face, info.faceColor || '#ff9e7a');
    }
  }
}
