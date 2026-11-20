// The HUD's top-left job panel: the story job with its number and stage n of m, its title, progress bar, objective
// and timer; a street race or taxi fare when one is running; and in free roam, where the next job waits.
import { completionPercent } from '../progression/completionTracker.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { ECLIPSE_WEEK } from '../eclipse/eclipseCalendar.js';
import { createElement, formatClock } from './domBuilder.js';

export class HudJobPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    const root = createElement('div', 'hud-panel job-panel', parent);
    this.root = root;
    const head = createElement('div', 'job-head', root);
    this.header = createElement('span', 'job-header', head);
    this.timer = createElement('b', 'job-timer', head);
    this.title = createElement('div', 'job-title', root);
    this.stage = createElement('div', 'job-stage', root);
    this.fill = createElement('i', '', createElement('div', 'job-track', root));
    this.objective = createElement('div', 'job-objective', root);
    this.next = createElement('div', 'job-next', root);
  }

  /** The story job in progress, in the panel's own terms. */
  storyInfo() {
    const missions = this.game.missions;
    const info = missions.stageInfo();
    if (!info) return null;
    return {
      header: `JOB ${String(info.number).padStart(2, '0')}/${info.total} · STAGE ${info.stage}/${info.count}`, title: info.title, stageLine: '',
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

  update() {
    const game = this.game;
    const cache = this.cache;
    const info = this.storyInfo() || game.races.panelInfo() || game.activities.panelInfo() || this.freeRoamInfo();
    cache.text(this.header, info.header);
    cache.text(this.title, info.title.toUpperCase());
    cache.text(this.stage, info.stageLine);
    cache.toggle(this.stage, 'empty', !info.stageLine);
    cache.width(this.fill, info.share);
    cache.text(this.objective, `▸ ${info.objective}`);
    cache.text(this.next, info.kind === 'roam' ? info.next : `NEXT ▸ ${info.next}`);
    cache.text(this.timer, info.timer === null || info.timer === undefined ? '' : formatClock(info.timer));
    cache.toggle(this.timer, 'urgent', info.counting === 'down' && info.timer !== null && info.timer < 20);
    cache.toggle(this.root, 'roam', info.kind === 'roam');
  }
}
