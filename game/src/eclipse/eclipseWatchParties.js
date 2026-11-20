// Eclipse week on the streets of Saros: strings of pennants over the avenues, telescopes on tripods at the watch
// spots, and the crowds that gather round them to look at the sun. The crowds grow day by day, cheer when totality
// falls and go home when the week is over. Watchers are ordinary citizens: they run from gunfire like anyone.
import * as THREE from 'three';
import { CITY } from '../core/config.js';
import { SeededRandom, distance2D } from '../core/random.js';
import { MeshBatcher, placement } from '../render/meshBatcher.js';
import { blockIndexAt, LANDMARKS } from '../world/cityLayout.js';
import { ECLIPSE_DAY } from './eclipseCalendar.js';

const P = CITY.pitch;
const PENNANT_COLOURS = ['#ffb547', '#f4ecd8', '#ff6a4d', '#2f2c5c'];
/** The share of each watch party that has turned up, by day of the week. */
const TURNOUT = [0.4, 0.55, 0.7, 0.85, 1];
const POPULATE_WITHIN = 125;
const MAX_WATCHERS = 44;
const pennantShape = new THREE.ConeGeometry(0.27, 0.6, 4);
const tubeShape = new THREE.CylinderGeometry(0.11, 0.15, 1.5, 8);
const legShape = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5);

/** Where the parties stand: [x, z, how many people at full turnout, metres the party spreads along x and z]. */
function watchSpots() {
  const spots = [];
  // Along the boardwalk and the kerb of Corona Drive, the whole length of the Strand.
  for (let z = 44; z < CITY.depth - 30; z += 48) {
    spots.push({ x: -10.4, z, size: 8, spreadX: 1.7, spreadZ: 8, boardwalk: true, telescope: true });
    spots.push({ x: 7.7, z: z + 24, size: 5, spreadX: 0.8, spreadZ: 6, telescope: z % 96 === 44 });
  }
  // Outside the Orrery Trust, in Jacaranda Gardens and at the observatory on the hill.
  const bank = LANDMARKS.bank;
  spots.push({ x: bank.x - 13, z: bank.z, size: 8, spreadX: 6, spreadZ: 0.7, telescope: true });
  spots.push({ x: bank.x + 14, z: bank.z, size: 6, spreadX: 5, spreadZ: 0.7, telescope: false });
  spots.push({ x: 3.5 * P, z: 3.5 * P + 9, size: 9, spreadX: 6, spreadZ: 2, telescope: true });
  spots.push({ x: LANDMARKS.observatory.x, z: LANDMARKS.observatory.z, size: 8, spreadX: 7, spreadZ: 0.7, telescope: true });
  spots.push({ x: LANDMARKS.radio.x + 10, z: LANDMARKS.radio.z, size: 5, spreadX: 4, spreadZ: 0.7, telescope: true });
  return spots;
}

export class EclipseWatchParties {
  constructor(game) {
    this.game = game;
    this.rng = new SeededRandom(CITY.seed + 505);
    this.spots = watchSpots().map((spot) => ({ ...spot, crowd: [], turnout: -1 }));
    this.cheering = false;
    this.clock = 0;
    this.sunHeading = 0;
    this.sunDirection = new THREE.Vector3();
    this.telescopes = [];
    const batch = new MeshBatcher();
    this.hangBunting(batch);
    for (const spot of this.spots) if (spot.telescope) this.standTelescope(batch, spot);
    this.decorations = batch.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }));
    game.scene.add(this.decorations);
  }

  /** Strings of pennants across Corona Drive, Grand Saros Avenue and the streets round Orrery Square. */
  hangBunting(batch) {
    for (let z = 30; z < CITY.depth - 10; z += 40) {
      if (z % P < 9 || z % P > P - 9) continue;
      this.hangString(batch, -7.2, z, 7.2, z);
    }
    for (let j = 3; j <= 5; j += 1) {
      for (let t = 18; t < P - 12; t += 22) {
        this.hangString(batch, 5 * P - 7.2, j * P + t, 5 * P + 7.2, j * P + t);
        this.hangString(batch, 5 * P + t, (j + 1) * P - 7.2, 5 * P + t, (j + 1) * P + 7.2);
      }
    }
  }

  /** One sagging string between two lamp-height points, a pennant every metre along it. */
  hangString(batch, x0, z0, x1, z1) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.floor(length / 1.05);
    const turn = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    for (let k = 0; k <= count; k += 1) {
      const t = k / count;
      const y = 7.6 - 0.9 * (1 - (2 * t - 1) ** 2);
      batch.addGeometry(pennantShape, placement(x0 + (x1 - x0) * t, y - 0.3, z0 + (z1 - z0) * t, turn, 1, 1, 0.1, Math.PI), PENNANT_COLOURS[(k + Math.round(z0 + x0)) % PENNANT_COLOURS.length]);
    }
  }

  /** A brass telescope on a tripod beside a party, already pointed at the afternoon sun. */
  standTelescope(batch, spot) {
    const x = spot.x + (spot.boardwalk ? 1.5 : 0);
    const z = spot.z + (spot.boardwalk ? 0 : -0.2) + spot.spreadZ + 1.2;
    const base = spot.boardwalk ? 0.22 : CITY.curb;
    for (let k = 0; k < 3; k += 1) {
      const angle = (k / 3) * Math.PI * 2;
      batch.addGeometry(legShape, placement(x + Math.sin(angle) * 0.3, base + 0.7, z + Math.cos(angle) * 0.3, angle, 1, 1, 1, 0.4), '#2b2a30');
    }
    batch.addGeometry(tubeShape, placement(x, base + 1.55, z, -0.32, 1, 1, 1, Math.PI / 2 - 0.3), '#d9a441');
    batch.addGeometry(tubeShape, placement(x - 0.19, base + 1.37, z + 0.56, -0.32, 1.3, 0.16, 1.3, Math.PI / 2 - 0.3), '#f4ecd8');
    this.telescopes.push({ x, z });
  }

  /** How many citizens are standing at watch parties right now. */
  watcherCount() {
    let count = 0;
    for (const spot of this.spots) count += spot.crowd.length;
    return count;
  }

  /** The share of each party that is out today: it grows through the week and is gone the day after. */
  turnoutToday() {
    const calendar = this.game.calendar;
    if (calendar.day > ECLIPSE_DAY || calendar.phase() === 'after') return 0;
    const night = calendar.hour < 7.5 || calendar.hour > 19.4;
    return night ? 0 : TURNOUT[calendar.day - 1];
  }

  /** Stand a party's people round its spot, facing the sun. */
  gather(spot, count) {
    const crowd = this.game.pedestrians;
    const rng = this.rng;
    while (spot.crowd.length < count) {
      const x = spot.x + rng.range(-spot.spreadX, spot.spreadX);
      const z = spot.z + rng.range(-spot.spreadZ, spot.spreadZ);
      const { i, j } = blockIndexAt(x, z);
      const goal = { i: Math.min(Math.max(i, 0), CITY.roadsX - 2), j: Math.min(Math.max(j, 0), CITY.roadsZ - 2), corner: rng.int(0, 3) };
      const watcher = crowd.spawnAt(spot.boardwalk ? { x, z, boardwalk: true } : { x, z, goal, clockwise: rng.chance(0.5) });
      watcher.watchSky(this.sunHeading + rng.range(-0.25, 0.25));
      watcher.heading = watcher.watchHeading;
      spot.crowd.push(watcher);
    }
  }

  /** Fill the parties near the player at once (a new game, a load, a screenshot scene). */
  populate() {
    for (const spot of this.spots) { spot.crowd.length = 0; spot.turnout = -1; }
    this.cheering = false;
    this.clock = 0;
    this.update(0);
  }

  update(dt) {
    const game = this.game;
    const calendar = game.calendar;
    const sun = game.sky.sunDirectionAt(calendar.hour, this.sunDirection);
    this.sunHeading = Math.atan2(sun.x, sun.z);
    const totality = calendar.isTotality();
    if (totality !== this.cheering) {
      this.cheering = totality;
      for (const spot of this.spots) for (const watcher of spot.crowd) watcher.cheering = totality && watcher.gazing;
    }
    const player = game.player.position;
    for (const scope of this.telescopes) {
      if (!game.player.vehicle && game.state === 'play' && distance2D(scope.x, scope.z, player.x, player.z) < 1.8) game.hud.hint(this.telescopeLine());
    }
    this.visitObservatory();
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0.5;
    const turnout = this.turnoutToday();
    let total = this.watcherCount();
    for (const spot of this.spots) {
      spot.crowd = spot.crowd.filter((watcher) => !watcher.gone && watcher.alive && watcher.gazing);
      if (turnout === 0) {
        for (const watcher of spot.crowd) watcher.stopWatching();
        spot.crowd.length = 0;
        continue;
      }
      for (const watcher of spot.crowd) watcher.watchHeading += (this.sunHeading - watcher.watchHeading) * 0.02;
      const wanted = Math.max(2, Math.round(spot.size * turnout));
      const near = distance2D(spot.x, spot.z, player.x, player.z) < POPULATE_WITHIN;
      // A party a gunfight has scattered stays scattered for a while; it only re-forms once Nova has gone away.
      if (near && spot.crowd.length === 0 && spot.turnout !== turnout && total + wanted <= MAX_WATCHERS) {
        this.gather(spot, wanted);
        total += wanted;
        spot.turnout = turnout;
      } else if (!near && spot.crowd.length === 0) spot.turnout = -1;
    }
  }

  /** At the door of the Saros Observatory: once the story is done, E turns the week back to first contact. */
  visitObservatory() {
    const game = this.game;
    const place = LANDMARKS.observatory;
    const player = game.player;
    if (game.state !== 'play' || player.vehicle || distance2D(place.x, place.z, player.position.x, player.position.z) > 2.2) return;
    if (!game.missions.isStoryComplete()) { game.hud.hint('Saros Observatory: the dome opens to visitors after the eclipse'); return; }
    if (game.calendar.isEclipseDay() && game.calendar.phase() !== 'after') { game.hud.hint('Saros Observatory: the eclipse is on. Look up'); return; }
    game.hud.hint('Press E to live the eclipse again, from first contact');
    if (!game.input.wasPressed('KeyE')) return;
    game.calendar.relive();
    this.populate();
    game.hud.banner('ECLIPSE DAY, AGAIN', 'First contact in a moment. Every rule of the dark is in force.', '#ffb547');
  }

  /** What Nova sees through a telescope. */
  telescopeLine() {
    const calendar = this.game.calendar;
    const covered = Math.round(calendar.coverage() * 100);
    if (calendar.isTotality()) return 'Telescope: the corona, a white crown round a black moon';
    if (covered > 0) return `Telescope: the moon covers ${covered}% of the sun`;
    const days = calendar.daysToTotality();
    return days > 0 ? `Telescope: a clean sun. ${days} ${days === 1 ? 'day' : 'days'} to totality` : 'Telescope: a clean sun. First contact is at 16:12';
  }
}
