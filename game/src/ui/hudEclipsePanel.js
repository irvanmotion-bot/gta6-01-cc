// The HUD's eclipse panel: a drawing of the sun as it stands in the sky right now, the moon across it, beside the
// countdown to totality (days through the week, seconds on eclipse day), the seconds of darkness left during it,
// and, whenever the streets are dark, whether Nova is hidden or what light is giving her away.
import { createElement } from './domBuilder.js';

const DISC_PIXELS = 112;
/** The moon crosses the icon along the same slanted line it crosses the sun in the sky (skyAndSun.js). */
const MOON_PATH = { x: -0.82, y: -0.57 };
const SUN_SHARE = 0.3;
const MOON_SHARE = 0.317;

export class HudEclipsePanel {
  constructor(game, parent, cache) {
    this.game = game;
    this.cache = cache;
    this.drawnKey = '';
    this.root = createElement('div', 'hud-panel eclipse-panel', parent);
    this.disc = createElement('canvas', 'eclipse-disc', this.root);
    this.disc.width = DISC_PIXELS;
    this.disc.height = DISC_PIXELS;
    const text = createElement('div', 'eclipse-text', this.root);
    this.caption = createElement('div', 'eclipse-caption', text);
    const row = createElement('div', 'eclipse-row', text);
    this.big = createElement('b', 'eclipse-big', row);
    this.line = createElement('span', 'eclipse-line', row);
    this.fill = createElement('i', '', createElement('div', 'eclipse-track', text));
    this.cover = createElement('div', 'eclipse-cover', text);
  }

  /** Draw the sun's disc with the moon where the calendar says it is; at totality, the corona round a black moon. */
  drawDisc(track, dark) {
    const size = DISC_PIXELS;
    const context = this.disc.getContext('2d');
    const centre = size / 2;
    const sunRadius = size * SUN_SHARE;
    context.clearRect(0, 0, size, size);
    const glow = context.createRadialGradient(centre, centre, sunRadius * 0.6, centre, centre, size / 2);
    glow.addColorStop(0, dark > 0.5 ? 'rgba(244, 236, 216, 0.75)' : 'rgba(255, 181, 71, 0.55)');
    glow.addColorStop(1, 'rgba(255, 181, 71, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);
    context.fillStyle = dark > 0.5 ? '#f4ecd8' : '#ffcf6b';
    context.beginPath();
    context.arc(centre, centre, sunRadius, 0, Math.PI * 2);
    context.fill();
    if (track === null) return;
    const slide = track * (SUN_SHARE + MOON_SHARE) * size;
    context.fillStyle = '#17122b';
    context.beginPath();
    context.arc(centre + MOON_PATH.x * slide, centre + MOON_PATH.y * slide, size * MOON_SHARE, 0, Math.PI * 2);
    context.fill();
  }

  update() {
    const game = this.game;
    const cache = this.cache;
    const calendar = game.calendar;
    const readout = calendar.readout();
    cache.text(this.caption, readout.caption);
    cache.text(this.big, readout.big);
    // The panel has room for the first words of the line; the atlas prints it whole.
    cache.text(this.line, readout.line.split(/ · |: /)[0]);
    cache.width(this.fill, readout.share);
    cache.toggle(this.root, 'ticking', readout.ticking);
    cache.toggle(this.root, 'totality', calendar.isTotality());
    const cover = game.darkness.readout();
    cache.toggle(this.cover, 'visible', cover !== null);
    if (cover) {
      cache.text(this.cover, cover.hidden ? `◐ ${cover.text}` : `☀ ${cover.text}`);
      cache.toggle(this.cover, 'lit', !cover.hidden);
    }
    const track = calendar.shadowTrack();
    const key = track === null ? 'clear' : track.toFixed(2);
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.drawDisc(track, calendar.darkness());
    }
  }
}
