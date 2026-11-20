// The HUD's top-left job panel: who gave the job (their portrait), its number and name, one bar cut into the job's
// steps with the step in hand named under it, then four plain lines: what to do NOW, what comes NEXT, the TIME
// LIMIT and what makes the job FAIL. A street race, a taxi fare or a bounty hit takes the panel over while it runs;
// in free roam it points at the next job.
import { completionPercent } from '../progression/completionTracker.js';
import { CHARACTERS, STORY_MISSIONS } from '../missions/storyMissions.js';
import { ECLIPSE_WEEK, formatCountdown } from '../eclipse/eclipseCalendar.js';
import { createElement } from './domBuilder.js';
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
    this.header = createElement('div', 'job-header', name);
    this.title = createElement('div', 'job-title', name);
    this.track = createElement('div', 'job-track', root);
    this.stage = createElement('div', 'job-stage', root);
    this.objective = this.buildLine(root, 'job-objective', 'NOW');
    this.next = this.buildLine(root, 'job-next', 'NEXT');
    this.limit = this.buildLine(root, 'job-limit', 'TIME LIMIT');
    this.fail = this.buildLine(root, 'job-fail', 'FAIL IF');
  }

  /** One labelled line of the panel: a short tag in the panel's accent, then the text. */
  buildLine(root, className, tag) {
    const line = createElement('div', `job-line ${className}`, root);
    const label = createElement('b', 'job-tag', line, tag);
    return { line, label, text: createElement('span', 'job-text', line) };
  }

  /** The story job in progress, in the panel's own terms. */
  storyInfo() {
    const missions = this.game.missions;
    const info = missions.stageInfo();
    if (!info) return null;
    const giver = CHARACTERS[missions.active.mission.giver];
    const limit = missions.timeLimit();
    return {
      header: `STORY JOB ${info.number}/${info.total} · ${giver.name}`, title: info.title, stageLine: `STEP ${info.stage} OF ${info.count} · ${info.name.toUpperCase()}`,
      steps: info.count, stepsDone: info.stage - 1, stepShare: missions.stepShare(), face: giver.name, faceColor: giver.color,
      share: info.share, objective: missions.objectiveText(), next: info.next, limit: limit ? `${formatCountdown(limit.seconds)} · ${limit.until}` : 'NONE', urgent: Boolean(limit) && limit.seconds < 30,
      fail: missions.failConditions().join(' · '), kind: 'story',
    };
  }

  /** Nothing running: point at the next job on offer and count the save's completion. */
  freeRoamInfo() {
    const game = this.game;
    const offer = game.missions.offers()[0];
    const waiting = game.missions.waitingForDay();
    const percent = completionPercent(game);
    return {
      header: `FREE ROAM · ${percent}% COMPLETE`, title: 'Saros is open', stageLine: `STORY ${game.missions.completed.size}/${STORY_MISSIONS.length} JOBS DONE`, share: percent / 100,
      objective: offer ? `Find ${offer.at.name} (${offer.at.icon} on the radar) for the job ${offer.title.toUpperCase()}`
        : waiting ? `${waiting.title} opens ${ECLIPSE_WEEK[waiting.day - 1].name} · rest at CASA REYES (H) to sleep till then` : 'The story is done. The city is yours.',
      next: 'Street races R · bounties ☠ · taxi fares T', limit: '', fail: '', kind: 'roam',
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

  /** Write one labelled line, or hide it when the job in hand has nothing to say there. */
  writeLine(entry, text, tag = null) {
    const cache = this.cache;
    cache.toggle(entry.line, 'empty', !text);
    cache.text(entry.text, text || '');
    if (tag) cache.text(entry.label, tag);
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const info = this.storyInfo() || game.races.panelInfo() || game.activities.panelInfo() || game.bounties.panelInfo() || this.freeRoamInfo();
    // The huge HUD has room for the first words of the header: what kind of job this is, and which.
    cache.text(this.header, game.hud.essentials ? info.header.split(' · ')[0] : info.header);
    cache.text(this.title, info.title.toUpperCase());
    // A long name is set a size smaller, so the huge HUD keeps it on one line.
    cache.toggle(this.title, 'long', info.title.length > 11);
    cache.text(this.stage, info.stageLine);
    cache.toggle(this.stage, 'empty', !info.stageLine);
    cache.html(this.track, this.trackMarkup(info));
    this.writeLine(this.objective, info.objective, info.kind === 'roam' ? 'GO' : 'NOW');
    this.writeLine(this.next, info.next, info.kind === 'roam' ? 'ALSO' : info.nextTag || 'NEXT');
    this.writeLine(this.limit, info.limit, info.limitTag || 'TIME LIMIT');
    this.writeLine(this.fail, info.fail, info.failTag || 'FAIL IF');
    cache.toggle(this.limit.line, 'urgent', Boolean(info.urgent));
    cache.toggle(this.root, 'roam', info.kind === 'roam');
    // Whose job it is: the giver of a story job, the capo with a price on him, or Nova herself between jobs.
    const face = info.face || 'NOVA';
    if (face !== this.drawnFace) {
      this.drawnFace = face;
      drawSpeakerPortrait(this.face, face, info.faceColor || '#ff9e7a');
    }
  }
}
