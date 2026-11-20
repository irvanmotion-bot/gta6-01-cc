// Totality: boots the city of Saros, owns every system and runs the game loop and its states (title, play, pause,
// atlas, shop). The eclipse calendar is the first system it loads: every other one asks it what day and hour it is.
// After it come the rules of play, each in its own module: the dark, the wanted level, cred and rank, the crew's
// favors, driving stunts, the police, the workshop, bounties, races and the story.
import * as THREE from 'three';
import { ECLIPSE_DAY, EclipseCalendar } from './eclipse/eclipseCalendar.js';
import { DarknessCover } from './eclipse/darknessCover.js';
import { WantedLevel } from './police/wantedLevel.js';
import { StreetCred } from './progression/streetCred.js';
import { CrewFavors } from './progression/crewFavors.js';
import { DrivingStunts } from './activities/drivingStunts.js';
import { PoliceDispatch } from './police/policeDispatch.js';
import { TuningWorkshop } from './garage/tuningWorkshop.js';
import { VaneBounties } from './activities/vaneBounties.js';
import { StreetRaces } from './activities/streetRaces.js';
import { MissionDirector } from './missions/missionDirector.js';
import { SideActivities } from './missions/sideActivities.js';
import { EclipseWatchParties } from './eclipse/eclipseWatchParties.js';
import { WorkshopShowroom } from './garage/workshopShowroom.js';
import { LANDMARKS } from './world/cityLayout.js';
import { captureGame, restoreGame, summarizeGame } from './core/gameSnapshot.js';
import { freshStats, loadSaveSlot, loadSettings, migrateRetiredSaves, writeSaveSlot } from './core/saveGame.js';
import { PedestrianCrowd } from './characters/pedestrians.js';
import { Player } from './characters/player.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { CityAtlas } from './ui/cityAtlas.js';
import { Menus } from './ui/menus.js';
import { CounterMenu } from './ui/counterMenu.js';
import { Shops } from './economy/shops.js';
import { Weapons } from './combat/weapons.js';
import { Gunmen } from './combat/gunmen.js';
import { detonate } from './combat/explosions.js';
import { VehicleFleet } from './vehicles/vehicleFleet.js';
import { Traffic } from './vehicles/trafficAI.js';
import { CityBuildings } from './world/buildings.js';
import { buildStreetsAndGround } from './world/streetsAndGround.js';
import { OceanAndBeach } from './world/oceanAndBeach.js';
import { StreetProps } from './world/streetProps.js';
import { StreetFurniture } from './world/streetFurniture.js';
import { CityLights } from './world/cityLights.js';
import { BoatsAtSea } from './world/boatsAtSea.js';
import { PlayerHeadlamp, setVehicleLightsNight } from './vehicles/vehicleLights.js';
import { CollisionWorld } from './world/collision.js';
import { Pickups } from './world/pickups.js';
import { WorldMarkers } from './world/worldMarkers.js';
import { SkyAndSun } from './render/skyAndSun.js';
import { ChaseCamera } from './render/chaseCamera.js';
import { createSkyReflection, reflectSkyOn } from './render/skyReflection.js';
import { bodyMaterial as vehicleBodyMaterial } from './vehicles/vehicleModel.js';
import { Particles } from './effects/particles.js';
import { SkidMarks } from './effects/skidMarks.js';
import { SoundEffects } from './audio/soundEffects.js';
import { Input } from './core/input.js';
import { CITY_NAME, GAME_TITLE } from './core/config.js';
import { distance2D } from './core/random.js';
import { stageScreenshot } from './debug/screenshotScenes.js';

class Game {
  constructor() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.time = 0;
    this.state = 'boot';
    this.down = null;
    this.frozen = false;
    this.titleAngle = 0.6;
    this.saveSlot = 1;
    migrateRetiredSaves();
    this.settings = loadSettings();
    this.stats = freshStats();
    this.characters = [];

    this.input = new Input(canvas);
    this.audio = new SoundEffects();
    this.camera = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.calendar = new EclipseCalendar(this);
    this.sky = new SkyAndSun(this.scene);
    this.collision = new CollisionWorld();
    buildStreetsAndGround(this.scene);
    this.buildings = new CityBuildings(this.scene, this.collision);
    this.ocean = new OceanAndBeach(this.scene, this.collision);
    this.props = new StreetProps(this.scene);
    this.furniture = new StreetFurniture(this.scene);
    this.cityLights = new CityLights(this.scene, this.props.lampSpots, this.buildings.fronts.neonSpots);
    this.boats = new BoatsAtSea(this.scene);
    this.headlamp = new PlayerHeadlamp(this.scene);
    // Car lacquer and tower glass mirror the sky; the mirror dims with the daylight.
    this.glossy = [vehicleBodyMaterial, this.buildings.materials.office];
    this.skyReflection = createSkyReflection(this.renderer);
    reflectSkyOn(this.glossy, this.skyReflection, 1);
    this.particles = new Particles(this.scene);
    this.skidMarks = new SkidMarks(this.scene);
    this.markers = new WorldMarkers(this.scene);
    this.pickups = new Pickups(this);
    this.vehicles = new VehicleFleet(this);
    this.traffic = new Traffic(this);
    this.player = new Player(this, TITLE_SPOT.x, TITLE_SPOT.z);
    this.pedestrians = new PedestrianCrowd(this);
    this.gunmen = new Gunmen(this);
    this.cred = new StreetCred(this);
    this.crew = new CrewFavors(this);
    this.workshop = new TuningWorkshop(this);
    this.showroom = new WorkshopShowroom(this);
    this.wanted = new WantedLevel(this);
    this.police = new PoliceDispatch(this);
    this.weapons = new Weapons(this);
    this.missions = new MissionDirector(this);
    this.activities = new SideActivities(this);
    this.races = new StreetRaces(this);
    this.bounties = new VaneBounties(this);
    this.stunts = new DrivingStunts(this);
    this.shops = new Shops(this);
    this.darkness = new DarknessCover(this);
    this.watchParties = new EclipseWatchParties(this);
    this.hud = new Hud(this);
    this.atlas = new CityAtlas(this);
    this.minimap = new Minimap(this);
    this.counter = new CounterMenu(this);
    this.menus = new Menus(this);
    this.applySettings();

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      // The browser keeps Escape for leaving pointer lock, so losing the lock in play is the pause key.
      if (!document.pointerLockElement && this.state === 'play' && !this.down) this.setState('pause');
    });
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => this.audio.unlock(), { passive: true });
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.view.aspect = window.innerWidth / window.innerHeight;
    this.camera.view.updateProjectionMatrix();
    this.hud.fitToWindow();
  }

  /**
   * Put the settings to work: volume, mouse speed, shadows, the size of the HUD, and RENDER SCALE, which draws the
   * city at more pixels than the window has and lets the browser average them down: smoother edges for more work.
   */
  applySettings() {
    const settings = this.settings;
    this.audio.setVolume(settings.volume);
    this.camera.sensitivity = settings.sensitivity;
    this.sky.setShadows(settings.shadows);
    this.hud.setSize(settings.hudSize);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * (settings.renderScale || 1);
    if (this.renderer.getPixelRatio() !== ratio) {
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /** Everyone a bullet, a bumper or a blast can reach: Nova, the citizens and the gunmen. */
  allCharacters() {
    return this.characters;
  }

  detonate(x, z, byPlayer) {
    detonate(this, x, z, byPlayer);
  }

  setState(state) {
    this.state = state;
    const playing = state === 'play';
    this.input.enabled = playing;
    if (!playing) this.input.releaseLock();
    this.hud.setVisible(playing || (state === 'shop' && !this.showroom.active));
    this.menus.show(state === 'title' ? 'start' : state === 'pause' ? 'pause' : null);
    this.atlas.show(state === 'map');
    if (playing) this.input.requestLock();
  }

  /** Empty the streets and reset every system: the clean slate before a new game, a load or the title screen. */
  resetWorld() {
    this.down = null;
    this.hud.hideDown();
    this.hud.clearSpeech();
    this.hud.clearFeed();
    this.races.reset();
    this.missions.reset();
    this.vehicles.clear();
    this.pedestrians.clear();
    this.gunmen.clear();
    this.pickups.clear();
    this.particles.clear();
    this.skidMarks.clear();
    this.police.clear();
    this.wanted.reset();
    this.weapons.reset();
    this.cred.reset();
    this.crew.reset();
    this.workshop.reset();
    this.bounties.reset();
    this.stunts.reset();
    this.darkness.headlightsOn = true;
    this.stats = freshStats();
    this.player.armor = 0;
    this.player.cash = 250;
    this.player.frozen = false;
  }

  /** Put Nova at Casa Reyes with traffic and citizens already around her. */
  enterCity(heading = Math.PI / 2) {
    const home = LANDMARKS.safehouse;
    this.player.revive(home.x - 7, home.z, heading);
    this.player.invulnerable = 0;
    this.camera.snapBehind(heading);
    this.traffic.populate();
    this.pedestrians.populate();
    this.watchParties.populate();
    this.setState('play');
  }

  newGame(slot = 1) {
    this.saveSlot = slot;
    this.resetWorld();
    this.activities.reset();
    this.calendar.reset();
    this.enterCity();
    const ride = this.vehicles.spawn('avocet', LANDMARKS.safehouse.kerb.x - 3, LANDMARKS.safehouse.kerb.z, -Math.PI / 2, '#1abc9c');
    ride.parked = true;
    ride.stolen = true;
    ride.ambient = true;
    this.hud.banner(GAME_TITLE, 'Monday in Saros. Four days until the sun goes out.', '#ffb547');
    this.hud.say('NOVA', 'Three years away, and I come home the week the whole world comes to watch the sky.', '#ff9e7a');
    this.hud.say('NOVA', 'Tío Bravo runs a garage on Gnomon Street. Follow the B on the radar.', '#ff9e7a');
    this.hud.notify('Press F beside a car to take it. Press M for the city atlas.');
  }

  /** Load a save slot and stand Nova outside Casa Reyes; an empty slot starts a new game there. */
  continueGame(slot = this.saveSlot) {
    const save = loadSaveSlot(slot);
    if (!save) { this.newGame(slot); return; }
    this.saveSlot = slot;
    this.resetWorld();
    restoreGame(this, save);
    this.enterCity();
    this.hud.notify(`Slot ${slot} loaded. Welcome back to ${CITY_NAME}.`);
  }

  /** Write the slot being played: an autosave after a job, a rest at Casa Reyes, or SAVE GAME on the pause menu. */
  saveGame(auto, fromMenu = false) {
    const saved = writeSaveSlot(this.saveSlot, summarizeGame(this), captureGame(this));
    const done = fromMenu ? `Saved to slot ${this.saveSlot}.` : auto ? `Autosaved to slot ${this.saveSlot}.` : `Saved to slot ${this.saveSlot} at Casa Reyes. Health restored.`;
    this.hud.notify(saved ? done : 'Saving is blocked in this browser.');
    return saved;
  }

  /** Why the pause menu cannot save right now, or '' when it can: not in the middle of a job, a race or a chase. */
  saveBlockedBy() {
    if (this.missions.active) return 'Finish or fail the job first';
    if (this.races.active) return 'Finish the race first';
    if (this.wanted.stars > 0) return 'Lose the police first';
    return '';
  }

  quitToTitle() {
    this.resetWorld();
    this.showTitle();
  }

  /** The start screen looks over the Strand on eclipse afternoon, the moon a third of the way across the sun. */
  showTitle() {
    this.calendar.reset(ECLIPSE_DAY, TITLE_HOUR);
    this.player.revive(TITLE_SPOT.x, TITLE_SPOT.z, 2.2);
    this.player.invulnerable = 0;
    this.traffic.populate();
    this.pedestrians.populate();
    this.watchParties.populate();
    this.setState('title');
  }

  onPlayerEnteredVehicle(vehicle) {
    this.camera.idleLook = 2;
    if (vehicle.spec.police) vehicle.siren = false;
    vehicle.unit = null;
    this.workshop.fit(vehicle);
  }

  onPlayerLeftVehicle(vehicle) {
    this.camera.idleLook = 0;
    if (vehicle) vehicle.boosting = false;
  }

  onVehicleExploded(vehicle) {
    this.detonate(vehicle.position.x, vehicle.position.z, Boolean(vehicle.hitByPlayer) || vehicle.driver === 'player');
    if (vehicle.driver !== 'player') vehicle.driver = null;
    vehicle.controller = null;
  }

  /** Nova is wiped out or arrested: the job fails, the screen says so, and she wakes up elsewhere. */
  onPlayerDown(kind) {
    if (this.down) return;
    this.down = { kind, clock: 0 };
    this.missions.onPlayerDown(kind);
    this.races.cancel();
    this.player.frozen = true;
    if (kind === 'busted') {
      this.stats.timesBusted += 1;
      this.hud.showDown('ARRESTED', 'Saros P.D. keeps your weapons and a cut of your cash.');
    } else {
      this.stats.timesWiped += 1;
      this.hud.showDown('WIPED OUT', 'Avocet Medical will patch you up, for a price.');
    }
    this.audio.jingle(false);
  }

  respawn() {
    const kind = this.down.kind;
    const place = kind === 'busted' ? LANDMARKS.police : LANDMARKS.hospital;
    const fee = Math.min(Math.round(this.player.cash * 0.1), 2500);
    if (this.player.vehicle) { this.player.vehicle.driver = null; this.player.vehicle = null; }
    this.player.cash -= fee;
    if (kind === 'busted') this.weapons.reset();
    this.wanted.reset();
    this.gunmen.clear();
    this.police.clear();
    for (const vehicle of [...this.vehicles.list]) if (vehicle.spec.police) this.vehicles.remove(vehicle);
    this.calendar.skipHours(2);
    this.player.frozen = false;
    this.player.revive(place.x - 8, place.z, Math.PI / 2);
    this.camera.snapBehind(Math.PI / 2);
    this.down = null;
    this.hud.hideDown();
    this.hud.notify(fee > 0 ? `You paid $${fee.toLocaleString('en-US')}.` : 'Back on your feet.');
  }

  /** One step of the living city; the title screen runs it too, without the player's systems. */
  simulate(dt, playing) {
    this.time += dt;
    this.characters = [this.player, ...this.pedestrians.list, ...this.gunmen.list];
    this.markers.begin(dt);
    if (playing) {
      this.player.update(dt);
      this.weapons.update(dt);
    } else {
      this.player.moveSpeed = 0;
      this.player.animate(dt);
    }
    this.traffic.update(dt);
    this.vehicles.update(dt);
    this.pedestrians.update(dt);
    this.gunmen.update(dt);
    if (playing) {
      this.police.update(dt);
      this.wanted.update(dt);
      this.crew.update(dt);
      this.pickups.update(dt);
      this.missions.update(dt);
      this.races.update(dt);
      this.bounties.update(dt);
      this.stunts.update(dt);
      this.activities.update(dt);
      this.shops.update(dt);
      this.workshop.update(dt);
      this.darkness.update(dt);
      this.audio.radio.tick(dt, Boolean(this.player.vehicle));
      this.stats.playSeconds += dt;
    }
    this.watchParties.update(dt);
    this.markers.end();
  }

  handlePlayKeys() {
    const input = this.input;
    if (input.wasPressed('Escape', 'KeyP')) { this.setState('pause'); return; }
    if (input.wasPressed('KeyM', 'Tab')) { this.setState('map'); return; }
    const vehicle = this.player.vehicle;
    if (vehicle && input.wasPressed('KeyH')) this.audio.horn();
    if (vehicle && input.wasPressed('KeyR')) this.hud.showRadio(this.audio.radio.nextStation());
    if (vehicle && input.wasPressed('KeyL')) this.darkness.toggleHeadlights();
  }

  /** How loud the siren loop should be: the nearest live siren, faded over 130 metres. */
  sirenLevel() {
    let nearest = Infinity;
    const p = this.player.position;
    for (const vehicle of this.vehicles.list) {
      if (vehicle.siren && !vehicle.dead) nearest = Math.min(nearest, distance2D(p.x, p.z, vehicle.position.x, vehicle.position.z));
    }
    return Math.max(0, 1 - nearest / 130);
  }

  titleCamera(dt) {
    this.titleAngle += dt * 0.05;
    const view = this.camera.view;
    const focus = this.player.position;
    view.position.set(focus.x - 9 + Math.sin(this.titleAngle) * 3, 2.6 + Math.sin(this.titleAngle * 0.7) * 0.4, focus.z - 7.5);
    view.lookAt(focus.x + 22, 9, focus.z + 30);
    this.camera.target.copy(focus);
  }

  update(realDt) {
    let dt = realDt;
    if (this.state === 'play') {
      if (this.down) {
        this.down.clock += realDt;
        dt *= 0.35;
        if (this.down.clock > 4.4) this.respawn();
      } else {
        this.handlePlayKeys();
      }
      if (this.state === 'play') {
        this.simulate(dt, true);
        this.camera.update(dt, this);
      }
    } else if (this.state === 'title') {
      this.simulate(dt, false);
      this.titleCamera(dt);
      this.menus.update();
    } else if (this.state === 'pause') {
      this.menus.update();
    } else if (this.state === 'map') {
      if (this.input.wasPressed('KeyM', 'Tab', 'Escape')) this.setState('play');
    } else if (this.state === 'shop') {
      this.counter.updateMenu();
      this.showroom.update(realDt);
    }
    const live = this.state === 'play' || this.state === 'title';
    if (live) {
      // The week's clock runs while Nova is in the streets; the title screen holds its eclipse afternoon still.
      if (this.state === 'play' && !this.down) this.calendar.update(dt, this.missions.clockRush());
      this.sky.update(dt, this.camera.target, this.calendar);
      this.ocean.update(dt, this.scene.fog.color);
      this.props.update(this.time, this.sky.night);
      this.buildings.setNight(this.sky.night);
      this.cityLights.setNight(this.sky.night);
      setVehicleLightsNight(this.sky.night);
      for (const material of this.glossy) material.envMapIntensity = 0.3 - this.sky.night * 0.21;
      this.headlamp.update(this.state === 'play' && this.darkness.headlightsOn ? this.player.vehicle : null, this.sky.night);
      this.boats.update(dt, this.time);
      this.particles.update(dt);
    }
    if (this.state === 'play') {
      this.hud.update(dt);
      this.minimap.draw();
    }
    this.audio.updateLoops(this.state === 'play' ? this.player.vehicle : null, this.state === 'play' ? this.sirenLevel() : 0, this.time, this.state !== 'play');
    this.input.endFrame();
  }

  /** Draw the city through the chase camera, or Bravo's yard through the showroom's while the workshop is open. */
  render() {
    this.renderer.render(this.scene, this.showroom.active ? this.showroom.view : this.camera.view);
  }

  run() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      if (!this.frozen) this.update(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

const TITLE_SPOT = { x: -9.5, z: 318 };
const TITLE_HOUR = 16.72;

const game = new Game();
window.totality = game;
const query = new URLSearchParams(window.location.search);
const shot = query.get('shot');
if (shot) stageScreenshot(game, shot, query.get('hud'));
else game.showTitle();
document.getElementById('loading').classList.add('done');
game.run();
