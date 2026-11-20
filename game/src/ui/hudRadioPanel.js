// The HUD's radio panel, under the car's dial while Nova is at the wheel with the radio on: the station with its
// frequency and its DJ on one line, the track on air and the band that plays it on the next.
import { createElement } from './domBuilder.js';

export class HudRadioPanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.root = createElement('div', 'hud-panel radio-panel', parent);
    this.station = createElement('div', 'radio-station', this.root);
    this.track = createElement('div', 'radio-track', this.root);
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const playing = game.player.vehicle ? game.audio.radio.nowPlaying() : null;
    cache.toggle(this.root, 'visible', playing !== null);
    if (!playing) return;
    cache.text(this.station, `RADIO · ${playing.station.toUpperCase()} · ${playing.dj}`);
    cache.text(this.track, `♪ ${playing.title.toUpperCase()} · ${playing.artist.toUpperCase()}`);
  }
}
