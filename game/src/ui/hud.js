// The heads-up display: builds every panel (job, crew, eclipse countdown, status, dispatch, vehicle, radar) and runs the pieces
// that belong to no panel: the crew's dialogue ribbon with portraits, banners, notifications, hints and the crosshair.
import { districtNameAt, streetNameAt } from '../world/cityLayout.js';
import { DomCache, createElement } from './domBuilder.js';
import { HudEclipsePanel } from './hudEclipsePanel.js';
import { HudJobPanel } from './hudJobPanel.js';
import { HudStatusPanel } from './hudStatusPanel.js';
import { HudDispatchPanel } from './hudDispatchPanel.js';
import { HudCrewPanel } from './hudCrewPanel.js';
import { HudVehiclePanel } from './hudVehiclePanel.js';
import { HudWeaponBar } from './hudWeaponBar.js';
import { HudFoeBars } from './hudFoeBars.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';
import { speakerJob } from '../missions/storyMissions.js';

/** The HUD SIZE setting: how much each choice enlarges the panels, and whether it keeps only the essentials. */
export const HUD_SIZES = {
  standard: { label: 'STANDARD', scale: 1 },
  large: { label: 'LARGE', scale: 1.2 },
  huge: { label: 'HUGE · ESSENTIALS', scale: 2.5, essentials: true },
};

/** The feed's line for what the radio is playing: the station, its frequency, the track and the artist. */
function radioLine(playing) {
  return `♪ ${playing.station} ${playing.frequency} · ${playing.title} · ${playing.artist}`;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.cache = new DomCache();
    const root = createElement('div', 'hidden', document.body);
    root.id = 'hud';
    this.root = root;
    const left = createElement('div', 'hud-column left-column', root);
    const right = createElement('div', 'hud-column right-column', root);
    const radar = this.buildRadar(root);
    this.jobPanel = new HudJobPanel(game, left, this.cache);
    this.crewPanel = new HudCrewPanel(game, left, this.cache);
    this.buildDialogue(left);
    this.eclipsePanel = new HudEclipsePanel(game, right, this.cache);
    this.statusPanel = new HudStatusPanel(game, right, this.cache, radar);
    this.dispatchPanel = new HudDispatchPanel(game, right, this.cache);
    // Bottom right: the weapon bar, with the car's dial under it at the wheel or the GPS list over it on a quiet walk.
    const corner = createElement('div', 'corner-stack', root);
    this.weaponBar = new HudWeaponBar(game, corner, this.cache);
    this.vehiclePanel = new HudVehiclePanel(game, corner, this.cache);
    this.foeBars = new HudFoeBars(game, root, this.cache);
    this.buildOverlays(root);
    this.speech = [];
    this.speechClock = 0;
    this.bannerClock = 0;
    this.hintText = '';
    this.hintClock = 0;
    this.hitClock = 0;
    this.size = 'standard';
    this.essentials = false;
    // The radio names its next track in the feed as it comes on.
    game.audio.radio.onTrackChange = (playing) => { if (playing && game.player.vehicle) this.notify(radioLine(playing)); };
    this.fitToWindow();
  }

  /**
   * The HUD SIZE setting: 'standard', 'large', or 'huge', which keeps only the essentials (the job and its
   * objective, the stars, the cash, the weapon, the radar and the prompts) and prints them more than twice as big.
   */
  setSize(size) {
    this.size = HUD_SIZES[size] ? size : 'standard';
    this.essentials = Boolean(HUD_SIZES[this.size].essentials);
    this.root.classList.toggle('essentials', this.essentials);
    this.fitToWindow();
  }

  /**
   * The panels are sized in window heights and laid out for a 16:10 frame. In a narrower window the whole HUD
   * shrinks in step, so the columns, the radar and the dialogue box never run into each other; the HUD SIZE setting
   * then enlarges all of it by its own factor.
   */
  fitToWindow() {
    const scale = Math.min(1, window.innerWidth / window.innerHeight / 1.6) * HUD_SIZES[this.size].scale;
    const style = this.root.style;
    style.zoom = String(scale);
    style.right = 'auto';
    style.bottom = 'auto';
    style.width = `${100 / scale}vw`;
    style.height = `${100 / scale}vh`;
  }

  /**
   * The radar block in the bottom-left corner, one frame: the minimap with the district's name across its foot,
   * the street and the clock under it, and room at the bottom for the health and armor bars. Returns the block.
   */
  buildRadar(root) {
    const radar = createElement('div', 'radar', root);
    const frame = createElement('div', 'radar-frame', radar);
    const canvas = createElement('canvas', '', frame);
    canvas.id = 'minimap';
    this.district = createElement('div', 'place-district', frame);
    const place = createElement('div', 'place-line', radar);
    this.street = createElement('span', 'place-street', place);
    this.clock = createElement('b', 'place-clock', place);
    return radar;
  }

  /** The crew's ribbon under the job panel: whoever is talking, their portrait and their line. */
  buildDialogue(column) {
    this.dialogue = createElement('div', 'dialogue', column);
    this.portrait = createElement('canvas', 'dialogue-portrait', this.dialogue);
    this.portrait.width = 96;
    this.portrait.height = 96;
    const text = createElement('div', 'dialogue-text', this.dialogue);
    const who = createElement('div', 'dialogue-who', text);
    this.speaker = createElement('b', 'dialogue-speaker', who);
    this.speakerJob = createElement('span', 'dialogue-job', who);
    this.line = createElement('div', 'dialogue-line', text);
  }

  buildOverlays(root) {
    this.notifications = createElement('div', 'notifications', root);
    this.crosshair = createElement('div', 'crosshair', root);
    this.hintBox = createElement('div', 'hint', root);
    this.hintKey = createElement('b', 'hint-key', this.hintBox);
    this.hintLine = createElement('span', 'hint-line', this.hintBox);
    this.damageFlash = createElement('div', 'damage-flash', root);
    this.bannerBox = createElement('div', 'banner', root);
    this.bannerTitle = createElement('div', 'banner-title', this.bannerBox);
    this.bannerSub = createElement('div', 'banner-sub', this.bannerBox);
    this.downScreen = createElement('div', 'down-screen', document.body);
    this.downTitle = createElement('div', 'down-title', this.downScreen);
    this.downSub = createElement('div', 'down-sub', this.downScreen);
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A short line in the feed at the top of the screen: pickups, purchases, cred, radio chatter. */
  notify(message) {
    const line = createElement('div', 'note', null, message);
    this.notifications.prepend(line);
    while (this.notifications.children.length > 3) this.notifications.lastChild.remove();
    setTimeout(() => line.classList.add('gone'), 3600);
    setTimeout(() => line.remove(), 4300);
  }

  /** The big centred title of a job start, pass or fail. */
  banner(title, subtitle, color) {
    this.bannerTitle.textContent = title;
    this.bannerTitle.style.color = color;
    this.bannerSub.textContent = subtitle;
    this.bannerBox.classList.add('visible');
    this.bannerClock = 4.2;
  }

  /** Queue a line of dialogue; lines play one after another in the dialogue box, each with its speaker's portrait. */
  say(speaker, line, color) {
    this.speech.push({ speaker, line, color });
  }

  clearSpeech() {
    this.speech.length = 0;
    this.speechClock = 0;
    this.dialogue.classList.remove('visible');
  }

  /** A prompt that shows for as long as a system keeps asking for it each frame. */
  hint(message) {
    this.hintText = message;
    this.hintClock = 0.15;
  }

  /** Write a prompt into its box; "Press F to steal the Duna" becomes a key cap F beside STEAL THE DUNA. */
  showHint(message) {
    const cache = this.cache;
    const press = /^Press (\w) (?:to |for )?(.*)$/.exec(message);
    cache.toggle(this.hintBox, 'keyed', Boolean(press));
    cache.text(this.hintKey, press ? press[1] : '');
    cache.text(this.hintLine, press ? press[2].toUpperCase() : message);
  }

  hitMarker() {
    this.hitClock = 0.12;
  }

  showVehicleName(name, kind) {
    this.notify(`${name} · ${kind}`);
  }

  /** R in a car: the feed names the station tuned in, its frequency and the track on air. */
  showRadio() {
    const playing = this.game.audio.radio.nowPlaying();
    this.notify(playing ? radioLine(playing) : '♪ Radio off');
  }

  /** The full-screen card when Nova is taken down or arrested. */
  showDown(title, subtitle) {
    this.downTitle.textContent = title;
    this.downSub.textContent = subtitle;
    this.downScreen.classList.add('visible');
  }

  hideDown() {
    this.downScreen.classList.remove('visible');
  }

  /** Show the next queued line of dialogue when the current one has had its time. */
  advanceDialogue(dt) {
    this.speechClock -= dt;
    if (this.speechClock > 0) return;
    const next = this.speech.shift();
    if (!next) { this.dialogue.classList.remove('visible'); return; }
    drawSpeakerPortrait(this.portrait, next.speaker, next.color);
    this.speaker.textContent = next.speaker;
    this.speaker.style.color = next.color;
    // Who they are to the crew, beside the name: JAZZ · RADIO HACKER.
    this.speakerJob.textContent = speakerJob(next.speaker);
    this.line.textContent = next.line;
    this.dialogue.style.borderColor = next.color;
    this.dialogue.classList.add('visible');
    this.speechClock = 2.2 + next.line.length * 0.045;
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const player = game.player;
    this.jobPanel.update(dt);
    this.eclipsePanel.update(dt);
    this.statusPanel.update(dt);
    this.dispatchPanel.update(dt);
    this.crewPanel.update(dt);
    this.weaponBar.update(dt);
    this.vehiclePanel.update(dt);
    this.foeBars.update(dt);
    cache.text(this.clock, `${game.calendar.dayName()} ${game.calendar.clockText()}`);
    cache.text(this.district, districtNameAt(player.position.x, player.position.z).toUpperCase());
    cache.text(this.street, streetNameAt(player.position.x, player.position.z));

    cache.toggle(this.crosshair, 'visible', !player.vehicle && (player.aiming || game.weapons.current !== 'fists'));
    this.hitClock -= dt;
    cache.toggle(this.crosshair, 'hit', this.hitClock > 0);
    cache.toggle(this.damageFlash, 'visible', player.hurtFlash > 0);
    this.hintClock -= dt;
    cache.toggle(this.hintBox, 'visible', this.hintClock > 0);
    if (this.hintClock > 0) this.showHint(this.hintText);
    if (this.bannerClock > 0) {
      this.bannerClock -= dt;
      if (this.bannerClock <= 0) this.bannerBox.classList.remove('visible');
    }
    this.advanceDialogue(dt);
  }
}
