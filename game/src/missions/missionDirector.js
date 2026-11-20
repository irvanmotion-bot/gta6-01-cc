// Runs the story: offers missions at their givers, steps through each one, tracks timers, and passes or fails it.
import { distance2D } from '../core/random.js';
import { leaveVehicle } from '../vehicles/carjacking.js';
import { CHARACTERS, STORY_MISSIONS } from './storyMissions.js';

const OBJECTIVE_COLOR = '#ffd60a';

export class MissionDirector {
  constructor(game) {
    this.game = game;
    this.completed = new Set();
    this.active = null;
    this.cooldown = 0;
  }

  reset(completed = []) {
    this.abandon();
    this.completed = new Set(completed);
  }

  /** The missions on offer now: not yet passed, with everything they require passed. */
  available() {
    return STORY_MISSIONS.filter((m) => !this.completed.has(m.id) && m.requires.every((id) => this.completed.has(id)));
  }

  /** One start marker per giver: the first mission that giver has on offer. */
  offers() {
    const seen = new Set();
    return this.available().filter((m) => (seen.has(m.giver) ? false : seen.add(m.giver)));
  }

  isStoryComplete() {
    return this.completed.size === STORY_MISSIONS.length;
  }

  start(mission) {
    const game = this.game;
    this.active = { mission, index: -1, step: null, timer: null, vehicle: null, tag: mission.id, remaining: [], progress: 0 };
    game.hud.banner(mission.title.toUpperCase(), `${CHARACTERS[mission.giver].name} · reward $${mission.reward.toLocaleString('en-US')}`, '#ffd60a');
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
    if (step.stars && step.kind !== 'steal') game.wanted.setStars(step.stars, 8);
    if (step.kind === 'say') {
      for (const [who, line] of step.lines) game.hud.say(CHARACTERS[who].name, line, CHARACTERS[who].color);
      this.advance();
    } else if (step.kind === 'give') {
      if (step.weapon) { game.weapons.give(step.weapon, step.ammo); game.hud.notify(`Received: ${step.weapon === 'pistol' ? 'Viper 9' : step.weapon === 'smg' ? 'Hornet SMG' : 'Longshot AR'}`); }
      if (step.armor) game.player.armor = step.armor;
      this.advance();
    } else if (step.kind === 'steal') {
      for (const other of [...game.vehicles.list]) {
        if (other.driver !== 'player' && distance2D(other.position.x, other.position.z, step.at[0], step.at[1]) < 7) game.vehicles.remove(other);
      }
      run.vehicle = game.vehicles.spawn(step.model, step.at[0], step.at[1], step.heading, step.paint);
      run.vehicle.missionTag = run.tag;
      run.vehicle.missionOwned = true;
      run.vehicle.parked = true;
      run.stealStars = step.stars || 0;
    } else if (step.kind === 'eliminate') {
      for (const [x, z] of step.spots) game.gunmen.spawn(step.enemy, x, z, run.tag);
      game.gunmen.alertFaction('gang', step.spots[0][0], step.spots[0][1]);
    } else if (step.kind === 'collect' || step.kind === 'race') {
      run.remaining = step.points.map((p) => ({ x: p[0], z: p[1] }));
      run.total = run.remaining.length;
    } else if (step.kind === 'loseCops' && game.wanted.stars === 0) {
      this.advance();
    }
  }

  objectiveText() {
    const run = this.active;
    if (!run || !run.step) return '';
    const step = run.step;
    if (step.kind === 'steal' && this.game.player.vehicle === run.vehicle) return step.textIn;
    if (step.kind === 'collect' || step.kind === 'race') return `${step.text} (${run.total - run.remaining.length}/${run.total})`;
    if (step.kind === 'eliminate') return `${step.text} (${this.game.gunmen.countAlive(run.tag)} left)`;
    if (step.kind === 'wait') return `${step.text} (${Math.ceil(step.seconds - run.progress)}s)`;
    if ((step.kind === 'deliver' || step.vehicle) && run.vehicle && this.game.player.vehicle !== run.vehicle) return `Get back in the ${run.vehicle.spec.name}`;
    return step.text;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    this.cooldown -= dt;
    if (!this.active) {
      if (this.cooldown > 0 || !player.alive) return;
      for (const mission of this.offers()) {
        game.markers.show(mission.at.x, mission.at.z, CHARACTERS[mission.giver].color, 1.8, 14);
        const near = distance2D(player.position.x, player.position.z, mission.at.x, mission.at.z) < 2.2;
        if (near && !player.vehicle && game.wanted.stars === 0) { this.start(mission); return; }
        if (near && game.wanted.stars > 0) game.hud.hint('Lose the police before starting a mission');
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
    game.wanted.clear();
    vehicle.health = vehicle.spec.health;
    game.hud.notify('Fresh coat applied. The police are looking for another car.');
    game.audio.cashRegister();
    vehicle.repaint(paint);
  }

  /** Bravo takes the delivered car: the player steps out and it no longer belongs to the mission. */
  handOver(run) {
    const vehicle = run.vehicle;
    if (this.game.player.vehicle === vehicle) leaveVehicle(this.game, true);
    vehicle.missionTag = null;
    vehicle.ambient = true;
    vehicle.stolen = false;
    vehicle.parked = true;
    run.vehicle = null;
  }

  /** What the minimap should show for the story: objectives while on a mission, givers otherwise. */
  blips() {
    const list = [];
    const run = this.active;
    if (!run) {
      for (const mission of this.offers()) list.push({ x: mission.at.x, z: mission.at.z, color: CHARACTERS[mission.giver].color, label: mission.at.icon, pinned: true });
      return list;
    }
    const step = run.step;
    if (!step) return list;
    if (step.kind === 'steal') list.push({ x: run.vehicle.position.x, z: run.vehicle.position.z, color: '#4dabf7', label: '', pinned: true });
    else if (step.at) {
      const awayFromCar = (step.kind === 'deliver' || step.vehicle) && run.vehicle && this.game.player.vehicle !== run.vehicle;
      if (awayFromCar) list.push({ x: run.vehicle.position.x, z: run.vehicle.position.z, color: '#4dabf7', label: '', pinned: true });
      else list.push({ x: step.at[0], z: step.at[1], color: OBJECTIVE_COLOR, label: '', pinned: true });
    } else if (step.kind === 'collect') for (const p of run.remaining) list.push({ x: p.x, z: p.z, color: OBJECTIVE_COLOR, label: '', pinned: true });
    else if (step.kind === 'race') list.push({ x: run.remaining[0].x, z: run.remaining[0].z, color: OBJECTIVE_COLOR, label: '', pinned: true });
    else if (step.kind === 'eliminate') {
      for (const g of this.game.gunmen.list) if (g.alive && g.missionTag === run.tag) list.push({ x: g.position.x, z: g.position.z, color: '#ff3b30', label: '', pinned: true });
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
    game.hud.banner('MISSION FAILED', reason, '#ff3b30');
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
    game.hud.banner('MISSION PASSED', `+$${mission.reward.toLocaleString('en-US')}`, '#2ecc71');
    game.audio.jingle(true);
    if (this.isStoryComplete()) {
      setTimeout(() => game.hud.banner('SOLMARA IS YOURS', 'Story complete. The city stays open: races, fares, tokens and trouble.', '#ffd60a'), 6500);
    }
    game.saveGame(true);
  }
}
