// Runs the story: offers jobs at their givers, steps through each one stage by stage, tracks timers and progress,
// and passes or fails it. The HUD's job panel reads its stage number, progress bar and next step from here.
import { CHARACTERS, SETUP_JOB_COUNT, STORY_MISSIONS } from './storyMissions.js';
import { ECLIPSE_WEEK } from '../eclipse/eclipseCalendar.js';
import { CRED_AWARDS } from '../progression/streetCred.js';
import { leaveVehicle } from '../vehicles/carjacking.js';
import { createTrafficDriverFor } from '../vehicles/trafficAI.js';
import { SeededRandom, distance2D } from '../core/random.js';

export class MissionDirector {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(60606);
    this.completed = new Set();
    this.active = null;
    this.cooldown = 0;
  }

  reset(completed = []) {
    this.abandon();
    this.completed = new Set(completed);
  }

  /** The jobs on offer now: not yet passed, with everything they require passed, on or after the day they open. */
  available() {
    const day = this.game.calendar.day;
    return this.unlocked().filter((m) => m.day <= day);
  }

  /** The jobs the story has reached, whatever the day. */
  unlocked() {
    return STORY_MISSIONS.filter((m) => !this.completed.has(m.id) && m.requires.every((id) => this.completed.has(id)));
  }

  /** The next job that is only waiting for its day of the week, when nothing is on offer today. */
  waitingForDay() {
    return this.available().length === 0 ? this.unlocked()[0] || null : null;
  }

  /** How many of the nine setup jobs are still to do: eclipse day does not dawn until this is zero. */
  setupJobsLeft() {
    return STORY_MISSIONS.slice(0, SETUP_JOB_COUNT).filter((m) => !this.completed.has(m.id)).length;
  }

  /** The day of the week a story that has come this far must have reached: the day of its latest passed job. */
  earliestDayOfStory() {
    return STORY_MISSIONS.reduce((day, m) => (this.completed.has(m.id) ? Math.max(day, m.day) : day), 1);
  }

  /** How much faster the week's clock runs right now: Nova holding the door of the Trust hurries the moon along. */
  clockRush() {
    const run = this.active;
    if (!run || !run.step || run.step.kind !== 'awaitTotality') return 1;
    const p = this.game.player.position;
    return distance2D(p.x, p.z, run.step.at[0], run.step.at[1]) < run.step.radius ? TOTALITY_RUSH : 1;
  }

  /** One start marker per giver: the first job that giver has on offer. */
  offers() {
    const seen = new Set();
    return this.available().filter((m) => (seen.has(m.giver) ? false : seen.add(m.giver)));
  }

  isStoryComplete() {
    return this.completed.size === STORY_MISSIONS.length;
  }

  /** Every job with its number and state, for the map screen's job list. */
  jobList() {
    return STORY_MISSIONS.map((mission, index) => {
      const done = this.completed.has(mission.id);
      const open = !done && mission.requires.every((id) => this.completed.has(id)) && mission.day <= this.game.calendar.day;
      return { number: index + 1, title: mission.title, giver: CHARACTERS[mission.giver].name, reward: mission.reward, day: ECLIPSE_WEEK[mission.day - 1].short, state: done ? 'done' : this.active && this.active.mission === mission ? 'active' : open ? 'open' : 'locked' };
    });
  }

  start(mission) {
    const game = this.game;
    const stages = mission.steps.filter((step) => step.stage).map((step) => step.stage);
    this.active = { mission, index: -1, step: null, timer: null, vehicle: null, tag: mission.id, remaining: [], targets: [], total: 0, progress: 0, stages, stage: 0, number: STORY_MISSIONS.indexOf(mission) + 1 };
    if (mission.hour !== undefined) game.calendar.setHour(mission.hour);
    game.hud.banner(mission.title.toUpperCase(), `Job ${this.active.number} · ${CHARACTERS[mission.giver].name} · reward $${mission.reward.toLocaleString('en-US')}`, '#ffb547');
    game.audio.menuSelect();
    this.advance();
  }

  /** Enter the next step; instant steps (say, give) run and move straight on. */
  advance() {
    const game = this.game;
    const run = this.active;
    run.index += 1;
    if (run.index >= run.mission.steps.length) { this.pass(); return; }
    const step = run.mission.steps[run.index];
    run.step = step;
    run.progress = 0;
    run.timer = step.time || null;
    if (step.stage) {
      run.stage = run.stages.indexOf(step.stage) + 1;
      if (run.stage > 1) game.cred.earn(CRED_AWARDS.stage, `stage ${run.stage - 1} done`);
    }
    if (step.stars && step.kind !== 'steal') game.wanted.setStars(step.stars, 8);
    // From an on-foot step on, the job's car is just a car: losing it no longer fails the job.
    if (step.onFoot && run.vehicle) { run.vehicle.missionTag = null; run.vehicle.ambient = true; run.vehicle = null; }
    if (step.kind === 'say') {
      for (const [who, line] of step.lines) game.hud.say(CHARACTERS[who].name, line, CHARACTERS[who].color);
      this.advance();
    } else if (step.kind === 'give') {
      if (step.weapon) { game.weapons.give(step.weapon, step.ammo); game.hud.notify(`Received: ${game.weapons.nameOf(step.weapon)}`); }
      if (step.armor) game.player.armor = Math.max(game.player.armor, step.armor);
      this.advance();
    } else if (step.kind === 'steal') {
      this.clearSpot(step.at[0], step.at[1]);
      run.vehicle = game.vehicles.spawn(step.model, step.at[0], step.at[1], step.heading, step.paint);
      run.vehicle.missionTag = run.tag;
      run.vehicle.missionOwned = true;
      run.vehicle.parked = true;
      run.stealStars = step.stars || 0;
    } else if (step.kind === 'eliminate') {
      for (const [x, z] of step.spots) game.gunmen.spawn(step.enemy, x, z, run.tag);
      run.total = step.spots.length;
      game.gunmen.alertFaction('gang', step.spots[0][0], step.spots[0][1]);
    } else if (step.kind === 'destroy') {
      run.targets = step.spots.map(([x, z, heading]) => this.spawnFleeingTarget(step, x, z, heading, run.tag));
      run.total = run.targets.length;
    } else if (step.kind === 'collect' || step.kind === 'race') {
      run.remaining = step.points.map((p) => ({ x: p[0], z: p[1] }));
      run.total = run.remaining.length;
    } else if (step.kind === 'loseCops' && game.wanted.stars === 0) {
      this.advance();
    }
  }

  clearSpot(x, z) {
    for (const other of [...this.game.vehicles.list]) {
      if (other.driver !== 'player' && distance2D(other.position.x, other.position.z, x, z) < 7) this.game.vehicles.remove(other);
    }
  }

  /** A target vehicle whose driver already knows: it runs the grid flat out until it is wrecked. */
  spawnFleeingTarget(step, x, z, heading, tag) {
    this.clearSpot(x, z);
    const target = this.game.vehicles.spawn(step.model, x, z, heading, step.paint);
    target.driver = 'ai';
    target.missionTag = tag;
    target.controller = createTrafficDriverFor(this.game, target, this.rng);
    target.controller.panic(100000);
    return target;
  }

  /** How far the current step has come, 0 to 1, for the bar under the stage name. */
  stepShare() {
    const run = this.active;
    const step = run.step;
    if (step.kind === 'collect' || step.kind === 'race') return (run.total - run.remaining.length) / run.total;
    if (step.kind === 'eliminate') return (run.total - this.game.gunmen.countAlive(run.tag)) / run.total;
    if (step.kind === 'destroy') return run.targets.filter((target) => target.dead).length / run.total;
    if (step.kind === 'wait') return run.progress / step.seconds;
    if (step.kind === 'awaitTotality') return this.game.calendar.coverage();
    if (step.kind === 'loseCops') return this.game.wanted.escapeProgress();
    return 0;
  }

  /** What the job panel shows: job number and title, stage n of m with its name, overall progress and the stage after. */
  stageInfo() {
    const run = this.active;
    if (!run || !run.step) return null;
    const count = run.stages.length;
    const stage = Math.max(1, run.stage);
    return {
      number: run.number, total: STORY_MISSIONS.length, title: run.mission.title, giver: CHARACTERS[run.mission.giver].name, reward: run.mission.reward,
      stage, count, name: run.stages[stage - 1], next: run.stages[stage] || 'Job complete', share: Math.min(1, (stage - 1 + this.stepShare()) / count),
    };
  }

  /**
   * The clock the job runs against: a timed step's own seconds, or, for a job that must be in place before the
   * dark (a step still ahead waits for totality), the eclipse's countdown. Null when nothing is timed.
   */
  timeLimit() {
    const run = this.active;
    if (!run || !run.step) return null;
    if (run.timer !== null) return { seconds: run.timer, label: 'TIME LIMIT' };
    const waitsForDark = run.mission.steps.slice(run.index).some((step) => step.kind === 'awaitTotality');
    const phase = this.game.calendar.phase();
    if (waitsForDark && (phase === 'partial' || phase === 'eclipseDay')) return { seconds: this.game.calendar.secondsToTotality(), label: 'TIME LIMIT · TOTALITY' };
    return null;
  }

  /** What fails the job from here: the clock, the job's car, the sun coming back, and always going down or in. */
  failConditions() {
    const run = this.active;
    if (!run || !run.step) return '';
    const reasons = [];
    if (run.vehicle) reasons.push(`${run.vehicle.spec.name.toUpperCase()} WRECKED`);
    if (run.timer !== null) reasons.push('TIME RUNS OUT');
    if (run.mission.steps.slice(run.index).some((step) => step.kind === 'awaitTotality')) reasons.push('SUN COMES BACK');
    reasons.push('BUSTED', 'WASTED');
    return reasons.slice(0, 3).join(' · ');
  }

  objectiveText() {
    const run = this.active;
    if (!run || !run.step) return '';
    const step = run.step;
    if (step.kind === 'steal' && this.game.player.vehicle === run.vehicle) return step.textIn;
    if (step.kind === 'collect' || step.kind === 'race') return `${step.text} (${run.total - run.remaining.length}/${run.total})`;
    if (step.kind === 'eliminate') return `${step.text} (${this.game.gunmen.countAlive(run.tag)} left)`;
    if (step.kind === 'destroy') return `${step.text} (${run.targets.filter((target) => target.dead).length}/${run.total})`;
    if (step.kind === 'wait') return `${step.text} (${Math.ceil(step.seconds - run.progress)}s)`;
    if (step.kind === 'awaitTotality') return `${step.text} (sun ${Math.round(this.game.calendar.coverage() * 100)}% covered)`;
    if ((step.kind === 'deliver' || step.vehicle) && run.vehicle && this.game.player.vehicle !== run.vehicle) return `Get back in the ${run.vehicle.spec.name}`;
    return step.text;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    this.cooldown -= dt;
    if (!this.active) {
      if (this.cooldown > 0 || !player.alive || game.races.active) return;
      for (const mission of this.offers()) {
        game.markers.show(mission.at.x, mission.at.z, CHARACTERS[mission.giver].color, 1.8, 14);
        const near = distance2D(player.position.x, player.position.z, mission.at.x, mission.at.z) < 2.2;
        if (near && !player.vehicle && game.wanted.stars === 0) { this.start(mission); return; }
        if (near && game.wanted.stars > 0) game.hud.hint('Lose the police before starting a job');
      }
      return;
    }
    const run = this.active;
    const step = run.step;
    const px = player.position.x;
    const pz = player.position.z;
    if (run.timer !== null) {
      run.timer -= dt;
      if (run.timer <= 0) { this.fail('You ran out of time.'); return; }
    }
    if (run.vehicle && run.vehicle.dead) { this.fail(`The ${run.vehicle.spec.name} was destroyed.`); return; }

    if (step.kind === 'steal') {
      game.markers.show(run.vehicle.position.x, run.vehicle.position.z, '#4dabf7', 2.6, 10);
      if (player.vehicle === run.vehicle) {
        if (run.stealStars) game.wanted.setStars(run.stealStars, 8);
        this.advance();
      }
    } else if (step.kind === 'goto' || step.kind === 'deliver') {
      const radius = step.radius || 5;
      game.markers.show(step.at[0], step.at[1], OBJECTIVE_COLOR, Math.min(radius, 6));
      const needsCar = step.kind === 'deliver' || step.vehicle;
      const inside = distance2D(px, pz, step.at[0], step.at[1]) < radius;
      if (inside && (!needsCar || (player.vehicle === run.vehicle && Math.abs(run.vehicle.speed) < 4))) {
        if (step.respray) this.respray(run.vehicle, step.respray);
        if (step.kind === 'deliver') this.handOver(run);
        this.advance();
      }
    } else if (step.kind === 'collect') {
      for (let index = run.remaining.length - 1; index >= 0; index -= 1) {
        const point = run.remaining[index];
        game.markers.show(point.x, point.z, OBJECTIVE_COLOR, 3, 22);
        if (distance2D(px, pz, point.x, point.z) < 4.5) { run.remaining.splice(index, 1); game.audio.checkpoint(); }
      }
      if (run.remaining.length === 0) this.advance();
    } else if (step.kind === 'race') {
      const point = run.remaining[0];
      game.markers.show(point.x, point.z, OBJECTIVE_COLOR, 6, 34);
      if (run.remaining[1]) game.markers.show(run.remaining[1].x, run.remaining[1].z, '#ff9f1c', 4, 12);
      if (distance2D(px, pz, point.x, point.z) < 9) { run.remaining.shift(); game.audio.checkpoint(); }
      if (run.remaining.length === 0) this.advance();
    } else if (step.kind === 'eliminate') {
      if (game.gunmen.countAlive(run.tag) === 0) this.advance();
    } else if (step.kind === 'destroy') {
      for (const target of run.targets) if (!target.dead) game.markers.show(target.position.x, target.position.z, '#ff3b30', 3, 16);
      if (run.targets.every((target) => target.dead)) this.advance();
    } else if (step.kind === 'wait') {
      game.markers.show(step.at[0], step.at[1], '#ff9f1c', step.radius);
      if (distance2D(px, pz, step.at[0], step.at[1]) < step.radius) run.progress += dt;
      if (run.progress >= step.seconds) { game.audio.cashRegister(); this.advance(); }
    } else if (step.kind === 'awaitTotality') {
      // The vault's daylight lock lets go only when the sun does. A sun that has already come back means a missed window.
      game.markers.show(step.at[0], step.at[1], '#f4ecd8', step.radius);
      const phase = game.calendar.phase();
      if (phase === 'totality') this.advance();
      else if (phase === 'waning' || phase === 'after') this.fail('The sun came back. The daylight lock is shut again.');
    } else if (step.kind === 'loseCops') {
      if (game.wanted.stars === 0) this.advance();
    }
  }

  respray(vehicle, paint) {
    const game = this.game;
    game.wanted.clear(false);
    vehicle.repair();
    game.hud.notify('Fresh coat applied. The police are looking for another car.');
    game.audio.cashRegister();
    vehicle.repaint(paint);
  }

  /** The giver takes the delivered car: the player steps out and it no longer belongs to the job. */
  handOver(run) {
    const vehicle = run.vehicle;
    if (this.game.player.vehicle === vehicle) leaveVehicle(this.game, true);
    vehicle.missionTag = null;
    vehicle.ambient = true;
    vehicle.stolen = false;
    vehicle.parked = true;
    run.vehicle = null;
  }

  /** What the minimap should show for the story: objectives while on a job, givers otherwise. */
  blips() {
    const list = [];
    const run = this.active;
    if (!run) {
      for (const mission of this.offers()) list.push({ x: mission.at.x, z: mission.at.z, color: CHARACTERS[mission.giver].color, label: mission.at.icon, pinned: true });
      return list;
    }
    const step = run.step;
    if (!step) return list;
    const pin = (x, z, color) => list.push({ x, z, color, label: '', pinned: true });
    if (step.kind === 'steal') pin(run.vehicle.position.x, run.vehicle.position.z, '#4dabf7');
    else if (step.at) {
      const awayFromCar = (step.kind === 'deliver' || step.vehicle) && run.vehicle && this.game.player.vehicle !== run.vehicle;
      if (awayFromCar) pin(run.vehicle.position.x, run.vehicle.position.z, '#4dabf7');
      else pin(step.at[0], step.at[1], OBJECTIVE_COLOR);
    } else if (step.kind === 'collect') for (const p of run.remaining) pin(p.x, p.z, OBJECTIVE_COLOR);
    else if (step.kind === 'race') pin(run.remaining[0].x, run.remaining[0].z, OBJECTIVE_COLOR);
    else if (step.kind === 'destroy') { for (const target of run.targets) if (!target.dead) pin(target.position.x, target.position.z, '#ff3b30'); }
    else if (step.kind === 'eliminate') {
      for (const g of this.game.gunmen.list) if (g.alive && g.missionTag === run.tag) pin(g.position.x, g.position.z, '#ff3b30');
    }
    return list;
  }

  onGunmanDown() { /* counted live from the gunmen list; kept as the hook other systems call */ }

  onPlayerDown(kind) {
    if (this.active) this.fail(kind === 'busted' ? 'You were arrested.' : 'You were taken down.');
  }

  /** End the running job; a passed job keeps its closing lines playing under the result card. */
  cleanup(clearLines = true) {
    const run = this.active;
    if (!run) return;
    this.game.gunmen.removeTagged(run.tag);
    if (run.vehicle) { run.vehicle.missionTag = null; run.vehicle.ambient = true; }
    for (const target of run.targets) { target.missionTag = null; target.ambient = true; }
    if (clearLines) this.game.hud.clearSpeech();
    this.active = null;
  }

  abandon() {
    this.cleanup();
  }

  fail(reason) {
    const game = this.game;
    this.cleanup();
    this.cooldown = 4;
    game.stats.missionsFailed += 1;
    game.hud.banner('JOB FAILED', reason, '#ff6a4d');
    game.audio.jingle(false);
  }

  pass() {
    const game = this.game;
    const mission = this.active.mission;
    this.completed.add(mission.id);
    this.cleanup(false);
    this.cooldown = 5;
    game.player.addCash(mission.reward);
    game.stats.missionsPassed += 1;
    const waiting = this.waitingForDay();
    const next = STORY_MISSIONS.find((entry) => !this.completed.has(entry.id) && entry.requires.every((id) => this.completed.has(id)));
    const opens = next ? `${next.title.toUpperCase()} · ${ECLIPSE_WEEK[next.day - 1].name.toUpperCase()}` : 'THE CITY IS YOURS';
    game.hud.banner('JOB PASSED', mission.title.toUpperCase(), '#f4ecd8', [
      ['PAID', `+$${mission.reward.toLocaleString('en-US')}`, true], ['STREET CRED', `+${mission.cred}`], ['JOBS DONE', `${this.completed.size} / ${STORY_MISSIONS.length}`], ['NEXT', opens],
    ]);
    if (waiting) game.hud.notify(`Next job opens ${ECLIPSE_WEEK[waiting.day - 1].name}. Rest at Casa Reyes to sleep till then.`);
    game.cred.earn(mission.cred, mission.title);
    game.audio.jingle(true);
    if (this.isStoryComplete()) {
      setTimeout(() => game.hud.banner('SAROS IS YOURS', 'Story complete. The city stays open, and the observatory can show you the eclipse again.', '#ffb547'), 6500);
    }
    game.saveGame(true);
  }
}

const OBJECTIVE_COLOR = '#ffb547';
/** How many times faster the clock runs while Nova waits at the door for the dark. */
const TOTALITY_RUSH = 12;
