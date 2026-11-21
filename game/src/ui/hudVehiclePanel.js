// The HUD's bottom-right panel. In a car: its name and class, the speedometer and gear, and the body and nitro
// gauges (the radio names its station in the feed when it changes). On foot and not wanted: the GPS list of the
// nearest places with their distance.
import { distance2D } from '../core/random.js';
import { LANDMARKS } from '../world/cityLayout.js';
import { createElement, createMeter } from './domBuilder.js';

export class HudVehiclePanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.gpsClock = 0;
    this.root = createElement('div', 'hud-panel vehicle-panel', parent);
    this.name = createElement('div', 'vehicle-name', this.root);
    const dial = createElement('div', 'speed-row', this.root);
    this.gear = createElement('span', 'gear-box', dial);
    this.speed = createElement('b', 'speed-value', dial);
    createElement('small', '', dial, 'km/h');
    const gauges = createElement('div', 'vitals', this.root);
    this.condition = createMeter(gauges, 'condition-meter', 'BODY');
    this.nitro = createMeter(gauges, 'nitro-meter', 'NITRO');
    // The car radio: station and frequency, then the song on air and who plays it.
    this.radio = createElement('div', 'radio-line', this.root);
    this.station = createElement('b', 'radio-station', this.radio);
    this.song = createElement('span', 'radio-song', this.radio);
    this.gps = createElement('div', 'hud-panel gps-panel', parent);
    createElement('div', 'panel-caption', this.gps, 'GPS · NEAREST');
    this.gpsRows = createElement('div', 'gps-rows', this.gps);
  }

  /** Which gear the dial shows for a speed: R, N or 1 to 5. */
  gearFor(vehicle) {
    if (vehicle.speed < -0.5) return 'R';
    if (Math.abs(vehicle.speed) < 0.5) return 'N';
    return String(Math.min(5, 1 + Math.floor((vehicle.speed / (vehicle.spec.maxSpeed * 1.05)) * 5)));
  }

  /** The three nearest landmarks with their distance, for a player on foot. */
  gpsMarkup() {
    const p = this.game.player.position;
    const places = Object.values(LANDMARKS).map((place) => ({ place, distance: distance2D(p.x, p.z, place.x, place.z) })).sort((a, b) => a.distance - b.distance).slice(0, 3);
    return places.map(({ place, distance }) => `<div><i style="background:${place.color}">${place.icon}</i><b>${place.name}</b><u>${Math.round(distance)} m</u></div>`).join('');
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const vehicle = game.player.vehicle;
    cache.toggle(this.root, 'visible', Boolean(vehicle));
    // The GPS list is for a quiet walk: with the police on her, the dispatch panel has the screen instead.
    cache.toggle(this.gps, 'visible', !vehicle && game.wanted.stars === 0);
    if (!vehicle) {
      this.gpsClock -= dt;
      if (this.gpsClock <= 0) { this.gpsClock = 0.5; cache.html(this.gpsRows, this.gpsMarkup()); }
      return;
    }
    cache.text(this.name, `${vehicle.spec.name.toUpperCase()} · ${vehicle.spec.kind.toUpperCase()}`);
    cache.text(this.speed, String(Math.round(Math.abs(vehicle.speed) * 3.6)));
    cache.text(this.gear, this.gearFor(vehicle));
    const condition = vehicle.conditionPercent();
    cache.width(this.condition.fill, condition / 100);
    cache.text(this.condition.value, vehicle.tiresShredded ? 'TYRES OUT' : `${condition}%`);
    cache.toggle(this.condition.root, 'low', condition < 35 || vehicle.tiresShredded);
    const workshop = game.workshop;
    cache.toggle(this.nitro.root, 'empty', !workshop.hasNitro());
    cache.width(this.nitro.fill, workshop.hasNitro() ? workshop.nitroCharge : 0);
    cache.text(this.nitro.value, !workshop.hasNitro() ? 'NONE' : vehicle.boosting ? 'BURN' : workshop.nitroCharge >= 1 ? 'READY' : `${Math.round(workshop.nitroCharge * 100)}%`);
    const song = game.audio.radio.nowPlaying(game.time);
    cache.toggle(this.radio, 'off', !song);
    cache.text(this.station, song ? `RADIO ${song.station.toUpperCase()}` : 'RADIO OFF · R TO TUNE');
    cache.text(this.song, song ? `♪ ${song.title.toUpperCase()} · ${song.artist.toUpperCase()}` : '');
  }
}
