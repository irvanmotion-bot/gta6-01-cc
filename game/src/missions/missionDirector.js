// Runs the story: offers jobs at their givers, steps through each one stage by stage, tracks timers and progress,
// and passes or fails it. The HUD's job panel reads its stage number, progress bar and next step from here.
import { CHARACTERS, STORY_MISSIONS } from './storyMissions.js';
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

  /** The jobs on offer now: not yet passed, with everything they require passed. */
  available() {
    return STORY_MISSIONS.filter((m) => !this.completed.has(m.id) && m.requires.every((id) => this.completed.has(id)));
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
      const open = !done && mission.requires.every((id) => this.completed.has(id));
      return { number: index + 1, title: mission.title, giver: CHARACTERS[mission.giver].name, reward: mission.reward, state: done ? 'done' : this.active && this.active.mission === mission ? 'active' : open ? 'open' : 'locked' };
    });
  }

  start(mission) {
    const game = this.game;
    const stages = mission.steps.filter((step) => step.stage).map((step) => step.stage);
    this.active = { mission, index: -1, step: null, timer: null, vehicle: null, tag: mission.id, remaining: [], targets: [], total: 0, progress: 0, stages, stage: 0, number: STORY_MISSIONS.indexOf(mission) + 1 };
    if (mission.hour !== undefined) game.sky.hour = mission.hour;
    game.hud.banner(mission.title.toUpperCase(), `Job ${this.active.number} · ${CHARACTERS[mission.giver].name} · reward $${mission.reward.toLocaleString('en-US')}`, '#ffd60a');
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

  objectiveText() {
    const run = this.active;
    if (!run || !run.step) return '';
    const step = run.step;
    if (step.kind === 'steal' && this.game.player.vehicle === run.vehicle) return step.textIn;
    if (step.kind === 'collect' || step.kind === 'race') return `${step.text} (${run.total - run.remaining.length}/${run.total})`;
    if (step.kind === 'eliminate') return `${step.text} (${this.game.gunmen.countAlive(run.tag)} left)`;
    if (step.kind === 'destroy') return `${step.text} (${run.targets.filter((target) => target.dead).length}/${run.total})`;
    if (step.kind === 'wait') return `${step.text} (${Math.ceil(step.seconds - run.progress)}s)`;
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

  cleanup() {
    const run = this.active;
    if (!run) return;
    this.game.gunmen.removeTagged(run.tag);
    if (run.vehicle) { run.vehicle.missionTag = null; run.vehicle.ambient = true; }
    for (const target of run.targets) { target.missionTag = null; target.ambient = true; }
    this.game.hud.clearSpeech();
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
    game.hud.banner('JOB FAILED', reason, '#ff3b30');
    game.audio.jingle(false);
  }

  pass() {
    const game = this.game;
    const mission = this.active.mission;
    this.completed.add(mission.id);
    this.cleanup();
    this.cooldown = 5;
    game.player.addCash(mission.reward);
    game.stats.missionsPassed += 1;
    game.hud.banner('JOB PASSED', `+$${mission.reward.toLocaleString('en-US')} · +${mission.cred} cred`, '#2ecc71');
    game.cred.earn(mission.cred, mission.title);
    game.audio.jingle(true);
    if (this.isStoryComplete()) {
      setTimeout(() => game.hud.banner('SOLMARA IS YOURS', 'Story complete. The city stays open: races, fares, bounties and trouble.', '#ffd60a'), 6500);
    }
    game.saveGame(true);
  }
}

const OBJECTIVE_COLOR = '#ffd60a';
